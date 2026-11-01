import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getMarketplace } from '@/lib/marketplace/store';
import { currentMember } from '@/lib/community/http';
import { LocalFriendsDirectory } from '@/components/LocalFriendsDirectory';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const friend = getMarketplace().getLocalFriendProfile(id);
  if (!friend) return { title: 'Local Friend Not Found — MIRAS' };
  return {
    title: `${friend.displayName} (Local Friend) — MIRAS Udaipur`,
    description: friend.introduction.slice(0, 160),
  };
}

export default async function LocalFriendProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const marketplace = getMarketplace();
  const friend = marketplace.getLocalFriendProfile(id);
  if (!friend) notFound();

  const currentUser = await currentMember();

  return (
    <LocalFriendsDirectory
      friends={[friend]}
      currentUser={currentUser || null}
      initialRoleFilter="all"
    />
  );
}
