import { describe, expect, it } from "vitest";
import { getVisibleStories, isStoryVisible, searchVisibleStories } from "@/lib/services/content";
import { place, story, withFixture } from "./helpers";

const verified = story({ id: "verified", text: "needle verified" });
const unverified = story({ id: "unverified", text: "needle unverified", verifiedBy: undefined, verifiedAt: undefined });
const sample = story({ id: "sample", text: "needle sample", isSample: true, verifiedBy: undefined, verifiedAt: undefined });

describe("story visibility", () => {
  it("live mode shows only verified, non-sample stories", () => {
    withFixture({ places: [place()], stories: [verified, unverified, sample] });
    expect(getVisibleStories("p1", "live").map((s) => s.id)).toEqual(["verified"]);
  });

  it("demo mode adds samples but never an unverified, non-sample story", () => {
    withFixture({ places: [place()], stories: [verified, unverified, sample] });
    const ids = getVisibleStories("p1", "demo").map((s) => s.id);
    expect(ids).toContain("verified");
    expect(ids).toContain("sample");
    expect(ids).not.toContain("unverified");
  });

  it("treats a blank verifiedBy as unverified", () => {
    expect(isStoryVisible(story({ verifiedBy: "   " }), "live")).toBe(false);
  });

  it("search only returns visible stories", () => {
    withFixture({ places: [place()], stories: [verified, unverified, sample] });
    expect(searchVisibleStories("needle", "live").map((r) => r.story.id)).toEqual(["verified"]);
    expect(searchVisibleStories("needle", "demo").map((r) => r.story.id).sort()).toEqual(["sample", "verified"]);
  });

  it("search returns nothing (the I-don't-know case) when no visible story matches", () => {
    withFixture({ places: [place()], stories: [unverified] });
    expect(searchVisibleStories("needle", "live")).toEqual([]);
    expect(searchVisibleStories("needle", "demo")).toEqual([]);
  });

  it("rejects a history story without a source reference", () => {
    withFixture({ places: [place()], stories: [story({ id: "h", sourceType: "history", sourceRef: undefined })] });
    expect(getVisibleStories("p1", "live")).toEqual([]);
  });
});
