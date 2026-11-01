export type Point = { lat: number; lng: number };

/** Great-circle distance in kilometres. */
export function distanceKm(a: Point, b: Point): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

export const directionsUrl = (p: Point) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;

/** Money is stored as integer minor units (paise). */
export function formatMoney(minor: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(minor / 100);
}

const IST_DATE: Intl.DateTimeFormatOptions = { timeZone: "Asia/Kolkata", dateStyle: "medium" };
export const formatDateIST = (iso: string) => new Date(iso).toLocaleDateString("en-IN", IST_DATE);
export const formatDateTimeIST = (iso: string) => `${new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })} IST`;

/** A phone number a visitor can really dial; placeholder text like "SAMPLE: phone goes here" is not. */
export const isDialable = (phone: string | null | undefined): phone is string => Boolean(phone && /^\+?[\d\s()-]{7,}$/.test(phone));
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;
