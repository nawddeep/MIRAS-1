import { getRepos } from "@/lib/repos";
import type { Artisan, Workshop } from "@/lib/schemas";

// All publishing gates live here. UI and API routes call these; nothing else flips a status to "published".

export class PublishGateError extends Error {
  constructor(public missing: string[]) {
    super(`Cannot publish: ${missing.join(", ")}`);
  }
}

/** Artisan gate: recorded consent (given + date) and owner confirmation. Sample listings never publish. */
export function artisanPublishBlockers(a: Artisan): string[] {
  const missing: string[] = [];
  if (a.isSample) missing.push("sample listings cannot be published");
  if (!a.consent.given) missing.push("consent not given");
  if (!a.consent.date) missing.push("consent date missing");
  if (!a.ownerConfirmedAt) missing.push("owner has not confirmed the listing");
  return missing;
}

/** Workshop gate: the owner must have confirmed the details. */
export function workshopPublishBlockers(w: Workshop): string[] {
  const missing: string[] = [];
  if (w.isSample) missing.push("sample workshops cannot be published");
  if (!w.confirmedByOwnerAt) missing.push("owner has not confirmed the workshop details");
  return missing;
}

/** The one write path for artisans. Refuses to store a published listing that fails the gate. */
export function saveArtisan(a: Artisan): Artisan {
  if (a.status === "published") {
    const missing = artisanPublishBlockers(a);
    if (missing.length) throw new PublishGateError(missing);
  }
  getRepos().artisans.save(a);
  return a;
}

/** Owner taps Publish: that tap is the owner confirmation, then the consent gate decides. */
export function publishArtisanAsOwner(a: Artisan, now = new Date()): Artisan {
  return saveArtisan({ ...a, ownerConfirmedAt: now.toISOString(), status: "published" });
}

export function unpublishArtisan(a: Artisan): Artisan {
  return saveArtisan({ ...a, status: "draft" });
}

export function saveWorkshop(w: Workshop): Workshop {
  if (w.status === "published") {
    const missing = workshopPublishBlockers(w);
    if (missing.length) throw new PublishGateError(missing);
  }
  getRepos().workshops.save(w);
  return w;
}
