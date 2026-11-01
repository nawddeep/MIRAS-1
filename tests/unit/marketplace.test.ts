import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setCoreDb } from "@/lib/db/core";
import { migrate, openCoreDb, type Db } from "@/lib/db/migrate";
import { createCommunity, getCommunity, type Member, type Role } from "@/lib/community/store";
import { createMarketplace, getMarketplace } from "@/lib/marketplace/store";
import { openDb } from "@/lib/repos/sqlite";
import { getOrganiserEvents } from "@/lib/services/organiser-events";

const PASSWORD = "a-long-test-password-1";
/** A real account (the app checks it exists), registered with the given role. */
const accountsIn = (community: ReturnType<typeof createCommunity>) => async (username: string, role: Role): Promise<Member> => (await community.register(username, `Name ${username}`, PASSWORD, role)).user;
const input = (over: Record<string, unknown> = {}) => ({
  eventType: "heritage_walk" as const,
  title: "Old city walk",
  description: "A guided walk through the old city.",
  location: "Gangaur Ghat",
  startsAt: "2027-01-10T04:30:00.000Z",
  ...over,
});

describe("event creation rules", () => {
  const db = openDb(":memory:");
  const community = createCommunity(db);
  const market = createMarketplace(db);
  const account = accountsIn(community);

  it("refuses visitors", async () => {
    const visitor = await account("visitor1", "visitor");
    expect(() => market.createEvent(visitor, input())).toThrow(/Visitors cannot create events/);
  });

  it("lets artisans host workshops only", async () => {
    const artisan = await account("maker", "artisan");
    expect(() => market.createEvent(artisan, input())).toThrow(/only host craft workshops/);
    expect(market.createEvent(artisan, input({ eventType: "workshop", title: "Pigment workshop" })).status).toBe("published");
  });

  it("lets event managers host any kind of event", async () => {
    expect(market.createEvent(await account("organiser", "event_manager"), input()).eventType).toBe("heritage_walk");
  });

  it("gives no account a special pass, including one literally named 123", async () => {
    const named123 = await account("123", "visitor");
    expect(() => market.createEvent(named123, input({ eventType: "workshop" }))).toThrow(/Visitors cannot create events/);
    const artisan123 = await community.register("124", "Name 124", PASSWORD, "artisan");
    expect(() => market.createEvent(artisan123.user, input())).toThrow(/only host craft workshops/);
  });
});

describe("account roles", () => {
  it("starts everyone as a visitor and changes role only through setRole", async () => {
    const community = createCommunity(openDb(":memory:"));
    const { user } = await community.register("traveller_one", "Traveller One", "a-long-test-password-1");
    expect(user.role).toBe("visitor");
    expect(community.setRole(user.id, "artisan").role).toBe("artisan");
    const { user: maker } = await community.register("maker_one", "Maker One", "a-long-test-password-2", "artisan");
    expect(maker.role).toBe("artisan");
  });
});

describe("source safety", () => {
  const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));

  it("has no username-based exemption or demo credentials anywhere in the app", () => {
    const files = ["app", "components", "lib"].flatMap((d) => walk(d)).filter((f) => /\.tsx?$/.test(f));
    const bad = files.filter((f) => /username\s*[!=]==?\s*['"]123['"]|Username:\s*<strong>123/.test(fs.readFileSync(f, "utf8")));
    expect(bad).toEqual([]);
  });

  it("sets one session cookie, never an insecure duplicate", () => {
    const http = fs.readFileSync("lib/community/http.ts", "utf8");
    expect(http.match(/\.set\(SESSION_COOKIE/g)?.length).toBe(2); // one to sign in, one to sign out
    expect(http).not.toMatch(/secure:\s*false/);
  });
});

describe("organiser events on the public events list", () => {
  let dir: string;
  let db: Db;
  const previous = process.env.MIRAS_DATA_DIR;
  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "miras-market-"));
    process.env.MIRAS_DATA_DIR = dir;
    db = openCoreDb(":memory:");
    migrate(db);
    db.exec(`INSERT INTO event_categories (id, label, emoji, color) VALUES ('workshop', 'Workshop', 'W', '#0f766e'), ('community', 'Community', 'C', '#15803d')`);
    setCoreDb(db);
  });
  afterAll(() => {
    setCoreDb(undefined);
    db.close();
    if (previous === undefined) delete process.env.MIRAS_DATA_DIR;
    else process.env.MIRAS_DATA_DIR = previous;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("lists only published events, in the shared shape, linked to the organiser page", async () => {
    const market = getMarketplace();
    const account = accountsIn(getCommunity());
    const organiser = await account("organiser2", "event_manager");
    const walk = market.createEvent(organiser, input({ title: "Published walk", cost: "Free" }));
    market.createEvent(organiser, input({ title: "Draft walk", status: "draft" }));
    market.createEvent(await account("maker2", "artisan"), input({ eventType: "workshop", title: "Paid workshop", cost: "₹500", materialsProvided: "Brushes" }));

    const events = getOrganiserEvents();
    expect(events.map((e) => e.title).sort()).toEqual(["Paid workshop", "Published walk"]);
    const published = events.find((e) => e.title === "Published walk")!;
    expect(published).toMatchObject({ detailHref: `/events/${walk.id}`, bookingUrl: null, ticketStatus: "free", category: { id: "community" }, organiser: "Name organiser2" });
    const workshop = events.find((e) => e.title === "Paid workshop")!;
    expect(workshop).toMatchObject({ ticketStatus: "on-sale", category: { id: "workshop" }, includes: ["Materials provided: Brushes"] });
    expect(Date.parse(workshop.endsAt!)).toBeGreaterThan(Date.parse(workshop.startsAt!));
  });
});
