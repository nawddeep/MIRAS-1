import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/memories/moments/route";
import type { AiProvider } from "@/lib/ai";
import { MockAiProvider } from "@/lib/ai/mock";
import { checkContent } from "@/lib/content-check";
import { limits } from "@/lib/rate-limit";
import { pickMoments } from "@/lib/services/memories";
import { place, story, withFixture } from "./helpers";

const places = [place({ id: "p1", slug: "p1", name: "Place One" }), place({ id: "p2", slug: "p2", name: "Place Two" })];
const stories = [
  story({ id: "v1", placeId: "p1", title: "Verified story" }),
  story({ id: "u2", placeId: "p2", text: "UNVERIFIED", verifiedBy: undefined, verifiedAt: undefined }),
];
const frames = (n: number) => Array.from({ length: n }, (_, i) => ({ data: Buffer.from(`frame-${i}`), mime: "image/jpeg" }));
const ai = (...outs: unknown[]): AiProvider & { pickMoments: ReturnType<typeof vi.fn> } => {
  const pick = vi.fn();
  outs.forEach((o) => (o instanceof Error ? pick.mockRejectedValueOnce(o) : pick.mockResolvedValueOnce(o)));
  return { name: "gemini", draftListing: vi.fn(), matchPlace: vi.fn(), pickMoments: pick };
};
const m = (over: object = {}) => ({ frameIndex: 0, caption: "Light on water", placeId: null, faceVisible: false, uncertain: false, ...over });

beforeEach(() => limits.memories.reset());

describe("memories", () => {
  it("mock mode returns labelled demo captions and claims no place or face", async () => {
    withFixture({ places, stories });
    const r = await pickMoments(new MockAiProvider(), frames(3), [], "live");
    expect(r.ok && r.demo).toBe(true);
    if (!r.ok) return;
    expect(r.moments).toHaveLength(3);
    expect(r.moments.every((x) => x.caption.startsWith("Demo response") && x.placeId === null && !x.faceVisible)).toBe(true);
  });

  it("attaches a verified story for a matched place, and none when no visible story exists", async () => {
    withFixture({ places, stories });
    const r = await pickMoments(ai({ moments: [m({ placeId: "p1" }), m({ frameIndex: 1, placeId: "p2" })] }), frames(2), [], "live");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.moments[0].story?.id).toBe("v1");
    expect(r.moments[1].story).toBeNull();
    expect(JSON.stringify(r)).not.toContain("UNVERIFIED");
  });

  it("the visitor's place choice wins over the model's suggestion", async () => {
    withFixture({ places, stories });
    const r = await pickMoments(ai({ moments: [m({ placeId: "p2" })] }), frames(1), ["p1"], "live");
    expect(r.ok && r.moments[0]).toMatchObject({ placeId: "p1", placeFrom: "visitor" });
  });

  it("passes the face flag through for the visitor to decide", async () => {
    withFixture({ places, stories });
    const r = await pickMoments(ai({ moments: [m({ faceVisible: true })] }), frames(1), [], "live");
    expect(r.ok && r.moments[0].faceVisible).toBe(true);
  });

  it("retries once on invalid output, then reports it without showing anything", async () => {
    withFixture({ places, stories });
    const bad = ai("not json", { moments: [{ frameIndex: "zero" }] });
    expect(await pickMoments(bad, frames(1), [], "live")).toEqual({ ok: false, demo: false, reason: "invalid_model_output" });
    expect(bad.pickMoments).toHaveBeenCalledTimes(2);
  });

  it("drops out-of-range or duplicate frames and unknown places", async () => {
    withFixture({ places, stories });
    const r = await pickMoments(ai({ moments: [m(), m(), m({ frameIndex: 9 }), m({ frameIndex: 1, placeId: "taj-mahal" })] }), frames(2), [], "live");
    expect(r.ok && r.moments.map((x) => [x.frameIndex, x.placeId])).toEqual([
      [0, null],
      [1, null],
    ]);
  });

  it("never sends story text to the model and zeroes the frames", async () => {
    withFixture({ places, stories });
    const model = ai({ moments: [m()] });
    const f = frames(1);
    await pickMoments(model, f, [], "live");
    expect(JSON.stringify(model.pickMoments.mock.calls[0][0].candidates)).not.toContain("Verified story");
    expect(f[0].data.every((b) => b === 0)).toBe(true);
  });

  it("API rejects more than 5 frames and rate-limits", async () => {
    withFixture({ places, stories });
    const req = (n: number) => {
      const form = new FormData();
      for (let i = 0; i < n; i++) form.append("frames", new File([new Uint8Array(10)], `${i}.jpg`, { type: "image/jpeg" }));
      return new Request("http://t/api/memories/moments", { method: "POST", body: form, headers: { "x-forwarded-for": "192.0.2.4" } });
    };
    expect((await POST(req(6))).status).toBe(400);
    const statuses = [];
    for (let i = 0; i < 9; i++) statuses.push((await POST(req(1))).status);
    expect(statuses.every((s) => s === 200)).toBe(true);
    expect((await POST(req(1))).status).toBe(429);
  });

  it("the licensed-music slot is empty and a track without rights fails content:check", () => {
    expect(JSON.parse(fs.readFileSync(path.resolve("content/music.json"), "utf8"))).toEqual([]);
    const { contentDir, publicDir } = withFixture({});
    fs.writeFileSync(path.join(contentDir, "music.json"), JSON.stringify([{ id: "t1", title: "T", path: "/media/t.mp3", owner: "O", permittedUse: "P", licenceNote: "L" }]));
    expect(checkContent(contentDir, publicDir).errors.join("\n")).toMatch(/Music track "t1".*no rights entry/);
  });
});
