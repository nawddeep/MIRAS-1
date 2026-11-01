"use client";

import { useEffect, useState } from "react";
import { idbAll, idbDelete } from "@/lib/client/idb";
import type { Lang } from "@/lib/i18n";
import { formatSavedAt, type OfflineRecord } from "./SaveOffline";
import { Card, SampleBadge, SourceTypeLabel } from "./ui";

export function OfflineView({ lang }: { lang: Lang }) {
  const [records, setRecords] = useState<OfflineRecord[] | null>(null);
  const load = () => idbAll<OfflineRecord>("offline").then(setRecords, () => setRecords([]));
  useEffect(() => {
    load();
  }, []);

  if (!records) return <p className="text-ink-soft">Loading saved copies…</p>;
  if (!records.length) return <p className="text-ink-soft">Nothing saved yet. Use &ldquo;Save for offline&rdquo; on a place page while you are online.</p>;

  const plan = records.find((r) => r.kind === "plan");
  const phrases = records.find((r) => r.kind === "phrases");
  const places = records.filter((r): r is Extract<OfflineRecord, { kind: "place" }> => r.kind === "place");

  return (
    <div className="space-y-5" data-testid="offline-view">
      {plan && plan.kind === "plan" && (
        <Card>
          <h2 className="text-2xl">Your plan</h2>
          <p className="text-xs text-ink-soft">Offline copy saved on {formatSavedAt(plan.savedAt)}</p>
          {plan.data.places.length ? (
            <p className="mt-1">
              {plan.data.places.join(", ")} · start {plan.data.startTime} · {plan.data.dayHours} h · {plan.data.mode}
            </p>
          ) : (
            <p className="mt-1 text-ink-soft">No places in your plan yet.</p>
          )}
        </Card>
      )}

      {places.map((r) => (
        <Card key={r.id}>
          {r.data.isSample && <SampleBadge lang={lang} />}
          <h2 className="mt-1 text-2xl">{r.data.name}</h2>
          <p className="text-xs text-ink-soft">Offline copy saved on {formatSavedAt(r.savedAt)}</p>
          <p className="mt-2">{r.data.summary}</p>
          <p className="mt-1 text-sm">Opening hours: {r.data.openingHours}</p>
          <ul className="mt-2 list-disc pl-5 text-sm">
            {r.data.visitTips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
          {r.data.stories.map((s) => (
            <div key={s.title} className="mt-3 rounded-xl bg-paper p-3">
              <div className="flex flex-wrap gap-2">
                <SourceTypeLabel lang={lang} type={s.sourceType} />
                {s.isSample && <SampleBadge lang={lang} />}
              </div>
              <p className="mt-1 font-display text-lg">{s.title}</p>
              <p className="text-sm">{s.text}</p>
              {s.sourceRef && <p className="text-xs text-ink-soft">Source: {s.sourceRef}</p>}
            </div>
          ))}
          <button
            type="button"
            className="mt-3 min-h-10 text-sm underline"
            onClick={async () => {
              await idbDelete("offline", r.id);
              load();
            }}
          >
            Delete this offline copy
          </button>
        </Card>
      ))}

      {phrases && phrases.kind === "phrases" && phrases.data.length > 0 && (
        <Card>
          <h2 className="text-2xl">Phrases</h2>
          <p className="text-xs text-ink-soft">Offline copy saved on {formatSavedAt(phrases.savedAt)}</p>
          <ul className="mt-2 space-y-2">
            {phrases.data.map((p) => (
              <li key={p.id}>
                {p.isSample && <SampleBadge lang={lang} />}
                <p>{p.en}</p>
                <p lang="hi">{p.hi}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
