/* eslint-disable @typescript-eslint/no-explicit-any -- adapter for the untyped prototype data in "ABC(3 features)" */
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Db } from "./migrate";

/** The prototype's data, as exported by ABC(3 features)/src/mockData.js and eventsData.js. */
export type AbcMock = {
  users: Record<string, any>;
  groups: any[];
  localRequests: any[];
  reviews: any[];
  reports: any[];
  eventPrefs: Record<string, Record<string, { going?: boolean; attended?: boolean }>>;
  eventReminders: any[];
  events: any[];
  categories: Record<string, { label: string; emoji?: string; color?: string }>;
  eventsChecked: string;
};

/** Reads mockData.js and eventsData.js from the prototype's src folder. */
export async function loadAbcMock(srcDir = path.resolve("ABC(3 features)/src")): Promise<AbcMock> {
  const load = (file: string) => import(/* webpackIgnore: true */ pathToFileURL(path.join(srcDir, file)).href);
  const [mock, events] = await Promise.all([load("mockData.js"), load("eventsData.js")]);
  const state = mock.freshState();
  return {
    users: state.users,
    groups: state.groups,
    localRequests: state.localRequests,
    reviews: state.reviews,
    reports: state.reports,
    eventPrefs: state.eventPrefs,
    eventReminders: state.eventReminders,
    events: events.EVENTS,
    categories: events.CATEGORIES,
    eventsChecked: events.EVENTS_CHECKED,
  };
}

const KEYS = {
  user: ["username", "name", "city", "style", "bio", "color", "guest", "type", "local"],
  local: ["area", "languages", "expertise", "about", "years", "pricing", "verification", "rating", "reviews", "hosted", "responseRate", "cancelRate", "lastTripAt", "since", "tierState", "listed"],
  verification: ["provider", "document", "masked", "verifiedAt", "status", "reason", "history"],
  group: ["id", "name", "type", "destination", "startDate", "endDate", "solo", "description", "vibe", "maxMembers", "leader", "members", "requests", "code", "createdAt", "localFriend", "itinerary", "suggestions", "polls", "messages"],
  item: ["id", "day", "time", "title", "place", "note"],
  suggestion: ["id", "by", "kind", "targetId", "proposed", "reason", "status", "decisionComment", "decidedAt", "createdAt"],
  poll: ["id", "by", "question", "multi", "closed", "createdAt", "options"],
  message: ["id", "kind", "by", "text", "pollId", "at"],
  joinRequest: ["username", "message", "at"],
  localRequest: ["id", "local", "by", "groupId", "startDate", "endDate", "message", "status", "reply", "createdAt", "decidedAt"],
  review: ["id", "tripId", "from", "to", "dir", "stars", "cats", "tags", "text", "at", "reply", "historic", "tripEnd"],
  report: ["id", "kind", "about", "by", "text", "at", "status"],
  event: ["id", "featured", "category", "title", "organiser", "start", "end", "venue", "recurring", "expected", "price", "status", "about", "tiers", "includes", "bookingUrl", "bookingSite", "source"],
  tier: ["name", "price", "status", "note"],
} as const;

const NO_LOGIN = "!sample-no-login";
const flag = (v: unknown) => (v ? 1 : 0);
/** Event times in the prototype are Udaipur local time without an offset. */
const ist = (v: string | null | undefined) => (v ? (/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(v) ? `${v}:00+05:30` : v) : null);

/**
 * Loads the prototype's travellers, Local Friends, groups, reviews and events into the 0008 tables.
 * Re-runnable: it first removes what a previous run loaded (sample travellers and groups, and the same event ids).
 * Travellers, groups and reviews are demo data (is_sample = 1); events come from public listings (is_sample = 0).
 * Throws on any field it does not know, so nothing in the prototype data is dropped silently.
 */
