"use client";

import { directionsUrl, duration, km, longDate, minutes, MODE_LABEL } from "@/lib/format";
import type { Block, Day } from "@/lib/types";
import { DownIcon, PinIcon, PlusIcon, RefreshIcon, TrashIcon, UpIcon } from "../icons";
import { ModeSummary, ModeTable } from "../ModeTimes";
import { TrailCard } from "../TrailCard";
import { DataBadge } from "../ui";

const KIND_LABEL: Record<Block["kind"], string> = { visit: "Visit", meal: "Meal", buffer: "Buffer", free: "Free time" };
const LEG_VERB: Record<string, string> = { walk: "walk", car: "by auto, taxi or car", cycle: "by cycle", scooter: "by two-wheeler" };

export interface DayActions {
  move: (blockId: string, dir: -1 | 1) => void;
  remove: (blockId: string) => void;
  swap: (blockId: string) => void;
  add: () => void;
  regenerate: () => void;
}

export function DaySchedule({ day, busy, editable, actions, swapError }: {
  day: Day; busy: boolean; editable: boolean; actions: DayActions; swapError?: string | null;
}) {
  const movable = day.blocks.filter((b) => !b.auto);
  const placeBlocks = day.blocks.filter((b) => b.place);
  return (
    <article className="card-solid" aria-labelledby={`day-${day.index}`} aria-busy={busy}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Day {day.index + 1}{day.area ? ` · ${day.area.name}` : ""}</p>
          <h3 id={`day-${day.index}`} className="text-[26px]">{longDate(day.date)}</h3>
          {day.weather_note && <p className="mt-1 text-[14px] text-muted">{day.weather_note}</p>}
        </div>
        {editable && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-secondary btn-sm" onClick={actions.add} disabled={busy}><PlusIcon size={16} /> Add a stop</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={actions.regenerate} disabled={busy}><RefreshIcon size={16} /> Show me different suggestions</button>
          </div>
        )}
      </header>

      {day.search_notes.length > 0 && (
        <ul className="notice mt-3 space-y-1 text-[14px]" aria-label="What changed in the search">
          {day.search_notes.map((n) => <li key={n}>{n}</li>)}
        </ul>
      )}

      {day.mode_totals.length > 0 && (
        <div className="mt-4 rounded-[18px] bg-paper p-3">
          <ModeSummary modes={day.mode_totals} prefix="Today’s route:" />
          <details className="mt-1">
            <summary className="cursor-pointer text-[14px] text-muted min-h-[32px] py-1">All modes and navigation</summary>
            <ModeTable modes={day.mode_totals} navUrls={day.navigation_urls} compact />
          </details>
        </div>
      )}

      {busy && <p className="mt-3 text-[14px] text-muted" role="status">Updating this day with live data…</p>}
      {swapError && <p className="alert mt-3" role="alert">{swapError}</p>}

      {movable.every((b) => !b.place) && (
        <p className="notice mt-4">No places came back from the place providers for this day. See the notes above, or add stops yourself.</p>
      )}

      <ol className="timeline mt-4">
        {day.blocks.map((b) => {
          const idx = movable.findIndex((m) => m.id === b.id);
          const prevPlace = (() => {
            const i = placeBlocks.findIndex((p) => p.id === b.id);
            return i > 0 ? placeBlocks[i - 1].place! : day.area ?? null;
          })();
          return (
            <li key={b.id} data-kind={b.kind} className="pb-4">
              {b.leg_from_previous && (
                <details className="mb-1 text-[13px] text-muted">
                  <summary className="flex cursor-pointer flex-wrap items-center gap-2 min-h-[32px]">
                    ↓ {duration(b.leg_from_previous.duration_s)} {LEG_VERB[b.leg_from_previous.mode]} · {km(b.leg_from_previous.distance_m)}
                    <DataBadge type={b.leg_from_previous.provenance.data_type} />
                    <span>{b.leg_from_previous.provenance.source}</span>
                    <span className="underline underline-offset-2">other modes</span>
                  </summary>
                  {b.leg_from_previous.modes.length > 0 && b.place && prevPlace && (
                    <div className="mt-1 rounded-[14px] bg-white p-2.5 text-text">
                      <ModeTable
                        compact
                        modes={b.leg_from_previous.modes}
                        initial={b.leg_from_previous.mode}
                        navUrls={Object.fromEntries(["walk", "cycle", "scooter", "car"].map((m) => [m, directionsUrl(prevPlace, b.place!, m)]))}
                      />
                    </div>
                  )}
                </details>
              )}
              <div className={`rounded-[18px] p-3 ${b.kind === "buffer" || b.kind === "free" ? "bg-paper/60" : "bg-paper"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] text-muted tnum">
                      {b.start}–{b.end} · {KIND_LABEL[b.kind]}{b.kind === "visit" && b.indoor != null ? (b.indoor ? " · indoor" : " · outdoor") : ""}
                    </p>
                    <p className={`text-[17px] leading-snug ${b.kind === "visit" || b.kind === "meal" ? "font-medium" : ""}`}>{b.title}</p>
                  </div>
                  {editable && !b.auto && (
                    <div className="flex shrink-0 gap-1">
                      <button type="button" className="icon-btn !h-9 !w-9" aria-label={`Move ${b.title} earlier`} disabled={busy || idx <= 0} onClick={() => actions.move(b.id, -1)}><UpIcon size={16} /></button>
                      <button type="button" className="icon-btn !h-9 !w-9" aria-label={`Move ${b.title} later`} disabled={busy || idx >= movable.length - 1} onClick={() => actions.move(b.id, 1)}><DownIcon size={16} /></button>
                      <button type="button" className="icon-btn !h-9 !w-9" aria-label={`Remove ${b.title}`} disabled={busy} onClick={() => actions.remove(b.id)}><TrashIcon size={16} /></button>
                    </div>
                  )}
                </div>
                {b.place && (
                  <div className="mt-2 space-y-1 text-[14px]">
                    {b.place.address && <p className="text-muted">{b.place.address}</p>}
                    {b.hours_note && <p className={b.hours_note.startsWith("May be closed") ? "text-[var(--danger-text)]" : ""}>{b.hours_note}</p>}
                    {b.kind === "visit" && <p className="text-muted">Suggested time here: {minutes(b.duration_min)} (estimate)</p>}
                    {b.place.score_reasons.length > 0 && (
                      <p className="text-muted"><span className="text-text">Why: </span>{b.place.score_reasons.slice(0, 4).join(" · ")}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {b.place.hidden_gem && <span className="badge badge-neutral">Lesser-known</span>}
                      {b.place.rating != null && <span className="badge badge-neutral">★ {b.place.rating.toFixed(1)} Google</span>}
                      <a href={b.place.maps_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[36px] items-center gap-1 underline underline-offset-4">
                        <PinIcon size={15} /> {b.place.maps_url_is_listing ? "Google Maps" : "Location in Google Maps"}
                      </a>
                      <span className="text-[12px] text-muted">{b.place.provenance.source}</span>
                    </div>
                    {editable && (b.kind === "visit" || b.kind === "meal") && (
                      <button type="button" className="btn btn-ghost btn-sm !min-h-[40px] !px-0" disabled={busy} onClick={() => actions.swap(b.id)}>
                        <RefreshIcon size={15} /> Show me a different {b.kind === "meal" ? "restaurant" : "place"}
                      </button>
                    )}
                  </div>
                )}
                {!b.place && b.reason && <p className="mt-1 text-[14px] text-muted">{b.reason}</p>}
              </div>
            </li>
          );
        })}
      </ol>

      {day.trails.length > 0 && (
        <div className="mt-2 grid gap-3">
          <p className="eyebrow">Walking trail for this day</p>
          {day.trails.map((t) => <TrailCard key={t.id} trail={t} />)}
        </div>
      )}
      <p className="mt-3 text-[12px] text-muted">Leg times: {MODE_LABEL.scooter} times without Google Routes are estimated from car times. Car times assume free-flowing traffic unless marked traffic-aware.</p>
    </article>
  );
}
