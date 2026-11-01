"use client";

import { useEffect, useId, useRef, useState } from "react";
import { apiGet } from "@/lib/trip/api";
import type { Envelope, ProviderStatus, Suggestion } from "@/lib/trip/types";
import { SearchIcon } from "./icons";

export interface PickedLocation { label: string; lat: number; lng: number }

interface Props {
  label: string;
  placeholder?: string;
  near?: { lat: number; lng: number };
  initial?: string;
  onSelect: (loc: PickedLocation) => void;
}

function newSession() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());
}

/** Combobox: type to get suggestions (Google, then Geoapify). "Search" runs an explicit
 *  geocode (Geoapify, then Nominatim, which only allows explicit searches). */
export function LocationSearch({ label, placeholder, near, initial = "", onSelect }: Props) {
  const id = useId();
  const [text, setText] = useState(initial);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const session = useRef(newSession());
  const skipNext = useRef(false);

  useEffect(() => {
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    const q = text.trim();
    if (q.length < 2) return;
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const res = await apiGet<Envelope<Suggestion[]>>("/api/trip/places/autocomplete", { q, lat: near?.lat, lng: near?.lng, session: session.current }, ctl.signal);
        setItems(res.data);
        setOpen(true);
        setActive(-1);
        setProblem(res.data.length ? null : explain(res.providers));
      } catch (e) {
        if ((e as Error).name !== "AbortError") setProblem((e as Error).message);
      } finally {
        setBusy(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [text, near?.lat, near?.lng]);

  async function choose(s: Suggestion) {
    setOpen(false);
    skipNext.current = true;
    setText(s.title);
    setProblem(null);
    if (s.lat != null && s.lng != null) {
      onSelect({ label: s.title, lat: s.lat, lng: s.lng });
    } else if (s.google_place_id) {
      try {
        setBusy(true);
        const res = await apiGet<Envelope<Suggestion>>(`/api/trip/places/resolve/${encodeURIComponent(s.google_place_id)}`, { session: session.current });
        if (res.data.lat != null && res.data.lng != null) onSelect({ label: s.title, lat: res.data.lat, lng: res.data.lng });
      } catch (e) {
        setProblem((e as Error).message);
      } finally {
        setBusy(false);
      }
    }
    session.current = newSession();
  }

  async function explicitSearch() {
    const q = text.trim();
    if (q.length < 2) return;
    setBusy(true);
    try {
      const res = await apiGet<Envelope<Suggestion[]>>("/api/trip/places/geocode", { q });
      setItems(res.data);
      setOpen(true);
      setProblem(res.data.length ? null : explain(res.providers));
    } catch (e) {
      setProblem((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(-1, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && active >= 0 && items[active]) choose(items[active]);
      else explicitSearch();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const listId = `${id}-list`;
  return (
    <div className="relative">
      <label htmlFor={id} className="label">{label}</label>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <SearchIcon size={20} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
          <input
            id={id}
            className="field !pl-11"
            role="combobox"
            aria-expanded={open && items.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
            autoComplete="off"
            placeholder={placeholder}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (e.target.value.trim().length < 2) {
                setItems([]);
                setOpen(false);
              }
            }}
            onKeyDown={onKey}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onFocus={() => items.length && setOpen(true)}
          />
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={explicitSearch} disabled={busy || text.trim().length < 2}>
          {busy ? "…" : "Search"}
        </button>
      </div>
      {open && items.length > 0 && (
        <ul id={listId} role="listbox" className="absolute z-50 mt-2 max-h-72 w-full overflow-y-auto rounded-[20px] bg-white p-1.5 shadow-[0_10px_30px_rgb(0_0_0/0.12)]">
          {items.map((s, i) => (
            <li
              key={s.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`cursor-pointer rounded-[14px] px-3 py-2.5 ${i === active ? "bg-paper" : "hover:bg-paper"}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(s)}
            >
              <span className="block text-[16px]">{s.title}</span>
              {s.subtitle && <span className="block text-[13px] text-muted">{s.subtitle}</span>}
            </li>
          ))}
        </ul>
      )}
      <p className="sr-only" aria-live="polite">{open ? `${items.length} suggestions` : ""}</p>
      {problem && <p className="mt-2 text-[14px] text-[var(--danger-text)]" role="status">{problem}</p>}
    </div>
  );
}

function explain(providers: ProviderStatus[]): string {
  if (providers.length && providers.every((p) => p.state === "not_configured"))
    return "Place search is not configured on the server (needs a Google Places or Geoapify key).";
  const err = providers.find((p) => p.state === "error");
  if (err) return `${err.provider} had an error. Try again shortly.`;
  return "No matching places found.";
}
