import Link from 'next/link';
import { BookmarkPlace } from './BookmarkPlace';
import type { Place, Trail } from '@/lib/schemas';
import { ArrowIcon } from './icons';

export function HomeDiscovery({ places, trail, craft }: { places: Place[]; trail?: Trail; craft?: Place }) {
  return <div className="home-discovery">
    <section className="home-recommendations"><div className="discovery-heading"><div><p className="discovery-eyebrow">A GOOD PLACE TO BEGIN</p><h2>Find your Udaipur.</h2></div><Link href="/places">All places <ArrowIcon size={17}/></Link></div><div className="recommendation-grid">{[...places].sort((a,b)=>(a.slug==='pichhola'?-1:b.slug==='pichhola'?1:0)).map(place=><article key={place.id} className="recommendation-card"><Link href={`/places/${place.slug}`} className="stack-card-link">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={place.photos[0]} alt="" width={480} height={360}/><div><h3>{place.name}</h3><span>{place.category} · {place.typicalVisitMinutes} min suggested</span></div></Link><BookmarkPlace slug={place.slug}/>
    </article>)}</div></section>
    <div className="home-editorial-grid">{trail && <section className="home-trail"><p className="discovery-eyebrow">TAKE THE SCENIC ROUTE</p><h2>A little walking.<br/>A lot of history.</h2><p>Palace courtyards, old-city lanes and the lakefront, in one suggested route.</p><div className="trail-line"><span>City Palace</span><span>Jagdish Temple</span><span>Bagore Ki Haveli</span></div><Link href={`/trails/${trail.id}`} className="discovery-cta">Explore this trail <ArrowIcon size={18}/></Link><small>{trail.placeIds.length} stops · About {Math.round(trail.approxMinutes/60)} hours · Estimate</small></section>}
    {craft && <section className="home-craft">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <Link href={`/places/${craft.slug}`}><img src={craft.photos[0]} alt="Shilpgram’s rural arts and crafts setting" width={600} height={340}/><div><p className="discovery-eyebrow">MADE HERE. REMEMBERED EVERYWHERE.</p><h2>The hands behind<br/>the heritage.</h2><p>Explore Shilpgram’s craft traditions, village architecture and stories.</p><span className="discovery-cta">Discover Shilpgram <ArrowIcon size={18}/></span></div></Link>
    </section>}</div>
    <section className="home-more-tools"><div className="discovery-heading"><div><p className="discovery-eyebrow">MAKE IT YOUR JOURNEY</p><h2>There’s more to your trip.</h2></div><Link href="/discover">All features <ArrowIcon size={17}/></Link></div><nav aria-label="Quick travel tools">{[['/discover/community','Community','Stories & memories'],['/discover/hotels','Find a stay','Search your area'],['/discover/rentals','Bikes & cars','Find rental shops'],['/discover/hidden','Hidden Udaipur','A different itinerary']].map(([href,title,detail])=><Link key={href} href={href}><strong>{title}</strong><small>{detail}</small><ArrowIcon size={18}/></Link>)}</nav><Link className="home-journal-link" href="/profile">Your saved places, passport &amp; travel tools <ArrowIcon size={18}/></Link></section>
  </div>;
}
