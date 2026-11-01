"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/trip/api";

import { inr, longDate } from "@/lib/trip/format";
import type { DailyWeather, Envelope, Itinerary, Place, PlacesPage, ProviderStatus } from "@/lib/trip/types";
import { PhoneIcon, PinIcon, RainIcon, ShieldIcon, SunIcon } from "../icons";
import { DataBadge, EmptyState, ProviderNotice, Skeleton, SourceLine } from "../ui";

export function WeatherChip({ w }: { w: DailyWeather }) {
  const Icon = w.suggestion === "indoor" ? RainIcon : SunIcon;
  return (
    <div className="tile min-w-[150px]">
      <div className="flex items-center justify-between">
        <span className="text-[14px] text-muted">{longDate(w.date)}</span>
        <DataBadge type={w.provenance.data_type} />
      </div>
      <p className="mt-1 flex items-center gap-2 text-[20px] tnum"><Icon size={20} /> {w.temp_max_c != null ? `${Math.round(w.temp_max_c)}°` : "–"} / {w.temp_min_c != null ? `${Math.round(w.temp_min_c)}°` : "–"}</p>
      <p className="text-[14px]">{w.condition ?? "Condition not available"}</p>
      <p className="text-[13px] text-muted">
        {w.rain_probability_pct != null ? `Rain chance ${Math.round(w.rain_probability_pct)}%` : w.precipitation_mm != null ? `Rain ${w.precipitation_mm} mm (observed)` : "Rain chance not available"}
      </p>
    </div>
  );
}

export function WeatherStrip({ days }: { days: { weather?: DailyWeather | null }[] }) {
  const ws = days.map((d) => d.weather).filter(Boolean) as DailyWeather[];
  if (!ws.length) return <EmptyState title="No weather data">Open-Meteo did not return weather for these dates.</EmptyState>;
  return (
    <div>
      <div className="scroll-x">{ws.map((w) => <WeatherChip key={w.date} w={w} />)}</div>
      <SourceLine p={ws[0].provenance} className="mt-2" />
      {ws.some((w) => w.provenance.data_type === "Historical") && (
        <p className="mt-1 text-[13px] text-muted">Dates more than 16 days away show weather observed on the same dates in an earlier year, labelled Historical. It is not a forecast.</p>
      )}
      <p className="mt-1 text-[12px] text-muted">Weather data by Open-Meteo.com</p>
    </div>
  );
}

function MiniPlace({ p }: { p: Place }) {
  return (
    <li className="tile">
      <p className="text-[16px] font-medium">{p.name}</p>
      <p className="text-[14px] text-muted">{p.address ?? "Address not available"}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {p.phone && <a className="btn btn-sm btn-secondary" href={`tel:${p.phone.replace(/\s/g, "")}`}><PhoneIcon size={16} /> Call</a>}
        <a className="btn btn-sm btn-secondary" href={p.maps_url} target="_blank" rel="noopener noreferrer"><PinIcon size={16} /> {p.maps_url_is_listing ? "Google Maps" : "Location"}</a>
      </div>
      <SourceLine p={p.provenance} className="mt-2" />
    </li>
  );
}

