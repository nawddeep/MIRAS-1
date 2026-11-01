"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { apiGet, photoUrl } from "@/lib/api";
import { km, PRICE_LABEL } from "@/lib/format";
import { addPick } from "@/lib/storage";
import type { Envelope, Place } from "@/lib/types";
import { BikeIcon, CloseIcon, ExternalIcon, GlobeIcon, PhoneIcon, PinIcon, PlusIcon } from "./icons";
import { NotAvailable, Skeleton, SourceLine } from "./ui";

export const CATEGORY_LABEL: Record<string, string> = {
  food: "Restaurant",
  cafes: "Café or coffee shop",
  rentals: "Vehicle rental",
  rental_bike: "Bike / motorcycle rental",
  rental_scooter: "Scooter rental",
  rental_bicycle: "Bicycle rental",
  rental_car: "Car rental",
  rental_selfdrive: "Self-drive car rental",
  rental_taxi: "Car with driver (taxi)",
  hidden_gems: "Hidden gem",
  artisans: "Artisan or handicraft",
  stays: "Stay",
  attractions: "Attraction",
  shopping: "Shopping",
  entertainment: "Entertainment",
  health: "Health",
};

/** Rows used in lists. Ratings only appear for Google-sourced places. */
export function PlaceRow({ place, active, onOpen }: { place: Place; active?: boolean; onOpen: (p: Place) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(place)}
      aria-current={active ? "true" : undefined}
      className={`tile w-full text-left transition ${active ? "ring-2 ring-[var(--ink-2)]" : ""}`}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-[17px] font-medium leading-snug">{place.name}</span>
          <span className="mt-0.5 block truncate text-[14px] text-muted">{place.address ?? "Address not available"}</span>
        </span>
        {place.distance_m != null && <span className="shrink-0 text-[14px] text-muted tnum">{km(place.distance_m)}</span>}
      </span>
      {place.category?.startsWith("rental") && (
        <span className="mt-1 block text-[14px]">{place.vehicle_types.length ? place.vehicle_types.join(", ") : <span className="italic text-muted">Vehicle types not listed</span>}</span>
      )}
      <span className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-muted">
        {place.rating != null && <span className="badge badge-neutral">★ {place.rating.toFixed(1)} Google{place.rating_count ? ` (${place.rating_count.toLocaleString("en-IN")})` : ""}</span>}
        <span>{place.provenance.source}</span>
      </span>
    </button>
  );
}

