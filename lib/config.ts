import path from "node:path";

/** All runtime config in one place. Every value has a safe default so the app runs with no .env. */
export function getConfig() {
  const threshold = Number(process.env.MATCH_THRESHOLD);
  const timeout = Number(process.env.UPLOAD_TIMEOUT_MS);
  return {
    uploadTimeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : 45_000,
    demoMode: process.env.NEXT_PUBLIC_DEMO_MODE !== "false",
    matchThreshold: Number.isFinite(threshold) && threshold > 0 && threshold <= 1 ? threshold : 0.85,
    geminiApiKey: process.env.GEMINI_API_KEY?.trim() || undefined,
    geminiModel: process.env.GEMINI_MODEL?.trim() || undefined,
    dataDir: path.resolve(process.env.MIRAS_DATA_DIR || "./data"),
    contentDir: path.resolve(process.env.MIRAS_CONTENT_DIR || "./content"),
  };
}

export type Mode = "demo" | "live";
export const currentMode = (): Mode => (getConfig().demoMode ? "demo" : "live");
