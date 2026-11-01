import { describe, expect, it } from "vitest";
import { checkContent } from "@/lib/content-check";
import { distanceKm, placeholderCoordinateIds, planDay, type PlannerPlace } from "@/lib/planner";
import { place, withFixture } from "./helpers";

// Synthetic test places about 1 km apart. Not real Udaipur data.
const p = (id: string, over: Partial<PlannerPlace> = {}): PlannerPlace => ({
  id,
  name: id.toUpperCase(),
  lat: 24.5 + Number(id.slice(1)) * 0.009,
  lng: 73.7,
  typicalVisitMinutes: 60,
  openingTimes: { open: "09:00", close: "17:00", closedDays: [] },
  placeholderCoords: false,
  ...over,
});
const base = { startTime: "09:00", dayMinutes: 8 * 60, mode: "walk" as const, weekday: "tue" as const };

describe("trip planner", () => {
  it("orders places, adds estimated travel, and stays within hours and day length", () => {
    const r = planDay({ ...base, places: [p("p1"), p("p2"), p("p3")] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.stops.map((s) => s.placeId)).toHaveLength(3);
    expect(r.stops[0]).toMatchObject({ arrive: "09:00", leave: "10:00", travelMinutes: 0 });
    expect(r.stops[1].travelMinutes).toBeGreaterThan(0);
    expect(r.endsAt <= "17:00").toBe(true);
  });

  it("waits for opening time and never schedules a closed place", () => {
    const r = planDay({ ...base, places: [p("p1", { openingTimes: { open: "11:00", close: "12:30", closedDays: [] } })] });
    expect(r.ok && r.stops[0]).toMatchObject({ arrive: "11:00", leave: "12:00" });

    const late = planDay({ ...base, startTime: "16:30", places: [p("p1")] });
    expect(late.ok && late.stops).toEqual([]);
    expect(late.ok && late.skipped[0].reason).toMatch(/Closed/);
  });

  it("skips a place closed on the chosen weekday", () => {
    const r = planDay({ ...base, places: [p("p1", { openingTimes: { open: "09:00", close: "17:00", closedDays: ["tue"] } })] });
    expect(r.ok && r.skipped[0].reason).toBe("Closed on that day");
  });

  it("never exceeds the chosen day length", () => {
    const r = planDay({ ...base, dayMinutes: 150, places: [p("p1"), p("p2"), p("p3")] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.stops.length).toBe(2);
    expect(r.endsAt <= "11:30").toBe(true);
    expect(r.skipped[0].reason).toBe("Does not fit in your day length");
  });

  it("refuses to plan and names what is missing instead of guessing", () => {
    const r = planDay({ ...base, places: [p("p1", { openingTimes: undefined })] });
    expect(r).toEqual({ ok: false, problems: [{ placeId: "p1", name: "P1", problem: "Missing opening times" }] });
  });

  it("refuses placeholder coordinates with 'Needs real coordinates'", () => {
    const r = planDay({ ...base, places: [p("p1", { placeholderCoords: true })] });
    expect(r.ok === false && r.problems[0].problem).toBe("Needs real coordinates");
  });

  it("detects places sharing identical coordinates", () => {
    const ids = placeholderCoordinateIds([
      { id: "a", lat: 1, lng: 2 },
      { id: "b", lat: 1, lng: 2 },
      { id: "c", lat: 3, lng: 4 },
    ]);
    expect([...ids].sort()).toEqual(["a", "b"]);
  });

  it("distance is straight-line (haversine)", () => {
    expect(distanceKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111.2, 0);
  });

  it("content:check warns about shared coordinates", () => {
    const { contentDir, publicDir } = withFixture({ places: [place({ id: "a", slug: "a" }), place({ id: "b", slug: "b" })] });
    const r = checkContent(contentDir, publicDir);
    expect(r.errors).toEqual([]);
    expect(r.warnings.join("\n")).toMatch(/share identical coordinates.*a, b/);
  });
});
