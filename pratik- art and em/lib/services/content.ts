import { currentMode, type Mode } from "@/lib/config";
import { getRepos } from "@/lib/repos";
import type { Place, StoryEntry } from "@/lib/schemas";

/**
 * THE visibility rule. A story is visible only if it is verified (verifiedBy set) and not a sample.
 * In demo mode, sample entries are also visible; the UI always badges them.
 * An unverified, non-sample entry is never visible in any mode.
 */
export function isStoryVisible(story: StoryEntry, mode: Mode): boolean {
  if (story.isSample) return mode === "demo";
  return Boolean(story.verifiedBy?.trim() && story.verifiedAt);
}

/** The only way any screen or AI feature may read stories. */
export function getVisibleStories(placeId: string, mode: Mode = currentMode()): StoryEntry[] {
  return getRepos()
    .stories.listAll()
    .filter((s) => s.placeId === placeId && isStoryVisible(s, mode));
}

export function isPlaceVisible(place: Place, mode: Mode): boolean {
  return place.status === "published" && (!place.isSample || mode === "demo");
}

export function getVisiblePlaces(mode: Mode = currentMode()): Place[] {
  return getRepos()
    .places.list()
    .filter((p) => isPlaceVisible(p, mode));
}

export function getVisiblePlaceBySlug(slug: string, mode: Mode = currentMode()): Place | undefined {
  const place = getRepos().places.getBySlug(slug);
  return place && isPlaceVisible(place, mode) ? place : undefined;
}

const norm = (s: string) => s.toLocaleLowerCase().normalize("NFKC");
const matches = (q: string, ...fields: (string | undefined)[]) => fields.some((f) => f && norm(f).includes(q));

export function filterPlaces(places: Place[], query = "", category = ""): Place[] {
  const q = norm(query.trim());
  return places.filter(
    (p) => (!category || p.category === category) && (!q || matches(q, p.name, p.name_hi, p.summary, p.summary_hi, p.category)),
  );
}

/** Search over visible stories only. Returns nothing (→ "I don't know") rather than guessing. */
export function searchVisibleStories(query: string, mode: Mode = currentMode()): { story: StoryEntry; place: Place }[] {
  const q = norm(query.trim());
  if (!q) return [];
  return getVisiblePlaces(mode).flatMap((place) =>
    getVisibleStories(place.id, mode)
      .filter((s) => matches(q, s.title, s.title_hi, s.text, s.text_hi))
      .map((story) => ({ story, place })),
  );
}
