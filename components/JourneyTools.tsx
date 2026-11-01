import Link from 'next/link';
import { ArrowIcon } from './icons';

const tools = [
  ['/camera', 'Camera stories', 'Look at a place through its stories'],
  ['/passport', 'Heritage passport', 'Stories read, memories collected'],
  ['/offline', 'Offline guides', 'Take your saved guides with you'],
  ['/plan', 'Plan your day', 'Build a personal itinerary'],
  ['/trails', 'Walking trails', 'Explore at your own pace'],
  ['/memories', 'Memories', 'Keep moments from your journey'],
  ['/artisans', 'Local artisans', 'Discover Udaipur’s living crafts'],
  ['/events', 'Events', 'See what’s coming up'],
  ['/picks', 'Visitor suggestions', 'Share a favourite place'],
  ['/replay', '360 replay', 'Open your own panoramic photo'],
  ['/onboard', 'Share your craft', 'Create an artisan listing'],
];

export function JourneyTools() {
  return <section className="journey-tools"><h2 className="t-heading">Make it your journey</h2><nav aria-label="Travel tools" className="profile-tools">{tools.map(([href,title,description])=><Link key={href} href={href}><span><strong>{title}</strong><small>{description}</small></span><ArrowIcon size={20}/></Link>)}</nav></section>;
}
