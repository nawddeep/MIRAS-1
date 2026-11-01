import { z } from "zod";
import { currentMode, type Mode } from "@/lib/config";
import { getRepos } from "@/lib/repos";
import type { Artisan, Workshop } from "@/lib/schemas";
import { artisanPublishBlockers, saveArtisan, workshopPublishBlockers } from "./publishing";

/** Real listings show only when published AND still passing the gate. Samples show only in demo mode. */
export function isArtisanVisible(a: Artisan, mode: Mode): boolean {
  if (a.isSample) return mode === "demo";
  return a.status === "published" && artisanPublishBlockers(a).length === 0;
}

export function getVisibleArtisans(mode: Mode = currentMode()): Artisan[] {
  return getRepos()
    .artisans.list()
    .filter((a) => isArtisanVisible(a, mode));
}

export function getVisibleArtisan(id: string, mode: Mode = currentMode()): Artisan | undefined {
  const a = getRepos().artisans.get(id);
  return a && isArtisanVisible(a, mode) ? a : undefined;
}

export function isWorkshopVisible(w: Workshop, mode: Mode): boolean {
  if (w.isSample) return mode === "demo";
  return w.status === "published" && workshopPublishBlockers(w).length === 0;
}

export function getVisibleWorkshops(artisanId: string, mode: Mode = currentMode()): Workshop[] {
  return getRepos()
    .workshops.list()
    .filter((w) => w.artisanId === artisanId && isWorkshopVisible(w, mode));
}

/** Fields an owner may change from their private edit link. Status and consent go through their own paths. */
export const OwnerEdit = z.object({
  name: z.string().trim().min(1).max(120),
  craft: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(2000),
  description_hi: z.string().trim().max(2000).optional(),
  materials: z.array(z.string().trim().min(1).max(60)).max(20),
  languages: z.array(z.string().trim().min(1).max(40)).min(1).max(10),
  contact: z.string().trim().min(3).max(200),
  locationText: z.string().trim().min(1).max(200),
});
export type OwnerEdit = z.infer<typeof OwnerEdit>;

export function applyOwnerEdit(a: Artisan, edit: OwnerEdit): Artisan {
  return saveArtisan({ ...a, ...edit });
}

/** Consent ticked in the app. The doc reference records exactly which wording was agreed to. */
export const IN_APP_CONSENT_REF = "in-app consent checkbox, wording v1";

export function recordInAppConsent(a: Artisan, now = new Date()): Artisan {
  return saveArtisan({ ...a, consent: { given: true, date: now.toISOString(), docRef: a.consent.docRef || IN_APP_CONSENT_REF } });
}
