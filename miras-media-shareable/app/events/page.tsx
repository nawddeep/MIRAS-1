import { connection } from "next/server";
import { EventsView } from "@/components/EventsView";
import { getEvents } from "@/lib/services/abc-services";

export default async function EventsPage() {
  await connection();
  return (
    <div className="space-y-4">
      <h1 className="text-3xl">Events</h1>
      <p className="text-ink-soft">What is on in Udaipur, from organisers and public listings. Times are Indian Standard Time. Booking happens on the organiser&apos;s page, outside MIRAS.</p>
      <EventsView events={getEvents()} />
    </div>
  );
}