export function StaysList({ stays, requested }: { stays: Place[]; requested: boolean }) {
  if (!requested) return <EmptyState title="No stay type chosen">Pick a stay type with “Tweak trip” to see options. Days start from the old city.</EmptyState>;
  if (!stays.length) return <EmptyState title="No stays returned">The place providers returned no matching stays. Try another stay type.</EmptyState>;
  return (
    <>
      <p className="mb-3 text-[15px] text-muted">Options from the place providers. Prices and availability are only on the property’s own site or listing.</p>
      <ul className="grid gap-3 md:grid-cols-2">
        {stays.map((p) => (
          <li key={p.id} className="tile">
            <p className="text-[17px] font-medium">{p.name}</p>
            <p className="text-[14px] text-muted">{p.address ?? "Address not available"}</p>
            {p.rating != null && <p className="mt-1 text-[14px]">★ {p.rating.toFixed(1)} on Google{p.rating_count ? ` (${p.rating_count.toLocaleString("en-IN")})` : ""}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              <a className="btn btn-sm btn-primary" href={p.maps_url} target="_blank" rel="noopener noreferrer">{p.maps_url_is_listing ? "Open in Google Maps" : "Open location"}</a>
              {p.website && <a className="btn btn-sm btn-secondary" href={p.website} target="_blank" rel="noopener noreferrer">Website</a>}
            </div>
            <SourceLine p={p.provenance} className="mt-2" />
          </li>
        ))}
      </ul>
    </>
  );
}

export function BudgetCard({ budget }: { budget: Itinerary["budget"] }) {
  return (
    <div className="card">
      {budget.lines.length === 0 ? (
        <p className="text-[15px]">No prices were available from the providers for this trip, so we are not showing a total.</p>
      ) : (
        <ul className="divide-y divide-[var(--line)]">
          {budget.lines.map((l) => (
            <li key={l.label} className="py-3 first:pt-0">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[15px]">{l.label}</p>
                <p className="shrink-0 text-[17px] tnum">
                  {l.amount_min != null ? inr(l.amount_min, l.currency) : "?"}
                  {l.amount_max != null && l.amount_max !== l.amount_min ? ` – ${inr(l.amount_max, l.currency)}` : ""}
                </p>
              </div>
              <div className="mt-1 flex items-center gap-2 text-[13px] text-muted"><DataBadge type={l.data_type} /> {l.basis}</div>
            </li>
          ))}
        </ul>
      )}
      <ul className="mt-3 space-y-1 text-[14px] text-muted">{budget.notes.map((n) => <li key={n}>• {n}</li>)}</ul>
    </div>
  );
}

export function EssentialsCard({ e }: { e: Itinerary["essentials"] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="card">
        <h3 className="flex items-center gap-2 text-[20px]"><ShieldIcon size={20} /> Emergency numbers</h3>
        <ul className="mt-3 grid gap-2">
          {e.emergency.map((c) => (
            <li key={c.number} className="flex items-center justify-between gap-3">
              <span className="text-[15px]">{c.label}</span>
              <a href={`tel:${c.number}`} className="btn btn-sm btn-primary tnum">{c.number}</a>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[13px] text-muted">{e.emergency_source}</p>
      </div>
      <div className="card">
        <h3 className="text-[20px]">Documents checklist</h3>
        <ul className="mt-3 space-y-2 text-[15px]">
          {e.documents.map((d) => (
            <li key={d}><label className="flex items-start gap-2"><input type="checkbox" className="mt-1.5 h-4 w-4 accent-[var(--ink-2)]" /> <span>{d}</span></label></li>
          ))}
        </ul>
      </div>
      <div className="card">
        <h3 className="text-[20px]">Nearest hospitals</h3>
        {e.hospitals.length ? <ul className="mt-3 grid gap-2">{e.hospitals.map((p) => <MiniPlace key={p.id} p={p} />)}</ul> : <p className="mt-2 text-[15px] text-muted">Not available from the place providers. Call 112 or 108 in an emergency.</p>}
      </div>
      <div className="card">
        <h3 className="text-[20px]">Nearest pharmacies</h3>
        {e.pharmacies.length ? <ul className="mt-3 grid gap-2">{e.pharmacies.map((p) => <MiniPlace key={p.id} p={p} />)}</ul> : <p className="mt-2 text-[15px] text-muted">Not available from the place providers.</p>}
      </div>
      <div className="card md:col-span-2">
        <h3 className="text-[20px]">Money and payments</h3>
        <ul className="mt-2 space-y-1 text-[15px]">{e.money_notes.map((n) => <li key={n}>• {n}</li>)}</ul>
      </div>
    </div>
  );
}

export function RentalShop({ p }: { p: Place }) {
  const hours = p.opening_hours?.weekday_text?.length ? p.opening_hours.weekday_text.join(" · ") : p.opening_hours?.raw;
  return (
    <li className="tile">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[17px] font-medium">{p.name}</p>
        {p.distance_m != null && <span className="shrink-0 text-[14px] text-muted tnum">{p.distance_m < 1000 ? `${Math.round(p.distance_m)} m` : `${(p.distance_m / 1000).toFixed(1)} km`}</span>}
      </div>
      <p className="text-[14px]">{p.vehicle_types.length ? p.vehicle_types.join(", ") : <span className="italic text-muted">Vehicle types not listed</span>}</p>
      <p className="text-[14px] text-muted">{p.address ?? "Address not available"}</p>
      <p className="text-[13px] text-muted">{hours ? `Hours: ${hours}` : "Hours not available"}</p>
      {p.rating != null && <p className="text-[14px]">★ {p.rating.toFixed(1)} on Google{p.rating_count ? ` (${p.rating_count.toLocaleString("en-IN")})` : ""}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        {p.phone && <a className="btn btn-sm btn-primary" href={`tel:${p.phone.replace(/\s/g, "")}`}><PhoneIcon size={16} /> Call</a>}
        {p.website && <a className="btn btn-sm btn-secondary" href={p.website} target="_blank" rel="noopener noreferrer">Website</a>}
        <a className="btn btn-sm btn-secondary" href={p.maps_url} target="_blank" rel="noopener noreferrer"><PinIcon size={16} /> Open in Maps</a>
        <Link className="btn btn-sm btn-ghost" href={`/trip-planner/trail?ride=${p.lat.toFixed(6)},${p.lng.toFixed(6)}&mode=${p.vehicle_types.some((v) => v.startsWith("Bicycle")) ? "cycle" : "scooter"}&name=${encodeURIComponent(p.name)}`}>Ride from here</Link>
      </div>
      <p className="mt-1 text-[12px] text-muted">No prices shown: rental rates aren’t published by the providers. Ask the shop.</p>
      <SourceLine p={p.provenance} className="mt-1" />
    </li>
  );
}

function RentalList({ group, at, label }: { group: string; at: { lat: number; lng: number }; label: string }) {
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const ctl = new AbortController();
    apiGet<Envelope<PlacesPage>>("/api/trip/places/nearby", { lat: at.lat, lng: at.lng, category: group, radius: 5000 }, ctl.signal)
      .then((r) => { setPlaces(r.data.places.slice(0, 6)); setProviders(r.providers); })
      .catch((e) => (e as Error).name !== "AbortError" && setError((e as Error).message));
    return () => ctl.abort();
  }, [group, at.lat, at.lng]);
  return (
    <div>
      <h3 className="text-[20px]">Near {label}</h3>
      {error && <p className="alert mt-2">{error}</p>}
      {!places && !error && (
        <div className="mt-2" role="status">
          <p className="text-[14px] text-muted">Looking up rental shops (OpenStreetMap can take up to 40 seconds)…</p>
          <Skeleton className="mt-2 h-24" />
        </div>
      )}
      <ProviderNotice providers={providers} className="mt-2" />
      {places && (places.length ? (
        <ul className="mt-2 grid gap-2 md:grid-cols-2">{places.map((p) => <RentalShop key={p.id} p={p} />)}</ul>
      ) : (
        <p className="mt-2 text-[15px] text-muted">No rental shops listed here by the providers. Google Places has the widest coverage of rental shops.</p>
      ))}
    </div>
  );
}

export function RentalsCard({ r }: { r: NonNullable<Itinerary["rentals"]> }) {
  const label = { two_wheeler: "bike or scooter", car: "car", unsure: "vehicle", none: "vehicle" }[r.choice];
  return (
    <div className="grid gap-5">
      <p className="text-[15px] text-muted">You chose to rent a {label}. Days use {r.choice === "two_wheeler" ? "two-wheeler" : r.choice === "car" ? "car" : "road"} times for longer hops. Rent directly with a shop: no booking, reservation or payment here.</p>
      {r.notes.length > 0 && <ul className="notice space-y-1">{r.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
      <RentalList group={r.group} at={r.arrival} label={r.arrival_label} />
      <RentalList group={r.group} at={r.stay} label={r.stay_label} />
      <div className="card">
        <p className="eyebrow">General advice</p>
        <h3 className="mt-1 text-[20px]">Before you rent</h3>
        <ul className="mt-2 space-y-1.5 text-[15px]">{r.advice.map((a) => <li key={a}>• {a}</li>)}</ul>
      </div>
    </div>
  );
}
