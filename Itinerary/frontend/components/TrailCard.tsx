"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiSend } from "@/lib/api";
import { duration, km, MODE_LABEL } from "@/lib/format";
import type { ModeEstimate, TrailRoute } from "@/lib/types";
import { ExternalIcon, MountainIcon, RouteIcon } from "./icons";
import { ModeTable } from "./ModeTimes";
import { SourceLine } from "./ui";

export function trailHref(t: TrailRoute): string {
  const wp = t.waypoints.map((w) => `${w.name.replace(/[|;]/g, " ")}|${w.lat.toFixed(6)}|${w.lng.toFixed(6)}`).join(";");
  return `/trail?mode=${t.mode}&title=${encodeURIComponent(t.title)}&wp=${encodeURIComponent(wp)}`;
}

/** Elevation profile as an inline SVG area chart. */
export function ElevationProfile({ profile, dark }: { profile: [number, number][]; dark?: boolean }) {
  if (profile.length < 2) return null;
  const W = 300, H = 70;
  const maxD = profile[profile.length - 1][0] || 1;
  const els = profile.map((p) => p[1]);
  const lo = Math.min(...els), hi = Math.max(...els);
  const span = Math.max(hi - lo, 10);
  const pts = profile.map(([d, e]) => [(d / maxD) * W, H - 6 - ((e - lo) / span) * (H - 16)]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const stroke = dark ? "#ffd23f" : "#101718";
  return (
    <figure className="mt-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[70px] w-full" role="img" aria-label={`Elevation from ${Math.round(lo)} m to ${Math.round(hi)} m over ${km(maxD)}`}>
        <path d={`${line} L${W},${H} L0,${H} Z`} fill={stroke} opacity={0.12} />
        <path d={line} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" />
      </svg>
      <figcaption className="flex justify-between text-[12px] opacity-75 tnum">
        <span>{Math.round(lo)} m</span>
        <span>Elevation profile</span>
        <span>{Math.round(hi)} m</span>
      </figcaption>
    </figure>
  );
}

const DIFF_STYLE: Record<string, string> = {
  Easy: "bg-[var(--ok)] text-ink",
  Moderate: "bg-[var(--saffron)] text-ink",
  Hard: "bg-[var(--rose)] text-ink",
};

export function TrailCard({ trail, dark = false, showMapLink = true }: { trail: TrailRoute; dark?: boolean; showMapLink?: boolean }) {
  const start = trail.waypoints[0];
  const end = trail.waypoints[trail.waypoints.length - 1];
  const loop = start.lat === end.lat && start.lng === end.lng;
  const stops = trail.waypoints.slice(1, -1);
  const [modes, setModes] = useState<ModeEstimate[]>(trail.mode_estimates ?? []);
  const [modesError, setModesError] = useState(false);
  const needModes = !trail.mode_estimates?.length;
  useEffect(() => {
    if (!needModes) return;
    const ctl = new AbortController();
    apiSend<ModeEstimate[]>("POST", "/api/routes/modes", { waypoints: trail.waypoints }, undefined, ctl.signal)
      .then(setModes)
      .catch((e) => (e as Error).name !== "AbortError" && setModesError(true));
    return () => ctl.abort();
  }, [needModes, trail.waypoints]);
  return (
    <article className={`trail-card ${dark ? "on-night" : ""}`} data-theme={dark ? "dark" : "light"} aria-label={trail.title}>
      <div className="p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="badge badge-suggested">{trail.label}</span>
          <span className={`badge ${DIFF_STYLE[trail.difficulty.level]}`} title={trail.difficulty.basis}>
            {trail.difficulty.level} · estimate
          </span>
        </div>
        <h3 className="mt-3 text-[26px] leading-tight">{trail.title}</h3>

        <ol className="trail-stops mt-4">
          <li><strong className="font-semibold">Start:</strong> {start.name}</li>
          {stops.map((w, i) => (
            <li key={`${w.name}-${i}`}>{w.name}</li>
          ))}
          <li><strong className="font-semibold">{loop ? "Back to start:" : "End:"}</strong> {end.name}</li>
        </ol>

        <dl className="mt-5 grid grid-cols-2 gap-3 text-[14px] sm:grid-cols-4">
          <Stat label="Distance" value={km(trail.distance_m)} />
          <Stat label="Est. time" value={duration(trail.duration_s)} />
          <Stat label="Climb" value={trail.elevation_gain_m != null ? `${trail.elevation_gain_m} m` : "Not available"} />
          <Stat label="Mode" value={MODE_LABEL[trail.mode]} />
        </dl>

        {trail.elevation_profile && <ElevationProfile profile={trail.elevation_profile} dark={dark} />}

        <p className="mt-3 text-[13px] opacity-80">{trail.difficulty.basis}.</p>

        <div className="mt-4 border-t border-current/15 pt-3">
          <p className="text-[11px] uppercase tracking-[0.1em] opacity-70">Travel time by mode</p>
          {modes.length ? (
            <ModeTable modes={modes} navUrls={trail.navigation_urls} dark={dark} initial={trail.mode === "walk" ? "walk" : trail.mode} />
          ) : modesError ? (
            <p className="mt-1 text-[14px] opacity-75">Times by other modes are unavailable right now.</p>
          ) : (
            <p className="mt-1 text-[14px] opacity-75" role="status">Checking two-wheeler, four-wheeler, walking and cycling times…</p>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <a href={trail.navigation_url} target="_blank" rel="noopener noreferrer" className={`btn btn-sm ${dark ? "bg-[var(--trail-yellow)] text-ink" : "btn-primary"}`}>
            <RouteIcon size={18} /> Start navigation <ExternalIcon size={16} />
          </a>
          {showMapLink && (
            <Link href={trailHref(trail)} className={`btn btn-sm ${dark ? "border border-white/30" : "btn-secondary"}`}>
              <MountainIcon size={18} /> View trail map
            </Link>
          )}
        </div>
        <SourceLine p={trail.provenance} className={`mt-4 ${dark ? "!text-muted-night" : ""}`} />
      </div>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.1em] opacity-70">{label}</dt>
      <dd className="text-[18px] tnum">{value}</dd>
    </div>
  );
}
