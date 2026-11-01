"use client";

import { useState } from "react";
import { duration, km, MODE_LABEL, MODE_ORDER } from "@/lib/trip/format";
import type { ModeEstimate } from "@/lib/trip/types";
import { BikeIcon, ExternalIcon, RouteIcon } from "./icons";
import { DataBadge } from "./ui";

function sorted(modes: ModeEstimate[]) {
  return MODE_ORDER.map((m) => modes.find((x) => x.mode === m)).filter(Boolean) as ModeEstimate[];
}

/** One line: "12 km · about 28 min by two-wheeler, 33 min by four-wheeler". */
export function ModeSummary({ modes, prefix }: { modes: ModeEstimate[]; prefix?: string }) {
  const tw = modes.find((m) => m.mode === "scooter");
  const car = modes.find((m) => m.mode === "car");
  if (!tw && !car) return null;
  const dist = (car ?? tw)!.distance_m;
  return (
    <p className="text-[15px]">
      {prefix && <strong className="font-medium">{prefix} </strong>}
      {km(dist)} · about {tw ? `${duration(tw.duration_s)} by two-wheeler${tw.data_type === "Estimated" ? " (estimated)" : ""}` : ""}
      {tw && car ? ", " : ""}
      {car ? `${duration(car.duration_s)} by four-wheeler` : ""}
    </p>
  );
}

/** Mode selector with distance, time, label and a per-mode "Start navigation". */
export function ModeTable({ modes, navUrls, dark = false, initial = "scooter", compact = false }: {
  modes: ModeEstimate[]; navUrls?: Record<string, string>; dark?: boolean; initial?: string; compact?: boolean;
}) {
  const list = sorted(modes);
  const [sel, setSel] = useState(list.some((m) => m.mode === initial) ? initial : list[0]?.mode);
  const cur = list.find((m) => m.mode === sel);
  if (!list.length) return null;
  return (
    <div className={compact ? "" : "mt-3"}>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Travel mode">
        {list.map((m) => (
          <button key={m.mode} type="button" role="radio" aria-checked={m.mode === sel} onClick={() => setSel(m.mode)}
            className={`min-h-[36px] rounded-full px-3 text-[13px] transition ${m.mode === sel
              ? (dark ? "bg-[var(--trail-yellow)] text-ink" : "bg-ink-2 text-white")
              : (dark ? "border border-white/25" : "border border-line bg-white")}`}>
            {MODE_LABEL[m.mode]} · {duration(m.duration_s)}
          </button>
        ))}
      </div>
      {cur && (
        <div className="mt-2 text-[14px]">
          <p className="flex flex-wrap items-center gap-2">
            {cur.mode === "scooter" ? <BikeIcon size={16} /> : <RouteIcon size={16} />}
            <span className="tnum">{km(cur.distance_m)} · {duration(cur.duration_s)}</span>
            <DataBadge type={cur.data_type} />
            <span className="opacity-75">{cur.source}</span>
            {cur.traffic_aware && <span className="opacity-75">· traffic-aware</span>}
          </p>
          {cur.note && <p className={`mt-1 ${cur.suitable ? "opacity-75" : "text-[var(--danger-text)]"} ${dark && !cur.suitable ? "!text-[var(--rose)]" : ""}`}>{cur.suitable ? "" : "Not ideal: "}{cur.note}</p>}
          {navUrls?.[cur.mode] && (
            <a href={navUrls[cur.mode]} target="_blank" rel="noopener noreferrer"
              className={`mt-2 inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-3.5 text-[14px] ${dark ? "bg-[var(--trail-yellow)] text-ink" : "bg-ink-2 text-white"}`}>
              <RouteIcon size={16} /> Start navigation ({MODE_LABEL[cur.mode].toLowerCase()}) <ExternalIcon size={14} />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
