import { describe, expect, it, vi } from "vitest";
import type { AiProvider } from "@/lib/ai";
import { MockAiProvider } from "@/lib/ai/mock";
import { createListing, draftFromVoice, type ListingSubmission } from "@/lib/services/onboarding";
import type { StorageProvider } from "@/lib/storage";
import { withFixture } from "./helpers";

const audio = Buffer.alloc(5000, 1);
const good = { title: "T", description_hi: "हि", description_en: "E", category: "C", materials: ["clay"], uncertain_fields: ["materials"] };

function provider(...outputs: (unknown | Error)[]): AiProvider & { draftListing: ReturnType<typeof vi.fn> } {
  const draftListing = vi.fn();
  for (const o of outputs) {
    if (o instanceof Error) draftListing.mockRejectedValueOnce(o);
    else draftListing.mockResolvedValueOnce(o);
  }
  return { name: "gemini", draftListing, matchPlace: vi.fn(), pickMoments: vi.fn() };
}

describe("draftFromVoice", () => {
  it("accepts valid JSON from the model on the first try", async () => {
    const ai = provider(JSON.stringify(good));
    const r = await draftFromVoice(ai, { audio, audioMime: "audio/webm" });
    expect(r).toMatchObject({ ok: true, attempts: 1, demo: false });
    if (r.ok) expect(r.draft.uncertain_fields).toEqual(["materials"]);
  });

  it("retries once after invalid JSON and then succeeds", async () => {
    const ai = provider("not json {", JSON.stringify(good));
    const r = await draftFromVoice(ai, { audio, audioMime: "audio/webm" });
    expect(r).toMatchObject({ ok: true, attempts: 2 });
    expect(ai.draftListing).toHaveBeenCalledTimes(2);
  });

  it("falls back to the typed form with partial fields after two invalid outputs", async () => {
    const ai = provider("garbage", JSON.stringify({ title: "Kept title", materials: "not an array" }));
    const r = await draftFromVoice(ai, { audio, audioMime: "audio/webm" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("invalid_model_output");
      expect(r.partial).toEqual({ title: "Kept title" });
    }
    expect(ai.draftListing).toHaveBeenCalledTimes(2);
  });

  it("rejects empty audio without calling the model", async () => {
    const ai = provider(JSON.stringify(good));
    const r = await draftFromVoice(ai, { audio: Buffer.alloc(10), audioMime: "audio/webm" });
    expect(r).toMatchObject({ ok: false, reason: "empty_audio" });
    expect(ai.draftListing).not.toHaveBeenCalled();
  });

  it("reports ai_unavailable when the model call fails (timeout or network)", async () => {
    const ai = provider(new Error("timeout"));
    const r = await draftFromVoice(ai, { audio, audioMime: "audio/webm" });
    expect(r).toMatchObject({ ok: false, reason: "ai_unavailable" });
  });

  it("labels mock drafts as demo", async () => {
    const r = await draftFromVoice(new MockAiProvider(), { audio, audioMime: "audio/webm" });
    expect(r).toMatchObject({ ok: true, demo: true });
  });
});

const sub = (over: Partial<ListingSubmission> = {}): ListingSubmission => ({
  name: "Owner Name",
  craft: "Craft",
  description: "Description",
  materials: [],
  languages: ["Hindi"],
  contact: "owner@example.invalid",
  locationText: "Area",
  consentAgreed: false,
  photoHasNoFaces: false,
  publish: false,
  ...over,
});

const fakeStorage = (): StorageProvider & { saveImage: ReturnType<typeof vi.fn> } => ({
  saveImage: vi.fn((_d: Buffer, _m: string, rights) => ({ id: "m1", path: "/api/media/x.jpg", ...rights })),
  read: vi.fn(),
});

describe("createListing", () => {
  it("saves a draft and never publishes without an explicit Publish tap", () => {
    const { repos } = withFixture({});
    const { artisan } = createListing(sub({ consentAgreed: true }), undefined, fakeStorage());
    expect(artisan.status).toBe("draft");
    expect(repos.artisans.get(artisan.id)?.status).toBe("draft");
    expect(artisan.editToken.length).toBeGreaterThanOrEqual(24);
  });

  it("keeps the draft and reports blockers when Publish is tapped without consent", () => {
    const { repos } = withFixture({});
    const { artisan, publishBlockers } = createListing(sub({ publish: true }), undefined, fakeStorage());
    expect(publishBlockers).toContain("consent not given");
    expect(repos.artisans.get(artisan.id)?.status).toBe("draft");
  });

  it("publishes with consent and an explicit Publish tap", () => {
    const { repos } = withFixture({});
    const { artisan } = createListing(sub({ publish: true, consentAgreed: true }), undefined, fakeStorage());
    expect(repos.artisans.get(artisan.id)?.status).toBe("published");
    expect(repos.artisans.get(artisan.id)?.consent.date).toBeTruthy();
  });

  it("refuses to store a photo unless the owner confirms it shows no faces", () => {
    withFixture({});
    const storage = fakeStorage();
    expect(() => createListing(sub(), { data: Buffer.alloc(10), mime: "image/jpeg" }, storage)).toThrow(/face/);
    expect(storage.saveImage).not.toHaveBeenCalled();
  });

  it("records rights for a stored photo", () => {
    withFixture({});
    const storage = fakeStorage();
    const { artisan } = createListing(sub({ photoHasNoFaces: true }), { data: Buffer.alloc(10), mime: "image/jpeg" }, storage);
    expect(storage.saveImage).toHaveBeenCalledWith(expect.any(Buffer), "image/jpeg", expect.objectContaining({ owner: "Owner Name", containsPeople: false }));
    expect(artisan.photos).toEqual(["/api/media/x.jpg"]);
  });
});
