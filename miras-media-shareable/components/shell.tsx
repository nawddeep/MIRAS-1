"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { BackIcon, PlanIcon, HomeIcon, ProfileIcon, PlacesIcon, SearchIcon, StoriesIcon, GridIcon, MediaIcon, Studio360Icon } from "./icons";

// Screens that draw their own top area (home greeting, full-screen camera, full-screen media).
const OWN_TOP = new Set(["/", "/camera", "/plan", "/discover/community"]);

/** Back button, wordmark and the language toggle (which replaces the board's bell and avatar). */
export function TopBar({ appName, right }: { appName: string; right: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [search, setSearch] = useState(false);
  if (OWN_TOP.has(pathname) || pathname.startsWith("/media")) return null;
  const detail = /^\/(places|stories|artisans)\/.+/.test(pathname);
  const title = pathname === '/places' ? 'Explore Places' : pathname === '/stories' ? 'Stories' : pathname === '/profile' ? 'Your Udaipur' : pathname === '/account' ? 'Your account' : pathname === '/journeys' ? 'Your journeys' : pathname === '/discover' ? '' : appName;
  const hi = pathname === '/places' ? 'उदयपुर के स्थल' : pathname === '/stories' ? 'कहानियाँ' : null;
  return (
    <header className={`miras-top ${detail ? 'detail-toolbar' : ''} ${search ? 'search-open' : ''} sticky top-0 z-30 border-b border-line bg-paper/95 pt-[env(safe-area-inset-top)]`}>
      <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-1.5">
        <button type="button" aria-label="Back" onClick={() => (window.history.length > 1 ? router.back() : router.push('/'))} className="toolbar-back grid h-11 w-11 place-items-center rounded-full"><BackIcon /></button>
        <Link href="/" className="toolbar-title flex flex-1 flex-col font-display text-xl"><span>{title}</span>{hi && <small lang="hi">{hi}</small>}</Link>
        <div className="flex items-center gap-2">
          <Link
            href="/media"
            className="toolbar-media-btn inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-600 via-rose-600 to-pink-600 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:opacity-90 active:scale-95"
            aria-label="Media & Social Feed"
          >
            <span aria-hidden="true">✦</span>
            <span>Media</span>
          </Link>
          {pathname === "/discover" ? <Link href="/search" aria-label="Search MIRAS" className="toolbar-search grid h-11 w-11 place-items-center rounded-full"><SearchIcon/></Link> : pathname === "/profile" ? <Link href="/discover" aria-label="All journal tools" className="toolbar-search grid h-11 w-11 place-items-center rounded-full"><GridIcon/></Link> : pathname === "/places" ? <Link href="/discover" className="toolbar-more">More ↗</Link> : hi ? <button type="button" aria-label="Search this collection" aria-expanded={search} className="toolbar-search grid h-11 w-11 place-items-center rounded-full" onClick={()=>setSearch(!search)}><SearchIcon size={22}/></button> : <div className="toolbar-language">{right}</div>}
        </div>
      </div>
    </header>
  );
}

type Slot = "home" | "places" | "plan" | "stories" | "media" | "studio" | "makers";
const SLOTS = [
  { slot: "home", href: "/", icon: HomeIcon },
  { slot: "places", href: "/places", icon: PlacesIcon },
  { slot: "plan", href: "/plan", icon: PlanIcon },
  { slot: "stories", href: "/stories", icon: StoriesIcon },
  { slot: "media", href: "/media", icon: MediaIcon },
  { slot: "studio", href: "/replay", icon: Studio360Icon },
  { slot: "makers", href: "/profile", icon: ProfileIcon },
] as const;

export function BottomNav({ labels }: { labels: Record<Slot, string> }) {
  const pathname = usePathname();
  if (pathname.startsWith("/media")) return null;
  const active = (href: string) =>
    href === "/profile"
      ? ["/profile", "/account", "/journeys", "/people"].some((route) => pathname.startsWith(route))
      : href === "/"
      ? pathname === "/"
      : href === "/places"
      ? ["/places", "/discover", "/trails", "/artisans"].some((route) => pathname.startsWith(route))
      : href === "/media"
      ? pathname.startsWith("/media")
      : href === "/replay"
      ? pathname.startsWith("/replay")
      : pathname.startsWith(href);
  return <nav aria-label="Main" className="miras-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line pb-[env(safe-area-inset-bottom)]"><ul className="mx-auto flex max-w-xl items-center justify-around">{SLOTS.map(({slot,href,icon:Icon})=><li key={slot}><Link href={href} aria-current={active(href)?"page":undefined}><Icon size={22}/><span>{labels[slot]}</span></Link></li>)}</ul></nav>;
}
