import Link from "next/link";
import { currentMember } from "@/lib/community/http";
import { ProfileJournal } from "@/components/ProfileJournal";
import { getVisiblePlaces, getVisibleStories } from "@/lib/services/content";

export default async function ProfilePage() {
  const user=await currentMember();
  const places = getVisiblePlaces();
  const items = [
    ...places.map(place => ({ id: place.slug, title: place.name, subtitle: place.name_hi, href: `/places/${place.slug}`, image: place.photos[0] || "/media/pichhola/palace.webp", kind: "place" as const })),
    ...places.flatMap(place => getVisibleStories(place.id).map(story => ({ id: story.id, title: story.title, subtitle: story.title_hi, href: `/stories/${story.id}`, image: place.photos[0] || "/media/pichhola/story.webp", kind: "story" as const }))),
  ];
  return <div className="profile-screen space-y-7">
    <header className="profile-intro"><span className="journal-monogram" aria-hidden="true">{user?.name.slice(0,1)||"M"}</span><p>{user?`${user.name} · @${user.username}`:"A little Udaipur, kept for later."}</p><small>Saved on this device</small></header>
    <ProfileJournal items={items}/>
    <nav className="profile-tools" aria-label="Journal tools">{[["/account","Account & privacy"],["/discover/community","Community & memories"],["/journeys","My journeys & badges"],["/offline","Offline guides"],["/passport","Heritage passport"],["/discover","All MIRAS features"]].map(([href,title])=><Link href={href} key={href}>{title}<span aria-hidden="true">↗</span></Link>)}</nav>
    <details className="profile-install"><summary>Keep MIRAS on your home screen</summary><p>On iPhone or iPad, open MIRAS in Safari, tap Share, then Add to Home Screen. On Android, use your browser’s Install app or Add to Home screen option when available.</p><p>Camera access requires HTTPS or localhost. Saved collections stay on this device.</p></details>
  </div>;
}
