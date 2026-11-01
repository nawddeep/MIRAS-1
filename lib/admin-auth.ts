import crypto from "node:crypto";

// Moderation is protected by ADMIN_PASSCODE from .env. With no passcode set, moderation is disabled.
export const MOD_COOKIE = "miras_mod";

const passcode = () => process.env.ADMIN_PASSCODE?.trim() || undefined;
export const moderationEnabled = () => Boolean(passcode());

/** The cookie holds a hash of the passcode, never the passcode itself. */
const token = (code: string) => crypto.createHash("sha256").update(`miras-moderation:${code}`).digest("hex");

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** Returns the cookie value to set if the passcode is right, otherwise null. */
export function checkPasscode(input: string): string | null {
  const code = passcode();
  if (!code || !safeEqual(token(input), token(code))) return null;
  return token(code);
}

export function isModerator(cookieValue: string | undefined): boolean {
  const code = passcode();
  return Boolean(code && cookieValue && safeEqual(cookieValue, token(code)));
}
