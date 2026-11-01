import { currentMode, type Mode } from "../config";
import { getCoreDb } from "../db/core";

type Row = Record<string, string | number | null>;

/* ---------- C. Events ---------- */

export type AppEvent = {
  id: string;
  category: { id: string; label: string; emoji: string | null; color: string | null };
  title: string;
  organiser: string;
  startsAt: string | null;
  endsAt: string | null;
  expectedText: string | null;
  recurringText: string | null;
  venue: string;
  priceText: string;
  ticketStatus: "on-sale" | "few-left" | "sold-out" | "free" | "at-venue" | "tba" | "past";
  about: string;
  bookingUrl: string | null;
  bookingSite: string | null;
  featured: boolean;
  checkedOn: string;
  tiers: { name: string; priceText: string; status: string; note: string | null }[];
  includes: string[];
  /** Set for events organisers created themselves: opens their detail page instead of an outside booking link. */
  detailHref?: string | null;
};

/** Events come from public listings, so they show in every mode; sample rows would show in demo mode only. */
export function getEvents(mode: Mode = currentMode()): AppEvent[] {
  const db = getCoreDb();
  const tiers = db.prepare("SELECT name, price_text, status, note FROM event_tiers WHERE event_id = ? ORDER BY position");
  const includes = db.prepare("SELECT text FROM event_includes WHERE event_id = ? ORDER BY position");
  const rows = db
    .prepare(
      `SELECT e.*, c.label AS cat_label, c.emoji AS cat_emoji, c.color AS cat_color FROM events e JOIN event_categories c ON c.id = e.category_id
       WHERE ${mode === "demo" ? "1" : "e.is_sample = 0"} ORDER BY e.starts_at IS NULL, e.starts_at`,
    )
    .all() as Row[];
  return rows.map((r) => ({
    id: r.id as string,
    category: { id: r.category_id as string, label: r.cat_label as string, emoji: r.cat_emoji as string | null, color: r.cat_color as string | null },
    title: r.title as string,
    organiser: r.organiser as string,
    startsAt: r.starts_at as string | null,
    endsAt: r.ends_at as string | null,
    expectedText: r.expected_text as string | null,
    recurringText: r.recurring_text as string | null,
    venue: r.venue as string,
    priceText: r.price_text as string,
    ticketStatus: r.ticket_status as AppEvent["ticketStatus"],
    about: r.about as string,
    bookingUrl: r.booking_url as string | null,
    bookingSite: r.booking_site as string | null,
    featured: r.featured === 1,
    checkedOn: r.checked_on as string,
    tiers: (tiers.all(r.id) as Row[]).map((t) => ({ name: t.name as string, priceText: t.price_text as string, status: t.status as string, note: t.note as string | null })),
    includes: (includes.all(r.id) as { text: string }[]).map((i) => i.text),
  }));
}

/* ---------- B. Local Friends ---------- */

export type Tier = "new" | "trusted" | "top" | "legend";
export type LocalFriend = {
  id: string;
  name: string;
  area: string;
  about: string;
  yearsInCity: number | null;
  languages: string[];
  expertise: string[];
  priceMinor: number;
  priceUnit: string;
  rating: number | null;
  reviewCount: number;
  hostedCount: number;
  responseRate: number | null;
  tier: Tier;
  verifiedAt: string;
  isSample: boolean;
  reviews: { stars: number; body: string | null; by: string; at: string }[];
};

/** Tier rules from the prototype's README. A recorded tier (with its grace period) wins over the computed one. */
export function computeTier(f: { rating: number | null; hosted: number; responseRate: number | null; cancelRate: number | null; lastTripAt: string | null; memberSince: string | null }, now = new Date()): Tier {
  const rating = f.rating ?? 0;
  const days = (iso: string | null) => (iso ? (now.getTime() - Date.parse(iso)) / 86_400_000 : Infinity);
  if (f.hosted >= 50 && rating >= 4.8 && days(f.memberSince) >= 365) return "legend";
  if (f.hosted >= 20 && rating >= 4.7 && (f.responseRate ?? 0) >= 0.9 && (f.cancelRate ?? 1) <= 0.05 && days(f.lastTripAt) <= 90) return "top";
  if (f.hosted >= 5 && rating >= 4.3) return "trusted";
  return "new";
}
const TIER_ORDER: Tier[] = ["new", "trusted", "top", "legend"];