export function importAbcMock(db: Db, data: AbcMock): Record<string, number> {
  const counts: Record<string, number> = {};
  const known = (label: keyof typeof KEYS, obj: object) => {
    const extra = Object.keys(obj).filter((k) => !(KEYS[label] as readonly string[]).includes(k));
    if (extra.length) throw new Error(`Unknown ${label} field(s): ${extra.join(", ")}`);
  };
  const add = (table: string, row: Record<string, unknown>) => {
    const cols = Object.keys(row);
    db.prepare(`INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`).run(...cols.map((c) => row[c] ?? null));
    counts[table] = (counts[table] ?? 0) + 1;
  };

  db.transaction(() => {
    db.prepare("DELETE FROM travel_groups WHERE is_sample = 1").run();
    db.prepare("DELETE FROM users WHERE id IN (SELECT user_id FROM traveller_profiles WHERE is_sample = 1)").run();
    const eventDelete = db.prepare("DELETE FROM events WHERE id = ?");
    for (const e of data.events) eventDelete.run(e.id);

    // Travellers and Local Friends
    for (const u of Object.values(data.users)) {
      known("user", u);
      add("users", { id: u.username, username: u.username, display_name: u.name, bio: u.bio ?? "", password_hash: NO_LOGIN, recovery_hash: NO_LOGIN });
      add("traveller_profiles", { user_id: u.username, city: u.city, travel_style: u.style, color: u.color, guest_rating: u.guest?.rating, guest_review_count: u.guest?.reviews ?? 0, is_sample: 1 });
    }
    for (const u of Object.values(data.users).filter((x) => x.type === "local")) {
      const l = u.local;
      known("local", l);
      known("verification", l.verification);
      add("local_friends", {
        user_id: u.username, area: l.area, about: l.about, years_in_city: l.years,
        price_minor: Math.round(l.pricing.amount * 100), price_unit: l.pricing.unit,
        rating: l.rating, review_count: l.reviews, hosted_count: l.hosted, response_rate: l.responseRate, cancel_rate: l.cancelRate,
        last_trip_at: l.lastTripAt, member_since: l.since,
        tier_current: l.tierState?.current, tier_since: l.tierState?.since, tier_warning_to: l.tierState?.warning?.to, tier_warning_at: l.tierState?.warning?.at,
        listed: l.listed === false ? 0 : 1, is_sample: 1,
      });
      for (const language of l.languages) add("local_friend_languages", { user_id: u.username, language });
      for (const topic of l.expertise) add("local_friend_expertise", { user_id: u.username, topic });
      const v = l.verification;
      add("local_verifications", { user_id: u.username, provider: v.provider, document: v.document, masked_id: v.masked, verified_at: v.verifiedAt, status: v.status ?? "verified", reason: v.reason });
      for (const h of v.history ?? []) add("local_verification_history", { user_id: u.username, status: h.status, reason: h.reason, at: h.at, by_name: h.by });
    }

    // Groups
    for (const g of data.groups) {
      known("group", g);
      add("travel_groups", {
        id: g.id, name: g.name, type: g.type, destination: g.destination, start_date: g.startDate, end_date: g.endDate,
        description: g.description ?? "", max_members: g.maxMembers, leader_id: g.leader, invite_code: g.code,
        solo: flag(g.solo), local_friend_id: g.localFriend, is_sample: 1, created_at: g.createdAt,
      });
      for (const vibe of g.vibe ?? []) add("group_vibes", { group_id: g.id, vibe });
      for (const user_id of g.members) add("group_members", { group_id: g.id, user_id });
      for (const r of g.requests ?? []) {
        known("joinRequest", r);
        add("group_join_requests", { id: `${g.id}:req:${r.username}`, group_id: g.id, user_id: r.username, message: r.message, created_at: r.at });
      }
      for (const i of g.itinerary ?? []) {
        known("item", i);
        add("group_itinerary_items", { id: `${g.id}:${i.id}`, group_id: g.id, day: i.day, time: i.time, title: i.title, place: i.place, note: i.note });
      }
      for (const s of g.suggestions ?? []) {
        known("suggestion", s);
        add("group_suggestions", {
          id: `${g.id}:${s.id}`, group_id: g.id, by_user: s.by, kind: s.kind, target_item_id: s.targetId ? `${g.id}:${s.targetId}` : null,
          proposed_json: s.proposed ? JSON.stringify(s.proposed) : null, reason: s.reason, status: s.status,
          decision_comment: s.decisionComment, decided_at: s.decidedAt, created_at: s.createdAt,
        });
      }
      for (const p of g.polls ?? []) {
        known("poll", p);
        add("group_polls", { id: `${g.id}:${p.id}`, group_id: g.id, by_user: p.by, question: p.question, multi: flag(p.multi), closed: flag(p.closed), created_at: p.createdAt });
        p.options.forEach((o: any, position: number) => {
          add("group_poll_options", { id: `${g.id}:${p.id}:${o.id}`, poll_id: `${g.id}:${p.id}`, position, text: o.text });
          for (const user_id of o.votes) add("group_poll_votes", { option_id: `${g.id}:${p.id}:${o.id}`, user_id });
        });
      }
      for (const m of g.messages ?? []) {
        known("message", m);
        add("group_messages", { id: `${g.id}:${m.id}`, group_id: g.id, kind: m.kind ?? "text", by_user: m.by, body: m.text, poll_id: m.pollId ? `${g.id}:${m.pollId}` : null, created_at: m.at });
      }
    }

    // Requests, reviews, reports
    for (const r of data.localRequests) {
      known("localRequest", r);
      add("local_requests", { id: r.id, local_id: r.local, by_user: r.by, group_id: r.groupId, start_date: r.startDate, end_date: r.endDate, message: r.message, status: r.status, reply: r.reply, created_at: r.createdAt, decided_at: r.decidedAt });
    }
    for (const r of data.reviews) {
      known("review", r);
      add("trip_reviews", {
        id: r.id, trip_group_id: r.tripId === "hist" ? null : r.tripId, from_user: r.from, to_user: r.to, direction: r.dir, stars: r.stars,
        categories_json: r.cats ? JSON.stringify(r.cats) : null, tags_json: JSON.stringify(r.tags ?? []), body: r.text, historic: flag(r.historic),
        trip_end: r.tripEnd, reply_text: r.reply?.text, reply_at: r.reply?.at, created_at: r.at,
      });
    }
    for (const r of data.reports) {
      known("report", r);
      add("local_friend_reports", { id: r.id, kind: r.kind, about_user: r.about, by_user: r.by, body: r.text, status: r.status, created_at: r.at });
    }

    // Events
    const insertCategory = db.prepare("INSERT OR REPLACE INTO event_categories (id, label, emoji, color) VALUES (?, ?, ?, ?)");
    for (const [id, c] of Object.entries(data.categories)) {
      insertCategory.run(id, c.label, c.emoji ?? null, c.color ?? null);
      counts.event_categories = (counts.event_categories ?? 0) + 1;
    }
    for (const e of data.events) {
      known("event", e);
      add("events", {
        id: e.id, category_id: e.category, title: e.title, organiser: e.organiser, starts_at: ist(e.start), ends_at: ist(e.end),
        expected_text: e.expected, recurring_text: e.recurring, venue: e.venue, price_text: e.price, ticket_status: e.status, about: e.about,
        booking_url: e.bookingUrl, booking_site: e.bookingSite, source_url: e.source, featured: flag(e.featured), checked_on: data.eventsChecked, is_sample: 0,
      });
      (e.tiers ?? []).forEach((t: any, position: number) => {
        known("tier", t);
        add("event_tiers", { event_id: e.id, position, name: t.name, price_text: t.price, status: t.status, note: t.note });
      });
      (e.includes ?? []).forEach((text: string, position: number) => add("event_includes", { event_id: e.id, position, text }));
    }
    for (const [user_id, prefs] of Object.entries(data.eventPrefs)) {
      for (const [event_id, p] of Object.entries(prefs)) add("event_attendance", { user_id, event_id, going: flag(p.going), attended: flag(p.attended) });
    }
    for (const r of data.eventReminders) add("event_reminders", { id: r.id, user_id: r.user, event_id: r.eventId, kind: r.kind, created_at: r.createdAt });
  })();
  return counts;
}
