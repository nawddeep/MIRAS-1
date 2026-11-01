import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getMarketplace } from '@/lib/marketplace/store';
import { currentMember } from '@/lib/community/http';
import { ShopDetailView } from '@/components/ShopDetailView';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const shop = getMarketplace().getShopBySlug(slug);
  if (!shop) return { title: 'Artisan Shop Not Found — MIRAS' };
  return {
    title: `${shop.name} (${shop.craft}) — MIRAS Udaipur`,
    description: shop.description.slice(0, 160),
  };
}

export default async function ShopPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const marketplace = getMarketplace();
  const shop = marketplace.getShopBySlug(slug);
  if (!shop) notFound();

  const products = marketplace.listProductsByShop(shop.id, false);
  const workshops = marketplace.listEvents({
    organizerId: shop.ownerAccountId,
    includeDrafts: false,
    onlyUpcoming: false,
  });
  const friendProfile = marketplace.getLocalFriendProfile(shop.ownerAccountId) || null;
  const reviews = marketplace.listReviewsForTarget('shop', shop.id);
  const currentUser = await currentMember();

  return (
    <ShopDetailView
      shop={shop}
      products={products}
      workshops={workshops}
      friendProfile={friendProfile}
      initialReviews={reviews}
      currentUser={currentUser || null}
    />
  );
}
