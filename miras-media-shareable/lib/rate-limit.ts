// Sliding-window limiter per client, in memory. Fine for one demo server; a hosted store can replace it.

export function createRateLimiter(max: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return {
    /** Records a hit and returns false if this client is over the limit. */
    allow(key: string, now = Date.now()): boolean {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= max) {
        hits.set(key, recent);
        return false;
      }
      hits.set(key, [...recent, now]);
      return true;
    },
    reset() {
      hits.clear();
    },
  };
}

export const tooMany = () => Response.json({ ok: false, error: "Too many requests. Please wait a minute and try again." }, { status: 429 });

// One limiter per AI or upload endpoint.
export const limits = {
  cameraMatch: createRateLimiter(20, 60_000),
  onboardDraft: createRateLimiter(10, 10 * 60_000),
  onboardSubmit: createRateLimiter(5, 10 * 60_000),
  memories: createRateLimiter(10, 10 * 60_000),
  picks: createRateLimiter(5, 10 * 60_000),
};
