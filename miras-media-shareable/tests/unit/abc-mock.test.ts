/* eslint-disable @typescript-eslint/no-explicit-any -- the prototype's data is untyped */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { importAbcMock, loadAbcMock, type AbcMock } from "@/lib/db/abc-mock";
import { migrate, openCoreDb, type Db } from "@/lib/db/migrate";

let db: Db;
let data: AbcMock;
beforeEach(async () => {
  db = openCoreDb(":memory:");
  migrate(db);
  data = await loadAbcMock();
});
afterEach(() => db.close());

const count = (table: string, where = "1") => db.prepare(`SELECT COUNT(*) FROM ${table} WHERE ${where}`).pluck().get() as number;
const total = (lists: any[][]) => lists.reduce((n, l) => n + l.length, 0);

describe("ABC prototype data", () => {
  it("loads every record in mockData.js and eventsData.js", () => {
    importAbcMock(db, data);
    const groups = data.groups;
    const locals = Object.values(data.users).filter((u) => u.type === "local");
    expect(count("users")).toBe(Object.keys(data.users).length);
    expect(count("local_friends")).toBe(locals.length);
    expect(count("travel_groups")).toBe(groups.length);
    expect(count("group_members")).toBe(total(groups.map((g) => g.members)));
    expect(count("group_itinerary_items")).toBe(total(groups.map((g) => g.itinerary ?? [])));
    expect(count("group_suggestions")).toBe(total(groups.map((g) => g.suggestions ?? [])));
    expect(count("group_messages")).toBe(total(groups.map((g) => g.messages ?? [])));
    expect(count("group_polls")).toBe(total(groups.map((g) => g.polls ?? [])));
    expect(count("group_poll_votes")).toBe(total(groups.flatMap((g) => (g.polls ?? []).map((p: any) => p.options.flatMap((o: any) => o.votes)))));
    expect(count("local_requests")).toBe(data.localRequests.length);
    expect(count("trip_reviews")).toBe(data.reviews.length);
    expect(count("local_friend_reports")).toBe(data.reports.length);
    expect(count("events")).toBe(data.events.length);
    expect(count("event_categories")).toBe(Object.keys(data.categories).length);
    expect(count("event_reminders")).toBe(data.eventReminders.length);
    expect(db.pragma("foreign_key_check")).toEqual([]);
  });

  it("keeps the details the prototype's screens rely on", () => {
    importAbcMock(db, data);
    expect(db.prepare("SELECT price_minor, price_unit, listed FROM local_friends WHERE user_id = 'nandini_udaipur'").get()).toEqual({ price_minor: 60000, price_unit: "half-day", listed: 1 });
    expect(db.prepare("SELECT status FROM local_verifications WHERE user_id = 'manoj_tours'").pluck().get()).toBe("suspended");
    expect(db.prepare("SELECT listed FROM local_friends WHERE user_id = 'manoj_tours'").pluck().get()).toBe(0);
    expect(db.prepare("SELECT tier_current, tier_warning_to FROM local_friends WHERE user_id = 'bhanu_hikes'").get()).toEqual({ tier_current: "top", tier_warning_to: "trusted" });
    expect(db.prepare("SELECT invite_code, type FROM travel_groups WHERE id = 'g-sharma-family'").get()).toEqual({ invite_code: "MIR-SHRM58", type: "private" });
    expect(db.prepare("SELECT local_friend_id FROM travel_groups WHERE id = 'g-food-trail'").pluck().get()).toBe("nandini_udaipur");
    expect(db.prepare("SELECT direction, historic FROM trip_reviews WHERE id = 'h1'").get()).toEqual({ direction: "t2l", historic: 1 });
    expect(db.prepare("SELECT starts_at FROM events WHERE id = 'ccd-udaipur-2026'").pluck().get()).toBe("2026-12-20T09:00:00+05:30");
    expect(db.prepare("SELECT starts_at, expected_text FROM events WHERE id = 'uwmf-2027'").get()).toEqual({ starts_at: null, expected_text: "Usually early February" });
    expect(db.prepare("SELECT COUNT(*) FROM event_tiers WHERE event_id = 'ccd-udaipur-2026'").pluck().get()).toBe(4);
  });

  it("is re-runnable and does not duplicate anything", () => {
    const first = importAbcMock(db, data);
    const again = importAbcMock(db, data);
    expect(again).toEqual(first);
    expect(count("users")).toBe(first.users);
    expect(count("events")).toBe(first.events);
    expect(count("group_messages")).toBe(first.group_messages);
  });

  it("marks travellers and groups as demo data and events as real listings", () => {
    importAbcMock(db, data);
    expect(count("travel_groups", "is_sample = 0")).toBe(0);
    expect(count("local_friends", "is_sample = 0")).toBe(0);
    expect(count("events", "is_sample = 1")).toBe(0);
  });

  it("refuses data with a field it does not know about, instead of dropping it", () => {
    const changed = structuredClone(data);
    changed.groups[0].pinnedMessage = "x";
    expect(() => importAbcMock(db, changed)).toThrow(/Unknown group field.*pinnedMessage/);
    expect(count("travel_groups")).toBe(0);
  });
});
