import { useId, type ReactNode } from "react";

// The project's own illustrations: Lake Pichhola with a palace silhouette. No photos, no people.
export type Scene = "dawn" | "day" | "golden" | "night";

/** Individual backgrounds extracted from the user's supplied image sheet. */
export function HeroScene({ scene, className = "" }: { scene: Scene; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/media/pichhola/${scene === "night" ? "moonlight" : scene === "day" ? "palace-wide" : scene}.webp`} alt="" className={`object-cover ${className}`} />;
}

/** Jharokha (cusped arch) mask. Used only for the splash scene and the camera viewfinder. */
export function ArchFrame({ children, className = "" }: { children: ReactNode; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <div className={`relative ${className}`}>
      <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
        <clipPath id={`${id}-arch`} clipPathUnits="objectBoundingBox">
          <path d="M0,1 L0,0.42 Q0,0.33 0.06,0.3 Q0.06,0.22 0.14,0.2 Q0.16,0.12 0.25,0.11 Q0.3,0.04 0.4,0.05 Q0.45,0 0.5,0 Q0.55,0 0.6,0.05 Q0.7,0.04 0.75,0.11 Q0.84,0.12 0.86,0.2 Q0.94,0.22 0.94,0.3 Q1,0.33 1,0.42 L1,1 Z" />
        </clipPath>
      </svg>
      <div className="h-full w-full" style={{ clipPath: `url(#${id}-arch)` }}>
        {children}
      </div>
    </div>
  );
}

/** Thin wavy line: section divider and loading accent. */
export function RippleDivider({ className = "", loading = false }: { className?: string; loading?: boolean }) {
  return (
    <svg viewBox="0 0 200 8" preserveAspectRatio="none" className={`h-2 w-full ${loading ? "anim-pulse" : ""} ${className}`} aria-hidden="true" focusable="false">
      <path d="M0 4 Q12.5 0 25 4 T50 4 T75 4 T100 4 T125 4 T150 4 T175 4 T200 4" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
    </svg>
  );
}
