import { describe, expect, it } from "vitest";
import { POST as ownerPOST } from "@/app/api/owner/[token]/route";
import { getVisibleArtisans, getVisibleWorkshops } from "@/lib/services/artisans";
import { PublishGateError, publishArtisanAsOwner, saveArtisan, saveWorkshop } from "@/lib/services/publishing";
import { artisan, withFixture, workshop } from "./helpers";

const consented = { given: true, date: "2026-10-27T10:00:00.000Z", docRef: "consent-a1.pdf" };

function callOwner(token: string, body: unknown) {
  const req = new Request(`http://test/api/owner/${token}`, { method: "POST", body: JSON.stringify(body) });
  return ownerPOST(req as never, { params: Promise.resolve({ token }) } as never);
}

describe("artisan publish gate (service)", () => {
  it("refuses to publish without consent", () => {
    withFixture({ artisans: [artisan()] });
    expect(() => publishArtisanAsOwner(artisan())).toThrow(PublishGateError);
  });

  it("refuses consent without a date", () => {
    withFixture({ artisans: [artisan()] });
    expect(() => publishArtisanAsOwner(artisan({ consent: { given: true } }))).toThrow(/consent date missing/);
  });

  it("refuses a published status without owner confirmation, even when saved directly", () => {
    withFixture({ artisans: [artisan()] });
    expect(() => saveArtisan(artisan({ consent: consented, status: "published" }))).toThrow(/owner has not confirmed/);
  });

  it("never publishes a sample listing", () => {
    withFixture({ artisans: [artisan({ isSample: true, consent: consented })] });
    expect(() => publishArtisanAsOwner(artisan({ isSample: true, consent: consented }))).toThrow(/sample/);
  });

  it("publishes when consent and owner confirmation are both recorded", () => {
    const { repos } = withFixture({ artisans: [artisan({ consent: consented })] });
    publishArtisanAsOwner(artisan({ consent: consented }));
    expect(repos.artisans.get("a1")?.status).toBe("published");
    expect(repos.artisans.get("a1")?.ownerConfirmedAt).toBeTruthy();
    expect(getVisibleArtisans("live").map((a) => a.id)).toEqual(["a1"]);
  });

  it("hides a content file that claims published without consent", () => {
    withFixture({ artisans: [artisan({ status: "published", ownerConfirmedAt: "2026-10-27T10:00:00.000Z" })] });
    expect(getVisibleArtisans("live")).toEqual([]);
  });
});

describe("artisan publish gate (API)", () => {
  it("returns 409 and keeps the listing as draft when consent is missing", async () => {
    const { repos } = withFixture({ artisans: [artisan()] });
    const res = await callOwner("test-edit-token-0123456789", { action: "publish" });
    expect(res.status).toBe(409);
    expect((await res.json()).missing).toContain("consent not given");
    expect(repos.artisans.get("a1")?.status).toBe("draft");
  });

  it("publishes after the owner records consent through the API", async () => {
    const { repos } = withFixture({ artisans: [artisan()] });
    expect((await callOwner("test-edit-token-0123456789", { action: "consent", agreed: true })).status).toBe(200);
    expect((await callOwner("test-edit-token-0123456789", { action: "publish" })).status).toBe(200);
    expect(repos.artisans.get("a1")?.status).toBe("published");
    expect((await callOwner("test-edit-token-0123456789", { action: "unpublish" })).status).toBe(200);
    expect(repos.artisans.get("a1")?.status).toBe("draft");
  });

  it("rejects an unknown edit token", async () => {
    withFixture({ artisans: [artisan()] });
    expect((await callOwner("wrong-token-wrong-token", { action: "publish" })).status).toBe(404);
  });

  it("does not let a save smuggle in a published status or consent", async () => {
    const { repos } = withFixture({ artisans: [artisan()] });
    const fields = { name: "N", craft: "C", description: "D", materials: [], languages: ["Hindi"], contact: "c@x.invalid", locationText: "L" };
    const res = await callOwner("test-edit-token-0123456789", { action: "save", fields: { ...fields, status: "published", consent: consented } });
    expect(res.status).toBe(200);
    expect(repos.artisans.get("a1")?.status).toBe("draft");
    expect(repos.artisans.get("a1")?.consent.given).toBe(false);
  });
});

describe("workshop publish gate", () => {
  it("refuses to publish without owner confirmation", () => {
    withFixture({ workshops: [workshop()] });
    expect(() => saveWorkshop(workshop({ status: "published" }))).toThrow(PublishGateError);
  });

  it("publishes with owner confirmation", () => {
    const { repos } = withFixture({ workshops: [workshop()] });
    saveWorkshop(workshop({ status: "published", confirmedByOwnerAt: "2026-10-27T10:00:00.000Z" }));
    expect(repos.workshops.get("w1")?.status).toBe("published");
  });

  it("hides a content file that claims published without confirmation", () => {
    withFixture({ workshops: [workshop({ status: "published" })] });
    expect(getVisibleWorkshops("a1", "live")).toEqual([]);
  });
});
