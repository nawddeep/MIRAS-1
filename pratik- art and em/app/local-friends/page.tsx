import type { Metadata } from 'next';
import { getMarketplace } from '@/lib/marketplace/store';
import { currentMember } from '@/lib/community/http';
import { LocalFriendsDirectory } from '@/components/LocalFriendsDirectory';

export const metadata: Metadata = {
  title: 'Local Friends — MIRAS Udaipur',
  description: 'Connect with authentic local artisans and heritage experience managers in Udaipur.',
};

export default async function LocalFriendsPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: 'artisan' | 'event_manager' }>;
}) {
  const { role } = await searchParams;
  const marketplace = getMarketplace();
  const friends = marketplace.listPublicLocalFriends(role);
  const currentUser = await currentMember();

  return (
    <LocalFriendsDirectory
      friends={friends}
      currentUser={currentUser || null}
      initialRoleFilter={role || 'all'}
    />
  );
}
