"use client";

import { useEffect } from "react";

/** Registers /sw.js in production builds only, so development never runs against a cached shell. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // No service worker: the app still works online; only the offline page is unavailable.
      });
    }
  }, []);
  return null;
}
