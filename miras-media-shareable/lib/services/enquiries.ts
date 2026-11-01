import crypto from "node:crypto";
import { currentMode, type Mode } from "@/lib/config";
import { getRepos } from "@/lib/repos";
import { EnquiryInput, type Enquiry } from "@/lib/schemas";
import { isArtisanVisible } from "./artisans";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 3;

// In-memory sliding window per client. Good enough for one demo server; a hosted DB can replace it.
const hits = new Map<string, { at: number; fingerprint: string }[]>();

export function resetEnquiryLimits() {
  hits.clear();
}

export type EnquiryResult =
  | { ok: true; enquiry: Enquiry }
  | { ok: false; status: 400 | 404 | 429; error: string; fieldErrors?: Record<string, string> };

export function submitEnquiry(raw: unknown, clientKey: string, now = Date.now(), mode: Mode = currentMode()): EnquiryResult {
  const parsed = EnquiryInput.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0] ?? "form")] ??= i.message;
    return { ok: false, status: 400, error: "Please check the form.", fieldErrors };
  }
  const input = parsed.data;
  const artisan = getRepos().artisans.get(input.artisanId);
  if (!artisan || !isArtisanVisible(artisan, mode)) return { ok: false, status: 404, error: "This artisan is not available." };

  const recent = (hits.get(clientKey) ?? []).filter((h) => now - h.at < WINDOW_MS);
  const fingerprint = `${input.artisanId}:${input.message.toLocaleLowerCase()}`;
  if (recent.some((h) => h.fingerprint === fingerprint)) {
    return { ok: false, status: 429, error: "You already sent this message. The artisan will reply to you directly." };
  }
  if (recent.length >= MAX_PER_WINDOW) {
    return { ok: false, status: 429, error: "Too many messages in a short time. Please try again in a few minutes." };
  }
  hits.set(clientKey, [...recent, { at: now, fingerprint }]);

  const enquiry: Enquiry = { ...input, id: crypto.randomUUID(), createdAt: new Date(now).toISOString() };
  getRepos().enquiries.create(enquiry);
  return { ok: true, enquiry };
}
