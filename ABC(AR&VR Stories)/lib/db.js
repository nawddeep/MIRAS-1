// Tiny JSON-file store for the prototype: uploaded stories live in data/db.json and their media in
// data/uploads/. Swap for a real database + object storage (S3, GCS...) in production.
import fs from 'node:fs/promises';
import path from 'node:path';
import { MOCK_REACTIONS, MOCK_STORIES, MOCK_VIEWS, USERS } from './mock';

export const DATA_DIR = path.join(process.cwd(), 'data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');
export const STORY_TTL_MS = 24 * 3600 * 1000;
export const MAX_SECONDS = 60;

let queue = Promise.resolve(); // serialise writes

async function read() {
  try {
    return JSON.parse(await fs.readFile(DB_FILE, 'utf8'));
  } catch {
    return { stories: [], views: {}, reactions: {} };
  }
}
async function write(db) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${DB_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2));
  await fs.rename(tmp, DB_FILE);
}
export function mutate(fn) {
  queue = queue.then(async () => { const db = await read(); const out = await fn(db); await write(db); return out; });
  return queue;
}

/** All active (< 24 h old) stories, mock + uploaded, with views and reactions. */
export async function listStories() {
  const db = await read();
  const now = Date.now();
  const mock = MOCK_STORIES.map(({ hoursAgo, ...s }) => ({ ...s, mock: true, createdAt: new Date(now - hoursAgo * 3600e3).toISOString() }));
  const mockReactions = Object.fromEntries(Object.entries(MOCK_REACTIONS).map(([k, list]) => [k, list.map((r) => ({ ...r, at: new Date(now - r.at * 3600e3).toISOString() }))]));
  const all = [...mock, ...db.stories].filter((s) => now - new Date(s.createdAt).getTime() < STORY_TTL_MS);
  return all
    .map((s) => ({
      ...s,
      views: [...new Set([...(MOCK_VIEWS[s.id] || []), ...(db.views[s.id] || [])])],
      reactions: [...(mockReactions[s.id] || []), ...(db.reactions[s.id] || [])],
    }))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

export async function getStory(id) {
  return (await listStories()).find((s) => s.id === id) || null;
}

export const isUser = (id) => USERS.some((u) => u.id === id);
