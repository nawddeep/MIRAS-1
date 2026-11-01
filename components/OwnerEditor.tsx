"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Artisan } from "@/lib/schemas";
import { Button, Label } from "./ui";

const list = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

export function OwnerEditor({ token, artisan, blockers }: { token: string; artisan: Artisan; blockers: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [agreed, setAgreed] = useState(false);

  async function act(body: object, success: string) {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(`/api/owner/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      setNote(res.ok ? { ok: true, text: success } : { ok: false, text: data.missing?.join("; ") ?? data.error ?? "Something went wrong." });
      if (res.ok) router.refresh();
    } catch {
      setNote({ ok: false, text: "No connection. Nothing was changed. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const s = (k: string) => String(f.get(k) ?? "");
    act(
      {
        action: "save",
        fields: {
          name: s("name"),
          craft: s("craft"),
          description: s("description"),
          description_hi: s("description_hi") || undefined,
          materials: list(s("materials")),
          languages: list(s("languages")),
          contact: s("contact"),
          locationText: s("locationText"),
        },
      },
      "Saved.",
    );
  }

  const input = "min-h-11 w-full rounded-xl border border-ink/25 bg-white px-3";
  const field = (name: keyof Artisan, label: string, value: string, multiline = false) => (
    <div>
      <label htmlFor={name} className="mb-1 block font-medium">
        {label}
      </label>
      {multiline ? (
        <textarea id={name} name={name} defaultValue={value} rows={4} className={`${input} py-2`} />
      ) : (
        <input id={name} name={name} defaultValue={value} className={input} />
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-2xl border border-line bg-white/60 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">Status:</span>
          <Label tone={artisan.status === "published" ? "info" : "neutral"}>{artisan.status === "published" ? "Published" : "Draft"}</Label>
          <Label tone={artisan.consent.given ? "info" : "rose"}>{artisan.consent.given ? "Consent recorded" : "No consent yet"}</Label>
        </div>

        {!artisan.consent.given && !artisan.isSample && (
          <div className="space-y-2 rounded-xl bg-saffron/15 p-3">
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-1.5" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span>
                I agree that MIRAS may show this listing and its photo publicly, and that I can edit or remove it at any time from this
                private link.
              </span>
            </label>
            <Button type="button" variant="secondary" disabled={!agreed || busy} onClick={() => act({ action: "consent", agreed: true }, "Consent recorded.")}>
              Record my consent
            </Button>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {artisan.status === "published" ? (
            <Button type="button" variant="secondary" disabled={busy} onClick={() => act({ action: "unpublish" }, "Unpublished. Your listing is hidden.")}>
              Unpublish
            </Button>
          ) : (
            <Button type="button" variant="accent" disabled={busy} onClick={() => act({ action: "publish" }, "Published.")}>
              Publish
            </Button>
          )}
        </div>
        {artisan.status !== "published" && blockers.length > 0 && (
          <ul className="list-disc pl-5 text-sm text-ink-soft">
            {blockers
              .filter((b) => b !== "owner has not confirmed the listing")
              .map((b) => (
                <li key={b}>Before publishing: {b}</li>
              ))}
          </ul>
        )}
        {note && (
          <p role={note.ok ? "status" : "alert"} className={`rounded-xl p-3 text-sm ${note.ok ? "bg-lake/25" : "bg-rose/15"}`}>
            {note.text}
          </p>
        )}
      </section>

      <form onSubmit={onSave} className="space-y-3">
        <h2 className="text-2xl">Edit your listing</h2>
        {field("name", "Name", artisan.name)}
        {field("craft", "Craft", artisan.craft)}
        {field("description", "Description (English)", artisan.description, true)}
        {field("description_hi", "Description (Hindi)", artisan.description_hi ?? "", true)}
        {field("materials", "Materials (comma separated)", artisan.materials.join(", "))}
        {field("languages", "Languages (comma separated)", artisan.languages.join(", "))}
        {field("contact", "Contact (only you and the team see this)", artisan.contact)}
        {field("locationText", "Area", artisan.locationText)}
        <Button type="submit" disabled={busy}>
          Save changes
        </Button>
      </form>
    </div>
  );
}