/** Listed and currently DigiLocker-verified Local Friends. Demo-flagged rows show in demo mode only. */
export function getLocalFriends(mode: Mode = currentMode(), now = new Date()): LocalFriend[] {
  const db = getCoreDb();
  const languages = db.prepare("SELECT language FROM local_friend_languages WHERE user_id = ? ORDER BY language");
  const expertise = db.prepare("SELECT topic FROM local_friend_expertise WHERE user_id = ? ORDER BY topic");
  const reviews = db.prepare(
    `SELECT r.stars, r.body, r.created_at, u.display_name FROM trip_reviews r JOIN users u ON u.id = r.from_user
     WHERE r.to_user = ? AND r.direction = 't2l' ORDER BY r.created_at DESC LIMIT 2`,
  );
  const rows = db
    .prepare(
      `SELECT lf.*, u.display_name, v.verified_at FROM local_friends lf
       JOIN users u ON u.id = lf.user_id JOIN local_verifications v ON v.user_id = lf.user_id
       WHERE lf.listed = 1 AND v.status = 'verified' AND ${mode === "demo" ? "1" : "lf.is_sample = 0"}`,
    )
    .all() as Row[];
  const friends = rows.map((r): LocalFriend => {
    const computed = computeTier({ rating: r.rating as number | null, hosted: r.hosted_count as number, responseRate: r.response_rate as number | null, cancelRate: r.cancel_rate as number | null, lastTripAt: r.last_trip_at as string | null, memberSince: r.member_since as string | null }, now);
    return {
      id: r.user_id as string,
      name: r.display_name as string,
      area: r.area as string,
      about: r.about as string,
      yearsInCity: r.years_in_city as number | null,
      languages: (languages.all(r.user_id) as { language: string }[]).map((l) => l.language),
      expertise: (expertise.all(r.user_id) as { topic: string }[]).map((t) => t.topic),
      priceMinor: r.price_minor as number,
      priceUnit: r.price_unit as string,
      rating: r.rating as number | null,
      reviewCount: r.review_count as number,
      hostedCount: r.hosted_count as number,
      responseRate: r.response_rate as number | null,
      tier: (r.tier_current as Tier | null) ?? computed,
      verifiedAt: r.verified_at as string,
      isSample: r.is_sample === 1,
      reviews: (reviews.all(r.user_id) as Row[]).map((v) => ({ stars: v.stars as number, body: v.body as string | null, by: v.display_name as string, at: v.created_at as string })),
    };
  });
  // Higher tier first, then rating, so the directory ranks trusted locals higher.
  return friends.sort((a, b) => TIER_ORDER.indexOf(b.tier) - TIER_ORDER.indexOf(a.tier) || (b.rating ?? 0) - (a.rating ?? 0));
}

/* ---------- A. Travel groups ---------- */

export type GroupCard = {
  id: string;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  description: string;
  vibes: string[];
  memberCount: number;
  maxMembers: number;
  leaderName: string;
  localFriendName: string | null;
  isSample: boolean;
};
export type GroupDetail = GroupCard & {
  members: string[];
  itinerary: { id: string; day: number; time: string; title: string; place: string | null; note: string | null }[];
};

const groupSql = (mode: Mode) => `
  SELECT g.*, lu.display_name AS leader_name, fu.display_name AS friend_name,
         (SELECT COUNT(*) FROM group_members m WHERE m.group_id = g.id) AS member_count
  FROM travel_groups g JOIN users lu ON lu.id = g.leader_id LEFT JOIN users fu ON fu.id = g.local_friend_id
  WHERE g.type = 'public' AND g.solo = 0 AND ${mode === "demo" ? "1" : "g.is_sample = 0"}`;

function toCard(r: Row, vibes: string[]): GroupCard {
  return {
    id: r.id as string, name: r.name as string, destination: r.destination as string, startDate: r.start_date as string, endDate: r.end_date as string,
    description: r.description as string, vibes, memberCount: r.member_count as number, maxMembers: r.max_members as number,
    leaderName: r.leader_name as string, localFriendName: r.friend_name as string | null, isSample: r.is_sample === 1,
  };
}

/** Only public groups are listed. Private groups join by invite code and are never browsable. */
export function getPublicGroups(mode: Mode = currentMode()): GroupCard[] {
  const db = getCoreDb();
  const vibes = db.prepare("SELECT vibe FROM group_vibes WHERE group_id = ? ORDER BY vibe");
  return (db.prepare(`${groupSql(mode)} ORDER BY g.start_date`).all() as Row[]).map((r) => toCard(r, (vibes.all(r.id) as { vibe: string }[]).map((v) => v.vibe)));
}

/** A public group's page: itinerary and members. Chat and polls stay members-only. */
export function getPublicGroup(id: string, mode: Mode = currentMode()): GroupDetail | undefined {
  const db = getCoreDb();
  const row = db.prepare(`${groupSql(mode)} AND g.id = ?`).get(id) as Row | undefined;
  if (!row) return undefined;
  const vibes = (db.prepare("SELECT vibe FROM group_vibes WHERE group_id = ? ORDER BY vibe").all(id) as { vibe: string }[]).map((v) => v.vibe);
  const members = (db.prepare("SELECT u.display_name FROM group_members m JOIN users u ON u.id = m.user_id WHERE m.group_id = ? ORDER BY u.display_name").all(id) as { display_name: string }[]).map((m) => m.display_name);
  const itinerary = (db.prepare("SELECT id, day, time, title, place, note FROM group_itinerary_items WHERE group_id = ? ORDER BY day, time").all(id) as Row[]).map((i) => ({
    id: i.id as string, day: i.day as number, time: i.time as string, title: i.title as string, place: i.place as string | null, note: i.note as string | null,
  }));
  return { ...toCard(row, vibes), members, itinerary };
}
