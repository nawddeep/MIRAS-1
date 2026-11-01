"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TopBar } from "@/components/trip/Shell";
import { LocationSearch, type PickedLocation } from "@/components/trip/LocationSearch";
import { MapView, type MapMarker } from "@/components/trip/MapView";
import { PlaceDetail, PlaceRow } from "@/components/trip/PlaceDetail";
import { LocateIcon } from "@/components/trip/icons";
import { EmptyState, ErrorBox, ProviderNotice, Skeleton } from "@/components/trip/ui";
import { apiGet } from "@/lib/trip/api";
import type { Envelope, Place, PlacesPage, ProviderStatus } from "@/lib/trip/types";

const CATEGORIES = [
  { key: "cafes", label: "Cafés & coffee" },
  { key: "food", label: "Restaurants" },
  { key: "hidden_gems", label: "Hidden gems" },
  { key: "artisans", label: "Artisans & crafts" },
  { key: "stays", label: "Stays" },
  { key: "attractions", label: "Attractions" },
  { key: "shopping", label: "Shopping & markets" },
  { key: "entertainment", label: "Entertainment" },
  { key: "health", label: "Hospitals & pharmacies" },
  { key: "rentals", label: "Bike & car rentals" },
];
const RENTAL_FILTERS = [
  { key: "rentals", label: "All rentals" },
  { key: "rental_bike", label: "Bike / motorcycle" },
  { key: "rental_scooter", label: "Scooter" },
  { key: "rental_bicycle", label: "Bicycle" },
  { key: "rental_car", label: "Car" },
  { key: "rental_selfdrive", label: "Self-drive cars" },
  { key: "rental_taxi", label: "Cars with driver" },
];
const isRental = (k: string) => k === "rentals" || k.startsWith("rental_");
const RADII = [500, 1000, 2000, 5000, 10000];
const UDAIPUR = { label: "Udaipur old city", lat: 24.5854, lng: 73.7125 };

const CATEGORY_NOTE: Record<string, string> = {
  hidden_gems: "Independent cafés, viewpoints and lesser-known sites. Google results are limited to places with fewer than 300 reviews.",
  artisans: "Galleries, craft and miniature-painting studios, pottery, textiles, jewellery and local markets.",
  rentals: "Rental shops from Google Places and OpenStreetMap, sorted by distance and rating. Vehicle types appear only when the provider lists them. No prices or reservations here: call or visit the shop. The OpenStreetMap lookup can take up to 40 seconds.",
};

