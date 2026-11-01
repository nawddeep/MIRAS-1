// Server-side logging for AI failures, so a wrong model name, a quota error or a timeout can be told apart
// when something goes wrong on demo day. It logs which route failed and the kind of error only.
// It never logs the error message (SDK messages can echo request details), the API key, or anything the visitor sent.

const SHORT_CODE = /^[A-Z0-9_]{3,40}$/;

/** "ApiError (HTTP 429)", "TypeError (ETIMEDOUT)" or just the class name. */
export function describeError(e: unknown): string {
  if (!(e instanceof Error)) return typeof e;
  const { status, code, cause } = e as { status?: unknown; code?: unknown; cause?: { code?: unknown } };
  const causeCode = cause && typeof cause === "object" ? cause.code : undefined;
  const detail =
    typeof status === "number"
      ? `HTTP ${status}`
      : [code, causeCode].find((c): c is string => typeof c === "string" && SHORT_CODE.test(c)) ?? "";
  return `${e.name || "Error"}${detail ? ` (${detail})` : ""}`;
}

export function logAi(route: string, event: string) {
  console.error(`[ai] ${route}: ${event}`);
}
