import type { AiProvider } from "@/lib/ai";
import { describeError, logAi } from "@/lib/ai-log";
import { currentMode, getConfig, type Mode } from "@/lib/config";
import { PlaceMatch, type StoryEntry } from "@/lib/schemas";
import { getVisiblePlaces, getVisibleStories } from "./content";

export type CameraResult =
  | { known: true; demo: boolean; confidence: number; place: { id: string; slug: string; name: string; name_hi?: string }; stories: StoryEntry[] }
  | { known: false; demo: boolean; reason: "low_confidence" | "person" | "unsure" };

/**
 * Retrieval first: the model only picks a place id from the supported list and gives a confidence.
 * Stories always come from getVisibleStories, never from the model.
 * The frame is used for this one call and then zero-filled; it is never written anywhere.
 */
export async function matchFrame(
  ai: AiProvider,
  frame: Buffer,
  mime: string,
  opts: { mode?: Mode; threshold?: number; demoPlaceId?: string } = {},
): Promise<CameraResult> {
  const mode = opts.mode ?? currentMode();
  const threshold = opts.threshold ?? getConfig().matchThreshold;
  const demo = ai.name === "mock";
  const places = getVisiblePlaces(mode);
  try {
    let match: PlaceMatch | undefined;
    if (demo && opts.demoPlaceId) {
      // Mock mode cannot see. The visitor picked the place by hand; the UI labels this "Demo response".
      match = { placeId: opts.demoPlaceId, confidence: 1, personIsMainSubject: false };
    } else {
      let raw: unknown;
      try {
        raw = await ai.matchPlace({ image: frame, imageMime: mime, candidates: places.map((p) => ({ id: p.id, name: p.name })) });
      } catch (e) {
        logAi("camera/match", `model call failed: ${describeError(e)}`);
        return { known: false, demo, reason: "unsure" };
      }
      const parsed = PlaceMatch.safeParse(typeof raw === "string" ? safeJson(raw) : raw);
      if (!parsed.success) {
        logAi("camera/match", "model returned invalid JSON");
        return { known: false, demo, reason: "unsure" };
      }
      match = parsed.data;
    }
    if (match.personIsMainSubject) return { known: false, demo, reason: "person" };
    const place = places.find((p) => p.id === match.placeId);
    if (!place || match.confidence < threshold) return { known: false, demo, reason: "low_confidence" };
    return {
      known: true,
      demo,
      confidence: match.confidence,
      place: { id: place.id, slug: place.slug, name: place.name, name_hi: place.name_hi },
      stories: getVisibleStories(place.id, mode),
    };
  } finally {
    frame.fill(0);
  }
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}
