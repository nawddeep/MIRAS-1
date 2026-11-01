// Trip planner. Pure functions only (runs in the browser and in tests).
// Uses only lat/lng, typicalVisitMinutes and openingTimes from content. Travel time is an estimate:
// straight-line distance at a stated speed. No maps API.

import type { OpeningTimes } from "@/lib/schemas";
import { WEEKDAYS } from "@/lib/schemas";

export const SPEED_KMH = { walk: 4.5, drive: 20 } as const;
export type TravelMode = keyof typeof SPEED_KMH;

export type PlannerPlace = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  typicalVisitMinutes: number;
  openingTimes?: OpeningTimes;
  placeholderCoords: boolean;
};

export type PlanInput = {
  places: PlannerPlace[];
  startTime: string; // HH:MM
  dayMinutes: number;
  mode: TravelMode;
  weekday: (typeof WEEKDAYS)[number];
};

export type Stop = { placeId: string; name: string; arrive: string; leave: string; travelMinutes: number };
export type PlanResult =
  | { ok: true; stops: Stop[]; skipped: { placeId: string; name: string; reason: string }[]; endsAt: string }
  | { ok: false; problems: { placeId: string; name: string; problem: string }[] };

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const toHHMM = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const travelMinutes = (a: PlannerPlace, b: PlannerPlace, mode: TravelMode) => Math.ceil((distanceKm(a, b) / SPEED_KMH[mode]) * 60);

/** Ids of places whose coordinates are shared with another place: a sign they are placeholders. */
export function placeholderCoordinateIds(places: { id: string; lat: number; lng: number }[]): Set<string> {
  const byKey = new Map<string, string[]>();
  for (const p of places) {
    const key = `${p.lat},${p.lng}`;
    byKey.set(key, [...(byKey.get(key) ?? []), p.id]);
  }
  return new Set([...byKey.values()].filter((ids) => ids.length > 1).flat());
}

/**
 * Orders the chosen places greedily (earliest possible next visit that still fits).
 * Never schedules a visit outside opening hours and never runs past the day length.
 * Refuses to plan, and says why, when coordinates or opening times are missing or placeholders.
 */
export function planDay(input: PlanInput): PlanResult {
  const problems = input.places.flatMap((p) => [
    ...(p.placeholderCoords ? [{ placeId: p.id, name: p.name, problem: "Needs real coordinates" }] : []),
    ...(!p.openingTimes ? [{ placeId: p.id, name: p.name, problem: "Missing opening times" }] : []),
  ]);
  if (problems.length) return { ok: false, problems };

  const dayEnd = toMin(input.startTime) + input.dayMinutes;
  const skipped: { placeId: string; name: string; reason: string }[] = [];
  let remaining = input.places.filter((p) => {
    const closed = p.openingTimes!.closedDays.includes(input.weekday);
    if (closed) skipped.push({ placeId: p.id, name: p.name, reason: "Closed on that day" });
    return !closed;
  });

  const stops: Stop[] = [];
  let now = toMin(input.startTime);
  let here: PlannerPlace | undefined;
  const option = (p: PlannerPlace) => {
    const travel = here ? travelMinutes(here, p, input.mode) : 0;
    const arrive = Math.max(now + travel, toMin(p.openingTimes!.open));
    const leave = arrive + p.typicalVisitMinutes;
    return { p, travel, arrive, leave, closesFirst: leave > toMin(p.openingTimes!.close), dayOver: leave > dayEnd };
  };

  for (;;) {
    const next = remaining
      .map(option)
      .filter((o) => !o.closesFirst && !o.dayOver)
      .sort((a, b) => a.arrive - b.arrive)[0];
    if (!next) break;
    stops.push({ placeId: next.p.id, name: next.p.name, arrive: toHHMM(next.arrive), leave: toHHMM(next.leave), travelMinutes: next.travel });
    now = next.leave;
    here = next.p;
    remaining = remaining.filter((p) => p !== next.p);
  }
  for (const o of remaining.map(option)) {
    skipped.push({ placeId: o.p.id, name: o.p.name, reason: o.closesFirst ? "Closed by the time you could visit" : "Does not fit in your day length" });
  }
  return { ok: true, stops, skipped, endsAt: toHHMM(now) };
}
