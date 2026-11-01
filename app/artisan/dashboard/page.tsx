import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentMember } from '@/lib/community/http';
import { getMarketplace } from '@/lib/marketplace/store';
import { ArtisanDashboard } from '@/components/ArtisanDashboard';

export const metadata: Metadata = {
  title: 'Artisan Dashboard — MIRAS',
  robots: { index: false, follow: false },
};

export default async function ArtisanDashboardPage() {
  const user = await currentMember();
  if (!user) {
    redirect('/artisans/login');
  }

  if (user.role !== 'artisan') {
    return (
      <div className="max-w-md mx-auto py-12 px-4 text-center space-y-4">
        <h1 className="text-2xl font-medium">Access Restricted</h1>
        <p className="text-sm text-muted-paper">
          This dashboard is reserved for verified or registered artisans. Your account (@{user.username}) currently has the role: <strong>{user.role}</strong>.
        </p>
        <div className="pt-2">
          <Link href="/artisans/register" className="feature-primary px-4 py-2 text-xs inline-block">
            Register as Artisan ↗
          </Link>
        </div>
      </div>
    );
  }

  const marketplace = getMarketplace();
  const shop = marketplace.getShopByOwner(user.id) || null;
  const products = shop ? marketplace.listProductsByShop(shop.id, true) : [];
  const workshops = marketplace.listEvents({
    organizerId: user.id,
    includeDrafts: true,
    onlyUpcoming: false,
  });
  const friendProfile = marketplace.getLocalFriendProfile(user.id) || null;
  const friendRequests = marketplace.listFriendRequests(user.id);
  const reviews = shop ? marketplace.listReviewsForTarget('shop', shop.id) : [];

  return (
    <ArtisanDashboard
      user={user}
      initialShop={shop}
      initialProducts={products}
      initialWorkshops={workshops}
      initialFriendProfile={friendProfile}
      initialFriendRequests={friendRequests}
      initialReviews={reviews}
    />
  );
}
