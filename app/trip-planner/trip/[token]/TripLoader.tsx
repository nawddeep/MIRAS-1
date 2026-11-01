"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TopBar } from "@/components/trip/Shell";
import { ItineraryView } from "@/components/trip/itinerary/ItineraryView";
import { ErrorBox, Skeleton } from "@/components/trip/ui";
import { apiGet } from "@/lib/trip/api";
import type { Itinerary } from "@/lib/trip/types";

export function TripLoader({ token }: { token: string }) {
  const [it, setIt] = useState<Itinerary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctl = new AbortController();
    apiGet<Itinerary>(`/api/trip/itinerary/shared/${encodeURIComponent(token)}`, undefined, ctl.signal)
      .then(setIt)
      .catch((e) => {
        if ((e as Error).name !== "AbortError") setError((e as Error).message);
      });
    return () => ctl.abort();
  }, [token]);

  return (
    <>
      <TopBar back="/trip-planner/plan" />
      {error ? (
        <div className="px-5"><ErrorBox title="Could not open this trip" action={<Link className="btn btn-secondary btn-sm" href="/trip-planner/plan">Plan a new trip</Link>}>{error}</ErrorBox></div>
      ) : it ? (
        <ItineraryView initial={it} />
      ) : (
        <div className="px-5 pt-4" aria-busy="true">
          <p role="status">Opening the saved trip and refreshing place details…</p>
          <Skeleton className="mt-4 h-40" />
          <Skeleton className="mt-4 h-72" />
        </div>
      )}
    </>
  );
}
