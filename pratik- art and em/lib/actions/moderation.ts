"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { checkPasscode, isModerator, MOD_COOKIE } from "@/lib/admin-auth";
import { ModerationError, moderatePick } from "@/lib/services/picks";

export type ModState = { error?: string; ok?: string };

export async function signIn(_prev: ModState, form: FormData): Promise<ModState> {
  const value = checkPasscode(String(form.get("passcode") ?? ""));
  if (!value) return { error: "Wrong passcode." };
  (await cookies()).set(MOD_COOKIE, value, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: 60 * 60 * 8,
  });
  revalidatePath("/admin/moderation");
  return {};
}

export async function moderate(_prev: ModState, form: FormData): Promise<ModState> {
  if (!isModerator((await cookies()).get(MOD_COOKIE)?.value)) return { error: "Please sign in again." };
  try {
    const decision = form.get("decision") === "approve" ? "approve" : "reject";
    moderatePick(String(form.get("id") ?? ""), decision, String(form.get("moderator") ?? ""), String(form.get("sourcedBy") ?? ""));
    revalidatePath("/admin/moderation");
    revalidatePath("/picks");
    return { ok: decision === "approve" ? "Approved." : "Rejected." };
  } catch (e) {
    if (e instanceof ModerationError) return { error: e.message };
    throw e;
  }
}
