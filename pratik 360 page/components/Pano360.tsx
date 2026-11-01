"use client";

import { useEffect, useRef, useState } from "react";
import "@photo-sphere-viewer/core/index.css";
import { t, type Lang } from "@/lib/i18n";
import { Button, NotRealLabel } from "./ui";
import { MediaImage } from "./domain";

/**
 * 360 preview. The viewer (and three.js) only loads after a tap, so weak connections
 * get the still image first and never download the 3D bundle unless asked.
 */
export function Pano360({ src, poster, illustrative, lang, alt }: { src: string; poster?: string; illustrative: boolean; lang: Lang; alt: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const open = attempt > 0 && !failed;

  useEffect(() => {
    if (attempt === 0 || !ref.current) return;
    let viewer: { destroy(): void } | undefined;
    let cancelled = false;
    import("@photo-sphere-viewer/core")
      .then(({ Viewer }) => {
        if (cancelled || !ref.current) return;
        viewer = new Viewer({ container: ref.current, panorama: src, navbar: ["zoom", "move", "fullscreen"], loadingTxt: "" });
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      viewer?.destroy();
    };
  }, [attempt, src]);

  return (
    <figure className="relative overflow-hidden rounded-2xl bg-mist" data-testid="pano360">
      <div className="aspect-[16/9]">
        {open ? (
          <div ref={ref} className="h-full w-full" aria-label={alt} role="img" />
        ) : (
          <>
            {poster && <MediaImage src={poster} alt={alt} />}
            <div className="absolute inset-0 grid place-items-center">
              <Button
                type="button"
                variant="accent"
                onClick={() => {
                  setFailed(false);
                  setAttempt((n) => n + 1);
                }}
              >
                {failed ? t(lang, "tryAgain") : t(lang, "preview360")}
              </Button>
            </div>
          </>
        )}
      </div>
      {illustrative && (
        <figcaption className="pointer-events-none absolute top-2 left-2 z-10">
          <NotRealLabel lang={lang} kind="illustrative" />
        </figcaption>
      )}
    </figure>
  );
}
