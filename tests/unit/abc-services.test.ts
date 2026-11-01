import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { importAbcMock, loadAbcMock } from "@/lib/db/abc-mock";
import { setCoreDb } from "@/lib/db/core";
import { migrate, openCoreDb, type Db } from "@/lib/db/migrate";
import { computeTier, getEvents, getLocalFriends, getPublicGroup, getPublicGroups } from "@/lib/services/abc-services";

const TIERS = ["new", "trusted", "top", "legend"];

let db: Db;
beforeEach(async () => {
  db = openCoreDb(":memory:");
  migrate(db);
  setCoreDb(db);
  importAbcMock(db, await loadAbcMock());
});
afterEach(() => {
  setCoreDb(undefined);
  db.close();
});

describe("events", () => {
  it("returns every event with tiers, and keeps undated events", () => {
    const events = getEvents("live");
    expect(events).toHaveLength(30);
    expect(events.find((e) => e.id === "ccd-udaipur-2026")?.tiers).toHaveLength(4);
    expect(events.filter((e) => !e.startsAt).map((e) => e.id).sort()).toEqual(["jamming-adda", "mewar-2027", "uwmf-2027"]);
  });
});

describe("local friends", () => {
  it("hides a suspended local and every demo local in live mode", () => {
    const demo = getLocalFriends("demo").map((f) => f.id);
    expect(demo).toHaveLength(7);
    expect(demo).not.toContain("manoj_tours");
    expect(getLocalFriends("live")).toEqual([]);
  });

  it("ranks higher tiers first and shows only public (traveller-to-local) reviews", () => {
    const friends = getLocalFriends("demo");
    const ranks = friends.map((f) => TIERS.indexOf(f.tier));
    expect(ranks).toEqual([...ranks].sort((a, b) => b - a));
    const nandini = friends.find((f) => f.id === "nandini_udaipur")!;
    expect(nandini.reviews.map((r) => r.by).sort()).toEqual(["Kabir Singh", "Priya Sharma"]);
  });

  it("computes tiers from the README rules", () => {
    const now = new Date("2026-11-01T00:00:00Z");
    const base = { rating: 4.9, hosted: 60, responseRate: 0.98, cancelRate: 0.01, lastTripAt: "2026-10-20T00:00:00Z", memberSince: "2024-01-01T00:00:00Z" };
    expect(computeTier(base, now)).toBe("legend");
    expect(computeTier({ ...base, hosted: 25, memberSince: "2026-06-01T00:00:00Z" }, now)).toBe("top");
    expect(computeTier({ ...base, hosted: 6, rating: 4.4 }, now)).toBe("trusted");
    expect(computeTier({ ...base, hosted: 2 }, now)).toBe("new");
  });
});

describe("groups", () => {
  it("lists only public, non-solo groups and never a private one", () => {
    expect(getPublicGroups("demo").map((g) => g.id).sort()).toEqual(["g-food-trail", "g-forts-trek", "g-lake-sunsets"]);
    expect(getPublicGroup("g-sharma-family", "demo")).toBeUndefined();
    expect(getPublicGroup("g-past-ghats", "demo")).toBeUndefined();
    expect(getPublicGroups("live")).toEqual([]);
  });

  it("returns a public group's itinerary in order, without chat", () => {
    const g = getPublicGroup("g-lake-sunsets", "demo")!;
    expect(g.itinerary.map((i) => `${i.day} ${i.time}`)).toEqual(["1 09:00", "1 17:30", "2 07:00", "2 19:00", "3 10:00"]);
    expect(g.members).toHaveLength(4);
    expect(Object.keys(g)).not.toContain("messages");
  });
});
