"use client";

import { useMemo, useState } from "react";
import type { TrailRoute } from "@/lib/types";
import { MapView, type MapMarker } from "./MapView";
import { MoonIcon, SunIcon } from "./icons";

/** Route on a map: polyline with direction arrows, start/finish markers, numbered stops,
 *  a compact legend and a light/dark switch. */
export function TrailMap({ trail, initialDark = true }: { trail: TrailRoute; initialDark?: boolean }) {
  const [dark, setDark] = useState(initialDark);
  const markers = useMemo<MapMarker[]>(() => {
    const w = trail.waypoints;
    const loop = w.length > 1 && w[0].lat === w[w.length - 1].lat && w[0].lng === w[w.length - 1].lng;
    const out: MapMarker[] = [{ id: "start", lat: w[0].lat, lng: w[0].lng, title: `Start: ${w[0].name}`, label: "S", kind: "start" }];
    w.slice(1, -1).forEach((p, i) => out.push({ id: `stop-${i}`, lat: p.lat, lng: p.lng, title: `${i + 1}. ${p.name}`, label: String(i + 1), kind: "stop" }));
    if (!loop) out.push({ id: "end", lat: w[w.length - 1].lat, lng: w[w.length - 1].lng, title: `Finish: ${w[w.length - 1].name}`, label: "F", kind: "end" });
    return out;
  }, [trail]);
  const start = trail.waypoints[0];

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <button type="button" className="chip" aria-pressed={dark} onClick={() => setDark((d) => !d)}>
          {dark ? <MoonIcon size={18} /> : <SunIcon size={18} />} Dark map
        </button>
      </div>
      <MapView
        center={{ lat: start.lat, lng: start.lng }}
        markers={markers}
        polyline={trail.geometry}
        arrows
        dark={dark}
        fit="polyline"
        className="h-[420px] md:h-[520px]"
        ariaLabel={`Map of ${trail.title}`}
      >
        <div className="map-legend" data-theme={dark ? "dark" : "light"} aria-hidden="true">
          <div className="flex items-center gap-2"><span className="inline-block h-[4px] w-6 rounded" style={{ background: dark ? "#ffd23f" : "#101718" }} /> Route (direction ➤)</div>
          <div className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-full bg-[var(--saffron)]" /> Start / finish</div>
          <div className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-full" style={{ background: dark ? "#ffd23f" : "#101718" }} /> Stops (numbered)</div>
        </div>
      </MapView>
    </div>
  );
}
