import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/picks/route";
import { checkPasscode, isModerator, moderationEnabled } from "@/lib/admin-auth";
import { limits } from "@/lib/rate-limit";
import { getPublicPicks, ModerationError, moderatePick, submitPick } from "@/lib/services/picks";
import { withFixture } from "./helpers";

const base = { name: "Quiet ghat", description: "A small step-well", whyItMatters: "Locals gather here", sensitive: false };

beforeEach(() => limits.picks.reset());
afterEach(() => vi.unstubAllEnvs());

describe("hidden Udaipur picks", () => {
  it("a new pick is pending and never shows to visitors", () => {
    const { repos } = withFixture({});
    const r = submitPick(base);
    expect(r.ok).toBe(true);
    expect(repos.picks.list()[0].status).toBe("pending");
    expect(getPublicPicks()).toEqual([]);
  });

  it("approval needs a moderator name and a sourced-by note", () => {
    withFixture({});
    const r = submitPick(base);
    if (!r.ok) throw new Error("submit failed");
    expect(() => moderatePick(r.id, "approve", "  ", "Visited 2026-10-27")).toThrow(ModerationError);
    expect(() => moderatePick(r.id, "approve", "A. Moderator", "")).toThrow(/sourced by/);
    expect(getPublicPicks()).toEqual([]);
    const ok = moderatePick(r.id, "approve", "A. Moderator", "Visited 2026-10-27");
    expect(ok).toMatchObject({ status: "approved", moderatedBy: "A. Moderator", sourcedBy: "Visited 2026-10-27" });
    expect(ok.moderatedAt).toBeTruthy();
    expect(getPublicPicks().map((p) => p.id)).toEqual([r.id]);
  });

  it("rejected picks never show", () => {
    withFixture({});
    const r = submitPick(base);
    if (!r.ok) throw new Error("submit failed");
    moderatePick(r.id, "reject", "A. Moderator", "");
    expect(getPublicPicks()).toEqual([]);
  });

  it("sensitive picks hide coordinates; others keep them", () => {
    withFixture({});
    const s = submitPick({ ...base, sensitive: true, lat: 24.5, lng: 73.7 });
    const n = submitPick({ ...base, name: "Open spot", lat: 24.6, lng: 73.8 });
    if (!s.ok || !n.ok) throw new Error("submit failed");
    moderatePick(s.id, "approve", "M", "src");
    moderatePick(n.id, "approve", "M", "src");
    const pub = getPublicPicks();
    const sensitive = pub.find((p) => p.id === s.id)!;
    expect(sensitive.lat).toBeUndefined();
    expect(sensitive.lng).toBeUndefined();
    expect(JSON.stringify(sensitive)).not.toContain("24.5");
    expect(pub.find((p) => p.id === n.id)).toMatchObject({ lat: 24.6, lng: 73.8 });
  });

  it("validates input and rate-limits the API", async () => {
    withFixture({});
    const call = (body: object) => POST(new Request("http://t/api/picks", { method: "POST", body: JSON.stringify(body), headers: { "x-forwarded-for": "198.51.100.20" } }));
    expect((await call({ ...base, name: "" })).status).toBe(400);
    for (let i = 0; i < 4; i++) expect((await call({ ...base, name: `p${i}` })).status).toBe(201);
    expect((await call(base)).status).toBe(429);
  });
});

describe("moderation passcode", () => {
  it("moderation is disabled when ADMIN_PASSCODE is unset", () => {
    vi.stubEnv("ADMIN_PASSCODE", "");
    expect(moderationEnabled()).toBe(false);
    expect(checkPasscode("")).toBeNull();
    expect(isModerator("anything")).toBe(false);
  });

  it("only the right passcode signs in, and the cookie never holds the passcode", () => {
    vi.stubEnv("ADMIN_PASSCODE", "test-passcode");
    expect(checkPasscode("wrong")).toBeNull();
    const cookie = checkPasscode("test-passcode");
    expect(cookie).toBeTruthy();
    expect(cookie).not.toContain("test-passcode");
    expect(isModerator(cookie!)).toBe(true);
    expect(isModerator("forged")).toBe(false);
  });
});
