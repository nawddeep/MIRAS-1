import fs from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { directionsUrl, distanceKm, formatMoney, isDialable, telHref } from "@/lib/city-format";
import { setCoreDb } from "@/lib/db/core";
import { migrate, openCoreDb, type Db } from "@/lib/db/migrate";
import { getVisibleCompanions, getVisibleRentalShops, getVisibleStays } from "@/lib/services/city-services";

let db: Db;
beforeEach(() => {
  db = openCoreDb(":memory:");
  migrate(db);
  setCoreDb(db);
});
afterEach(() => {
  setCoreDb(undefined);
  db.close();
});

const seedSamples = () => db.exec(fs.readFileSync("db/sample-data/sample.sql", "utf8"));
const NOW = new Date("2026-11-01T00:00:00Z");

describe("sample data", () => {
  it("loads twice without duplicating anything", () => {
    seedSamples();
    seedSamples();
    expect(db.prepare("SELECT COUNT(*) FROM stay_prices").pluck().get()).toBe(7);
    expect(db.prepare("SELECT COUNT(*) FROM companion_availability").pluck().get()).toBe(3);
  });

  it("shows in demo mode only", () => {
    seedSamples();
    expect(getVisibleStays("demo")).toHaveLength(3);
    expect(getVisibleRentalShops("demo")).toHaveLength(2);
    expect(getVisibleCompanions("demo", NOW)).toHaveLength(2);
    expect(getVisibleStays("live")).toEqual([]);
    expect(getVisibleRentalShops("live")).toEqual([]);
    expect(getVisibleCompanions("live", NOW)).toEqual([]);
  });
});

describe("stays", () => {
  const verifiedStay = (id: string) =>
    db.exec(`INSERT INTO stays (id, name, lat, lng, sustainable, status, verified_by, verified_at)
             VALUES ('${id}', '${id}', 24.5, 73.7, 1, 'published', 'Asha', '2026-10-01T00:00:00Z')`);

  it("hides a real stay until it is published and verified", () => {
    db.exec(`INSERT INTO stays (id, name, lat, lng, status) VALUES ('draft', 'Draft', 24.5, 73.7, 'draft');
             INSERT INTO stays (id, name, lat, lng, status) VALUES ('unchecked', 'Unchecked', 24.5, 73.7, 'published');`);
    verifiedStay("good");
    expect(getVisibleStays("live").map((s) => s.id)).toEqual(["good"]);
    expect(getVisibleStays("demo").map((s) => s.id)).toEqual(["good"]);
  });

  it("calls a real stay sustainable only when a practice has been checked", () => {
    verifiedStay("claimed");
    verifiedStay("checked");
    db.exec(`INSERT INTO stay_sustainability (stay_id, practice, verified_by, verified_at) VALUES ('checked', 'Solar hot water', 'Asha', '2026-10-01T00:00:00Z');
             INSERT INTO stay_sustainability (stay_id, practice) VALUES ('claimed', 'Unchecked claim');`);
    const byId = Object.fromEntries(getVisibleStays("live").map((s) => [s.id, s]));
    expect(byId.claimed).toMatchObject({ sustainable: false, practices: [] });
    expect(byId.checked).toMatchObject({ sustainable: true, practices: ["Solar hot water"] });
  });

  it("flags the cheapest latest price across booking sites", () => {
    verifiedStay("s");
    db.exec(`INSERT INTO booking_sources (id, name) VALUES ('a', 'Site A'), ('b', 'Site B');
             INSERT INTO stay_prices (stay_id, source_id, price_minor, checked_at) VALUES
               ('s', 'a', 100000, '2026-09-01T00:00:00Z'), ('s', 'a', 200000, '2026-10-01T00:00:00Z'), ('s', 'b', 250000, '2026-10-01T00:00:00Z');`);
    const prices = getVisibleStays("live")[0].prices;
    expect(prices.map((p) => [p.source, p.priceMinor, p.cheapest])).toEqual([["Site A", 200000, true], ["Site B", 250000, false]]);
  });
});

describe("rentals", () => {
  it("lists a verified shop with its offers, cheapest first within a vehicle", () => {
    db.exec(`INSERT INTO rental_shops (id, name, lat, lng, phone, status, verified_by, verified_at) VALUES ('r', 'Shop', 24.5, 73.7, '+91 98765 43210', 'published', 'Asha', '2026-10-01T00:00:00Z');
             INSERT INTO rental_offers (id, shop_id, vehicle_kind, price_minor) VALUES ('o1', 'r', 'bike', 90000), ('o2', 'r', 'bike', 70000);`);
    const [shop] = getVisibleRentalShops("live");
    expect(shop.offers.map((o) => o.priceMinor)).toEqual([70000, 90000]);
  });
});

describe("companions", () => {
  beforeEach(() => {
    db.exec(`INSERT INTO users (id, username, display_name, password_hash, recovery_hash) VALUES ('u', 'u', 'U', 'x', 'y');
             INSERT INTO companions (id, user_id, display_name, bio, status, identity_verified_by, identity_verified_at, safety_agreed_at)
               VALUES ('c', 'u', 'Asha', 'Bio', 'published', 'Team', '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z');
             INSERT INTO companion_experiences (id, companion_id, title, description, duration_minutes, status) VALUES
               ('e1', 'c', 'Walk', 'D', 60, 'published'), ('e2', 'c', 'Hidden draft', 'D', 60, 'draft');
             INSERT INTO companion_availability (id, companion_id, starts_at, ends_at, is_booked) VALUES
               ('past', 'c', '2026-10-01T04:00:00Z', '2026-10-01T06:00:00Z', 0),
               ('booked', 'c', '2026-12-01T04:00:00Z', '2026-12-01T06:00:00Z', 1),
               ('open', 'c', '2026-12-02T04:00:00Z', '2026-12-02T06:00:00Z', 0);`);
  });

  it("shows only published experiences and open future slots", () => {
    const [c] = getVisibleCompanions("live", NOW);
    expect(c.experiences.map((e) => e.id)).toEqual(["e1"]);
    expect(c.slots.map((s) => s.id)).toEqual(["open"]);
  });

  it("cannot be published without an identity check (database rule)", () => {
    expect(() =>
      db.exec(`INSERT INTO users (id, username, display_name, password_hash, recovery_hash) VALUES ('u2', 'u2', 'U', 'x', 'y');
               INSERT INTO companions (id, user_id, display_name, bio, status) VALUES ('c2', 'u2', 'No check', 'Bio', 'published');`),
    ).toThrow(/constraint/i);
  });
});

describe("formatting helpers", () => {
  it("formats paise as rupees", () => {
    expect(formatMoney(200000)).toBe("₹2,000");
  });

  it("measures distance and builds directions", () => {
    expect(distanceKm({ lat: 24.5854, lng: 73.7125 }, { lat: 24.5854, lng: 73.7125 })).toBe(0);
    expect(distanceKm({ lat: 24.58, lng: 73.68 }, { lat: 24.59, lng: 73.7 })).toBeGreaterThan(2);
    expect(directionsUrl({ lat: 24.5, lng: 73.7 })).toContain("destination=24.5,73.7");
  });

  it("only treats real numbers as dialable, never placeholder text", () => {
    expect(isDialable("+91 98765 43210")).toBe(true);
    expect(isDialable("SAMPLE: phone goes here")).toBe(false);
    expect(isDialable(null)).toBe(false);
    expect(telHref("+91 98765 43210")).toBe("tel:+919876543210");
  });
});
