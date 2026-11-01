"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TopBar } from "@/components/trip/Shell";
import { TrailCard } from "@/components/trip/TrailCard";
import { TrailMap } from "@/components/trip/TrailMap";
import { EmptyState, ErrorBox, ProviderNotice, Skeleton } from "@/components/trip/ui";
import { apiGet, apiSend } from "@/lib/trip/api";
import type { Envelope, ProviderStatus, TrailRoute, TrailWaypoint } from "@/lib/trip/types";

export default function TrailPage() {
  return (
    <Suspense fallback={<div className="p-5"><Skeleton className="h-[420px]" /></div>}>
      <KeyedTrailView />
    </Suspense>
  );
}

function parseWaypoints(s: string | null): TrailWaypoint[] {
  if (!s) return [];
  return s.split(";").map((part) => {
    const [name, lat, lng] = part.split("|");
    return { name, lat: Number(lat), lng: Number(lng) };
  }).filter((w) => Number.isFinite(w.lat) && Number.isFinite(w.lng));
}

function KeyedTrailView() {
  const sp = useSearchParams();
  // New route parameters remount the view, which resets its state.
  return <TrailView key={sp.toString()} />;
}

function TrailView() {
  const sp = useSearchParams();
  const ride = sp.get("ride");
  const mode = sp.get("mode") ?? "walk";
  const name = sp.get("name") ?? "Rental shop";
  const wp = sp.get("wp");
  const title = sp.get("title") ?? "Suggested route";
  const [trails, setTrails] = useState<TrailRoute[] | null>(null);
  const [selected, setSelected] = useState(0);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctl = new AbortController();
    (async () => {
      try {
        if (ride) {
          const [lat, lng] = ride.split(",").map(Number);
          const res = await apiGet<Envelope<TrailRoute[]>>("/api/trip/trails/ride-from", { lat, lng, mode, name }, ctl.signal);
          setTrails(res.data);
          setProviders(res.providers);
        } else {
          const waypoints = parseWaypoints(wp);
          if (waypoints.length < 2) throw new Error("This trail link has fewer than two points.");
          const res = await apiSend<Envelope<TrailRoute | null>>("POST", "/api/trip/trails/route", { title, mode, waypoints }, undefined, ctl.signal);
          setTrails(res.data ? [res.data] : []);
          setProviders(res.providers);
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError((e as Error).message);
      }
    })();
    return () => ctl.abort();
  }, [ride, mode, name, wp, title]);

  const t = trails?.[selected];
  return (
    <>
      <TopBar back={ride ? "/trip-planner/explore" : undefined} />
      <div className="px-5 pb-6">
        <p className="eyebrow">Trail view</p>
        <h1 className="mt-1 text-[32px] leading-tight">{ride ? `Ride from ${name}` : title}</h1>
        <p className="mt-2 text-[15px] text-muted">
          Routes are generated between real places by a routing provider and labelled “Suggested route”. They are not official or verified trails. Check road conditions and local rules before you go.
        </p>

        <ProviderNotice providers={providers} className="mt-4" />
        {error && <ErrorBox title="Could not build a route" className="mt-4">{error}</ErrorBox>}
        {!trails && !error && <Skeleton className="mt-4 h-[420px]" />}
        {trails && trails.length === 0 && (
          <EmptyState title="No suggested route yet">
            {ride ? "No real places within reach came back from the place providers, or routing failed. Try the other mode, or check the provider notice above." : "Routing providers could not connect these points."}
          </EmptyState>
        )}

        {trails && trails.length > 1 && (
          <div className="scroll-x mt-4" role="radiogroup" aria-label="Route options">
            {trails.map((tr, i) => (
              <button key={tr.id} type="button" role="radio" aria-checked={i === selected} className="chip" onClick={() => setSelected(i)}>
                {tr.title.replace(/ from .*/, "")} · {tr.difficulty.level}
              </button>
            ))}
          </div>
        )}

        {t && (
          <div className="mt-4 grid gap-5 md:grid-cols-[1.3fr_1fr] md:items-start">
            <TrailMap key={t.id} trail={t} />
            <TrailCard trail={t} dark showMapLink={false} />
          </div>
        )}
      </div>
    </>
  );
}
