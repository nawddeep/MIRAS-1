"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TopBar } from "@/components/Shell";
import { ItineraryView } from "@/components/itinerary/ItineraryView";
import { ErrorBox, Skeleton } from "@/components/ui";
import { apiSend } from "@/lib/api";
import { decodeRequest } from "@/lib/format";
import type { Itinerary } from "@/lib/types";

export default function ResultsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <KeyedResults />
    </Suspense>
  );
}

const STAGES = ["Finding places that match your interests…", "Checking the weather for your dates…", "Looking up transport options…", "Routing between stops and building your days…"];

function Loading() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => Math.min(x + 1, STAGES.length - 1)), 2500);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="px-5 pt-4" aria-busy="true">
      <p className="text-[17px]" role="status" aria-live="polite">{STAGES[i]}</p>
      <p className="mt-1 text-[14px] text-muted">Live provider calls can take up to half a minute.</p>
      <Skeleton className="mt-5 h-24" />
      <Skeleton className="mt-4 h-40" />
      <Skeleton className="mt-4 h-72" />
    </div>
  );
}

function KeyedResults() {
  const raw = useSearchParams().get("r");
  // A new request remounts the view, which resets its state.
  return <Results key={raw ?? ""} raw={raw} />;
}

function Results({ raw }: { raw: string | null }) {
  const [it, setIt] = useState<Itinerary | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const req = useMemo(() => (raw ? decodeRequest(raw) : null), [raw]);
  const error = req ? fetchError : "This link doesn’t contain a trip. Start again from the planner.";

  useEffect(() => {
    if (!req) return;
    const ctl = new AbortController();
    apiSend<Itinerary>("POST", "/api/itinerary/generate", req, undefined, ctl.signal)
      .then(setIt)
      .catch((e) => {
        if ((e as Error).name !== "AbortError") setFetchError((e as Error).message);
      });
    return () => ctl.abort();
  }, [req]);

  return (
    <>
      <TopBar back={raw ? `/plan?r=${raw}` : "/plan"} />
      {error ? (
        <div className="px-5"><ErrorBox title="Could not build your trip" action={<Link className="btn btn-secondary btn-sm" href="/plan">Back to the planner</Link>}>{error}</ErrorBox></div>
      ) : it ? (
        <ItineraryView initial={it} />
      ) : (
        <Loading />
      )}
    </>
  );
}
