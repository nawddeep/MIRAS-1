import Link from 'next/link';
import { frontendFeatures } from '@/lib/frontend-features';
import { ArrowIcon } from './icons';

export function FeatureMenu() {
  return <section className="feature-menu"><div className="hours-section-heading"><h2>More from MIRAS</h2><Link href="/discover">View all <ArrowIcon size={16}/></Link></div><nav aria-label="MIRAS features" className="feature-menu-grid">{frontendFeatures.slice(0,6).map((feature, index) => <Link key={feature.id} href={`/discover/${feature.id}`}><span className="feature-number" aria-hidden="true">{String(index+1).padStart(2,'0')}</span><span><strong>{feature.title}</strong><small lang="hi">{feature.hi}</small></span><ArrowIcon size={18}/></Link>)}</nav><Link className="feature-inline-link" href="/memories">Create a memory <ArrowIcon size={18}/></Link><Link className="feature-inline-link" href="/artisans">Meet local artisans <ArrowIcon size={18}/></Link></section>;
}
