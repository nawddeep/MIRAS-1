"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode } from "react";
import { BackIcon, HomeIcon, ProfileIcon, PlacesIcon, StoriesIcon, GridIcon } from "./icons";

const OWN_TOP = new Set(["/"]);

/** Back button, wordmark and the language toggle. */
export function TopBar({ appName, right }: { appName: string; right: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  if (OWN_TOP.has(pathname)) return null;

  let title = appName;
  if (pathname.startsWith('/artisans/login')) title = 'Artisan Sign In';
  else if (pathname.startsWith('/artisans/register')) title = 'Artisan Registration';
  else if (pathname.startsWith('/artisan/dashboard')) title = 'Artisan Workspace';
  else if (pathname.startsWith('/artisans')) title = 'Explore Artisans';
  else if (pathname.startsWith('/events/login')) title = 'Event Manager Sign In';
  else if (pathname.startsWith('/events/register')) title = 'Organizer Registration';
  else if (pathname.startsWith('/event-manager/dashboard')) title = 'Event Manager Workspace';
  else if (pathname.startsWith('/events')) title = 'Explore Events';
  else if (pathname.startsWith('/local-friends')) title = 'Local Friends';
  else if (pathname.startsWith('/account')) title = 'Account & Hub';
  else if (pathname.startsWith('/shops')) title = 'Artisan Shop';

  return (
    <header className="miras-top sticky top-0 z-30 border-b border-line bg-paper/95 pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-1.5">
        <button
          type="button"
          aria-label="Back"
          onClick={() => (window.history.length > 1 ? router.back() : router.push('/'))}
          className="toolbar-back grid h-11 w-11 place-items-center rounded-full"
        >
          <BackIcon />
        </button>
        <Link href="/" className="toolbar-title flex flex-1 flex-col font-display text-xl">
          <span>{title}</span>
        </Link>
        <div className="toolbar-language">{right}</div>
      </div>
    </header>
  );
}

const SLOTS = [
  { slot: "home", label: "Home", href: "/", icon: HomeIcon },
  { slot: "artisans", label: "Artisans", href: "/artisans", icon: PlacesIcon },
  { slot: "events", label: "Events", href: "/events", icon: StoriesIcon },
  { slot: "friends", label: "Local Friends", href: "/local-friends", icon: GridIcon },
  { slot: "account", label: "Account", href: "/account", icon: ProfileIcon },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href === "/artisans") return pathname.startsWith("/artisan") || pathname.startsWith("/shops");
    if (href === "/events") return pathname.startsWith("/event");
    if (href === "/local-friends") return pathname.startsWith("/local-friends");
    if (href === "/account") return pathname.startsWith("/account");
    return pathname.startsWith(href);
  };

  return (
    <nav aria-label="Main" className="miras-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-xl items-center justify-around">
        {SLOTS.map(({ slot, label, href, icon: Icon }) => (
          <li key={slot}>
            <Link href={href} aria-current={isActive(href) ? "page" : undefined}>
              <Icon size={22} />
              <span>{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
