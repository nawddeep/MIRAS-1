export type DraftInput = {
  audio: Buffer;
  audioMime: string;
  image?: Buffer;
  imageMime?: string;
};

export type MatchInput = {
  image: Buffer;
  imageMime: string;
  /** Only ids and names of supported places. Never story text: the model must not write or recall stories. */
  candidates: { id: string; name: string }[];
};

export type MomentsInput = {
  /** Small still frames extracted in the visitor's browser. Never stored. */
  frames: { data: Buffer; mime: string }[];
  candidates: { id: string; name: string }[];
};

/**
 * Providers return RAW model output (string or object). Callers validate it with Zod
 * before anything reaches a user, so a provider can never push unchecked text into the UI.
 */
export interface AiProvider {
  readonly name: "mock" | "gemini";
  draftListing(input: DraftInput): Promise<unknown>;
  matchPlace(input: MatchInput): Promise<unknown>;
  pickMoments(input: MomentsInput): Promise<unknown>;
}
