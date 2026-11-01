import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { getConfig, type Mode } from "../config";
import { openDb, type Db } from "../repos/sqlite";
import { MAX_SECONDS } from "./media";
import { MOCK_STORIES, MOCK_USERS, type StoryUser } from "./mock";

export { MAX_SECONDS };
export const STORY_TTL_MS = 24 * 3600 * 1000;
export const EMOJI = ["😍", "🔥", "👏", "😮", "😂", "🙏"];

export type Projection = "equirect" | "pano" | "flat";
export type Reaction = { by: string; emoji?: string; text?: string; at: string };
/** The shape the story screens already use. */
export type ClientStory = {
  id: string;
  userId: string;
  mediaType: "image" | "video";
  projection: Projection;
  panoDeg?: number;
  src: string;
  poster?: string;
  duration: number;
  trimStart: number;
  caption: string;
  place: string;
  createdAt: string;
  mock?: boolean;
  views: string[];
  reactions: Reaction[];
};

export type StoryRow = {
  id: string;
  author_id: string;
  media_type: "image" | "video";
  projection: Projection;
  pano_deg: number | null;
  media_file: string;
  duration: number;
  trim_start: number;
  caption: string;
  place: string;
  created_at: string;
};

export const uploadDir = () => path.join(getConfig().dataDir, "uploads", "ar-stories");

