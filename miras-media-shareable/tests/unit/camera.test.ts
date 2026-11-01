import fs from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { AiProvider } from "@/lib/ai";
import { MockAiProvider } from "@/lib/ai/mock";
import { matchFrame } from "@/lib/services/camera";
import { place, story, withFixture } from "./helpers";

const places = [place({ id: "p1", slug: "p1", name: "Place One" }), place({ id: "p2", slug: "p2", name: "Place Two" })];
const stories = [
  story({ id: "v1", placeId: "p1", text: "VERIFIED-TEXT-ONE" }),
  story({ id: "u1", placeId: "p1", text: "UNVERIFIED-SECRET", verifiedBy: undefined, verifiedAt: undefined }),
];

function vision(out: unknown): AiProvider & { matchPlace: ReturnType<typeof vi.fn> } {
  return { name: "gemini", draftListing: vi.fn(), matchPlace: vi.fn().mockResolvedValue(out), pickMoments: vi.fn() };
}
const frame = () => Buffer.from("fake-jpeg-bytes-of-a-monument");

describe("camera story mode", () => {
  it("returns only visible stories for a confident match", async () => {
    withFixture({ places, stories });
    const r = await matchFrame(vision({ placeId: "p1", confidence: 0.95 }), frame(), "image/jpeg", { mode: "live", threshold: 0.85 });
    expect(r.known).toBe(true);
    if (r.known) expect(r.stories.map((s) => s.id)).toEqual(["v1"]);
    expect(JSON.stringify(r)).not.toContain("UNVERIFIED-SECRET");
  });

  it("says I don't know below the threshold", async () => {
    withFixture({ places, stories });
    const r = await matchFrame(vision({ placeId: "p1", confidence: 0.6 }), frame(), "image/jpeg", { mode: "live", threshold: 0.85 });
    expect(r).toMatchObject({ known: false, reason: "low_confidence" });
  });

  it("says I don't know for an out-of-set photo (null or unknown place id)", async () => {
    withFixture({ places, stories });
    expect(await matchFrame(vision({ placeId: null, confidence: 0.99 }), frame(), "image/jpeg", { mode: "live", threshold: 0.85 })).toMatchObject({ known: false });
    expect(await matchFrame(vision({ placeId: "taj-mahal", confidence: 0.99 }), frame(), "image/jpeg", { mode: "live", threshold: 0.85 })).toMatchObject({ known: false });
  });

  it("rejects a photo where a person is the main subject", async () => {
    withFixture({ places, stories });
    const r = await matchFrame(vision({ placeId: "p1", confidence: 0.99, personIsMainSubject: true }), frame(), "image/jpeg", { mode: "live", threshold: 0.5 });
    expect(r).toMatchObject({ known: false, reason: "person" });
  });

  it("treats invalid model output or a failed call as unsure", async () => {
    withFixture({ places, stories });
    expect(await matchFrame(vision("I think it's a fort, built in..."), frame(), "image/jpeg", { mode: "live" })).toMatchObject({ known: false, reason: "unsure" });
    const failing: AiProvider = { name: "gemini", draftListing: vi.fn(), matchPlace: vi.fn().mockRejectedValue(new Error("down")), pickMoments: vi.fn() };
    expect(await matchFrame(failing, frame(), "image/jpeg", { mode: "live" })).toMatchObject({ known: false, reason: "unsure" });
  });

  it("never sends story text to the AI, only place ids and names", async () => {
    withFixture({ places, stories });
    const ai = vision({ placeId: "p1", confidence: 0.95 });
    await matchFrame(ai, frame(), "image/jpeg", { mode: "demo", threshold: 0.85 });
    const input = ai.matchPlace.mock.calls[0][0];
    expect(input.candidates).toEqual([
      { id: "p1", name: "Place One" },
      { id: "p2", name: "Place Two" },
    ]);
    const sent = JSON.stringify({ ...input, image: undefined });
    expect(sent).not.toContain("VERIFIED-TEXT-ONE");
    expect(sent).not.toContain("UNVERIFIED-SECRET");
  });

  it("discards the frame: the buffer is zeroed and nothing is written to disk", async () => {
    withFixture({ places, stories });
    const writeSpy = vi.spyOn(fs, "writeFileSync");
    const buf = frame();
    await matchFrame(vision({ placeId: "p1", confidence: 0.95 }), buf, "image/jpeg", { mode: "live", threshold: 0.85 });
    expect(buf.every((b) => b === 0)).toBe(true);
    expect(writeSpy).not.toHaveBeenCalled();
    writeSpy.mockRestore();
  });

  it("mock mode never claims a match unless the visitor picks the place by hand", async () => {
    withFixture({ places, stories });
    expect(await matchFrame(new MockAiProvider(), frame(), "image/jpeg", { mode: "demo" })).toMatchObject({ known: false, demo: true });
    const picked = await matchFrame(new MockAiProvider(), Buffer.alloc(0), "image/jpeg", { mode: "demo", demoPlaceId: "p1" });
    expect(picked).toMatchObject({ known: true, demo: true });
  });

  it("ignores a manual pick when a real provider is configured", async () => {
    withFixture({ places, stories });
    const r = await matchFrame(vision({ placeId: null, confidence: 0 }), frame(), "image/jpeg", { mode: "live", demoPlaceId: "p1" });
    expect(r.known).toBe(false);
  });
});
