"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Workshop } from "@/lib/schemas";
import { Button, Label } from "./ui";

const input = "min-h-11 w-full rounded-xl border border-ink/25 bg-white px-3";

function WorkshopForm({ w, onSave, busy }: { w?: Workshop; onSave: (fields: Record<string, string>) => void; busy: boolean }) {
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>);
      }}
    >
      {(
        [
          ["title", "Title", w?.title],
          ["language", "Language", w?.language],
          ["durationMinutes", "Duration (minutes)", w?.durationMinutes?.toString()],
          ["cost", "Cost", w?.cost],
          ["howToBook", "How to book (outside MIRAS)", w?.howToBook],
        ] as const
      ).map(([name, label, value]) => (
        <div key={name}>
          <label className="mb-1 block text-sm font-medium" htmlFor={`${w?.id ?? "new"}-${name}`}>
            {label}
          </label>
          <input
            id={`${w?.id ?? "new"}-${name}`}
            name={name}
            defaultValue={value ?? ""}
            inputMode={name === "durationMinutes" ? "numeric" : undefined}
            className={input}
          />
        </div>
      ))}
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor={`${w?.id ?? "new"}-description`}>
          Description
        </label>
        <textarea id={`${w?.id ?? "new"}-description`} name="description" defaultValue={w?.description ?? ""} rows={3} className={`${input} py-2`} />
      </div>
      <Button type="submit" variant="secondary" disabled={busy}>
        {w ? "Save changes" : "Add workshop"}
      </Button>
    </form>
  );
}

export function OwnerWorkshops({ token, workshops }: { token: string; workshops: Workshop[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});

  async function act(body: object, success: string) {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(`/api/owner/${encodeURIComponent(token)}/workshops`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      setNote(res.ok ? { ok: true, text: success } : { ok: false, text: data.missing?.join("; ") ?? data.error ?? "Something went wrong." });
      if (res.ok) router.refresh();
    } catch {
      setNote({ ok: false, text: "No connection. Nothing was changed." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4" data-testid="owner-workshops">
      <h2 className="text-2xl">Workshops</h2>
      <p className="text-sm text-ink-soft">
        A workshop is shown to visitors only after you confirm its details. Editing a workshop hides it again until you re-confirm. No bookings
        or payments happen in MIRAS.
      </p>
      {workshops.map((w) => (
        <div key={w.id} className="space-y-3 rounded-2xl border border-line bg-white/60 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-xl">{w.title}</span>
            <Label tone={w.status === "published" ? "info" : "neutral"}>{w.status === "published" ? "Published" : "Draft"}</Label>
          </div>
          <WorkshopForm w={w} busy={busy} onSave={(fields) => act({ action: "save", id: w.id, fields }, "Saved as draft. Confirm again to publish.")} />
          {w.status === "published" ? (
            <Button type="button" variant="secondary" disabled={busy} onClick={() => act({ action: "unpublish", id: w.id }, "Workshop hidden.")}>
              Unpublish
            </Button>
          ) : (
            <div className="space-y-2 rounded-xl bg-saffron/15 p-3">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={Boolean(confirmed[w.id])}
                  onChange={(e) => setConfirmed({ ...confirmed, [w.id]: e.target.checked })}
                />
                I confirm the title, duration, cost and booking details above are correct.
              </label>
              <Button
                type="button"
                variant="accent"
                disabled={busy || !confirmed[w.id]}
                onClick={() => act({ action: "publish", id: w.id, confirmed: true }, "Workshop published.")}
              >
                Confirm and publish
              </Button>
            </div>
          )}
        </div>
      ))}
      <details className="rounded-2xl border border-dashed border-line p-4">
        <summary className="cursor-pointer font-medium">Add a workshop</summary>
        <div className="mt-3">
          <WorkshopForm busy={busy} onSave={(fields) => act({ action: "save", fields }, "Workshop saved as draft.")} />
        </div>
      </details>
      {note && (
        <p role={note.ok ? "status" : "alert"} className={`rounded-xl p-3 text-sm ${note.ok ? "bg-lake/25" : "bg-rose/15"}`}>
          {note.text}
        </p>
      )}
    </section>
  );
}
