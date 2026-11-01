"use client";

import { useState } from "react";
import { inr, minutes } from "@/lib/trip/format";
import type { BusOption, FlightOption, Money, TrainOption, TransportResults } from "@/lib/trip/types";
import { BusIcon, ExternalIcon, PlaneIcon, TrainIcon } from "../icons";
import { EmptyState, NotAvailable, SourceLine } from "../ui";

type Tab = "flights" | "trains" | "buses";

function price(m?: Money | null) {
  return m ? inr(m.amount, m.currency) : <NotAvailable />;
}

function time(s?: string | null) {
  if (!s) return <NotAvailable />;
  const m = s.match(/(\d{2}:\d{2})/);
  return m ? m[1] : s;
}

function Redirect({ url, label }: { url?: string | null; label: string }) {
  if (!url) return <p className="text-[13px] text-muted">No provider link available.</p>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
      {label} <ExternalIcon size={15} />
    </a>
  );
}

function Grid({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[14px] sm:grid-cols-4">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt className="text-[11px] uppercase tracking-[0.08em] text-muted">{k}</dt>
          <dd className="tnum">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function FlightCard({ f }: { f: FlightOption }) {
  return (
    <li className="tile">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[17px] font-medium">{f.airline ?? "Airline not available"}</p>
          <p className="text-[14px] text-muted">{f.flight_number ?? "Flight number not available"}</p>
        </div>
        <p className="text-[19px] tnum">{price(f.price)}</p>
      </div>
      <Grid items={[
        ["Departs", time(f.departure)], ["Arrives", time(f.arrival)],
        ["Duration", f.duration_min != null ? minutes(f.duration_min) : <NotAvailable key="d" />],
        ["Stops", f.stops != null ? (f.stops === 0 ? "Non-stop" : String(f.stops)) : <NotAvailable key="s" />],
      ]} />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <SourceLine p={f.provenance} />
        <Redirect url={f.redirect_url} label={f.redirect_label} />
      </div>
    </li>
  );
}

function TrainCard({ t }: { t: TrainOption }) {
  return (
    <li className="tile">
      <p className="text-[17px] font-medium">{t.train_number ?? "—"} {t.train_name ?? ""}</p>
      <p className="text-[14px] text-muted">{t.from_station ?? "?"} → {t.to_station ?? "?"}</p>
      <Grid items={[
        ["Departs", time(t.departure)], ["Arrives", time(t.arrival)],
        ["Duration", t.duration_min != null ? minutes(t.duration_min) : <NotAvailable key="d" />],
        ["Fare", price(t.fare)],
      ]} />
      <p className="mt-2 text-[14px]">Running status: {t.running_status ?? <NotAvailable />}</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <SourceLine p={t.provenance} />
        <Redirect url={t.redirect_url} label={t.redirect_label} />
      </div>
    </li>
  );
}

function BusCard({ b }: { b: BusOption }) {
  return (
    <li className="tile">
      <p className="text-[17px] font-medium">{b.operator ?? "Operator not available"}</p>
      <p className="text-[14px] text-muted">{b.route_name ?? ""} {b.category ? `· ${b.category}` : ""}</p>
      <Grid items={[
        ["Departs", time(b.departure)], ["Arrives", time(b.arrival)],
        ["Duration", b.duration_min != null ? minutes(b.duration_min) : <NotAvailable key="d" />],
        ["Fare", price(b.fare)],
      ]} />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <SourceLine p={b.provenance} />
        <Redirect url={b.redirect_url} label={b.redirect_label} />
      </div>
    </li>
  );
}

export function TransportSection({ transport, hasOrigin }: { transport?: TransportResults | null; hasOrigin: boolean }) {
  const counts = { flights: transport?.flights.length ?? 0, trains: transport?.trains.length ?? 0, buses: transport?.buses.length ?? 0 };
  const first = (["flights", "trains", "buses"] as Tab[]).find((t) => counts[t] > 0) ?? "flights";
  const [tab, setTab] = useState<Tab>(first);

  if (!hasOrigin) {
    return <EmptyState title="Add where you’re travelling from">Transport options need an origin. Use “Tweak trip” to add one.</EmptyState>;
  }
  if (!transport) return <EmptyState title="Transport could not be loaded">See the provider notice at the top of the page.</EmptyState>;

  const tabs: { k: Tab; label: string; icon: typeof PlaneIcon }[] = [
    { k: "flights", label: "Flights", icon: PlaneIcon },
    { k: "trains", label: "Trains", icon: TrainIcon },
    { k: "buses", label: "Buses", icon: BusIcon },
  ];
  return (
    <div>
      <p className="text-[15px] text-muted">
        {transport.origin_label}{transport.origin_airport ? ` (${transport.origin_airport})` : ""} → {transport.destination_label}
        {transport.destination_airport ? ` (${transport.destination_airport})` : ""} on {transport.date}. Prices and seats are confirmed only on the provider’s site.
      </p>
      <div className="scroll-x mt-3" role="tablist" aria-label="Transport type">
        {tabs.map(({ k, label, icon: Icon }) => (
          <button key={k} role="tab" aria-selected={tab === k} data-active={tab === k} className="chip" onClick={() => setTab(k)}>
            <Icon size={18} /> {label} ({counts[k]})
          </button>
        ))}
      </div>
      {transport.notes.length > 0 && <ul className="notice mt-3 space-y-1">{transport.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
      <div role="tabpanel" className="mt-3">
        {counts[tab] === 0 ? (
          <EmptyState title={`No ${tab} to show`}>
            {tab === "flights" && "No flight provider returned results for this route and date, or none is configured."}
            {tab === "trains" && "Train data needs a configured timetable provider and your departure station code."}
            {tab === "buses" && "Bus timetables appear only from an authorised GTFS feed. None returned trips for this route."}
          </EmptyState>
        ) : (
          <ul className="grid gap-3">
            {tab === "flights" && transport.flights.map((f) => <FlightCard key={f.id} f={f} />)}
            {tab === "trains" && transport.trains.map((t) => <TrainCard key={t.id} t={t} />)}
            {tab === "buses" && transport.buses.map((b) => <BusCard key={b.id} b={b} />)}
          </ul>
        )}
      </div>
    </div>
  );
}
