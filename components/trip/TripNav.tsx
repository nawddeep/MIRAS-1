"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/trip-planner/plan", label: "Plan my trip", match: (p: string) => p.startsWith("/trip-planner/plan") || p.startsWith("/trip-planner/trip") },
  { href: "/trip-planner/explore", label: "Explore around me", match: (p: string) => p.startsWith("/trip-planner/explore") || p.startsWith("/trip-planner/trail") },
];

/** Switch between the two trip-planner experiences. Hidden on the landing page, which already offers both. */
export function TripNav() {
  const pathname = usePathname();
  if (pathname === "/trip-planner") return null;
  return (
    <nav aria-label="Trip planner" className="scroll-x px-5 pt-3">
      {ITEMS.map(({ href, label, match }) => (
        <Link key={href} href={href} className="chip" data-active={match(pathname) ? "true" : undefined} aria-current={match(pathname) ? "page" : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
