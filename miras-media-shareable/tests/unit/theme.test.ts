import { describe, expect, it } from "vitest";
import { readMinutes } from "@/lib/read-time";
import { parseHourParam, sceneFor, timeOfDay } from "@/lib/time-of-day";

describe("time of day", () => {
  it("switches at the edge hours 5, 10, 16 and 19", () => {
    expect([4, 5, 9, 10, 15, 16, 18, 19, 23, 0].map(timeOfDay)).toEqual([
      "night",
      "dawn",
      "dawn",
      "day",
      "day",
      "golden",
      "golden",
      "night",
      "night",
      "night",
    ]);
  });

  it("day uses its own neutral scene", () => {
    expect(sceneFor("day")).toBe("day");
    expect(sceneFor("golden")).toBe("golden");
  });

  it("accepts only ?hour=0..23", () => {
    expect(["7", "17", "22", "0", "23"].map(parseHourParam)).toEqual([7, 17, 22, 0, 23]);
    expect(["24", "-1", "7.5", "x", "", null].map(parseHourParam)).toEqual([null, null, null, null, null, null]);
  });
});

describe("read time", () => {
  it("is ceil(words / 200) minutes and at least 1", () => {
    expect(readMinutes("")).toBe(1);
    expect(readMinutes("one two three")).toBe(1);
    expect(readMinutes(Array(200).fill("w").join(" "))).toBe(1);
    expect(readMinutes(Array(201).fill("w").join(" "))).toBe(2);
    expect(readMinutes(Array(450).fill("w").join("  \n"))).toBe(3);
  });
});
