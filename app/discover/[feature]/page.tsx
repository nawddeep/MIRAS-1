import { CommunityFeed } from '@/components/CommunityFeed';
import { redirect } from 'next/navigation';
import { HiddenLocations } from '@/components/HiddenLocations';
import { notFound } from 'next/navigation';
import { RentalsView, StaysView } from '@/components/CityServices';
import { FeatureFrame } from '@/components/FeatureFrame';
import { FeaturePreview } from '@/components/FeaturePreview';
import { LocalFriendsView } from '@/components/LocalFriendsView';
import { frontendFeatures } from '@/lib/frontend-features';
import { getLang } from '@/lib/lang-server';
import { getLocalFriends } from '@/lib/services/abc-services';
import { getVisibleRentalShops, getVisibleStays } from '@/lib/services/city-services';

export default async function FeaturePage({ params }: PageProps<'/discover/[feature]'>) {
  const { feature } = await params;
  const entry = frontendFeatures.find(item=>item.id===feature);
  if (!entry) notFound();
  if (feature === 'community') return <CommunityFeed/>;
  if (feature === 'account') redirect('/account');
  if (feature === 'badges') redirect('/journeys');
  if (feature === 'hidden') return <HiddenLocations />;
  if (feature === 'hotels') return <FeatureFrame feature={entry} banner="category-heritage"><StaysView stays={getVisibleStays()} lang={await getLang()} /></FeatureFrame>;
  if (feature === 'rentals') return <FeatureFrame feature={entry} banner="category-nature"><RentalsView shops={getVisibleRentalShops()} lang={await getLang()} /></FeatureFrame>;
  if (feature === 'locals') return <FeatureFrame feature={entry} banner="category-waterfront"><LocalFriendsView friends={getLocalFriends()} /></FeatureFrame>;
  return <FeaturePreview feature={entry}/>;
}
