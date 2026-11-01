import Link from "next/link";
import { connection } from "next/server";
import { EventsView } from "@/components/EventsView";
import { getEvents } from "@/lib/services/abc-services";
import { getOrganiserEvents } from "@/lib/services/organiser-events";

export default async function EventsPage() {
  await connection();
  // Curated listings and events organisers created themselves, in date order (undated ones last).
  const events = [...getEvents(), ...getOrganiserEvents()].sort((a, b) => (a.startsAt ? Date.parse(a.startsAt) : Infinity) - (b.startsAt ? Date.parse(b.startsAt) : Infinity));
  return (
    <div className="space-y-4">
      <h1 className="text-3xl">Events</h1>
      <p className="text-ink-soft">What is on in Udaipur, from organisers and public listings. Times are Indian Standard Time. Curated listings book on the organiser&apos;s page; events marked &ldquo;Listed by organiser&rdquo; take an enquiry here and are not verified by MIRAS.</p>
      <p className="text-sm">
        Running an event or workshop? <Link href="/events/register" className="underline">List it</Link> · <Link href="/events/login" className="underline">Organiser sign in</Link>
      </p>
      <EventsView events={events} />
    </div>
  );
}
