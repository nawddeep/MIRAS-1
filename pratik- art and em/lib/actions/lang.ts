"use server";

import { cookies } from "next/headers";
import { LANG_COOKIE, type Lang } from "@/lib/i18n";

export async function setLang(lang: Lang) {
  (await cookies()).set(LANG_COOKIE, lang === "hi" ? "hi" : "en", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}
