import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/enquiries/route";
import { resetEnquiryLimits, submitEnquiry } from "@/lib/services/enquiries";
import { artisan, withFixture } from "./helpers";

const live = artisan({
  status: "published",
  consent: { given: true, date: "2026-10-27T10:00:00.000Z", docRef: "c.pdf" },
  ownerConfirmedAt: "2026-10-27T10:00:00.000Z",
});
const base = { artisanId: "a1", kind: "question", message: "Do you teach?", contactBack: "me@example.invalid" };

beforeEach(() => resetEnquiryLimits());

describe("enquiries", () => {
  it("rejects an empty message", () => {
    withFixture({ artisans: [live] });
    const r = submitEnquiry({ ...base, message: "   " }, "c1", Date.now(), "live");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors?.message).toBeTruthy();
  });

  it("rejects a very long message", () => {
    withFixture({ artisans: [live] });
    const r = submitEnquiry({ ...base, message: "x".repeat(1001) }, "c1", Date.now(), "live");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });

  it("stores a valid enquiry with a timestamp and counts it per artisan", () => {
    const { repos } = withFixture({ artisans: [live] });
    const r = submitEnquiry(base, "c1", Date.parse("2026-10-28T01:00:00Z"), "live");
    expect(r.ok).toBe(true);
    expect(repos.enquiries.listByArtisan("a1")[0].createdAt).toBe("2026-10-28T01:00:00.000Z");
    expect(repos.enquiries.countByArtisan()).toEqual({ a1: 1 });
  });

  it("blocks the same message sent twice", () => {
    withFixture({ artisans: [live] });
    const now = Date.now();
    expect(submitEnquiry(base, "c1", now, "live").ok).toBe(true);
    const again = submitEnquiry(base, "c1", now + 1000, "live");
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.status).toBe(429);
  });

  it("rate-limits repeated submissions and lets them through after the window", () => {
    const { repos } = withFixture({ artisans: [live] });
    const now = Date.now();
    for (let i = 0; i < 3; i++) expect(submitEnquiry({ ...base, message: `m${i}` }, "c1", now + i, "live").ok).toBe(true);
    expect(submitEnquiry({ ...base, message: "m4" }, "c1", now + 10, "live").ok).toBe(false);
    expect(submitEnquiry({ ...base, message: "other client" }, "c2", now + 10, "live").ok).toBe(true);
    expect(submitEnquiry({ ...base, message: "m5" }, "c1", now + 11 * 60 * 1000, "live").ok).toBe(true);
    expect(repos.enquiries.countByArtisan().a1).toBe(5);
  });

  it("refuses enquiries to an unpublished artisan", () => {
    withFixture({ artisans: [artisan()] });
    const r = submitEnquiry(base, "c1", Date.now(), "live");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(404);
  });

  it("API returns 400 for invalid JSON and 201 for a valid enquiry", async () => {
    withFixture({ artisans: [live] });
    const bad = await POST(new Request("http://t/api/enquiries", { method: "POST", body: "{" }));
    expect(bad.status).toBe(400);
    const good = await POST(
      new Request("http://t/api/enquiries", { method: "POST", body: JSON.stringify(base), headers: { "x-forwarded-for": "9.9.9.9" } }),
    );
    expect(good.status).toBe(201);
  });
});
