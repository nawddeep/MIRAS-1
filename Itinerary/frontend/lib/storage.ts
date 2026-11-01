"use client";

import type { Place } from "./types";

// Places picked in Explore ("Add to itinerary") wait here until added to a trip.
// Only id, name and coordinates are kept; full details are re-fetched when used.
export interface Pick { id: string; name: string; lat: number; lng: number }

const PICKS = "itinerary.picks.v1";
const EDIT = "itinerary.edit-tokens.v1";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event("itinerary-storage"));
    return true;
  } catch {
    return false;
  }
}

export function getPicks(): Pick[] {
  return read<Pick[]>(PICKS, []);
}

export function addPick(p: Place): boolean {
  const picks = getPicks().filter((x) => x.id !== p.id);
  return write(PICKS, [{ id: p.id, name: p.name, lat: p.lat, lng: p.lng }, ...picks].slice(0, 30));
}

export function removePick(id: string): void {
  write(PICKS, getPicks().filter((p) => p.id !== id));
}

export function saveEditToken(share: string, edit: string): boolean {
  return write(EDIT, { ...read<Record<string, string>>(EDIT, {}), [share]: edit });
}

export function getEditToken(share: string): string | null {
  return read<Record<string, string>>(EDIT, {})[share] ?? null;
}
