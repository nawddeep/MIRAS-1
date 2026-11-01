"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { idbGet, idbPut } from "@/lib/client/idb";
import { loadPlan } from "@/lib/client/plan-store";
import type { SourceType } from "@/lib/schemas";
import { Button } from "./ui";

export type OfflinePlace = {
  slug: string;
  name: string;
  summary: string;
  openingHours: string;
  visitTips: string[];
  isSample: boolean;
  stories: { title: string; text: string; sourceType: SourceType; sourceRef?: string; isSample: boolean }[];
};
export type OfflinePhrase = { id: string; en: string; hi: string; isSample: boolean };
export type OfflineRecord =
  | { id: string; kind: "place"; savedAt: string; data: OfflinePlace }
  | { id: "plan"; kind: "plan"; savedAt: string; data: { places: string[]; startTime: string; dayHours: number; mode: string } }
  | { id: "phrases"; kind: "phrases"; savedAt: string; data: OfflinePhrase[] };

export const formatSavedAt = (iso: string) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

/** Saves this place, the visitor's plan and the phrase list into IndexedDB on the device. Nothing is cached automatically. */
export function SaveOffline({ place, phrases, placeNames }: { place: OfflinePlace; phrases: OfflinePhrase[]; placeNames: Record<string, string> }) {
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    idbGet<OfflineRecord>("offline", `place:${place.slug}`).then(
      (r) => r && setSavedAt(r.savedAt),
      () => undefined,
    );
  }, [place.slug]);

  async function save() {
    const now = new Date().toISOString();
    const plan = loadPlan();
    try {
      await idbPut<OfflineRecord>("offline", { id: `place:${place.slug}`, kind: "place", savedAt: now, data: place });
      await idbPut<OfflineRecord>("offline", {
        id: "plan",
        kind: "plan",
        savedAt: now,
        data: { places: plan.placeIds.map((id) => placeNames[id] ?? id), startTime: plan.startTime, dayHours: plan.dayHours, mode: plan.mode },
      });
      await idbPut<OfflineRecord>("offline", { id: "phrases", kind: "phrases", savedAt: now, data: phrases });
      setSavedAt(now);
      setError(null);
    } catch {
      setError("Could not save on this device (storage may be blocked in private mode).");
    }
  }

  return (
    <div className="space-y-1 rounded-2xl border border-dashed border-line p-3" data-testid="save-offline">
      <Button type="button" variant="secondary" onClick={save}>
        {savedAt ? "Update offline copy" : "Save for offline"}
      </Button>
      {savedAt && (
        <p className="text-sm">
          Offline copy saved on {formatSavedAt(savedAt)}.{" "}
          <Link href="/offline" className="underline">
            Open offline copies
          </Link>
        </p>
      )}
      {error && <p className="text-sm text-[#9b3b28]">{error}</p>}
      <p className="text-xs text-ink-soft">Saves this place, your plan and the phrase list on this device.</p>
    </div>
  );
}
