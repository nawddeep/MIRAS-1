import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

type Db = typeof import("@/lib/media-social/db");
type Storage = typeof import("@/lib/media-social/storage");

const PW = "a-long-test-password-1";
const bytes = (...parts: (string | number[])[]) => Uint8Array.from(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)));
const jpeg = () => new File([bytes([0xff, 0xd8, 0xff, 0xe0], "JFIF-body-bytes")], "holiday.jpg", { type: "image/jpeg" });

let dir: string;
let db: Db;
let storage: Storage;
const previous = process.env.MIRAS_DATA_DIR;
const ids: Record<string, string> = {};
const post = (userId: string, caption: string, extra: Partial<Parameters<Db["createMediaPost"]>[0]> = {}) =>
  db.createMediaPost({ userId, username: userId, userName: userId, mediaType: "photo", mediaUrl: "/media/places/city-palace-1.webp", caption, ...extra });

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "miras-media-"));
  process.env.MIRAS_DATA_DIR = dir;
  const { getCommunity } = await import("@/lib/community/store");
  for (const n of ["maya_m", "nikhil_m", "olga_m"]) ids[n] = (await getCommunity().register(n, `Name ${n}`, PW)).user.id;
  db = await import("@/lib/media-social/db");
  storage = await import("@/lib/media-social/storage");
  for (const n of Object.keys(ids)) db.ensureMediaProfile(ids[n], n, `Name ${n}`);
});

