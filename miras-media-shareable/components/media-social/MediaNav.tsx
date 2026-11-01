"use client";

export type MediaTab = "feed" | "reels" | "editor" | "ar_vr" | "profile";

interface MediaNavProps {
  activeTab: MediaTab;
  onTabChange: (tab: MediaTab) => void;
}

export function MediaNav({ activeTab, onTabChange }: MediaNavProps) {
  const tabs = [
    {
      id: "feed" as MediaTab,
      label: "Feed",
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
        </svg>
      ),
    },
    {
      id: "reels" as MediaTab,
      label: "Reels",
      badge: "9:16",
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75A1.125 1.125 0 003.375 19.5m0-13.875A1.125 1.125 0 014.5 4.5h15a1.125 1.125 0 011.125 1.125m-17.25 0h1.5C5.496 5.625 6 6.129 6 6.75m14.25-1.125v12.75m0 0a1.125 1.125 0 01-1.125 1.125h-1.5m2.625-1.125A1.125 1.125 0 0020.625 19.5m0-15A1.125 1.125 0 0019.5 3.375h-15A1.125 1.125 0 003.375 4.5m16.125 0V5.625m0 12.75v1.125" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 8.25l6 3.75-6 3.75V8.25z" />
        </svg>
      ),
    },
    {
      id: "editor" as MediaTab,
      label: "Create",
      isAction: true,
      icon: (
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-amber-500 via-rose-500 to-pink-500 text-white shadow-md shadow-rose-500/25">
          <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </div>
      ),
    },
    {
      id: "ar_vr" as MediaTab,
      label: "AR / 360°",
      badge: "3D",
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
        </svg>
      ),
    },
    {
      id: "profile" as MediaTab,
      label: "Profile",
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
      ),
    },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200/90 bg-stone-50/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
      <div className="mx-auto flex max-w-xl items-center justify-around px-2 py-1.5">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`group relative flex flex-col items-center justify-center rounded-xl px-3 py-1 text-xs transition active:scale-95 ${
                isActive ? "text-rose-600 font-bold" : "text-stone-500 hover:text-stone-800"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              <div className="relative">
                {tab.icon}
                {tab.badge && !isActive && (
                  <span className="absolute -top-1 -right-3 rounded-full bg-amber-500/90 px-1 text-[8px] font-bold text-white leading-tight">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="mt-0.5 text-[10px] tracking-tight">{tab.label}</span>
              {isActive && !tab.isAction && (
                <span className="absolute bottom-0 h-1 w-5 rounded-full bg-rose-600 transition-all" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