export function PlaceDetail({ place, onClose, rideFrom = false }: { place: Place; onClose: () => void; rideFrom?: boolean }) {
  const [full, setFull] = useState<Place | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<"idle" | "ok" | "fail">("idle");
  const closeRef = useRef<HTMLButtonElement>(null);

  // Details are fetched only when a place is opened. OpenStreetMap (Overpass) results already
  // contain everything, so they have no separate lookup.
  const needsDetails = place.provider !== "osm";
  useEffect(() => {
    if (!needsDetails) return;
    const ctl = new AbortController();
    apiGet<Envelope<Place>>(`/api/places/details/${encodeURIComponent(place.id)}`, { category: place.category ?? undefined }, ctl.signal)
      .then((r) => setFull(r.data))
      .catch((e) => {
        if ((e as Error).name !== "AbortError") setError((e as Error).message);
      });
    return () => ctl.abort();
  }, [place.id, place.category, needsDetails]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const p = full ?? place;
  const loading = needsDetails && !full && !error;
  const hours = p.opening_hours;
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <section className="sheet" role="dialog" aria-modal="true" aria-labelledby="place-title">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-black/15 md:hidden" aria-hidden="true" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">{CATEGORY_LABEL[p.category ?? ""] ?? "Place"}</p>
            <h2 id="place-title" className="mt-1 text-[28px]">{p.name}</h2>
          </div>
          <button ref={closeRef} type="button" className="icon-btn" aria-label="Close details" onClick={onClose}>
            <CloseIcon size={20} />
          </button>
        </div>

        {loading && <Skeleton className="mt-4 h-40" />}
        {error && <p className="alert mt-4">Full details could not be loaded: {error}. Showing what the list had.</p>}

        {p.photos.length > 0 && (
          <div className="scroll-x mt-4">
            {p.photos.slice(0, 4).map((ph) => (
              <figure key={ph.ref} className="w-[78%] shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element -- served through our key-hiding photo proxy */}
                <img src={photoUrl(ph.ref, 640)} alt={`Photo of ${p.name}`} loading="lazy" className="h-44 w-full rounded-[18px] object-cover bg-[#ccdde1]" />
                {ph.attributions.length > 0 && <figcaption className="mt-1 text-[12px] text-muted">Photo: {ph.attributions.join(", ")} (via Google)</figcaption>}
              </figure>
            ))}
          </div>
        )}

        <div className="mt-4 grid gap-2">
          <a href={p.maps_url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
            <PinIcon size={19} /> {p.maps_url_is_listing ? "Open in Google Maps" : "Open location in Google Maps"} <ExternalIcon size={16} />
          </a>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setPicked(addPick(p) ? "ok" : "fail")}
            aria-pressed={picked === "ok"}
          >
            <PlusIcon size={19} /> {picked === "ok" ? "Added: find it under “Add a stop” in your trip" : "Add to itinerary"}
          </button>
          {picked === "fail" && <p className="text-[14px] text-[var(--danger-text)]">Could not save on this device (storage is blocked).</p>}
          {rideFrom && (
            <div className="card mt-2">
              <p className="flex items-center gap-2 font-medium"><BikeIcon size={20} /> Ride from here</p>
              <p className="mt-1 text-[14px] text-muted">
                Suggested loops through real places near this shop. Rent directly with the shop: this app takes no reservations or payments.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link className="btn btn-sm btn-primary" href={`/trail?ride=${p.lat.toFixed(6)},${p.lng.toFixed(6)}&mode=cycle&name=${encodeURIComponent(p.name)}`}>Cycle routes</Link>
                <Link className="btn btn-sm btn-secondary" href={`/trail?ride=${p.lat.toFixed(6)},${p.lng.toFixed(6)}&mode=scooter&name=${encodeURIComponent(p.name)}`}>Bike / scooter routes</Link>
              </div>
            </div>
          )}
        </div>

        <dl className="mt-5 grid gap-4 text-[15px]">
          {(p.category?.startsWith("rental") || p.vehicle_types.length > 0) && (
            <Row label="Vehicles">{p.vehicle_types.length ? p.vehicle_types.join(", ") : <NotAvailable what="Vehicle types not listed" />}</Row>
          )}
          <Row label="Address">{p.address ?? <NotAvailable />}</Row>
          <Row label="Distance">{p.distance_m != null ? km(p.distance_m) + " from your search point" : <NotAvailable />}</Row>
          <Row label="Coordinates"><span className="tnum">{p.lat.toFixed(5)}, {p.lng.toFixed(5)}</span></Row>
          <Row label="Rating">
            {p.rating != null ? (
              <span>★ {p.rating.toFixed(1)} on Google{p.rating_count ? ` from ${p.rating_count.toLocaleString("en-IN")} reviews` : ""}</span>
            ) : (
              <NotAvailable what={p.provider === "google" ? "No rating yet" : "Not available (ratings come from Google only)"} />
            )}
          </Row>
          <Row label="Opening hours">
            {hours?.weekday_text?.length ? (
              <ul className="space-y-0.5">{hours.weekday_text.map((t) => <li key={t}>{t}</li>)}</ul>
            ) : hours?.raw ? (
              <span>{hours.raw}</span>
            ) : (
              <NotAvailable />
            )}
            {hours?.open_now != null && <span className="mt-1 block text-[14px] text-muted">{hours.open_now ? "Open now" : "Closed now"} (per provider)</span>}
          </Row>
          <Row label="Website">
            {p.website ? <a className="inline-flex items-center gap-1.5 underline underline-offset-4 break-all" href={p.website} target="_blank" rel="noopener noreferrer"><GlobeIcon size={16} /> {p.website.replace(/^https?:\/\//, "")}</a> : <NotAvailable />}
          </Row>
          <Row label="Phone">
            {p.phone ? <a className="inline-flex items-center gap-1.5 underline underline-offset-4" href={`tel:${p.phone.replace(/\s/g, "")}`}><PhoneIcon size={16} /> {p.phone}</a> : <NotAvailable />}
          </Row>
          {p.price_level && <Row label="Price level">{PRICE_LABEL[p.price_level] ?? p.price_level} (Google)</Row>}
          {p.provider === "google" && p.google_place_id && <Row label="Google Place ID"><span className="break-all text-[13px] text-muted">{p.google_place_id}</span></Row>}
        </dl>
        <SourceLine p={p.provenance} className="mt-5" />
        {p.provenance.attribution && <p className="mt-1 text-[12px] text-muted">{p.provenance.attribution}</p>}
      </section>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[12px] uppercase tracking-[0.08em] text-muted">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}
