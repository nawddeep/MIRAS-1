// Heritage passport. Pure functions; stamps live in the visitor's browser only.
// A stamp means "you opened this place's story and read or listened to it". It is not location-verified.

export type Stamp = { placeId: string; storyId: string; how: "read" | "listened"; earnedAt: string };

/** Adds a stamp only for a currently visible story, one per place (the first one is kept). */
export function earnStamp(stamps: Stamp[], story: { id: string; placeId: string }, visibleStoryIds: ReadonlySet<string>, how: Stamp["how"], now = new Date()): Stamp[] {
  if (!visibleStoryIds.has(story.id)) return stamps;
  if (stamps.some((s) => s.placeId === story.placeId)) return stamps;
  return [...stamps, { placeId: story.placeId, storyId: story.id, how, earnedAt: now.toISOString() }];
}

/** Drops stamps whose story is no longer visible (for example a sample story outside demo mode). */
export const validStamps = (stamps: Stamp[], visibleStoryIds: ReadonlySet<string>) => stamps.filter((s) => visibleStoryIds.has(s.storyId));

const KEY = "miras-passport-v1";

export function loadStamps(): Stamp[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function saveStamps(stamps: Stamp[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(stamps));
  } catch {
    // Storage blocked: stamps work for this visit only.
  }
}