afterAll(() => {
  if (previous === undefined) delete process.env.MIRAS_DATA_DIR;
  else process.env.MIRAS_DATA_DIR = previous;
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("who can see which posts", () => {
  it("shows the sample creators in demo mode only", () => {
    expect(db.queryFeed(undefined, { demo: true }).total).toBeGreaterThanOrEqual(5);
    expect(db.queryFeed(undefined, { demo: false }).total).toBe(0);
    expect(db.queryFeed(ids.maya_m, { demo: false }).posts.some((p) => db.isSeedUser(p.userId))).toBe(false);
    expect(db.queryReels(undefined, 30, true).every((r) => r.mediaType === "reel")).toBe(true);
  });

  it("shows members' posts to signed-in members, never to signed-out visitors", () => {
    const id = post(ids.maya_m, "Sunrise over the ghat #Udaipur");
    expect(db.getPost(id, ids.nikhil_m)?.caption).toContain("Sunrise");
    expect(db.getPost(id, undefined, true)).toBeNull();
    expect(db.queryFeed(undefined, { demo: true }).posts.some((p) => p.id === id)).toBe(false);
  });

  it("hides a private author's posts from everyone but the author and followers", () => {
    db.upsertMediaUserProfile({ userId: ids.olga_m, username: "olga_m", displayName: "Olga", privacy: "private" });
    const id = post(ids.olga_m, "Private lake walk");
    expect(db.getPost(id, ids.nikhil_m)).toBeNull();
    expect(db.getPost(id, ids.olga_m)).not.toBeNull();
    db.toggleMediaFollow(ids.nikhil_m, ids.olga_m);
    expect(db.getPost(id, ids.nikhil_m)).not.toBeNull();
    expect(db.getMediaUserProfile("olga_m", ids.maya_m)?.posts).toEqual([]);
  });

  it("does not show sample profiles outside demo mode, or any profile to visitors", () => {
    expect(db.getMediaUserProfile("aarav_explores", ids.maya_m, false)).toBeNull();
    expect(db.getMediaUserProfile("aarav_explores", ids.maya_m, true)?.userId).toBe("user-aarav");
    expect(db.getMediaUserProfile("maya_m", undefined, true)).toBeNull();
    expect(db.isFollowable("user-aarav", false)).toBe(false);
  });

  it("treats % and _ in a search as plain characters", () => {
    post(ids.maya_m, "Sale 100% off");
    post(ids.maya_m, "Plain caption without symbols");
    const hits = db.queryFeed(ids.maya_m, { searchQuery: "%" }).posts.map((p) => p.caption);
    expect(hits).toEqual(["Sale 100% off"]);
  });
});

describe("deleting", () => {
  it("lets only the author delete a post, and returns the uploaded file to remove", () => {
    const file = "abc123-0123456789abcdef.jpg";
    const id = post(ids.maya_m, "With a file", { mediaUrl: `/api/media-social/file/${file}` });
    db.toggleMediaLike(ids.nikhil_m, id);
    db.addMediaComment(id, ids.nikhil_m, "nikhil_m", "Nikhil", null, "Lovely");
    expect(db.canSeeUploadedFile(file, { viewerId: ids.nikhil_m, demo: false })).toBe(true);
    expect(db.canSeeUploadedFile(file, { viewerId: undefined, demo: true })).toBe(false);
    expect(db.deleteMediaPost(id, ids.nikhil_m)).toBeNull();
    expect(db.deleteMediaPost(id, ids.maya_m)).toEqual([file]);
    expect(db.getPost(id, ids.maya_m)).toBeNull();
    expect(db.getMediaComments(id)).toEqual([]);
    expect(db.canSeeUploadedFile(file, { viewerId: ids.nikhil_m, demo: false })).toBe(false);
  });

  it("removes everything a member made when their account is deleted", () => {
    const id = post(ids.nikhil_m, "Goes away", { mediaUrl: "/api/media-social/file/zz9-aaaaaaaaaaaaaaaa.png" });
    db.toggleMediaFollow(ids.nikhil_m, ids.maya_m);
    db.toggleMediaLike(ids.nikhil_m, post(ids.maya_m, "Maya's post"));
    expect(db.deleteMediaDataForUser(ids.nikhil_m)).toEqual(["zz9-aaaaaaaaaaaaaaaa.png"]);
    expect(db.getPost(id, ids.maya_m)).toBeNull();
    expect(db.getMediaUserProfile("nikhil_m", ids.maya_m)).toBeNull();
    expect(db.getFollowList(ids.maya_m, "followers")).toEqual([]);
  });
});

describe("uploads", () => {
  it("names the file from its own bytes, never from the browser's claim or the file name", async () => {
    const saved = await storage.saveUpload(new File([jpeg()], "evil.html", { type: "text/html" }));
    expect(saved.name).toMatch(storage.FILE_NAME);
    expect(saved.name.endsWith(".jpg")).toBe(true);
    expect(saved.mediaType).toBe("image");
    expect(fs.existsSync(path.join(storage.uploadDir(), saved.name))).toBe(true);
    await storage.removeUploads([saved.name]);
    expect(fs.existsSync(path.join(storage.uploadDir(), saved.name))).toBe(false);
  });

  it("refuses HTML, scripts and GIFs even when they claim to be images", async () => {
    for (const evil of [bytes("<html><script>alert(1)</script>"), bytes("GIF89a....."), bytes("#!/bin/sh\nrm -rf /")]) {
      await expect(storage.saveUpload(new File([evil], "photo.jpg", { type: "image/jpeg" }))).rejects.toMatchObject({ status: 415 });
    }
    await expect(storage.saveUpload(new File([], "empty.jpg", { type: "image/jpeg" }))).rejects.toMatchObject({ status: 400 });
  });

  it("only removes file names this module wrote", async () => {
    const outside = path.join(dir, "keep.txt");
    fs.writeFileSync(outside, "keep");
    await storage.removeUploads(["../../keep.txt", "keep.txt"]);
    expect(fs.existsSync(outside)).toBe(true);
  });
});

describe("source safety", () => {
  const routes = ["app/api/media-social/route.ts", "app/api/media-social/file/[filename]/route.ts"];
  const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));

  it("requires a signed-in member to write, and to download uploaded files", () => {
    expect(fs.readFileSync(routes[0], "utf8")).toMatch(/sameOrigin\(req\);\s*const member = await requireMember\(\)/);
    expect(fs.readFileSync(routes[1], "utf8")).toMatch(/requireMember\(\)/);
  });

  it("has no demo-persona fallback, switcher, header or fake website left", () => {
    const code = ["app/api/media-social", "app/media", "components/media-social", "lib/media-social"].flatMap(walk).filter((f) => /\.(ts|tsx)$/.test(f));
    for (const f of code) expect(fs.readFileSync(f, "utf8"), f).not.toMatch(/x-miras-demo-user|activeDemoUser|onSwitchDemoUser|miras-udaipur\.org/);
  });

  it("never returns a raw error message from the server", () => {
    for (const f of walk("app/api/media-social").filter((p) => p.endsWith(".ts"))) expect(fs.readFileSync(f, "utf8"), f).not.toMatch(/\(err(or)? as Error\)\.message/);
  });

  it("serves uploads privately with nosniff", () => {
    const text = fs.readFileSync(routes[1], "utf8");
    expect(text).toMatch(/private, max-age/);
    expect(text).toMatch(/X-Content-Type-Options": "nosniff"/);
    expect(text).not.toMatch(/immutable/);
  });
});