export function createArStories(db: Db) {
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS ar_stories (
      id TEXT PRIMARY KEY,
      author_id TEXT NOT NULL REFERENCES community_accounts(id) ON DELETE CASCADE,
      media_type TEXT NOT NULL CHECK (media_type IN ('image','video')),
      projection TEXT NOT NULL CHECK (projection IN ('equirect','pano','flat')),
      pano_deg INTEGER,
      media_file TEXT NOT NULL UNIQUE,
      duration REAL NOT NULL CHECK (duration > 0 AND duration <= ${MAX_SECONDS}),
      trim_start REAL NOT NULL DEFAULT 0 CHECK (trim_start >= 0),
      caption TEXT NOT NULL DEFAULT '',
      place TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ar_stories_created ON ar_stories (created_at);
    CREATE INDEX IF NOT EXISTS ar_stories_author ON ar_stories (author_id, created_at);
    CREATE TABLE IF NOT EXISTS ar_story_views (
      story_id TEXT NOT NULL REFERENCES ar_stories(id) ON DELETE CASCADE,
      viewer_id TEXT NOT NULL REFERENCES community_accounts(id) ON DELETE CASCADE,
      viewed_at TEXT NOT NULL,
      PRIMARY KEY (story_id, viewer_id)
    );
    CREATE TABLE IF NOT EXISTS ar_story_reactions (
      id TEXT PRIMARY KEY,
      story_id TEXT NOT NULL REFERENCES ar_stories(id) ON DELETE CASCADE,
      by_id TEXT NOT NULL REFERENCES community_accounts(id) ON DELETE CASCADE,
      emoji TEXT,
      text TEXT,
      created_at TEXT NOT NULL,
      CHECK (emoji IS NOT NULL OR text IS NOT NULL)
    );
    CREATE INDEX IF NOT EXISTS ar_story_reactions_story ON ar_story_reactions (story_id, created_at);
  `);
  const marks = (n: number) => Array(n).fill("?").join(",");
  const cutoff = (now: Date) => new Date(now.getTime() - STORY_TTL_MS).toISOString();

  return {
    newId: () => `s-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`,

    create(id: string, authorId: string, f: { mediaType: "image" | "video"; projection: Projection; panoDeg?: number; mediaFile: string; duration: number; trimStart: number; caption: string; place: string }, now = new Date()): StoryRow {
      db.prepare(
        `INSERT INTO ar_stories (id, author_id, media_type, projection, pano_deg, media_file, duration, trim_start, caption, place, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      ).run(id, authorId, f.mediaType, f.projection, f.projection === "pano" ? (f.panoDeg ?? 360) : null, f.mediaFile, f.duration, f.trimStart, f.caption, f.place, now.toISOString());
      return db.prepare("SELECT * FROM ar_stories WHERE id = ?").get(id) as StoryRow;
    },

    get: (id: string) => db.prepare("SELECT * FROM ar_stories WHERE id = ?").get(id) as StoryRow | undefined,
    byFile: (file: string, now = new Date()) => db.prepare("SELECT * FROM ar_stories WHERE media_file = ? AND created_at > ?").get(file, cutoff(now)) as StoryRow | undefined,
    listActive: (now = new Date()) => db.prepare("SELECT * FROM ar_stories WHERE created_at > ? ORDER BY created_at").all(cutoff(now)) as StoryRow[],
    countSince: (authorId: string, sinceIso: string) => (db.prepare("SELECT COUNT(*) c FROM ar_stories WHERE author_id = ? AND created_at > ?").get(authorId, sinceIso) as { c: number }).c,
    knownFiles: () => new Set((db.prepare("SELECT media_file FROM ar_stories").all() as { media_file: string }[]).map((r) => r.media_file)),

    /** Removes the author's own story. Returns its media file, or null when it is not theirs or does not exist. */
    remove(id: string, authorId: string): string | null {
      const row = db.prepare("SELECT media_file FROM ar_stories WHERE id = ? AND author_id = ?").get(id, authorId) as { media_file: string } | undefined;
      if (!row) return null;
      db.prepare("DELETE FROM ar_stories WHERE id = ?").run(id);
      return row.media_file;
    },

    /** Deletes stories older than 24 hours; returns the media files to remove from disk. */
    purgeExpired(now = new Date()): string[] {
      const old = db.prepare("SELECT id, media_file FROM ar_stories WHERE created_at <= ?").all(cutoff(now)) as { id: string; media_file: string }[];
      for (const r of old) db.prepare("DELETE FROM ar_stories WHERE id = ?").run(r.id);
      return old.map((r) => r.media_file);
    },

    /** Counts a view from a signed-in member other than the author. */
    recordView(storyId: string, viewerId: string, now = new Date()) {
      db.prepare(
        `INSERT OR IGNORE INTO ar_story_views (story_id, viewer_id, viewed_at)
         SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM ar_stories WHERE id = ? AND author_id <> ?)`,
      ).run(storyId, viewerId, now.toISOString(), storyId, viewerId);
    },

    views(ids: string[]): Map<string, string[]> {
      const out = new Map<string, string[]>();
      if (!ids.length) return out;
      for (const r of db.prepare(`SELECT story_id, viewer_id FROM ar_story_views WHERE story_id IN (${marks(ids.length)}) ORDER BY viewed_at`).all(...ids) as { story_id: string; viewer_id: string }[]) {
        out.set(r.story_id, [...(out.get(r.story_id) ?? []), r.viewer_id]);
      }
      return out;
    },

    addReaction(storyId: string, byId: string, r: { emoji?: string; text?: string }, now = new Date()): Reaction | null {
      if (!db.prepare("SELECT 1 FROM ar_stories WHERE id = ?").get(storyId)) return null;
      db.prepare("INSERT INTO ar_story_reactions (id, story_id, by_id, emoji, text, created_at) VALUES (?,?,?,?,?,?)").run(crypto.randomUUID(), storyId, byId, r.emoji ?? null, r.emoji ? null : (r.text ?? null), now.toISOString());
      return { by: byId, ...(r.emoji ? { emoji: r.emoji } : { text: r.text }), at: now.toISOString() };
    },

    reactions(ids: string[]): Map<string, Reaction[]> {
      const out = new Map<string, Reaction[]>();
      if (!ids.length) return out;
      for (const r of db.prepare(`SELECT story_id, by_id, emoji, text, created_at FROM ar_story_reactions WHERE story_id IN (${marks(ids.length)}) ORDER BY created_at`).all(...ids) as { story_id: string; by_id: string; emoji: string | null; text: string | null; created_at: string }[]) {
        out.set(r.story_id, [...(out.get(r.story_id) ?? []), { by: r.by_id, ...(r.emoji ? { emoji: r.emoji } : { text: r.text ?? "" }), at: r.created_at }]);
      }
      return out;
    },

    members(ids: string[]): { id: string; username: string; name: string }[] {
      if (!ids.length) return [];
      return db.prepare(`SELECT id, username, name FROM community_accounts WHERE id IN (${marks(ids.length)})`).all(...ids) as { id: string; username: string; name: string }[];
    },
  };
}

