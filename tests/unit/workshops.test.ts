import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/owner/[token]/workshops/route";
import { getVisibleWorkshops } from "@/lib/services/artisans";
import { artisan, withFixture, workshop } from "./helpers";

const TOKEN = "test-edit-token-0123456789";
const call = (body: unknown, token = TOKEN) =>
  POST(new Request(`http://t/api/owner/${token}/workshops`, { method: "POST", body: JSON.stringify(body) }) as never, {
    params: Promise.resolve({ token }),
  } as never);
const fields = { title: "Clay basics", description: "D", language: "Hindi", durationMinutes: "90", cost: "Ask", howToBook: "Call" };

describe("workshops (owner API)", () => {
  it("cannot publish without the owner's confirmation tick", async () => {
    const { repos } = withFixture({ artisans: [artisan()], workshops: [workshop()] });
    const res = await call({ action: "publish", id: "w1" });
    expect(res.status).toBe(400);
    expect(repos.workshops.get("w1")?.status).toBe("draft");
  });

  it("publishes after confirmation and records when it was confirmed", async () => {
    const { repos } = withFixture({ artisans: [artisan()], workshops: [workshop()] });
    expect((await call({ action: "publish", id: "w1", confirmed: true })).status).toBe(200);
    expect(repos.workshops.get("w1")).toMatchObject({ status: "published" });
    expect(repos.workshops.get("w1")?.confirmedByOwnerAt).toBeTruthy();
    expect(getVisibleWorkshops("a1", "live")).toHaveLength(1);
  });

  it("an edit unpublishes and clears the confirmation", async () => {
    const { repos } = withFixture({
      artisans: [artisan()],
      workshops: [workshop({ status: "published", confirmedByOwnerAt: "2026-10-27T10:00:00.000Z" })],
    });
    expect((await call({ action: "save", id: "w1", fields })).status).toBe(200);
    expect(repos.workshops.get("w1")).toMatchObject({ status: "draft", title: "Clay basics", durationMinutes: 90 });
    expect(repos.workshops.get("w1")?.confirmedByOwnerAt).toBeUndefined();
  });

  it("creates a new workshop as a draft", async () => {
    const { repos } = withFixture({ artisans: [artisan()] });
    const res = await call({ action: "save", fields });
    const { id } = await res.json();
    expect(repos.workshops.get(id)).toMatchObject({ artisanId: "a1", status: "draft" });
  });

  it("refuses to touch another artisan's workshop", async () => {
    const { repos } = withFixture({ artisans: [artisan()], workshops: [workshop({ artisanId: "someone-else" })] });
    expect((await call({ action: "publish", id: "w1", confirmed: true })).status).toBe(404);
    expect(repos.workshops.get("w1")?.status).toBe("draft");
  });

  it("never publishes a sample workshop", async () => {
    withFixture({ artisans: [artisan()], workshops: [workshop({ isSample: true })] });
    expect((await call({ action: "publish", id: "w1", confirmed: true })).status).toBe(409);
  });
});
