import type { TripRequest } from "./types";

export const TZ = "Asia/Kolkata";

export function km(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
}

export function minutes(totalMin: number): string {
  const m = Math.round(totalMin);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

export function duration(seconds: number): string {
  return minutes(seconds / 60);
}

export function inr(amount: number, currency = "INR"): string {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount)}`;
  }
}

export function checkedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "time unknown";
  return new Intl.DateTimeFormat("en-IN", { timeZone: TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d) + " IST";
}

export function longDate(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  return new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short" }).format(d);
}

export function addDays(isoDate: string, n: number): string {
  const d = new Date(`${isoDate}T00:00:00`);
  d.setDate(d.getDate() + n);
  return localIso(d);
}

export function localIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayIso(): string {
  return localIso(new Date());
}

// Trip requests travel in the URL (base64url JSON) so results can be reloaded or shared before saving.
export function encodeRequest(req: TripRequest): string {
  const bytes = new TextEncoder().encode(JSON.stringify(req));
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeRequest(s: string): TripRequest | null {
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as TripRequest;
  } catch {
    return null;
  }
}

export const PRICE_LABEL: Record<string, string> = {
  PRICE_LEVEL_FREE: "Free",
  PRICE_LEVEL_INEXPENSIVE: "Inexpensive",
  PRICE_LEVEL_MODERATE: "Moderate",
  PRICE_LEVEL_EXPENSIVE: "Expensive",
  PRICE_LEVEL_VERY_EXPENSIVE: "Very expensive",
};

export const MODE_LABEL: Record<string, string> = { walk: "Walk", cycle: "Cycle", scooter: "Two-wheeler", car: "Four-wheeler" };
export const MODE_ORDER = ["scooter", "car", "walk", "cycle"] as const;

/** Google Maps directions between two points for a travel mode (no key needed). */
export function directionsUrl(a: { lat: number; lng: number }, b: { lat: number; lng: number }, mode: string): string {
  const travelmode = { walk: "walking", cycle: "bicycling", scooter: "two-wheeler", car: "driving" }[mode] ?? "driving";
  const q = new URLSearchParams({ api: "1", origin: `${a.lat},${a.lng}`, destination: `${b.lat},${b.lng}`, travelmode });
  return `https://www.google.com/maps/dir/?${q}`;
}