export type ArStories = ReturnType<typeof createArStories>;
let instance: ArStories | undefined;
export const getArStories = () => (instance ??= createArStories(openDb(getConfig().dataDir)));

const PALETTE = ["#b4532a", "#7c3aed", "#0f766e", "#be185d", "#b45309", "#2563eb", "#15803d", "#9333ea"];
const colorFor = (s: string) => PALETTE[[...s].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7) % PALETTE.length];

export function toClientStory(r: StoryRow, views: string[] = [], reactions: Reaction[] = []): ClientStory {
  return {
    id: r.id,
    userId: r.author_id,
    mediaType: r.media_type,
    projection: r.projection,
    ...(r.pano_deg ? { panoDeg: r.pano_deg } : {}),
    src: `/api/ar-stories/media/${r.media_file}`,
    duration: r.duration,
    trimStart: r.trim_start,
    caption: r.caption,
    place: r.place,
    createdAt: r.created_at,
    views,
    reactions,
  };
}

/**
 * What one visitor may see. Members' stories are visible only to signed-in members for 24 hours.
 * Views and replies are visible only to the story's author; everyone else sees just their own.
 * Sample stories show in demo mode only, to everyone.
 */
export function storiesForViewer(viewerId: string | null, mode: Mode, now = new Date()) {
  const store = getArStories();
  const rows = viewerId ? store.listActive(now) : [];
  const ids = rows.map((r) => r.id);
  const views = store.views(ids);
  const reacts = store.reactions(ids);
  const real = rows.map((r) => {
    const mine = r.author_id === viewerId;
    const v = views.get(r.id) ?? [];
    const x = reacts.get(r.id) ?? [];
    return toClientStory(r, mine ? v : v.filter((id) => id === viewerId), mine ? x : x.filter((y) => y.by === viewerId));
  });
  const mock: ClientStory[] =
    mode === "demo"
      ? MOCK_STORIES.map(({ hoursAgo, ...s }) => ({ ...s, trimStart: 0, mock: true, createdAt: new Date(now.getTime() - hoursAgo * 3600e3).toISOString(), views: [], reactions: [] }))
      : [];
  const stories = [...mock, ...real].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const wanted = new Set<string>(viewerId ? [viewerId] : []);
  for (const s of real) {
    wanted.add(s.userId);
    for (const id of s.views) wanted.add(id);
    for (const r of s.reactions) wanted.add(r.by);
  }
  const people: StoryUser[] = store.members([...wanted]).map((m) => ({ id: m.id, name: m.name, handle: m.username, color: colorFor(m.username) }));
  const users = [...MOCK_USERS.filter((u) => mock.some((s) => s.userId === u.id)), ...people];
  return { users, stories, maxSeconds: MAX_SECONDS, me: viewerId };
}

/** Removes expired stories' files, and files left behind with no story (for example after an account was deleted). */
export async function purgeExpired(now = new Date()) {
  const store = getArStories();
  const dir = uploadDir();
  for (const file of store.purgeExpired(now)) await fs.unlink(path.join(dir, path.basename(file))).catch(() => {});
  const known = store.knownFiles();
  for (const file of await fs.readdir(dir).catch(() => [] as string[])) {
    if (known.has(file)) continue;
    const stat = await fs.stat(path.join(dir, file)).catch(() => null);
    if (stat && now.getTime() - stat.mtimeMs > 3600e3) await fs.unlink(path.join(dir, file)).catch(() => {});
  }
}
