"use client";

import { useEffect, useState } from "react";
import { LotusMark } from "./icons";


const SEEN = "miras_splash_seen";

function shouldShow(): boolean {
  if (process.env.NEXT_PUBLIC_E2E === "true") return false;
  // Automated browsers (Playwright, CI) never see the splash, so tests do not wait for it.
  if (navigator.webdriver && !new URLSearchParams(window.location.search).has("splash")) return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  if (new URLSearchParams(window.location.search).has("nosplash")) return false;
  try {
    if (sessionStorage.getItem(SEEN) && !new URLSearchParams(window.location.search).has("splash")) return false;
    sessionStorage.setItem(SEEN, "1");
  } catch {
    // Storage blocked: show once for this page load.
  }
  return true;
}

/** First-visit-of-the-session splash on the home screen. Auto-dismisses at 1.5 s; tap to skip. */
export function Splash({ tagline, taglineHi }: { tagline: string; taglineHi: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!shouldShow()) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- whether to show depends on browser-only state
    setShow(true);
    const t = setTimeout(() => setShow(false), 1500);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;
  return (
    <button
      type="button"
      onClick={() => setShow(false)}
      aria-label="Skip intro"
      data-testid="splash"
      className="miras-splash anim-fade fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-ink px-8 text-center text-on-dark"
    >
      <LotusMark size={44} className="text-saffron" />
      <div>
        <p className="font-display text-5xl tracking-[0.12em]">MIRAS</p>
        <p className="mt-1 text-lg">{tagline}</p>
      </div>
      <div className="splash-photo" aria-hidden="true" />
      <p lang="hi" className="font-display text-2xl">
        {taglineHi}
      </p>
      <span className="block h-0.5 w-24 overflow-hidden rounded-full bg-line-dark" aria-hidden="true">
        <span className="anim-progress block h-full w-full bg-saffron" />
      </span>
    </button>
  );
}
