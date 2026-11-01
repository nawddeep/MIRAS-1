"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TopBar } from "@/components/trip/Shell";
import { LocationSearch } from "@/components/trip/LocationSearch";
import { ArrowIcon } from "@/components/trip/icons";
import { ErrorBox, Skeleton } from "@/components/trip/ui";
import { apiGet } from "@/lib/trip/api";
import { addDays, decodeRequest, encodeRequest, longDate, todayIso } from "@/lib/trip/format";
import type { BudgetTier, Interest, Meta, Pace, Preset, Rental, StayType, TransportPref, TripRequest } from "@/lib/trip/types";

const STEPS = ["From", "To", "Dates", "Travellers", "Budget", "Transport", "Rental", "Interests", "Pace", "Stay"] as const;
const INTERESTS_STEP = STEPS.indexOf("Interests");
const BUDGETS: { v: BudgetTier; label: string; hint: string }[] = [
  { v: "budget", label: "Budget", hint: "Street food, hostels, free sights" },
  { v: "mid", label: "Mid-range", hint: "A mix of comfort and value" },
  { v: "premium", label: "Premium", hint: "Fine dining and heritage stays" },
];
const TRANSPORT: { v: TransportPref; label: string }[] = [
  { v: "any", label: "Any" }, { v: "flight", label: "Flight" }, { v: "train", label: "Train" }, { v: "bus", label: "Bus" },
];
const PACES: { v: Pace; label: string; hint: string }[] = [
  { v: "relaxed", label: "Relaxed", hint: "About 3 stops a day, long breaks" },
  { v: "balanced", label: "Balanced", hint: "About 4 stops a day" },
  { v: "packed", label: "Packed", hint: "About 5 stops a day, early starts" },
];
const RENTALS: { v: Rental; label: string; hint: string }[] = [
  { v: "none", label: "No", hint: "Walk short hops, autos or taxis for the rest" },
  { v: "two_wheeler", label: "Bike or scooter", hint: "Stops can be farther apart; times shown by two-wheeler" },
  { v: "car", label: "Car", hint: "Self-drive or with a driver" },
  { v: "unsure", label: "Not sure yet", hint: "We'll list rental shops so you can decide" },
];
const STAYS: { v: StayType | null; label: string }[] = [
  { v: null, label: "No preference" }, { v: "hotel", label: "Hotel" }, { v: "hostel", label: "Hostel" },
  { v: "homestay", label: "Homestay" }, { v: "heritage", label: "Heritage property" },
];

function defaults(): TripRequest {
  return {
    destination_id: "udaipur", origin: null, start_date: addDays(todayIso(), 1), days: 3, adults: 2, children: 0,
    budget_tier: "mid", budget_min_per_day: null, budget_max_per_day: null, transport: "any",
    interests: [], pace: "balanced", stay_type: null, rental: "none", preset: null,
  };
}

export default function PlanPage() {
  return (
    <Suspense fallback={<div className="p-5"><Skeleton className="h-96" /></div>}>
      <Planner />
    </Suspense>
  );
}

