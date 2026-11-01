import path from "node:path";
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { checkContent } from "@/lib/content-check";
import { artisan, place, story, withFixture } from "./helpers";

const photo = "/media/a.jpg";
const rights = { id: "m-a", path: photo, owner: "Team", permittedUse: "listing", licenceNote: "", containsPeople: false };
const check = (f: Parameters<typeof withFixture>[0]) => {
  const { contentDir, publicDir } = withFixture(f);
  return checkContent(contentDir, publicDir);
};

describe("content:check", () => {
  it("passes clean content", () => {
    const r = check({ places: [place({ photos: [photo] })], stories: [story()], media: [rights], publicFiles: ["media/a.jpg"] });
    expect(r.errors).toEqual([]);
  });

  it("fails on a schema error with the file and field", () => {
    const r = check({ places: [place()], stories: [{ ...story(), sourceType: "rumour" }] });
    expect(r.errors.join("\n")).toMatch(/stories[\\/]fixture\.json \[0\]: sourceType/);
  });

  it("fails on a history story without a source reference", () => {
    const r = check({ places: [place()], stories: [story({ sourceType: "history", sourceRef: undefined })] });
    expect(r.errors.join("\n")).toMatch(/sourceRef is required/);
  });

  it("fails on a published artisan without consent", () => {
    const r = check({ artisans: [artisan({ status: "published", ownerConfirmedAt: "2026-10-27T10:00:00.000Z" })] });
    expect(r.errors.join("\n")).toMatch(/Artisan "a1" is published but: consent not given/);
  });

  it("fails on a media file with no rights entry", () => {
    const r = check({ media: [], publicFiles: ["media/unlisted.jpg"] });
    expect(r.errors.join("\n")).toMatch(/\/media\/unlisted\.jpg has no rights entry/);
  });

  it("fails when a place uses a photo with no rights entry", () => {
    const r = check({ places: [place({ photos: ["/media/missing.jpg"] })] });
    expect(r.errors.join("\n")).toMatch(/place "p1" uses \/media\/missing\.jpg/);
  });

  it("fails when an artisan photo is marked as showing people", () => {
    const r = check({ artisans: [artisan({ photos: [photo] })], media: [{ ...rights, containsPeople: true }], publicFiles: ["media/a.jpg"] });
    expect(r.errors.join("\n")).toMatch(/showing people/);
  });

  it("lists every sample and unverified item", () => {
    const r = check({
      places: [place({ isSample: true })],
      stories: [story({ id: "s-sample", isSample: true }), story({ id: "s-unverified", verifiedBy: undefined, verifiedAt: undefined })],
    });
    expect(r.todo.map((t) => t.id).sort()).toEqual(["p1", "s-sample", "s-unverified"]);
  });

  it("the real /content folder passes", () => {
    const r = checkContent(path.resolve("content"), path.resolve("public"));
    expect(r.errors).toEqual([]);
  });

  it("rejects a curated location that points to an unknown place", () => {
    const { contentDir, publicDir } = withFixture({ places: [place()] });
    fs.writeFileSync(path.join(contentDir, "hidden-locations.json"), JSON.stringify([{ id: "h1", placeId: "missing", note: "Access needs checking", sensitive: false }]));
    expect(checkContent(contentDir, publicDir).errors.join("\n")).toContain('Hidden location "h1" points to unknown place "missing"');
  });

  it("rejects badge criteria with a nonpositive milestone", () => {
    const { contentDir, publicDir } = withFixture({});
    fs.writeFileSync(path.join(contentDir, "badges.json"), JSON.stringify([{ id: "b1", title: "First trip", description: "Complete a trip", metric: "completedTrips", threshold: 0, status: "definition-only" }]));
    expect(checkContent(contentDir, publicDir).errors.join("\n")).toMatch(/badges.json.*threshold/);
  });
});
