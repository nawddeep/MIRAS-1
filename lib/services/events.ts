import { currentMode, type Mode } from "@/lib/config";
import { getRepos } from "@/lib/repos";
import type { EventItem } from "@/lib/schemas";

/** Real events show only once the organiser has confirmed them. Samples show only in demo mode. Past events are hidden. */
export function isEventVisible(e: EventItem, mode: Mode, now: Date): boolean {
  if (Date.parse(e.startsAt) < now.getTime()) return false;
  if (e.isSample) return mode === "demo";
  return Boolean(e.confirmedByOrganiserAt);
}

export function getVisibleEvents(mode: Mode = currentMode(), now = new Date()): EventItem[] {
  return getRepos()
    .events.list()
    .filter((e) => isEventVisible(e, mode, now))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

const IST: Intl.DateTimeFormatOptions = { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" };
export const formatIST = (iso: string) => `${new Date(iso).toLocaleString("en-IN", IST)} IST`;
