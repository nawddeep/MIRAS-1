import { afterEach, describe, expect, it, vi } from "vitest";
import { aiStatus, getAiProvider } from "@/lib/ai";
import { getConfig } from "@/lib/config";

const KEYS = ["GEMINI_API_KEY", "GEMINI_MODEL", "MATCH_THRESHOLD", "NEXT_PUBLIC_DEMO_MODE", "UPLOAD_TIMEOUT_MS", "MIRAS_DATA_DIR"];

afterEach(() => vi.unstubAllEnvs());

describe("runs with no .env", () => {
  it("falls back to safe defaults and the mock AI provider", () => {
    for (const k of KEYS) vi.stubEnv(k, undefined as unknown as string);
    const cfg = getConfig();
    expect(cfg.demoMode).toBe(true);
    expect(cfg.matchThreshold).toBe(0.85);
    expect(cfg.uploadTimeoutMs).toBe(45_000);
    expect(getAiProvider().name).toBe("mock");
    expect(aiStatus().configured).toBe(false);
  });

  it("does not use Gemini with only a key (model name is never guessed)", () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_MODEL", "");
    expect(getAiProvider().name).toBe("mock");
  });

  it("uses Gemini only when both key and model are set", () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_MODEL", "model-name-from-env");
    expect(getAiProvider().name).toBe("gemini");
  });

  it("ignores an out-of-range threshold", () => {
    vi.stubEnv("MATCH_THRESHOLD", "7");
    expect(getConfig().matchThreshold).toBe(0.85);
  });
});