export default function ExplorePage() {
  const [loc, setLoc] = useState<PickedLocation | null>(null);
  const [isMe, setIsMe] = useState(false);
  const [category, setCategory] = useState("food");
  const [radius, setRadius] = useState(2000);
  const [places, setPlaces] = useState<Place[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  const [open, setOpen] = useState<Place | null>(null);

  const load = useCallback(
    async (more: boolean, signal?: AbortSignal) => {
      if (!loc) return;
      setLoading(true);
      setError(null);
      try {
        const res = await apiGet<Envelope<PlacesPage>>(
          "/api/trip/places/nearby",
          { lat: loc.lat, lng: loc.lng, category, radius, cursor: more ? cursor : undefined },
          signal,
        );
        setPlaces((prev) => {
          const base = more ? prev : [];
          const seen = new Set(base.map((p) => p.id));
          return [...base, ...res.data.places.filter((p) => !seen.has(p.id))];
        });
        setCursor(res.data.next_cursor ?? null);
        setProviders(res.providers);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [loc, category, radius, cursor],
  );

  useEffect(() => {
    if (!loc) return;
    const ctl = new AbortController();
    const t = setTimeout(() => load(false, ctl.signal), 0);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
    // Reload from page one only when the search itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc, category, radius]);

  function locateMe() {
    setGeoMsg(null);
    if (!("geolocation" in navigator)) {
      setGeoMsg("Your browser cannot share location. Search for a place instead.");
      return;
    }
    setGeoMsg("Asking your browser for permission…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoc({ label: "Your location", lat: pos.coords.latitude, lng: pos.coords.longitude });
        setIsMe(true);
        setGeoMsg(null);
      },
      (err) => {
        setGeoMsg(
          err.code === err.PERMISSION_DENIED
            ? "Location permission was denied. You can allow it in your browser settings, or search for a place above."
            : "Your location could not be found. Search for a place above instead.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  const markers = useMemo<MapMarker[]>(() => {
    const m: MapMarker[] = places.map((p, i) => ({ id: p.id, lat: p.lat, lng: p.lng, title: p.name, label: String(i + 1), active: open?.id === p.id, kind: isRental(category) ? "rental" : "place" }));
    if (loc) m.push({ id: "__me", lat: loc.lat, lng: loc.lng, title: loc.label, kind: isMe ? "me" : "start", label: isMe ? undefined : "•" });
    return m;
  }, [places, loc, isMe, open, category]);

  const circle = useMemo(() => (loc ? { lat: loc.lat, lng: loc.lng, radius } : undefined), [loc, radius]);
  const onMarker = useCallback((id: string) => {
    const p = places.find((x) => x.id === id);
    if (p) setOpen(p);
  }, [places]);

  return (
    <>
      <TopBar back="/trip-planner" />
      <div className="px-5 pb-4">
        <h1 className="text-[34px] leading-tight">Explore around you</h1>
        <p className="mt-1 text-[15px] text-muted">Search a place or use your location. Nothing here is booked: links open the provider or Google Maps.</p>

        <div className="mt-4 grid gap-3">
          <LocationSearch label="Where are you?" placeholder="Search a place, area or address" near={UDAIPUR} onSelect={(l) => { setLoc(l); setIsMe(false); }} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-secondary btn-sm" onClick={locateMe}><LocateIcon size={18} /> Use my current location</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setLoc(UDAIPUR); setIsMe(false); }}>Udaipur old city</button>
          </div>
          {geoMsg && <p className="notice" role="status">{geoMsg}</p>}
        </div>
      </div>

      {loc && (
        <>
          <div className="px-5">
            <div className="scroll-x" role="radiogroup" aria-label="Category">
              {CATEGORIES.map((c) => (
                <button key={c.key} type="button" role="radio" aria-checked={c.key === "rentals" ? isRental(category) : category === c.key} className="chip" onClick={() => setCategory(c.key)}>
                  {c.label}
                </button>
              ))}
            </div>
            {isRental(category) && (
              <div className="scroll-x mt-2" role="radiogroup" aria-label="Rental type">
                {RENTAL_FILTERS.map((f) => (
                  <button key={f.key} type="button" role="radio" aria-checked={category === f.key} className="chip !min-h-[38px] !text-[14px]" onClick={() => setCategory(f.key)}>
                    {f.label}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-3 flex items-center gap-3">
              <label htmlFor="radius" className="text-[14px] text-muted">Search radius</label>
              <select id="radius" className="field !min-h-[44px] !w-auto !py-2" value={radius} onChange={(e) => setRadius(Number(e.target.value))}>
                {RADII.map((r) => <option key={r} value={r}>{r < 1000 ? `${r} m` : `${r / 1000} km`}</option>)}
              </select>
              <span className="text-[14px] text-muted truncate">around {loc.label}</span>
            </div>
            {(CATEGORY_NOTE[category] ?? (isRental(category) ? CATEGORY_NOTE.rentals : null)) && (
              <p className="mt-3 text-[14px] text-muted">{CATEGORY_NOTE[category] ?? CATEGORY_NOTE.rentals}</p>
            )}
          </div>

          <div className="mt-4 px-5 md:grid md:grid-cols-[1.2fr_1fr] md:gap-5">
            <div className="md:sticky md:top-4 md:self-start">
              <MapView center={{ lat: loc.lat, lng: loc.lng }} markers={markers} circle={circle} fit={places.length ? "markers" : "circle"} onMarkerClick={onMarker} className="h-[44svh] min-h-[280px] md:h-[620px]" ariaLabel="Map of nearby places" />
            </div>
            <div className="mt-4 md:mt-0">
              <ProviderNotice providers={providers} className="mb-3" />
              {error && <ErrorBox title="Could not load places" action={<button className="btn btn-secondary btn-sm" onClick={() => load(false)}>Try again</button>}>{error}</ErrorBox>}
              {loading && !places.length && <div className="grid gap-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div>}
              {!loading && !error && places.length === 0 && (
                <EmptyState title="Nothing found here">
                  No {([...CATEGORIES, ...RENTAL_FILTERS].find((c) => c.key === category)?.label ?? "places").toLowerCase()} came back within {radius < 1000 ? `${radius} m` : `${radius / 1000} km`}. Try a larger radius or another category.
                </EmptyState>
              )}
              {isRental(category) && places.length > 0 && <h2 className="mb-2 text-[22px]">Rental shops</h2>}
              <ol className="grid gap-3" aria-label="Nearby places">
                {places.map((p, i) => (
                  <li key={p.id} className="flex gap-2">
                    <span className="mt-4 w-6 shrink-0 text-right text-[13px] text-muted tnum" aria-hidden="true">{i + 1}</span>
                    <div className="min-w-0 flex-1"><PlaceRow place={p} active={open?.id === p.id} onOpen={setOpen} /></div>
                  </li>
                ))}
              </ol>
              {cursor && (
                <button type="button" className="btn btn-secondary mt-4 w-full" disabled={loading} onClick={() => load(true)}>
                  {loading ? "Loading…" : "Load more"}
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {open && <PlaceDetail place={open} rideFrom={isRental(category) || isRental(open.category ?? "")} onClose={() => setOpen(null)} />}
    </>
  );
}
