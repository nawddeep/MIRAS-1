"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { MediaNotification } from "@/lib/media-social/db";

interface MediaHeaderProps {
  notifications: MediaNotification[];
  onOpenNotifications: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeFilter?: string | null;
  onClearFilter?: () => void;
}

export function MediaHeader({
  notifications,
  onOpenNotifications,
  searchQuery,
  onSearchChange,
  activeFilter,
  onClearFilter,
}: MediaHeaderProps) {
  const router = useRouter();
  const [showSearch, setShowSearch] = useState(false);
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <header className="sticky top-0 z-40 border-b border-ink/10 bg-paper/95 backdrop-blur-md transition-all">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-2.5">
        {/* Exit to MIRAS button */}
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
          className="group flex items-center gap-1.5 rounded-full border border-ink/15 bg-white/90 px-3 py-1.5 text-xs font-medium text-ink/80 shadow-sm transition hover:border-ink/25 hover:bg-ink/5 hover:text-ink active:scale-95"
          aria-label="Exit Media section and return to MIRAS main app"
        >
          <svg className="h-3.5 w-3.5 transition group-hover:-translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          <span>Exit to MIRAS</span>
        </button>

        {/* Media Brandmark */}
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-ink-2 to-lake-deep text-white shadow-sm shadow-ink-2/20">
            <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
            </svg>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-display text-lg font-bold tracking-tight text-ink">MIRAS</span>
              <span className="rounded bg-gradient-to-r from-ink-2 to-lake-deep px-1.5 py-0.2 text-[10px] font-bold uppercase tracking-wider text-white">Media</span>
            </div>
            <span className="text-[10px] text-ink/80">Udaipur Travel &amp; Heritage</span>
          </div>
        </div>

        {/* Right Tools: Search, Notifications, Demo User Switcher */}
        <div className="flex items-center gap-2">
          {/* Search Toggle */}
          <button
            type="button"
            onClick={() => setShowSearch(!showSearch)}
            className={`grid h-8 w-8 place-items-center rounded-full border transition ${
              showSearch || searchQuery ? "border-saffron bg-saffron/10 text-saffron-text" : "border-ink/10 bg-white text-ink-soft hover:bg-ink/5"
            }`}
            aria-label="Toggle Search"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </button>

          {/* Notifications Bell */}
          <button
            type="button"
            onClick={onOpenNotifications}
            className="relative grid h-8 w-8 place-items-center rounded-full border border-ink/10 bg-white text-ink-soft transition hover:bg-ink/5"
            aria-label="Notifications"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-ink-2 px-1 text-[9px] font-bold text-white shadow">
                {unreadCount}
              </span>
            )}
          </button>

        </div>
      </div>

      {/* Expandable Search Input & Active Filter Bar */}
      {(showSearch || searchQuery || activeFilter) && (
        <div className="border-t border-ink/10 bg-ink/5 px-4 py-2 transition-all">
          <div className="mx-auto flex max-w-4xl flex-col gap-2">
            <div className="relative flex items-center">
              <svg className="pointer-events-none absolute left-3 h-4 w-4 text-ink-soft/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search places, #hashtags, @creators, stories..."
                className="w-full rounded-full border border-ink/15 bg-white py-1.5 pr-8 pl-9 text-xs text-ink placeholder:text-ink-soft/70 focus:border-saffron focus:outline-none focus:ring-1 focus:ring-saffron"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange("")}
                  className="absolute right-2.5 text-xs text-ink-soft/70 hover:text-ink-soft"
                >
                  ✕
                </button>
              )}
            </div>

            {activeFilter && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-ink/80">Filter applied:</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-saffron/15 px-2 py-0.5 text-xs font-medium text-saffron-text">
                  {activeFilter}
                  <button type="button" onClick={onClearFilter} className="hover:text-ink">
                    ✕
                  </button>
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

