import path from "node:path";
import { getConfig } from "@/lib/config";
import { Artisan, EventItem, MediaAsset, Phrase, Pick, Place, StoryEntry, Trail, Workshop, type Enquiry } from "@/lib/schemas";
import { readEntities, readEntityFile } from "./json";
import { openDb, type Db } from "./sqlite";
import type { Repos } from "./types";

export type { Repos } from "./types";

/**
 * Content JSON is the base layer; SQLite rows with the same id override it.
 * That is how owner edits and voice-onboarded listings live alongside team-supplied content.
 */
export function createRepos(contentDir: string, db: Db): Repos {
  const dir = (name: string) => path.join(contentDir, name);
  const dbRows = <T>(table: string, schema: { parse: (v: unknown) => T }) =>
    (db.prepare(`SELECT data FROM ${table}`).all() as { data: string }[]).map((r) => schema.parse(JSON.parse(r.data)));
  const layered = <T extends { id: string }>(base: T[], overrides: T[]) => {
    const byId = new Map(base.map((x) => [x.id, x]));
    for (const o of overrides) byId.set(o.id, o);
    return [...byId.values()];
  };

  const places = () => readEntities(dir("places"), Place).items;
  const trails = () => readEntities(dir("trails"), Trail).items;
  const artisans = () => layered(readEntities(dir("artisans"), Artisan).items, dbRows("artisans", Artisan));
  const workshops = () => layered(readEntities(dir("workshops"), Workshop).items, dbRows("workshops", Workshop));

  return {
    places: {
      list: places,
      getById: (id) => places().find((p) => p.id === id),
      getBySlug: (slug) => places().find((p) => p.slug === slug),
    },
    trails: {
      list: trails,
      get: (id) => trails().find((t) => t.id === id),
    },
    events: {
      list: () => readEntities(dir("events"), EventItem).items,
    },
    phrases: {
      list: () => readEntityFile(path.join(contentDir, "phrases.json"), Phrase).items,
    },
    stories: {
      listAll: () => readEntities(dir("stories"), StoryEntry).items,
    },
    artisans: {
      list: artisans,
      get: (id) => artisans().find((a) => a.id === id),
      getByEditToken: (token) => artisans().find((a) => a.editToken === token),
      save: (a) => {
        const valid = Artisan.parse(a);
        db.prepare(
          `INSERT INTO artisans (id, edit_token, data, updated_at) VALUES (?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET edit_token = excluded.edit_token, data = excluded.data, updated_at = excluded.updated_at`,
        ).run(valid.id, valid.editToken, JSON.stringify(valid), new Date().toISOString());
      },
    },
    workshops: {
      list: workshops,
      get: (id) => workshops().find((w) => w.id === id),
      save: (w) => {
        const valid = Workshop.parse(w);
        db.prepare(
          `INSERT INTO workshops (id, artisan_id, data, updated_at) VALUES (?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
        ).run(valid.id, valid.artisanId, JSON.stringify(valid), valid.updatedAt);
      },
    },
    enquiries: {
      create: (e) => {
        db.prepare(
          `INSERT INTO enquiries (id, artisan_id, kind, message, contact_back, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
        ).run(e.id, e.artisanId, e.kind, e.message, e.contactBack, e.createdAt);
      },
      listByArtisan: (artisanId) =>
        (
          db
            .prepare(`SELECT * FROM enquiries WHERE artisan_id = ? ORDER BY created_at DESC`)
            .all(artisanId) as Record<string, string>[]
        ).map(
          (r): Enquiry => ({
            id: r.id,
            artisanId: r.artisan_id,
            kind: r.kind as Enquiry["kind"],
            message: r.message,
            contactBack: r.contact_back,
            createdAt: r.created_at,
          }),
        ),
      countByArtisan: () =>
        Object.fromEntries(
          (db.prepare(`SELECT artisan_id, COUNT(*) AS n FROM enquiries GROUP BY artisan_id`).all() as { artisan_id: string; n: number }[]).map(
            (r) => [r.artisan_id, r.n],
          ),
        ),
    },
    picks: {
      list: () => dbRows("picks", Pick).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      get: (id) => dbRows("picks", Pick).find((p) => p.id === id),
      save: (p) => {
        const valid = Pick.parse(p);
        db.prepare(
          `INSERT INTO picks (id, status, data, created_at) VALUES (?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET status = excluded.status, data = excluded.data`,
        ).run(valid.id, valid.status, JSON.stringify(valid), valid.createdAt);
      },
    },
    media: {
      list: () => layered(readEntityFile(path.join(contentDir, "media.json"), MediaAsset).items, dbRows("media_assets", MediaAsset)),
      save: (m) => {
        const valid = MediaAsset.parse(m);
        db.prepare(`INSERT OR REPLACE INTO media_assets (id, data) VALUES (?, ?)`).run(valid.id, JSON.stringify(valid));
      },
    },
  };
}

let repos: Repos | undefined;

export function getRepos(): Repos {
  if (!repos) {
    const cfg = getConfig();
    repos = createRepos(cfg.contentDir, openDb(cfg.dataDir));
  }
  return repos;
}

/** Tests only: swap in repos backed by fixtures and an in-memory DB. */
export function setRepos(next: Repos | undefined) {
  repos = next;
}
