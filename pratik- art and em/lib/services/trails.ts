import { currentMode, type Mode } from "@/lib/config";
import { getRepos } from "@/lib/repos";
import type { Place, StoryEntry, Trail } from "@/lib/schemas";
import { getVisiblePlaces, getVisibleStories } from "./content";

export type TrailStop = { place: Place; story: StoryEntry | null };

/** Trails come only from content. Samples show only in demo mode; a trail with a hidden stop is hidden. */
export function getVisibleTrails(mode: Mode = currentMode()): Trail[] {
  const visible = new Set(getVisiblePlaces(mode).map((p) => p.id));
  return getRepos()
    .trails.list()
    .filter((t) => (!t.isSample || mode === "demo") && t.placeIds.every((id) => visible.has(id)));
}

export function getTrailWithStops(id: string, mode: Mode = currentMode()): { trail: Trail; stops: TrailStop[] } | undefined {
  const trail = getVisibleTrails(mode).find((t) => t.id === id);
  if (!trail) return undefined;
  const places = new Map(getVisiblePlaces(mode).map((p) => [p.id, p]));
  return {
    trail,
    stops: trail.placeIds.map((pid) => ({ place: places.get(pid)!, story: getVisibleStories(pid, mode)[0] ?? null })),
  };
}
