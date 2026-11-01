"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeIcon, PinIcon, PlanIcon } from "./icons";

const ITEMS = [
  { href: "/", label: "Home", icon: HomeIcon, match: (p: string) => p === "/" },
  { href: "/plan", label: "Plan my trip", icon: PlanIcon, match: (p: string) => p.startsWith("/plan") || p.startsWith("/trip") },
  { href: "/explore", label: "Explore", icon: PinIcon, match: (p: string) => p.startsWith("/explore") || p.startsWith("/trail") },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="bottom-nav">
      <ul>
        {ITEMS.map(({ href, label, icon: Icon, match }) => (
          <li key={href}>
            <Link href={href} aria-current={match(pathname) ? "page" : undefined}>
              <Icon size={21} />
              <span>{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function TopBar({ title, back }: { title?: string; back?: string }) {
  return (
    <header className="flex items-center justify-between gap-3 px-5 pt-[calc(18px+env(safe-area-inset-top))] pb-2">
      {back ? (
        <Link href={back} className="icon-btn" aria-label="Back">
          <span aria-hidden="true">←</span>
        </Link>
      ) : (
        <span className="w-11" />
      )}
      <Link href="/" className="wordmark">{title ?? "TRIP TRAIL"}</Link>
      <span className="w-11" />
    </header>
  );
}
