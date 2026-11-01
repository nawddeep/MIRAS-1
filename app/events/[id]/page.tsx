import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getMarketplace } from '@/lib/marketplace/store';
import { currentMember } from '@/lib/community/http';
import { EventDetailView } from '@/components/EventDetailView';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const event = getMarketplace().getEvent(id);
  if (!event) return { title: 'Event Not Found — MIRAS' };
  return {
    title: `${event.title} — MIRAS Udaipur Events`,
    description: event.description.slice(0, 160),
  };
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const marketplace = getMarketplace();
  const event = marketplace.getEvent(id);
  if (!event) notFound();

  const reviews = marketplace.listReviewsForTarget('event', event.id);
  const currentUser = await currentMember();

  return (
    <EventDetailView
      event={event}
      initialReviews={reviews}
      currentUser={currentUser || null}
    />
  );
}
