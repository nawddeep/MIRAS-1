import { describe, expect, it } from "vitest";
import { earnStamp, validStamps } from "@/lib/passport";

const visible = new Set(["s1", "s2"]);
const now = new Date("2026-10-28T10:00:00.000Z");

describe("heritage passport", () => {
  it("a stamp needs a visible story", () => {
    expect(earnStamp([], { id: "hidden", placeId: "p1" }, visible, "read", now)).toEqual([]);
    expect(earnStamp([], { id: "s1", placeId: "p1" }, visible, "read", now)).toEqual([{ placeId: "p1", storyId: "s1", how: "read", earnedAt: now.toISOString() }]);
  });

  it("one stamp per place; the first is kept", () => {
    const one = earnStamp([], { id: "s1", placeId: "p1" }, visible, "read", now);
    expect(earnStamp(one, { id: "s2", placeId: "p1" }, visible, "listened", now)).toBe(one);
  });

  it("stamps for stories that are no longer visible are not counted", () => {
    const stamps = [
      { placeId: "p1", storyId: "s1", how: "read" as const, earnedAt: now.toISOString() },
      { placeId: "p9", storyId: "gone", how: "read" as const, earnedAt: now.toISOString() },
    ];
    expect(validStamps(stamps, visible).map((s) => s.storyId)).toEqual(["s1"]);
  });
});
