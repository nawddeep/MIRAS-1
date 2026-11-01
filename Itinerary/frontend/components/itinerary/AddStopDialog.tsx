"use client";

import { useEffect, useRef, useState } from "react";
import { apiGet } from "@/lib/api";
import { getPicks, removePick, type Pick } from "@/lib/storage";
import type { Envelope, Place } from "@/lib/types";
import { CloseIcon, SearchIcon } from "../icons";
import { PlaceRow } from "../PlaceDetail";
import { EmptyState, ProviderNotice, Skeleton } from "../ui";
import type { ProviderStatus } from "@/lib/types";

export function AddStopDialog({ destination, onPick, onClose }: { destination: string; onPick: (p: Place) => void; onClose: () => void }) {
  const [tab, setTab] = useState<"search" | "picks">("search");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Place[] | null>(null);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picks] = useState<Pick[]>(() => getPicks());
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim().length < 2) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiGet<Envelope<Place[]>>("/api/places/search", { q: q.trim(), destination });
      setResults(res.data);
      setProviders(res.providers);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function choosePick(p: Pick) {
    setBusy(true);
    setError(null);
    try {
      const res = await apiGet<Envelope<Place>>(`/api/places/details/${encodeURIComponent(p.id)}`);
      onPick(res.data);
      removePick(p.id);
    } catch (err) {
      setError(`Could not load ${p.name}: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <section className="sheet" role="dialog" aria-modal="true" aria-labelledby="add-title">
        <div className="flex items-center justify-between gap-3">
          <h2 id="add-title" className="text-[26px]">Add a stop</h2>
          <button ref={closeRef} type="button" className="icon-btn" aria-label="Close" onClick={onClose}><CloseIcon size={20} /></button>
        </div>
        <div className="mt-3 flex gap-2" role="tablist">
          <button role="tab" aria-selected={tab === "search"} data-active={tab === "search"} className="chip" onClick={() => setTab("search")}>Search places</button>
          <button role="tab" aria-selected={tab === "picks"} data-active={tab === "picks"} className="chip" onClick={() => setTab("picks")}>From Explore ({picks.length})</button>
        </div>
        {error && <p className="alert mt-3">{error}</p>}
        {tab === "search" ? (
          <div className="mt-4">
            <form onSubmit={search} className="flex gap-2" role="search">
              <label htmlFor="add-q" className="sr-only">Search for a place</label>
              <input id="add-q" className="field" placeholder="e.g. Bagore ki Haveli, rooftop café" value={q} onChange={(e) => setQ(e.target.value)} />
              <button className="btn btn-primary" disabled={busy || q.trim().length < 2}><SearchIcon size={18} /><span className="sr-only">Search</span></button>
            </form>
            <ProviderNotice providers={providers} className="mt-3" />
            {busy && <Skeleton className="mt-3 h-24" />}
            {results && !busy && results.length === 0 && <div className="mt-3"><EmptyState title="No places found">Try a different name.</EmptyState></div>}
            <ul className="mt-3 grid gap-2">{results?.map((p) => <li key={p.id}><PlaceRow place={p} onOpen={onPick} /></li>)}</ul>
          </div>
        ) : (
          <div className="mt-4">
            {picks.length === 0 ? (
              <EmptyState title="Nothing saved from Explore yet">Open a place in Explore and tap “Add to itinerary”.</EmptyState>
            ) : (
              <ul className="grid gap-2">
                {picks.map((p) => (
                  <li key={p.id}>
                    <button type="button" className="tile w-full text-left" disabled={busy} onClick={() => choosePick(p)}>
                      <span className="block text-[17px] font-medium">{p.name}</span>
                      <span className="text-[13px] text-muted">Saved from Explore</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </>
  );
}
