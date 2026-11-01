import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkContent } from "@/lib/content-check";
import { getTrailWithStops, getVisibleTrails } from "@/lib/services/trails";
import { place, story, withFixture } from "./helpers";

const trail = (over: object = {}) => ({ id: "t1", title: "T", theme: "Th", placeIds: ["p2", "p1"], approxMinutes: 120, isSample: false, ...over });
const setup = (trails: object[]) => {
  const fx = withFixture({ places: [place({ id: "p1", slug: "p1", typicalVisitMinutes: 30 }), place({ id: "p2", slug: "p2", typicalVisitMinutes: 45 })], stories: [story({ placeId: "p1" })] });
  fs.mkdirSync(path.join(fx.contentDir, "trails"), { recursive: true });
  fs.writeFileSync(path.join(fx.contentDir, "trails", "t.json"), JSON.stringify(trails));
  return fx;
};

describe("heritage trails", () => {
  it("lists stops in content order with each stop's visit duration and its visible story", () => {
    setup([trail()]);
    const data = getTrailWithStops("t1", "live");
    expect(data?.stops.map((s) => [s.place.id, s.place.typicalVisitMinutes])).toEqual([
      ["p2", 45],
      ["p1", 30],
    ]);
    expect(data?.stops[1].story?.placeId).toBe("p1");
    expect(data?.stops[0].story).toBeNull();
  });

  it("content:check fails on an unknown place id", () => {
    const { contentDir, publicDir } = setup([trail({ placeIds: ["p1", "nowhere"] })]);
    expect(checkContent(contentDir, publicDir).errors.join("\n")).toMatch(/Trail "t1" includes unknown place "nowhere"/);
  });

  it("sample trails show only in demo mode", () => {
    setup([trail({ isSample: true })]);
    expect(getVisibleTrails("live")).toEqual([]);
    expect(getVisibleTrails("demo")).toHaveLength(1);
  });

  it("the real content passes the trail checks", () => {
    expect(checkContent(path.resolve("content"), path.resolve("public")).errors).toEqual([]);
  });
});
