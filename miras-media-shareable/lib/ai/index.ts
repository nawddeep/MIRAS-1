import { getConfig } from "@/lib/config";
import { GeminiAiProvider } from "./gemini";
import { MockAiProvider } from "./mock";
import type { AiProvider } from "./types";

export type { AiProvider } from "./types";

let override: AiProvider | undefined;

/** Gemini only when BOTH the key and the model name are set. Otherwise the labelled mock. */
export function getAiProvider(): AiProvider {
  if (override) return override;
  const { geminiApiKey, geminiModel, uploadTimeoutMs } = getConfig();
  return geminiApiKey && geminiModel ? new GeminiAiProvider(geminiApiKey, geminiModel, uploadTimeoutMs) : new MockAiProvider();
}

export function aiStatus() {
  const { geminiApiKey, geminiModel } = getConfig();
  return {
    configured: Boolean(geminiApiKey && geminiModel),
    hasKey: Boolean(geminiApiKey),
    model: geminiModel ?? null,
  };
}

/** Tests only. */
export function setAiProvider(p: AiProvider | undefined) {
  override = p;
}
