import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCommunity, getCommunity } from "@/lib/community/store";
import { detectMedia } from "@/lib/ar-stories/media";
import { createArStories, getArStories, storiesForViewer, STORY_TTL_MS } from "@/lib/ar-stories/store";
import { openDb } from "@/lib/repos/sqlite";

const bytes = (...parts: (string | number[])[]) => Uint8Array.from(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)));
const PW = "a-long-test-password-1";
const photo = { mediaType: "image" as const, projection: "equirect" as const, mediaFile: "", duration: 10, trimStart: 0, caption: "", place: "" };

describe("file type detection (from the bytes, not the claimed type)", () => {
  it("accepts the supported photo and video formats", () => {
    expect(detectMedia(bytes([0xff, 0xd8, 0xff, 0xe0]))).toEqual({ ext: "jpg", mediaType: "image" });
    expect(detectMedia(bytes([0x89], "PNG", [0x0d, 0x0a, 0x1a, 0x0a]))).toEqual({ ext: "png", mediaType: "image" });
    expect(detectMedia(bytes("RIFF", [0, 0, 0, 0], "WEBP"))).toEqual({ ext: "webp", mediaType: "image" });
    expect(detectMedia(bytes([0, 0, 0, 24], "ftypisom"))).toEqual({ ext: "mp4", mediaType: "video" });
    expect(detectMedia(bytes([0, 0, 0, 20], "ftypqt  "))).toEqual({ ext: "mov", mediaType: "video" });
    expect(detectMedia(bytes([0x1a, 0x45, 0xdf, 0xa3, 1, 2]))).toEqual({ ext: "webm", mediaType: "video" });
  });

  it("rejects everything else, however it is named", () => {
    for (const evil of [bytes("<html><script>alert(1)</script>"), bytes("GIF89a....."), bytes("MZ", [0x90, 0, 3, 0, 0, 0, 4, 0]), bytes("#!/bin/sh\nrm -rf /"), bytes([]), bytes([0xff, 0xd8])]) {
      expect(detectMedia(evil)).toBeNull();
    }
  });
});

describe("story store", () => {
  const db = openDb(":memory:");
  const community = createCommunity(db);
  const store = createArStories(db);
  const make = async (name: string) => (await community.register(name, `Name ${name}`, PW)).user;

  it("lists only stories younger than 24 hours and purges the rest", async () => {
    const a = await make("author_a");
    const now = new Date("2026-11-02T12:00:00Z");
    store.create("s-old", a.id, { ...photo, mediaFile: "s-old.jpg" }, new Date(now.getTime() - STORY_TTL_MS - 60_000));
    store.create("s-new", a.id, { ...photo, mediaFile: "s-new.jpg" }, new Date(now.getTime() - 3600_000));
    expect(store.listActive(now).map((s) => s.id)).toEqual(["s-new"]);
    expect(store.purgeExpired(now)).toEqual(["s-old.jpg"]);
    expect(store.get("s-old")).toBeUndefined();
  });

  it("lets only the author delete, and counts a view only from someone else", async () => {
    const a = await make("owner_b");
    const b = await make("viewer_b");
    store.create("s-own", a.id, { ...photo, mediaFile: "s-own.jpg" });
    expect(store.remove("s-own", b.id)).toBeNull();
    store.recordView("s-own", a.id);
    store.recordView("s-own", b.id);
    store.recordView("s-own", b.id);
    expect(store.views(["s-own"]).get("s-own")).toEqual([b.id]);
    expect(store.remove("s-own", a.id)).toBe("s-own.jpg");
    expect(store.get("s-own")).toBeUndefined();
  });

  it("refuses an out-of-range duration at the database level", async () => {
    const a = await make("owner_c");
    expect(() => store.create("s-long", a.id, { ...photo, mediaFile: "s-long.jpg", duration: 61 })).toThrow(/constraint/i);
  });
});

describe("who can see what", () => {
  let dir: string;
  const previous = process.env.MIRAS_DATA_DIR;
  const ids: Record<string, string> = {};
  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "miras-stories-"));
    process.env.MIRAS_DATA_DIR = dir;
    for (const n of ["alice_s", "bob_s", "carol_s"]) ids[n] = (await getCommunity().register(n, `Name ${n}`, PW)).user.id;
    const store = getArStories();
    store.create("s-alice", ids.alice_s, { ...photo, mediaFile: "s-alice.jpg" });
    store.recordView("s-alice", ids.bob_s);
    store.recordView("s-alice", ids.carol_s);
    store.addReaction("s-alice", ids.bob_s, { emoji: "🔥" });
    store.addReaction("s-alice", ids.carol_s, { text: "Lovely" });
  });
  afterAll(() => {
    if (previous === undefined) delete process.env.MIRAS_DATA_DIR;
    else process.env.MIRAS_DATA_DIR = previous;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("shows signed-out visitors only the samples, and nothing in live mode", () => {
    expect(storiesForViewer(null, "demo").stories.every((s) => s.mock)).toBe(true);
    expect(storiesForViewer(null, "demo").stories.length).toBeGreaterThan(0);
    expect(storiesForViewer(null, "live").stories).toEqual([]);
  });

  it("shows members' stories to signed-in members, and samples only in demo mode", () => {
    expect(storiesForViewer(ids.bob_s, "live").stories.map((s) => s.id)).toEqual(["s-alice"]);
    expect(storiesForViewer(ids.bob_s, "demo").stories.some((s) => s.mock)).toBe(true);
  });

  it("gives the author the full list of viewers and replies", () => {
    const story = storiesForViewer(ids.alice_s, "live").stories[0];
    expect([...story.views].sort()).toEqual([ids.bob_s, ids.carol_s].sort());
    expect(story.reactions).toHaveLength(2);
  });

  it("gives everyone else only their own view and reply", () => {
    const story = storiesForViewer(ids.bob_s, "live").stories[0];
    expect(story.views).toEqual([ids.bob_s]);
    expect(story.reactions).toEqual([expect.objectContaining({ by: ids.bob_s, emoji: "🔥" })]);
  });
});

describe("source safety", () => {
  const files = ["app/api/ar-stories/route.ts", "app/api/ar-stories/[id]/route.ts", "app/api/ar-stories/[id]/react/route.ts", "app/api/ar-stories/media/[name]/route.ts"];

  it("requires a signed-in member for every route that writes or serves member media", () => {
    for (const f of files) expect(fs.readFileSync(f, "utf8"), f).toMatch(/requireMember\(\)/);
  });

  it("no longer trusts a user id sent by the browser, and has no demo-user switcher", () => {
    const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
    const code = ["app/api/ar-stories", "components/ar-stories", "lib/ar-stories"].flatMap(walk).filter((f) => /\.(js|ts|tsx)$/.test(f));
    for (const f of code) {
      const text = fs.readFileSync(f, "utf8");
      expect(text, f).not.toMatch(/form\.get\(["']userId["']\)|body\.userId|Viewing as|miras-stories-me|\/api\/stories/);
    }
  });
});
