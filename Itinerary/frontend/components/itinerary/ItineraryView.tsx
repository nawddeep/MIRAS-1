"use client";

import Link from "next/link";
import { useState } from "react";
import { apiSend } from "@/lib/api";
import { addDays, encodeRequest, longDate, minutes } from "@/lib/format";
import { getEditToken, saveEditToken } from "@/lib/storage";
import type { Block, Day, Envelope, Itinerary, Place, ProviderStatus } from "@/lib/types";
import { ShareIcon } from "../icons";
import { ErrorBox, ProviderNotice, SectionHeading } from "../ui";
import { AddStopDialog } from "./AddStopDialog";
import { BudgetCard, EssentialsCard, RentalsCard, StaysList, WeatherStrip } from "./Cards";
import { DaySchedule } from "./DaySchedule";
import { TransportSection } from "./TransportSection";

const SECTIONS = [
  ["overview", "Dates"], ["transport", "Transport"], ["rental", "Rental"], ["stay", "Stay"], ["weather", "Weather"], ["days", "Day plan"],
  ["meals", "Meals"], ["free", "Free time"], ["essentials", "Essentials"], ["budget", "Budget"],
] as const;

function newId() {
  return Math.random().toString(16).slice(2, 12);
}

export function ItineraryView({ initial }: { initial: Itinerary }) {
  const [it, setIt] = useState<Itinerary>(initial);
  const [busyDay, setBusyDay] = useState<number | null>(null);
  const [adding, setAdding] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [extraProviders, setExtraProviders] = useState<ProviderStatus[]>([]);
  const [share, setShare] = useState<string | null>(initial.share_token ?? null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [swapError, setSwapError] = useState<{ day: number; msg: string } | null>(null);
  // Every place ever shown per day, so "show me different" never brings one back.
  const [seen, setSeen] = useState<Record<number, string[]>>(() =>
    Object.fromEntries(initial.days.map((d) => [d.index, d.blocks.filter((b) => b.place).map((b) => b.place!.id)])));
  const remember = (day: Day) => setSeen((cur) => ({
    ...cur, [day.index]: [...new Set([...(cur[day.index] ?? []), ...day.blocks.filter((b) => b.place).map((b) => b.place!.id)])],
  }));
  const editToken = share ? getEditToken(share) : null;
  const canEdit = !share || !!editToken;
  const req = it.request;

  function replaceDay(day: Day) {
    setIt((cur) => ({ ...cur, days: cur.days.map((d) => (d.index === day.index ? day : d)) }));
    setDirty(true);
  }

  async function relayout(day: Day, blocks: Block[]) {
    setBusyDay(day.index);
    setError(null);
    try {
      const out = await apiSend<Day>("POST", "/api/itinerary/relayout-day", { request: req, day: { ...day, blocks } });
      replaceDay(out);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyDay(null);
    }
  }

  function move(day: Day, id: string, dir: -1 | 1) {
    const blocks = day.blocks.filter((b) => !b.auto);
    const i = blocks.findIndex((b) => b.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= blocks.length) return;
    [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
    relayout(day, blocks);
  }

  function remove(day: Day, id: string) {
    relayout(day, day.blocks.filter((b) => !b.auto && b.id !== id));
  }

  function addPlace(day: Day, place: Place) {
    setAdding(null);
    const blocks = day.blocks.filter((b) => !b.auto);
    const dinner = blocks.findIndex((b) => b.meal === "dinner");
    const block: Block = {
      id: newId(), kind: "visit", part: "afternoon", start: "", end: "", duration_min: 60, title: place.name,
      place, visit_minutes_is_estimate: true, auto: false, reason: "Added by you", interests: [],
    };
    blocks.splice(dinner >= 0 ? dinner : blocks.length, 0, block);
    relayout(day, blocks);
  }

  async function regenerate(day: Day) {
    setBusyDay(day.index);
    setError(null);
    const idsOf = (d: Day) => d.blocks.filter((b) => b.place).map((b) => b.place!.id);
    try {
      const res = await apiSend<Envelope<Day>>("POST", "/api/itinerary/regenerate-day", {
        request: req,
        day_index: day.index,
        other_day_place_ids: it.days.filter((d) => d.index !== day.index).flatMap(idsOf),
        seen_place_ids: [...new Set([...(seen[day.index] ?? []), ...idsOf(day)])],
        area_id: day.area?.id ?? null,
      });
      replaceDay(res.data);
      remember(res.data);
      setExtraProviders(res.providers);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyDay(null);
    }
  }

  async function swap(day: Day, blockId: string) {
    setBusyDay(day.index);
    setSwapError(null);
    const trip = it.days.flatMap((d) => d.blocks.filter((b) => b.place).map((b) => b.place!.id));
    try {
      const res = await apiSend<Envelope<Day>>("POST", "/api/itinerary/alternative", {
        request: req, day, block_id: blockId,
        exclude_place_ids: [...new Set([...trip, ...(seen[day.index] ?? [])])],
      });
      replaceDay(res.data);
      remember(res.data);
    } catch (e) {
      setSwapError({ day: day.index, msg: (e as Error).message });
    } finally {
      setBusyDay(null);
    }
  }

  async function save() {
    setSaveState("saving");
    setSaveMsg(null);
    try {
      if (share && editToken) {
        await apiSend<void>("PUT", `/api/itinerary/${share}`, it, { "X-Edit-Token": editToken });
      } else {
        const res = await apiSend<{ share_token: string; edit_token: string }>("POST", "/api/itinerary", it);
        if (!saveEditToken(res.share_token, res.edit_token)) setSaveMsg("Saved, but this browser blocked local storage, so you won’t be able to edit it later.");
        setShare(res.share_token);
        window.history.replaceState(null, "", `/trip/${res.share_token}`);
      }
      setSaveState("saved");
      setDirty(false);
    } catch (e) {
      setSaveState("error");
      setSaveMsg((e as Error).message);
    }
  }

  async function shareLink() {
    if (!share) return;
    const url = `${window.location.origin}/trip/${share}`;
    try {
      if (navigator.share) await navigator.share({ title: `${it.destination_name} trip`, url });
      else {
        await navigator.clipboard.writeText(url);
        setSaveMsg("Link copied.");
      }
    } catch {
      setSaveMsg(url);
    }
  }

  // One row per provider; a later "ok" replaces an earlier problem.
  const providers = Object.values(
    [...it.providers, ...extraProviders].reduce<Record<string, ProviderStatus>>((acc, p) => {
      if (!acc[p.provider] || p.state === "ok") acc[p.provider] = p;
      return acc;
    }, {}),
  );
  const end = addDays(req.start_date, req.days - 1);

  return (
    <div className="px-5 pb-10">
      <nav aria-label="Sections" className="sticky top-0 z-30 -mx-5 bg-[var(--paper)]/90 px-5 py-2 backdrop-blur">
        <ul className="scroll-x">
          {SECTIONS.map(([id, label]) => (
            <li key={id}><a href={`#${id}`} className="chip !min-h-[36px] !text-[14px]">{label}</a></li>
          ))}
        </ul>
      </nav>

      <section id="overview" className="mt-3 scroll-mt-16">
        <p className="eyebrow">Your trip trail</p>
        <h1 className="mt-1 text-[34px] leading-tight md:text-[42px]">{req.days} day{req.days > 1 ? "s" : ""} in {it.destination_name}</h1>
        <p className="mt-2 text-[16px] text-muted">
          {longDate(req.start_date)} to {longDate(end)} · {req.adults} adult{req.adults > 1 ? "s" : ""}{req.children ? `, ${req.children} child${req.children > 1 ? "ren" : ""}` : ""} · {req.pace} pace · {req.budget_tier === "mid" ? "mid-range" : req.budget_tier}
          {req.origin ? ` · from ${req.origin.label}` : ""}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {canEdit && <button type="button" className="btn btn-primary" onClick={save} disabled={saveState === "saving" || (!!share && !dirty)}>{saveState === "saving" ? "Saving…" : share ? (dirty ? "Save changes" : "Saved") : "Save and get a share link"}</button>}
          {share && <button type="button" className="btn btn-secondary" onClick={shareLink}><ShareIcon size={18} /> Share</button>}
          <Link href={`/plan?r=${encodeRequest(req)}`} className="btn btn-secondary">Tweak trip</Link>
        </div>
        {saveMsg && <p className={saveState === "error" ? "alert mt-3" : "notice mt-3"} role="status">{saveMsg}</p>}
        {share && !canEdit && <p className="notice mt-3">You are viewing a shared trip. Changes you make here won’t be saved to it.</p>}
        <ProviderNotice providers={providers} className="mt-4" />
        {error && <ErrorBox className="mt-3" title="That change didn’t go through">{error}</ErrorBox>}
      </section>

      <section id="transport" className="mt-10 scroll-mt-16" aria-labelledby="h-transport">
        <SectionHeading id="h-transport" eyebrow="Getting there" title="Transportation" />
        <TransportSection transport={it.transport} hasOrigin={!!req.origin} />
      </section>

      <section id="rental" className="mt-10 scroll-mt-16" aria-labelledby="h-rental">
        <SectionHeading id="h-rental" eyebrow="Getting around" title="Vehicle rental" />
        {it.rentals ? <RentalsCard r={it.rentals} /> : (
          <p className="text-[15px] text-muted">You didn’t ask for a rental. Use “Tweak trip” to add one, or find shops in <Link className="underline" href="/explore">Explore → Bike &amp; car rentals</Link>.</p>
        )}
      </section>

      <section id="stay" className="mt-10 scroll-mt-16" aria-labelledby="h-stay">
        <SectionHeading id="h-stay" eyebrow="Accommodation" title="Where to stay" />
        <StaysList stays={it.stays} requested={!!req.stay_type} />
      </section>

      <section id="weather" className="mt-10 scroll-mt-16" aria-labelledby="h-weather">
        <SectionHeading id="h-weather" eyebrow="Forecast" title="Weather for your dates" />
        <WeatherStrip days={it.days} />
      </section>

      <section id="days" className="mt-10 scroll-mt-16" aria-labelledby="h-days">
        <SectionHeading id="h-days" eyebrow="Daily schedule" title="Day by day" />
        <p className="mb-4 text-[15px] text-muted">
          Times include travel between stops from a routing provider. Time at each stop is an estimate. Opening hours come from the place provider where available.
        </p>
        <div className="grid gap-5">
          {it.days.map((d) => (
            <DaySchedule
              key={d.index}
              day={d}
              busy={busyDay === d.index}
              editable={canEdit}
              swapError={swapError?.day === d.index ? swapError.msg : null}
              actions={{ move: (id, dir) => move(d, id, dir), remove: (id) => remove(d, id), swap: (id) => swap(d, id), add: () => setAdding(d.index), regenerate: () => regenerate(d) }}
            />
          ))}
        </div>
      </section>

      <section id="meals" className="mt-10 scroll-mt-16" aria-labelledby="h-meals">
        <SectionHeading id="h-meals" eyebrow="Dining" title="Meal plan" />
        <ul className="grid gap-2">
          {it.days.map((d) => (
            <li key={d.index} className="tile">
              <p className="text-[14px] text-muted">Day {d.index + 1} · {longDate(d.date)}</p>
              {d.blocks.filter((b) => b.kind === "meal").map((b) => (
                <p key={b.id} className="text-[15px]"><span className="tnum">{b.start}</span> {b.title}{b.place?.price_range ? ` · ${b.place.price_range.basis}` : ""}</p>
              ))}
            </li>
          ))}
        </ul>
      </section>

      <section id="free" className="mt-10 scroll-mt-16" aria-labelledby="h-free">
        <SectionHeading id="h-free" eyebrow="Breathing room" title="Free time and buffers" />
        <ul className="grid gap-2 sm:grid-cols-2">
          {it.days.map((d) => {
            const free = d.blocks.filter((b) => b.kind === "free" || b.kind === "buffer").reduce((s, b) => s + b.duration_min, 0);
            return <li key={d.index} className="tile text-[15px]">Day {d.index + 1}: {free ? minutes(free) : "none"} of free time and buffers</li>;
          })}
        </ul>
      </section>

      <section id="essentials" className="mt-10 scroll-mt-16" aria-labelledby="h-ess">
        <SectionHeading id="h-ess" eyebrow="Safety and documents" title="Trip essentials" />
        <EssentialsCard e={it.essentials} />
      </section>

      <section id="budget" className="mt-10 scroll-mt-16" aria-labelledby="h-budget">
        <SectionHeading id="h-budget" eyebrow="Money" title="Estimated budget" />
        <BudgetCard budget={it.budget} />
      </section>

      {adding !== null && (
        <AddStopDialog destination={req.destination_id} onClose={() => setAdding(null)} onPick={(p) => addPlace(it.days.find((d) => d.index === adding)!, p)} />
      )}
    </div>
  );
}
