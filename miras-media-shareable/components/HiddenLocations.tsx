import Link from 'next/link';
import { PhotoCredits } from './PhotoCredits';
import { ImportedSpots } from './ImportedSpots';
import locations from '@/content/hidden-locations.json';
import { getVisiblePlaces } from '@/lib/services/content';

export function HiddenLocations() {
  const places = new Map(getVisiblePlaces().map(place=>[place.id,place]));
  return <div className="feature-preview"><Link href="/discover" className="feature-back">← All MIRAS features</Link><header className="feature-page-heading"><p className="feature-eyebrow">BEYOND THE PALACE ITINERARY</p><h1>Hidden Udaipur</h1><p>Ten known places for a different view of the city. “Hidden” means a curated alternative here, not a secret or unrestricted location.</p></header><p className="feature-disclosure">Map references are approximate. Search the named place and confirm its entrance, admission and access before travelling.</p><div className="space-y-6">{locations.map(location=>{
    const place=places.get(location.placeId);
    if(!place) return null;
    return <article key={location.id} className="border-b border-line pb-5">{/* eslint-disable-next-line @next/next/no-img-element */}
      <Link href={`/places/${place.slug}`} className="hidden-guide-photo"><img src={place.photos[0]} alt={place.name} width={720} height={420} loading="lazy" decoding="async"/></Link><h2 className="t-heading">{place.name}</h2><p lang="hi" className="font-display text-lg text-muted-paper">{place.name_hi}</p><p className="mt-2">{place.summary}</p><div className="feature-action-row"><Link href={`/places/${place.slug}`} className="feature-primary">Read the place guide</Link>{!location.sensitive && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name}, Udaipur, Rajasthan`)}`} target="_blank" rel="noopener noreferrer" className="feature-secondary">Find on Google Maps ↗</a>}</div><details className="text-sm"><summary className="min-h-11 cursor-pointer">Sources &amp; access notes</summary><p>{location.note}</p><p>{place.coordinateNote}</p>{place.sourceRefs?.map(source=><a className="inline-flex min-h-11 items-center underline" key={source} href={source} target="_blank" rel="noopener noreferrer">Official source ↗</a>)}</details><PhotoCredits paths={[place.photos[0]]}/></article>;
  })}</div><ImportedSpots/><Link href="/picks" className="feature-inline-link">Suggest a place of your own →</Link></div>;
}
