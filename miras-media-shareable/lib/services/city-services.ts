import { currentMode, type Mode } from "../config";
import { getCoreDb } from "../db/core";

/**
 * Same rule as stories: samples show only in demo mode (the UI badges them).
 * A real row shows only when it is published and a named person has verified it.
 */
const visibleSql = (mode: Mode, verifiedColumn: string) => {
  const real = `(is_sample = 0 AND status = 'published' AND ${verifiedColumn} IS NOT NULL)`;
  return mode === "demo" ? `(is_sample = 1 OR ${real})` : real;
};

/* ---------- Stays (idea 15) ---------- */

export type StayPrice = {
  source: string;
  roomType: string | null;
  priceMinor: number;
  currency: string;
  url: string | null;
  checkedAt: string;
  cheapest: boolean;
};
export type Stay = {
  id: string;
  name: string;
  kind: string;
  description: string | null;
  area: string | null;
  lat: number;
  lng: number;
  phone: string | null;
  /** True only when a practice has been checked (or the row is a sample). */
  sustainable: boolean;
  practices: string[];
  isSample: boolean;
  prices: StayPrice[];
};

export function getVisibleStays(mode: Mode = currentMode()): Stay[] {
  const db = getCoreDb();
  const practices = db.prepare(`SELECT practice, verified_at FROM stay_sustainability WHERE stay_id = ? ORDER BY practice`);
  const prices = db.prepare(
    `SELECT source_name, room_type, price_minor, currency, url, checked_at, is_cheapest
     FROM v_stay_price_comparison WHERE stay_id = ? ORDER BY room_type, price_minor`,
  );
  const rows = db.prepare(`SELECT * FROM stays WHERE ${visibleSql(mode, "verified_at")} ORDER BY name`).all() as Record<string, string | number | null>[];
  return rows.map((r) => {
    const isSample = r.is_sample === 1;
    const listed = (practices.all(r.id) as { practice: string; verified_at: string | null }[]).filter((p) => isSample || p.verified_at).map((p) => p.practice);
    return {
      id: r.id as string,
      name: r.name as string,
      kind: r.kind as string,
      description: r.description as string | null,
      area: r.area as string | null,
      lat: r.lat as number,
      lng: r.lng as number,
      phone: r.phone as string | null,
      sustainable: r.sustainable === 1 && (isSample || listed.length > 0),
      practices: listed,
      isSample,
      prices: (prices.all(r.id) as Record<string, string | number | null>[]).map((p) => ({
        source: p.source_name as string,
        roomType: p.room_type as string | null,
        priceMinor: p.price_minor as number,
        currency: p.currency as string,
        url: p.url as string | null,
        checkedAt: p.checked_at as string,
        cheapest: p.is_cheapest === 1,
      })),
    };
  });
}

/* ---------- Rentals (idea 16) ---------- */

export type RentalOffer = {
  id: string;
  vehicleKind: "cycle" | "bike" | "scooter" | "car";
  model: string | null;
  priceMinor: number | null;
  per: "hour" | "day";
  depositMinor: number | null;
  notes: string | null;
};
export type RentalShop = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  area: string | null;
  phone: string;
  hoursText: string | null;
  isSample: boolean;
  offers: RentalOffer[];
};

export function getVisibleRentalShops(mode: Mode = currentMode()): RentalShop[] {
  const db = getCoreDb();
  const offers = db.prepare(`SELECT * FROM rental_offers WHERE shop_id = ? ORDER BY vehicle_kind, price_minor`);
  const rows = db.prepare(`SELECT * FROM rental_shops WHERE ${visibleSql(mode, "verified_at")} ORDER BY name`).all() as Record<string, string | number | null>[];
  return rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    lat: r.lat as number,
    lng: r.lng as number,
    area: r.area as string | null,
    phone: r.phone as string,
    hoursText: r.hours_text as string | null,
    isSample: r.is_sample === 1,
    offers: (offers.all(r.id) as Record<string, string | number | null>[]).map((o) => ({
      id: o.id as string,
      vehicleKind: o.vehicle_kind as RentalOffer["vehicleKind"],
      model: o.model as string | null,
      priceMinor: o.price_minor as number | null,
      per: o.per as RentalOffer["per"],
      depositMinor: o.deposit_minor as number | null,
      notes: o.notes as string | null,
    })),
  }));
}

/* ---------- Local companions (idea 22) ---------- */

export type Companion = {
  id: string;
  displayName: string;
  bio: string;
  bioHi: string | null;
  area: string | null;
  languages: string[];
  identityVerifiedAt: string | null;
  isSample: boolean;
  experiences: { id: string; title: string; description: string; durationMinutes: number; priceMinor: number | null; meetingArea: string | null; maxGuests: number }[];
  /** Open (not yet booked) time slots from now on. */
  slots: { id: string; startsAt: string; endsAt: string }[];
};

export function getVisibleCompanions(mode: Mode = currentMode(), now = new Date()): Companion[] {
  const db = getCoreDb();
  const languages = db.prepare(`SELECT language FROM companion_languages WHERE companion_id = ? ORDER BY language`);
  const experiences = db.prepare(`SELECT * FROM companion_experiences WHERE companion_id = ? AND status = 'published' ORDER BY title`);
  const slots = db.prepare(
    `SELECT id, starts_at, ends_at FROM companion_availability WHERE companion_id = ? AND is_booked = 0 AND starts_at >= ? ORDER BY starts_at LIMIT 6`,
  );
  const rows = db.prepare(`SELECT * FROM companions WHERE ${visibleSql(mode, "identity_verified_at")} ORDER BY display_name`).all() as Record<string, string | number | null>[];
  return rows.map((r) => ({
    id: r.id as string,
    displayName: r.display_name as string,
    bio: r.bio as string,
    bioHi: r.bio_hi as string | null,
    area: r.area_label as string | null,
    languages: (languages.all(r.id) as { language: string }[]).map((l) => l.language),
    identityVerifiedAt: r.identity_verified_at as string | null,
    isSample: r.is_sample === 1,
    experiences: (experiences.all(r.id) as Record<string, string | number | null>[]).map((e) => ({
      id: e.id as string,
      title: e.title as string,
      description: e.description as string,
      durationMinutes: e.duration_minutes as number,
      priceMinor: e.price_minor as number | null,
      meetingArea: e.meeting_area_label as string | null,
      maxGuests: e.max_guests as number,
    })),
    slots: (slots.all(r.id, now.toISOString()) as { id: string; starts_at: string; ends_at: string }[]).map((s) => ({ id: s.id, startsAt: s.starts_at, endsAt: s.ends_at })),
  }));
}
