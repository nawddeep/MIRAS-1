import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AiProvider } from "@/lib/ai";
import { describeError } from "@/lib/ai-log";
import { matchFrame } from "@/lib/services/camera";
import { pickMoments } from "@/lib/services/memories";
import { draftFromVoice } from "@/lib/services/onboarding";
import { place, withFixture } from "./helpers";

const SECRET = "AIzaSy-FAKE-KEY-0123456789";

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const failing = (e: unknown): AiProvider => ({
  name: "gemini",
  draftListing: vi.fn().mockRejectedValue(e),
  matchPlace: vi.fn().mockRejectedValue(e),
  pickMoments: vi.fn().mockRejectedValue(e),
});
const garbage = (): AiProvider => ({
  name: "gemini",
  draftListing: vi.fn().mockResolvedValue("not json"),
  matchPlace: vi.fn().mockResolvedValue("not json"),
  pickMoments: vi.fn().mockResolvedValue("not json"),
});

let logged: string[];
beforeEach(() => {
  logged = [];
  vi.spyOn(console, "error").mockImplementation((...args) => void logged.push(args.map(String).join(" ")));
});
afterEach(() => vi.restoreAllMocks());

describe("describeError", () => {
  it("shows the class and HTTP status, never the message", () => {
    const text = describeError(new ApiError(`bad request for key ${SECRET}`, 429));
    expect(text).toBe("ApiError (HTTP 429)");
    expect(text).not.toContain(SECRET);
  });

  it("shows a network error code from the error or its cause", () => {
    expect(describeError(Object.assign(new TypeError("fetch failed"), { cause: { code: "ETIMEDOUT" } }))).toBe("TypeError (ETIMEDOUT)");
    expect(describeError(Object.assign(new Error("x"), { code: "ENOTFOUND" }))).toBe("Error (ENOTFOUND)");
  });

  it("ignores codes that are not short upper-case codes, and non-errors", () => {
    expect(describeError(Object.assign(new Error("x"), { code: `leak ${SECRET}` }))).toBe("Error");
    expect(describeError("a string")).toBe("string");
  });
});

describe("AI failures are logged without secrets or visitor data", () => {
  const audio = Buffer.alloc(5000, 7);

  it("onboard/draft: a model error is logged as route plus error kind", async () => {
    const r = await draftFromVoice(failing(new ApiError(`quota exceeded ${SECRET}`, 503)), { audio, audioMime: "audio/webm" });
    expect(r).toMatchObject({ ok: false, reason: "ai_unavailable" });
    expect(logged).toEqual(["[ai] onboard/draft: model call failed: ApiError (HTTP 503)"]);
    expect(logged.join("\n")).not.toContain(SECRET);
  });

  it("onboard/draft: invalid JSON twice is logged once", async () => {
    const r = await draftFromVoice(garbage(), { audio, audioMime: "audio/webm" });
    expect(r).toMatchObject({ ok: false, reason: "invalid_model_output" });
    expect(logged).toEqual(["[ai] onboard/draft: model returned invalid JSON twice"]);
  });

  it("camera/match: a model error and invalid JSON are both logged and both fall back to I don't know", async () => {
    withFixture({ places: [place()] });
    const frame = () => Buffer.from("fake-frame-bytes");
    expect(await matchFrame(failing(new ApiError(SECRET, 401)), frame(), "image/jpeg", { mode: "live" })).toMatchObject({ known: false, reason: "unsure" });
    expect(await matchFrame(garbage(), frame(), "image/jpeg", { mode: "live" })).toMatchObject({ known: false, reason: "unsure" });
    expect(logged).toEqual(["[ai] camera/match: model call failed: ApiError (HTTP 401)", "[ai] camera/match: model returned invalid JSON"]);
    expect(logged.join("\n")).not.toContain(SECRET);
    expect(logged.join("\n")).not.toContain("fake-frame-bytes");
  });

  it("memories/moments: a model error and invalid JSON are both logged", async () => {
    withFixture({ places: [place()] });
    const frames = () => [{ data: Buffer.from("fake-frame-bytes"), mime: "image/jpeg" }];
    expect(await pickMoments(failing(new ApiError(SECRET, 500)), frames(), [], "live")).toMatchObject({ ok: false, reason: "ai_unavailable" });
    expect(await pickMoments(garbage(), frames(), [], "live")).toMatchObject({ ok: false, reason: "invalid_model_output" });
    expect(logged).toEqual(["[ai] memories/moments: model call failed: ApiError (HTTP 500)", "[ai] memories/moments: model returned invalid JSON twice"]);
    expect(logged.join("\n")).not.toContain(SECRET);
  });
});
