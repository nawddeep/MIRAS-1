"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(true);
  const [isInstalled, setIsInstalled] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Check if already in standalone/PWA mode
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isStandalone) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of browser display mode after mount
      setIsInstalled(true);
      return;
    }

    const wasDismissed = sessionStorage.getItem("miras_install_dismissed");
    if (!wasDismissed) {
      setDismissed(false);
    }

    const timer = setTimeout(() => setReady(true), 60000);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  if (isInstalled || dismissed || !deferredPrompt || !ready) {
    return null;
  }

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("miras_install_dismissed", "true");
  };

  return (
    <aside
      aria-label="Install MIRAS application"
      data-testid="pwa-install-prompt"
      className="install-prompt fixed bottom-[calc(92px+env(safe-area-inset-bottom))] left-4 right-4 z-40 mx-auto max-w-lg rounded-2xl border border-line bg-paper/95 p-3.5 shadow-lg backdrop-blur"
    >
      <div className="flex items-center gap-3">
        <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-xl border border-line bg-ink">
          <Image
            src="/icons/icon-192.png"
            alt="MIRAS"
            width={44}
            height={44}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-semibold text-ink">Install MIRAS</p>
          <p className="truncate text-xs text-ink-soft">Fast offline access & standalone guide</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleInstallClick}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-ink px-3.5 text-xs font-semibold text-paper hover:bg-ink-soft"
          >
            Install
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss install prompt"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-ink-soft hover:bg-ink/10 hover:text-ink"
          >
            ✕
          </button>
        </div>
      </div>
    </aside>
  );
}
