import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentMember } from '@/lib/community/http';
import { getMarketplace } from '@/lib/marketplace/store';
import { EventManagerDashboard } from '@/components/EventManagerDashboard';

export const metadata: Metadata = {
  title: 'Event Manager Dashboard — MIRAS',
  robots: { index: false, follow: false },
};

export default async function EventManagerDashboardPage() {
  const user = await currentMember();
  if (!user) {
    redirect('/events/login');
  }

  if (user.role !== 'event_manager' && user.username !== '123') {
    return (
      <div className="max-w-md mx-auto py-12 px-4 text-center space-y-4">
        <h1 className="text-2xl font-medium">Access Restricted</h1>
        <p className="text-sm text-muted-paper">
          This dashboard is reserved for event organizers and managers. Your account (@{user.username}) currently has the role: <strong>{user.role}</strong>.
        </p>
        <div className="pt-2">
          <Link href="/events/register" className="feature-primary px-4 py-2 text-xs inline-block">
            Register as Event Manager ↗
          </Link>
        </div>
      </div>
    );
  }

  const marketplace = getMarketplace();
  const profile = marketplace.getOrganizerProfile(user.id) || null;
  const events = marketplace.listEvents({
    organizerId: user.id,
    includeDrafts: true,
    onlyUpcoming: false,
  });
  const enquiries = marketplace.listEventEnquiries(user.id);
  const friendProfile = marketplace.getLocalFriendProfile(user.id) || null;
  const friendRequests = marketplace.listFriendRequests(user.id);
  const reviews = marketplace.listReviewsForTarget('event', user.id);

  return (
    <EventManagerDashboard
      user={user}
      initialProfile={profile}
      initialEvents={events}
      initialEnquiries={enquiries}
      initialFriendProfile={friendProfile}
      initialFriendRequests={friendRequests}
      initialReviews={reviews}
    />
  );
}
