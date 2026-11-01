import crypto from "node:crypto";
import { z } from "zod";
import type { AiProvider } from "@/lib/ai";
import { describeError, logAi } from "@/lib/ai-log";
import type { DraftInput } from "@/lib/ai/types";
import { ListingDraft, type Artisan } from "@/lib/schemas";
import type { StorageProvider } from "@/lib/storage";
import { IN_APP_CONSENT_REF } from "./artisans";
import { PublishGateError, publishArtisanAsOwner, saveArtisan } from "./publishing";

/** Below this the recording is treated as empty (roughly under half a second of compressed audio). */
export const MIN_AUDIO_BYTES = 2_000;
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// Audio types the Gemini API lists as supported (ai.google.dev/gemini-api/docs/audio, checked 2026-10-28).
const GEMINI_AUDIO = new Set(["audio/wav", "audio/mp3", "audio/aiff", "audio/aac", "audio/ogg", "audio/flac", "audio/mpeg", "audio/m4a", "audio/opus", "audio/webm"]);
// Browser spellings for the same formats. Safari records AAC in an MP4 container, which is M4A.
const AUDIO_ALIASES: Record<string, string> = { "audio/mp4": "audio/m4a", "audio/x-m4a": "audio/m4a", "audio/x-wav": "audio/wav", "audio/wave": "audio/wav" };

/** Maps a browser recording type to a type Gemini accepts, or null if it is not supported. */
export function geminiAudioMime(type: string): string | null {
  const base = (type.split(";")[0] || "audio/webm").trim().toLowerCase();
  const mapped = AUDIO_ALIASES[base] ?? base;
  return GEMINI_AUDIO.has(mapped) ? mapped : null;
}

export type DraftResult =
  | { ok: true; draft: ListingDraft; demo: boolean; attempts: number }
  | { ok: false; reason: "empty_audio" | "invalid_model_output" | "ai_unavailable"; partial: Partial<ListingDraft>; demo: boolean; attempts: number };

function parse(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/** Keeps whatever fields have the right type, so the typed form can start from them. */
function partialFrom(raw: unknown): Partial<ListingDraft> {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const out: Partial<ListingDraft> = {};
  for (const k of ["title", "description_hi", "description_en", "category"] as const) if (typeof r[k] === "string") out[k] = r[k];
  if (Array.isArray(r.materials)) out.materials = r.materials.filter((m): m is string => typeof m === "string");
  return out;
}

/** Calls the model, validates the JSON, retries once, then falls back to the typed form. */
export async function draftFromVoice(ai: AiProvider, input: DraftInput): Promise<DraftResult> {
  const demo = ai.name === "mock";
  if (input.audio.length < MIN_AUDIO_BYTES) return { ok: false, reason: "empty_audio", partial: {}, demo, attempts: 0 };

  let last: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      last = parse(await ai.draftListing(input));
    } catch (e) {
      logAi("onboard/draft", `model call failed: ${describeError(e)}`);
      return { ok: false, reason: "ai_unavailable", partial: partialFrom(last), demo, attempts: attempt };
    }
    const valid = ListingDraft.safeParse(last);
    if (valid.success) return { ok: true, draft: valid.data, demo, attempts: attempt };
  }
  logAi("onboard/draft", "model returned invalid JSON twice");
  return { ok: false, reason: "invalid_model_output", partial: partialFrom(last), demo, attempts: 2 };
}

export const ListingSubmission = z.object({
  name: z.string().trim().min(1, "Please add your name.").max(120),
  headline: z.string().trim().max(160).optional(),
  craft: z.string().trim().min(1, "Please add your craft.").max(120),
  description: z.string().trim().min(1, "Please add a description.").max(2000),
  description_hi: z.string().trim().max(2000).optional(),
  materials: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  languages: z.array(z.string().trim().min(1).max(40)).min(1, "Please add at least one language.").max(10),
  contact: z.string().trim().min(3, "Please add a phone number or email.").max(200),
  locationText: z.string().trim().min(1, "Please add your area.").max(200),
  consentAgreed: z.boolean(),
  photoHasNoFaces: z.boolean(),
  publish: z.boolean(),
});
export type ListingSubmission = z.infer<typeof ListingSubmission>;

export type Photo = { data: Buffer; mime: string };

/**
 * Creates the owner's listing as a draft, then publishes only if the owner explicitly tapped Publish.
 * The consent gate in publishing.ts decides; if it refuses, the draft (and its edit link) is kept.
 */
export function createListing(
  sub: ListingSubmission,
  photo: Photo | undefined,
  storage: StorageProvider,
  now = new Date(),
): { artisan: Artisan; publishBlockers: string[] } {
  const photos: string[] = [];
  if (photo) {
    if (!sub.photoHasNoFaces) throw new Error("Please confirm the photo does not show anyone's face, or remove it.");
    const asset = storage.saveImage(photo.data, photo.mime, {
      owner: sub.name,
      permittedUse: "Display on the owner's MIRAS listing; owner can remove it at any time",
      licenceNote: "Uploaded by the owner during voice onboarding",
      containsPeople: false,
    });
    photos.push(asset.path);
  }

  const slug = sub.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "artisan";
  const draft: Artisan = {
    id: `${slug}-${crypto.randomBytes(3).toString("hex")}`,
    name: sub.name,
    headline: sub.headline || undefined,
    craft: sub.craft,
    description: sub.description,
    description_hi: sub.description_hi || undefined,
    materials: sub.materials,
    languages: sub.languages,
    photos,
    contact: sub.contact,
    locationText: sub.locationText,
    status: "draft",
    consent: sub.consentAgreed ? { given: true, date: now.toISOString(), docRef: IN_APP_CONSENT_REF } : { given: false },
    photoRights: photo ? "Owner's own photo, uploaded by the owner" : "No photo",
    editToken: crypto.randomBytes(24).toString("base64url"),
    isSample: false,
  };
  saveArtisan(draft);
  if (!sub.publish) return { artisan: draft, publishBlockers: [] };
  try {
    return { artisan: publishArtisanAsOwner(draft, now), publishBlockers: [] };
  } catch (e) {
    if (e instanceof PublishGateError) return { artisan: draft, publishBlockers: e.missing };
    throw e;
  }
}
