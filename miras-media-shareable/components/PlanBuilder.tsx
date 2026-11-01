"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DEFAULT_PLAN, loadPlan, savePlan, type SavedPlan } from "@/lib/client/plan-store";
import { planDay, SPEED_KMH, type PlannerPlace, type PlanResult } from "@/lib/planner";
import { WEEKDAYS } from "@/lib/schemas";
import { Button, Label } from "./ui";

const input = "min-h-11 rounded-xl border border-ink/25 bg-white px-3";

export function PlanBuilder({ places }: { places: (PlannerPlace & { slug: string; photo?: string })[] }) {
  const [plan, setPlan] = useState<SavedPlan>(DEFAULT_PLAN);
  const [weekday, setWeekday] = useState<(typeof WEEKDAYS)[number]>("sun");
  const [result, setResult] = useState<PlanResult | null>(null);
  const [storageError, setStorageError] = useState(false);
  const [selectedDay,setSelectedDay]=useState(0);
  const [query, setQuery] = useState("");

  // Read the device copy after mount (localStorage is not available during server render).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from device storage
    setPlan(loadPlan());
    setWeekday(WEEKDAYS[new Date().getDay()]);
  }, []);

  const update = (next: SavedPlan) => {
    setPlan(next);
    setStorageError(!savePlan(next));
    setResult(null);
  };
  const toggle = (id: string) =>
    update({ ...plan, placeIds: plan.placeIds.includes(id) ? plan.placeIds.filter((x) => x !== id) : [...plan.placeIds, id] });

  const chosen = plan.placeIds.flatMap(id=>places.filter(p=>p.id===id));
  const bySlug = new Map(places.map((p) => [p.id, p.slug]));

  return (
    <div className="planner-builder space-y-5">
      <Link className="plan-journey-link" href="/journeys">Finished exploring? Record your journey & badges →</Link>
      <div className="plan-date-strip" role="group" aria-label="Day of your visit">{Array.from({length:7},(_,i)=>{const date=new Date();date.setDate(date.getDate()+i);return <button type="button" key={i} aria-pressed={selectedDay===i} onClick={()=>{setSelectedDay(i);setWeekday(WEEKDAYS[date.getDay()]);setResult(null);}}><span>{date.getDate()}</span><small>{WEEKDAYS[date.getDay()]}</small></button>;})}</div>
      {storageError && <p role="status" className="plan-hours-note">Your changes are available for this visit, but this browser could not save them. Check device storage access before leaving.</p>}
      {chosen.length > 0 ? <section className="plan-shortlist" aria-label="Your saved stops"><div className="discovery-heading"><h2>Your route</h2><span>{chosen.length} selected</span></div><ol>{chosen.map((place,index)=><li key={place.id}><span className="plan-stop-number">{index+1}</span>{/* eslint-disable-next-line @next/next/no-img-element */}
        {place.photo && <img className="plan-stop-photo" src={place.photo} alt=""/>}<div><Link href={`/places/${place.slug}`}>{place.name}</Link><small>{place.typicalVisitMinutes} min suggested · {place.openingTimes ? "Hours available" : "Confirm visiting hours"}</small></div><button type="button" aria-label={`Remove ${place.name} from plan`} onClick={()=>toggle(place.id)}>×</button></li>)}</ol><p>{storageError ? "Open a place for directions and visit details. Changes are not saved yet." : "Your shortlist is saved on this device. Open a place for directions and visit details."}</p></section> : <section className="plan-shortlist"><h2>Your next adventure starts here.</h2><p>Search for a place and select it to start your shortlist.</p><Link href="/places" className="discovery-cta">Explore places →</Link></section>}

      <div className="plan-controls grid grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className="block text-sm font-medium">Start time</span>
          <input type="time" value={plan.startTime} onChange={(e) => update({ ...plan, startTime: e.target.value || "09:00" })} className={`${input} w-full`} />
        </label>
        <label className="space-y-1">
          <span className="block text-sm font-medium">Day length</span>
          <select value={plan.dayHours} onChange={(e) => update({ ...plan, dayHours: Number(e.target.value) })} className={`${input} w-full`}>
            {[2, 3, 4, 5, 6, 8, 10, 12].map((h) => (
              <option key={h} value={h}>
                {h} hours
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-sm font-medium">Getting around</span>
          <select value={plan.mode} onChange={(e) => update({ ...plan, mode: e.target.value as SavedPlan["mode"] })} className={`${input} w-full`}>
            <option value="walk">Walking</option>
            <option value="drive">Driving</option>
          </select>
        </label>

      </div>

      <a className="plan-add-place" href="#plan-picker">＋ Add a place</a>
      {chosen.some(place=>!place.openingTimes) && <p className="plan-hours-note">An automatic timetable needs confirmed hours; you can still use this shortlist to plan your visit.</p>}
      <Button
        type="button"
        variant="accent"
        disabled={!chosen.length}
        onClick={() => setResult(planDay({ places: chosen, startTime: plan.startTime, dayMinutes: plan.dayHours * 60, mode: plan.mode, weekday }))}
      >
        Make my plan
      </Button>
      <p className="text-xs text-ink-soft">{storageError ? "Changes have not been saved on this device." : "Your plan is saved on this device only."}</p>

      <section id="plan-picker" className="plan-picker"><div className="discovery-heading"><h2>Add places</h2><span>{places.length} available</span></div><label className="sr-only" htmlFor="plan-search">Search places for your plan</label><input id="plan-search" type="search" placeholder="Search a place…" value={query} onChange={e=>setQuery(e.target.value)} className="plan-search"/><fieldset><legend className="sr-only">Places to visit</legend><div className="plan-place-list">{places.filter(place=>place.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).map(place=><label key={place.id}><input type="checkbox" checked={plan.placeIds.includes(place.id)} onChange={()=>toggle(place.id)}/><span>{place.name}</span><small>{place.typicalVisitMinutes} min</small></label>)}</div></fieldset>{!places.some(place=>place.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) && <p className="plan-search-empty">No places match. <button type="button" onClick={()=>setQuery("")}>Clear search</button></p>}</section>

      {result && !result.ok && (
        <div role="alert" className="space-y-2 rounded-2xl border border-rose bg-rose/10 p-4" data-testid="plan-problems">
          <p className="font-medium">Some stops need more information before scheduling:</p>
          <ul className="list-disc pl-5">
            {result.problems.map((p) => (
              <li key={p.placeId + p.problem}>
                {p.name}: {p.problem}
              </li>
            ))}
          </ul><Link href="/trails" className="inline-flex min-h-11 items-center font-medium underline">Browse suggested trails instead →</Link>
        </div>
      )}

      {result?.ok && (
        <section className="space-y-3" data-testid="plan-result">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl">Your day</h2>
            <Label tone="warn">Estimate</Label>
          </div>
          <p className="text-sm text-ink-soft">
            Travel times are straight-line distance at {SPEED_KMH[plan.mode]} km/h ({plan.mode === "walk" ? "walking" : "driving"}). Real routes
            take longer.
          </p>
          <ol className="space-y-2">
            {result.stops.map((s, i) => (
              <li key={s.placeId} className="rounded-xl border border-line bg-white/60 p-3">
                {i > 0 && <p className="text-xs text-ink-soft">About {s.travelMinutes} min travel (estimate)</p>}
                <p className="font-medium">
                  {s.arrive}–{s.leave} ·{" "}
                  <Link href={`/places/${bySlug.get(s.placeId)}`} className="underline">
                    {s.name}
                  </Link>
                </p>
              </li>
            ))}
          </ol>
          {result.skipped.length > 0 && (
            <ul className="list-disc pl-5 text-sm">
              {result.skipped.map((s) => (
                <li key={s.placeId}>
                  Left out: {s.name}. {s.reason}.
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
