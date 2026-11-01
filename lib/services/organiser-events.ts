import { getCoreDb } from "../db/core";
import { getMarketplace, type EventType } from "../marketplace/store";
import type { AppEvent } from "./abc-services";

/** Which of the curated event categories each organiser event type is shown under. */
const CATEGORY: Record<EventType, string> = {
  workshop: "workshop",
  heritage_walk: "community",
  cultural_performance: "music",
  exhibition: "mela",
  festival: "mela",
  guided_experience: "community",
  community_event: "community",
  other: "community",
};

type CategoryRow = { id: string; label: string; emoji: string | null; color: string | null };

/**
 * Events that organisers and artisans created themselves (published ones only), in the same shape as the curated list
 * so /events can show both. They open an organiser detail page where visitors send an enquiry; there is no outside
 * booking link, and they are not verified by MIRAS.
 */
export function getOrganiserEvents(): AppEvent[] {
  const categories = new Map((getCoreDb().prepare("SELECT id, label, emoji, color FROM event_categories").all() as CategoryRow[]).map((c) => [c.id, c]));
  return getMarketplace()
    .listEvents()
    .map((e): AppEvent => {
      const end = new Date(Date.parse(e.startsAt) + e.durationMinutes * 60_000);
      const free = /^(free|₹?\s?0\b)/i.test(e.cost.trim());
      return {
        id: `organiser-${e.id}`,
        category: categories.get(CATEGORY[e.eventType]) ?? { id: "community", label: "Community", emoji: null, color: null },
        title: e.title,
        organiser: e.organizerName,
        startsAt: e.startsAt,
        endsAt: Number.isNaN(end.getTime()) ? null : end.toISOString(),
        expectedText: null,
        recurringText: null,
        venue: e.location,
        priceText: e.cost.trim() || "Ask the organiser",
        ticketStatus: free ? "free" : "on-sale",
        about: e.description,
        bookingUrl: null,
        bookingSite: null,
        featured: false,
        checkedOn: e.updatedAt.slice(0, 10),
        tiers: [],
        includes: e.materialsProvided.trim() ? [`Materials provided: ${e.materialsProvided.trim()}`] : [],
        detailHref: `/events/${e.id}`,
      };
    });
}
