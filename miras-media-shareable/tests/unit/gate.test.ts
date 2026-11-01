import { beforeEach, describe, expect, it } from "vitest";
import { POST as cameraPOST } from "@/app/api/camera/match/route";
import { POST as draftPOST } from "@/app/api/onboard/draft/route";
import { POST as submitPOST } from "@/app/api/onboard/submit/route";
import { createRateLimiter, limits } from "@/lib/rate-limit";
import { geminiAudioMime } from "@/lib/services/onboarding";
import { place, withFixture } from "./helpers";

describe("audio types sent to Gemini", () => {
  it("maps Safari's audio/mp4 (AAC in MP4) to audio/m4a", () => {
    expect(geminiAudioMime("audio/mp4")).toBe("audio/m4a");
    expect(geminiAudioMime("audio/mp4;codecs=mp4a.40.2")).toBe("audio/m4a");
    expect(geminiAudioMime("audio/x-m4a")).toBe("audio/m4a");
  });

  it("keeps Chrome's audio/webm and drops codec parameters", () => {
    expect(geminiAudioMime("audio/webm;codecs=opus")).toBe("audio/webm");
  });

  it("keeps Firefox's audio/ogg and drops codec parameters", () => {
    expect(geminiAudioMime("audio/ogg")).toBe("audio/ogg");
    expect(geminiAudioMime("audio/ogg;codecs=opus")).toBe("audio/ogg");
  });

  it("rejects a type Gemini does not list", () => {
    expect(geminiAudioMime("audio/x-unknown")).toBeNull();
    expect(geminiAudioMime("video/mp4")).toBeNull();
  });

  it("draft API answers 415 for an unsupported recording type", async () => {
    limits.onboardDraft.reset();
    const form = new FormData();
    form.append("audio", new File([new Uint8Array(5000)], "a", { type: "audio/x-unknown" }));
    const res = await draftPOST(new Request("http://t/api/onboard/draft", { method: "POST", body: form, headers: { "x-forwarded-for": "198.51.100.9" } }));
    expect(res.status).toBe(415);
  });
});

describe("rate limits", () => {
  beforeEach(() => Object.values(limits).forEach((l) => l.reset()));

  it("limiter allows up to max per window, per client, then recovers", () => {
    const l = createRateLimiter(2, 1000);
    expect([l.allow("a", 0), l.allow("a", 1), l.allow("a", 2)]).toEqual([true, true, false]);
    expect(l.allow("b", 2)).toBe(true);
    expect(l.allow("a", 1500)).toBe(true);
  });

  const hammer = async (call: () => Promise<Response>, times: number) => {
    const statuses: number[] = [];
    for (let i = 0; i < times; i++) statuses.push((await call()).status);
    return statuses;
  };
  const headers = { "x-forwarded-for": "203.0.113.50" };

  it("camera match: 21st request in a minute gets 429", async () => {
    withFixture({ places: [place()] });
    const call = () => {
      const form = new FormData();
      form.append("demoPlaceId", "p1");
      return cameraPOST(new Request("http://t/api/camera/match", { method: "POST", body: form, headers }));
    };
    const s = await hammer(call, 21);
    expect(s.slice(0, 20).every((x) => x !== 429)).toBe(true);
    expect(s[20]).toBe(429);
  });

  it("onboard draft: 11th request in 10 minutes gets 429", async () => {
    const call = () => draftPOST(new Request("http://t/api/onboard/draft", { method: "POST", body: new FormData(), headers }));
    const s = await hammer(call, 11);
    expect(s.slice(0, 10).every((x) => x !== 429)).toBe(true);
    expect(s[10]).toBe(429);
  });

  it("onboard submit: 6th request in 10 minutes gets 429", async () => {
    const call = () => submitPOST(new Request("http://t/api/onboard/submit", { method: "POST", body: new FormData(), headers }));
    const s = await hammer(call, 6);
    expect(s.slice(0, 5).every((x) => x !== 429)).toBe(true);
    expect(s[5]).toBe(429);
  });
});