function Planner() {
  const router = useRouter();
  const sp = useSearchParams();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [req, setReq] = useState<TripRequest>(() => {
    const r = sp.get("r");
    const prev = r ? decodeRequest(r) : null;
    return prev ? { ...defaults(), ...prev } : defaults();
  });
  const [step, setStep] = useState(() => (sp.get("r") ? INTERESTS_STEP : 0));
  const [mode, setMode] = useState<"form" | "presets">(sp.get("skip") ? "presets" : "form");
  const [error, setError] = useState<string | null>(null);
  const [endMode, setEndMode] = useState(false);

  useEffect(() => {
    apiGet<Meta>("/api/trip/meta").then(setMeta, (e) => setMetaError((e as Error).message));
  }, []);

  const set = <K extends keyof TripRequest>(k: K, v: TripRequest[K]) => setReq((r) => ({ ...r, [k]: v }));

  function validate(i: number): string | null {
    if (i === 2) {
      if (!req.start_date || req.start_date < todayIso()) return "Pick a start date from today onwards.";
      if (req.days < 1 || req.days > 10) return "Trips can be 1 to 10 days.";
    }
    if (i === 4 && req.budget_min_per_day != null && req.budget_max_per_day != null && req.budget_min_per_day > req.budget_max_per_day)
      return "The minimum budget is higher than the maximum.";
    if (i === INTERESTS_STEP && req.interests.length === 0) return "Choose at least one interest.";
    return null;
  }

  function next() {
    const e = validate(step);
    setError(e);
    if (e) return;
    if (step < STEPS.length - 1) setStep(step + 1);
    else submit(req);
  }

  function submit(r: TripRequest) {
    for (let i = 0; i < STEPS.length; i++) {
      const e = validate(i);
      if (e) {
        setStep(i);
        setError(e);
        return;
      }
    }
    router.push(`/trip-planner/plan/results?r=${encodeRequest(r)}`);
  }

  function applyPreset(p: Preset, go: boolean) {
    const r = { ...req, interests: p.interests, pace: p.pace, budget_tier: p.budget_tier, preset: p.id };
    if (r.start_date < todayIso()) r.start_date = addDays(todayIso(), 1);
    setReq(r);
    if (go) router.push(`/trip-planner/plan/results?r=${encodeRequest(r)}`);
    else {
      setMode("form");
      setStep(INTERESTS_STEP);
    }
  }

  return (
    <>
      <TopBar back="/trip-planner" />
      <div className="px-5 pb-8">
        <h1 className="text-[34px] leading-tight">Plan my trip</h1>
        <div className="mt-3 inline-flex rounded-full bg-white/80 p-1" role="tablist" aria-label="How to plan">
          <button role="tab" aria-selected={mode === "form"} className={`rounded-full px-4 py-2 text-[15px] min-h-[44px] ${mode === "form" ? "bg-ink-2 text-white" : ""}`} onClick={() => setMode("form")}>Step by step</button>
          <button role="tab" aria-selected={mode === "presets"} className={`rounded-full px-4 py-2 text-[15px] min-h-[44px] ${mode === "presets" ? "bg-ink-2 text-white" : ""}`} onClick={() => setMode("presets")}>Skip details</button>
        </div>

        {metaError && <ErrorBox className="mt-4" title="The trip service is not reachable">{metaError}</ErrorBox>}

        {mode === "presets" ? (
          <section className="mt-5" aria-labelledby="presets-title">
            <h2 id="presets-title" className="text-[24px]">Don’t want to fill all this?</h2>
            <p className="mt-1 text-[15px] text-muted">
              Pick a style. It fills interests, pace and budget and builds a {req.days}-day trip from {longDate(req.start_date)}. You can tweak everything afterwards.
            </p>
            {!meta && !metaError && <div className="mt-4 grid gap-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}</div>}
            <ul className="mt-4 grid gap-3 md:grid-cols-2">
              {meta?.presets.map((p) => (
                <li key={p.id} className="card-solid">
                  <h3 className="text-[22px]">{p.label}</h3>
                  <p className="mt-1 text-[15px] text-muted">{p.description}</p>
                  <p className="mt-2 text-[13px] text-muted">
                    {p.interests.map((i) => meta.interests.find((x) => x.key === i)?.label ?? i).join(" · ")} · {p.pace} pace
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className="btn btn-primary btn-sm" onClick={() => applyPreset(p, true)}>Build this trip <ArrowIcon size={16} /></button>
                    <button className="btn btn-secondary btn-sm" onClick={() => applyPreset(p, false)}>Tweak first</button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <section className="mt-5" aria-labelledby="step-title">
            <div className="flex items-center justify-between text-[14px] text-muted">
              <span>Step {step + 1} of {STEPS.length}</span>
              <span>{STEPS[step]}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/10" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1} aria-label="Progress">
              <div className="h-full rounded-full bg-ink-2 transition-[width] duration-300" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
            </div>
            <ol className="scroll-x mt-3" aria-label="Steps">
              {STEPS.map((s, i) => (
                <li key={s}>
                  <button type="button" className="chip !min-h-[36px] !px-3 !text-[13px]" data-active={i === step} aria-current={i === step ? "step" : undefined} onClick={() => setStep(i)}>
                    {i + 1}. {s}
                  </button>
                </li>
              ))}
            </ol>

            <div className="card mt-4 min-h-[260px]">
              <StepBody step={step} req={req} set={set} meta={meta} endMode={endMode} setEndMode={setEndMode} />
            </div>

            {error && <p className="alert mt-3" role="alert">{error}</p>}

            <div className="mt-4 flex items-center justify-between gap-3">
              <button type="button" className="btn btn-secondary" onClick={() => { setError(null); setStep(Math.max(0, step - 1)); }} disabled={step === 0}>Back</button>
              <div className="flex gap-2">
                {step >= INTERESTS_STEP && step < STEPS.length - 1 && (
                  <button type="button" className="btn btn-ghost" onClick={() => submit(req)}>Build now</button>
                )}
                <button type="button" className="btn btn-primary" onClick={next}>
                  {step === STEPS.length - 1 ? "Build my trip" : "Next"} <ArrowIcon size={18} />
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </>
  );
}

function Choice<T>({ options, value, onChange, label }: { options: { v: T; label: string; hint?: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-2">
      {options.map((o) => (
        <button key={String(o.v)} type="button" role="radio" aria-checked={value === o.v} onClick={() => onChange(o.v)}
          className={`flex min-h-[56px] flex-col items-start justify-center rounded-[20px] px-4 py-2 text-left transition ${value === o.v ? "bg-ink-2 text-white" : "bg-white"}`}>
          <span className="text-[16px] font-medium">{o.label}</span>
          {o.hint && <span className={`text-[13px] ${value === o.v ? "text-white/75" : "text-muted"}`}>{o.hint}</span>}
        </button>
      ))}
    </div>
  );
}

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[20px] bg-white px-4 py-2">
      <span id={`${label}-l`} className="text-[16px]">{label}</span>
      <div className="flex items-center gap-3" role="group" aria-labelledby={`${label}-l`}>
        <button type="button" className="icon-btn" aria-label={`Fewer ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(value - 1)}>−</button>
        <span className="w-6 text-center text-[18px] tnum" aria-live="polite">{value}</span>
        <button type="button" className="icon-btn" aria-label={`More ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
      </div>
    </div>
  );
}

function StepBody({ step, req, set, meta, endMode, setEndMode }: {
  step: number; req: TripRequest; meta: Meta | null; endMode: boolean; setEndMode: (b: boolean) => void;
  set: <K extends keyof TripRequest>(k: K, v: TripRequest[K]) => void;
}) {
  const dest = meta?.destinations.find((d) => d.id === req.destination_id);
  switch (step) {
    case 0:
      return (
        <div className="grid gap-4">
          <h2 id="step-title" className="text-[24px]">Where are you travelling from?</h2>
          <LocationSearch
            label="City or airport"
            placeholder="e.g. Delhi, Mumbai airport"
            initial={req.origin?.label ?? ""}
            onSelect={(l) => set("origin", { ...(req.origin ?? {}), label: l.label, lat: l.lat, lng: l.lng })}
          />
          {req.origin && <p className="text-[14px] text-muted">Selected: {req.origin.label} ({req.origin.lat.toFixed(3)}, {req.origin.lng.toFixed(3)})</p>}
          <details className="text-[15px]">
            <summary className="cursor-pointer min-h-[44px] py-2">Optional: airport and railway station codes</summary>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="label">Airport (IATA)</span>
                <input className="field uppercase" maxLength={3} placeholder="DEL" value={req.origin?.airport_code ?? ""} disabled={!req.origin}
                  onChange={(e) => req.origin && set("origin", { ...req.origin, airport_code: e.target.value.toUpperCase() || null })} />
              </label>
              <label className="block">
                <span className="label">Station code</span>
                <input className="field uppercase" maxLength={5} placeholder="NDLS" value={req.origin?.station_code ?? ""} disabled={!req.origin}
                  onChange={(e) => req.origin && set("origin", { ...req.origin, station_code: e.target.value.toUpperCase() || null })} />
              </label>
            </div>
            <p className="mt-2 text-[13px] text-muted">We try to find your nearest airport automatically. Train timetables need a station code.</p>
          </details>
          <p className="text-[14px] text-muted">You can skip this. Without an origin we won’t show transport options.</p>
        </div>
      );
    case 1:
      return (
        <div className="grid gap-4">
          <h2 id="step-title" className="text-[24px]">Travelling to</h2>
          <label className="block">
            <span className="label">Destination</span>
            <select className="field" value={req.destination_id} disabled={(meta?.destinations.length ?? 1) <= 1} onChange={(e) => set("destination_id", e.target.value)}>
              {(meta?.destinations ?? [{ id: "udaipur", name: "Udaipur", region: "Rajasthan, India" }]).map((d) => (
                <option key={d.id} value={d.id}>{d.name}, {d.region}</option>
              ))}
            </select>
          </label>
          <p className="text-[14px] text-muted">{dest ? `${dest.name} is the only destination for now.` : "Udaipur is the only destination for now."}</p>
        </div>
      );
    case 2:
      return (
        <div className="grid gap-4">
          <h2 id="step-title" className="text-[24px]">When are you going?</h2>
          <label className="block">
            <span className="label">Start date</span>
            <input type="date" className="field" min={todayIso()} value={req.start_date} onChange={(e) => set("start_date", e.target.value)} />
          </label>
          <div className="flex gap-2" role="radiogroup" aria-label="Trip length by">
            <button type="button" role="radio" aria-checked={!endMode} className="chip" onClick={() => setEndMode(false)}>Number of days</button>
            <button type="button" role="radio" aria-checked={endMode} className="chip" onClick={() => setEndMode(true)}>End date</button>
          </div>
          {endMode ? (
            <label className="block">
              <span className="label">End date</span>
              <input type="date" className="field" min={req.start_date} max={addDays(req.start_date, 9)} value={addDays(req.start_date, req.days - 1)}
                onChange={(e) => {
                  const d = Math.round((new Date(`${e.target.value}T00:00:00`).getTime() - new Date(`${req.start_date}T00:00:00`).getTime()) / 86400000) + 1;
                  if (d >= 1 && d <= 10) set("days", d);
                }} />
            </label>
          ) : (
            <Stepper label="Days" value={req.days} min={1} max={10} onChange={(n) => set("days", n)} />
          )}
          <p className="text-[14px] text-muted">{longDate(req.start_date)} to {longDate(addDays(req.start_date, req.days - 1))} · {req.days} day{req.days > 1 ? "s" : ""}</p>
        </div>
      );
    case 3:
      return (
        <div className="grid gap-3">
          <h2 id="step-title" className="text-[24px]">Who’s travelling?</h2>
          <Stepper label="Adults" value={req.adults} min={1} max={12} onChange={(n) => set("adults", n)} />
          <Stepper label="Children" value={req.children} min={0} max={12} onChange={(n) => set("children", n)} />
        </div>
      );
    case 4:
      return (
        <div className="grid gap-4">
          <h2 id="step-title" className="text-[24px]">Budget</h2>
          <Choice label="Budget range" options={BUDGETS} value={req.budget_tier} onChange={(v) => set("budget_tier", v)} />
          <fieldset>
            <legend className="label">Optional: your budget per day (₹, whole group)</legend>
            <div className="grid grid-cols-2 gap-3">
              <label><span className="sr-only">Minimum per day</span>
                <input className="field" inputMode="numeric" placeholder="Min" value={req.budget_min_per_day ?? ""} onChange={(e) => set("budget_min_per_day", e.target.value ? Math.max(0, Number(e.target.value.replace(/\D/g, ""))) : null)} />
              </label>
              <label><span className="sr-only">Maximum per day</span>
                <input className="field" inputMode="numeric" placeholder="Max" value={req.budget_max_per_day ?? ""} onChange={(e) => set("budget_max_per_day", e.target.value ? Math.max(0, Number(e.target.value.replace(/\D/g, ""))) : null)} />
              </label>
            </div>
          </fieldset>
        </div>
      );
    case 5:
      return (
        <div className="grid gap-4">
          <h2 id="step-title" className="text-[24px]">Preferred transport</h2>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Preferred transport">
            {TRANSPORT.map((t) => <button key={t.v} type="button" role="radio" aria-checked={req.transport === t.v} className="chip" onClick={() => set("transport", t.v)}>{t.label}</button>)}
          </div>
          <p className="text-[14px] text-muted">We show options and link to the provider. Nothing is booked here.</p>
        </div>
      );
    case 6:
      return (
        <div className="grid gap-4">
          <h2 id="step-title" className="text-[24px]">Do you want to rent a vehicle?</h2>
          <Choice label="Vehicle rental" options={RENTALS} value={req.rental} onChange={(v) => set("rental", v)} />
          <p className="text-[14px] text-muted">We’ll show rental shops near where you arrive and near your first day’s area, with phone, website and Maps links. Rent directly with the shop: there’s no booking here.</p>
        </div>
      );
    case 7:
      return (
        <div className="grid gap-4">
          <h2 id="step-title" className="text-[24px]">What do you enjoy?</h2>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Interests">
            {(meta?.interests ?? []).map((i) => {
              const on = req.interests.includes(i.key);
              return (
                <button key={i.key} type="button" aria-pressed={on} className="chip"
                  onClick={() => set("interests", on ? req.interests.filter((x) => x !== i.key) : [...req.interests, i.key as Interest])}>
                  {i.label}
                </button>
              );
            })}
            {!meta && <Skeleton className="h-11 w-full" />}
          </div>
          <p className="text-[14px] text-muted">{req.interests.length} selected</p>
        </div>
      );
    case 8:
      return (
        <div className="grid gap-4">
          <h2 id="step-title" className="text-[24px]">Pace</h2>
          <Choice label="Pace" options={PACES} value={req.pace} onChange={(v) => set("pace", v)} />
        </div>
      );
    default:
      return (
        <div className="grid gap-4">
          <h2 id="step-title" className="text-[24px]">Stay type <span className="text-muted">(optional)</span></h2>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Stay type">
            {STAYS.map((s) => <button key={String(s.v)} type="button" role="radio" aria-checked={req.stay_type === s.v} className="chip" onClick={() => set("stay_type", s.v)}>{s.label}</button>)}
          </div>
          <p className="text-[14px] text-muted">We’ll list matching places from Google or OpenStreetMap. Book directly with them.</p>
        </div>
      );
  }
}
