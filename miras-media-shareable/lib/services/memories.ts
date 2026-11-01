import type { AiProvider } from "@/lib/ai";
import { describeError, logAi } from "@/lib/ai-log";
import { currentMode, type Mode } from "@/lib/config";
import { MomentPicks, type StoryEntry } from "@/lib/schemas";
import { getVisiblePlaces, getVisibleStories } from "./content";

export const MAX_FRAMES = 5;

export type Moment = {
  frameIndex: number;
  caption: string;
  faceVisible: boolean;
  uncertain: boolean;
  placeId: string | null;
  /** "visitor" when the visitor chose the place, "model" when the model suggested it. */
  placeFrom: "visitor" | "model" | null;
  story: StoryEntry | null;
};

export type MomentsResult = { ok: true; demo: boolean; moments: Moment[] } | { ok: false; demo: boolean; reason: "invalid_model_output" | "ai_unavailable" };

const parse = (raw: unknown) => {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
};

/**
 * Picks highlight moments from frames the visitor's browser extracted.
 * The model only captions what it sees and may suggest a place. The visitor's own place choice wins.
 * Stories come from getVisibleStories; if none is visible, the moment has no story. Frames are zeroed after use.
 */
export async function pickMoments(
  ai: AiProvider,
  frames: { data: Buffer; mime: string }[],
  chosenPlaceIds: (string | null)[],
  mode: Mode = currentMode(),
): Promise<MomentsResult> {
  const demo = ai.name === "mock";
  const places = getVisiblePlaces(mode);
  const placeIds = new Set(places.map((p) => p.id));
  try {
    let picks: MomentPicks | undefined;
    for (let attempt = 0; attempt < 2 && !picks; attempt++) {
      let raw: unknown;
      try {
        raw = await ai.pickMoments({ frames, candidates: places.map((p) => ({ id: p.id, name: p.name })) });
      } catch (e) {
        logAi("memories/moments", `model call failed: ${describeError(e)}`);
        return { ok: false, demo, reason: "ai_unavailable" };
      }
      const parsed = MomentPicks.safeParse(parse(raw));
      if (parsed.success) picks = parsed.data;
    }
    if (!picks) {
      logAi("memories/moments", "model returned invalid JSON twice");
      return { ok: false, demo, reason: "invalid_model_output" };
    }

    const seen = new Set<number>();
    const moments = picks.moments
      .filter((m) => m.frameIndex < frames.length && !seen.has(m.frameIndex) && seen.add(m.frameIndex))
      .map((m): Moment => {
        const chosen = chosenPlaceIds[m.frameIndex];
        const visitorPlace = chosen && placeIds.has(chosen) ? chosen : null;
        const modelPlace = m.placeId && placeIds.has(m.placeId) ? m.placeId : null;
        const placeId = visitorPlace ?? modelPlace;
        return {
          frameIndex: m.frameIndex,
          caption: m.caption,
          faceVisible: m.faceVisible,
          uncertain: m.uncertain,
          placeId,
          placeFrom: visitorPlace ? "visitor" : modelPlace ? "model" : null,
          story: placeId ? (getVisibleStories(placeId, mode)[0] ?? null) : null,
        };
      });
    return { ok: true, demo, moments };
  } finally {
    for (const f of frames) f.data.fill(0);
  }
}
