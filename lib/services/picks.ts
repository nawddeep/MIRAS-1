import crypto from "node:crypto";
import { getRepos } from "@/lib/repos";
import { PickInput, type Pick } from "@/lib/schemas";

export type PublicPick = Omit<Pick, "lat" | "lng"> & { lat?: number; lng?: number };

export type SubmitResult = { ok: true; id: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Every submission starts as pending. Nothing a visitor sends is public until a named moderator approves it. */
export function submitPick(raw: unknown, now = new Date()): SubmitResult {
  const parsed = PickInput.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0] ?? "form")] ??= i.message;
    return { ok: false, error: "Please check the form.", fieldErrors };
  }
  const pick: Pick = { ...parsed.data, id: crypto.randomUUID(), status: "pending", createdAt: now.toISOString() };
  getRepos().picks.save(pick);
  return { ok: true, id: pick.id };
}

/** Approved picks only. Sensitive picks never carry coordinates outside the moderation screen. */
export function getPublicPicks(): PublicPick[] {
  return getRepos()
    .picks.list()
    .filter((p) => p.status === "approved")
    .map((p) => (p.sensitive ? { ...p, lat: undefined, lng: undefined } : p));
}

export class ModerationError extends Error {}

export function moderatePick(id: string, decision: "approve" | "reject", moderator: string, sourcedBy: string, now = new Date()): Pick {
  const pick = getRepos().picks.get(id);
  if (!pick) throw new ModerationError("Pick not found.");
  if (!moderator.trim()) throw new ModerationError("Add your name as the moderator.");
  if (decision === "approve" && !sourcedBy.trim()) throw new ModerationError("Approval needs a 'sourced by' note.");
  const next: Pick = {
    ...pick,
    status: decision === "approve" ? "approved" : "rejected",
    moderatedBy: moderator.trim(),
    moderatedAt: now.toISOString(),
    sourcedBy: decision === "approve" ? sourcedBy.trim() : pick.sourcedBy,
  };
  getRepos().picks.save(next);
  return next;
}
