"use client";

import { useState } from "react";
import { Button } from "./ui";

const input = "w-full rounded-xl border border-ink/25 bg-white px-3";

export function PickForm() {
  const [state, setState] = useState<{ ok?: boolean; error?: string; fields?: Record<string, string> }>({});
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const res = await fetch("/api/picks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: f.get("name"), description: f.get("description"), whyItMatters: f.get("whyItMatters"), sensitive: f.get("sensitive") === "on" }),
      });
      const body = await res.json().catch(() => ({}));
      setState(res.ok ? { ok: true } : { error: body.error ?? "Something went wrong.", fields: body.fieldErrors });
    } catch {
      setState({ error: "No connection. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  if (state.ok)
    return (
      <p role="status" className="rounded-2xl bg-lake/25 p-4">
        Thank you. Your pick is waiting for a moderator. It will not appear until someone on the team checks it.
      </p>
    );

  const err = (k: string) => state.fields?.[k] && <p className="text-sm text-[#9b3b28]">{state.fields[k]}</p>;
  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      <div>
        <label htmlFor="pick-name" className="mb-1 block font-medium">
          Name of the place
        </label>
        <input id="pick-name" name="name" maxLength={80} className={`${input} min-h-11`} />
        {err("name")}
      </div>
      <div>
        <label htmlFor="pick-description" className="mb-1 block font-medium">
          What is it?
        </label>
        <textarea id="pick-description" name="description" rows={3} maxLength={600} className={`${input} py-2`} />
        {err("description")}
      </div>
      <div>
        <label htmlFor="pick-why" className="mb-1 block font-medium">
          Why does it matter?
        </label>
        <textarea id="pick-why" name="whyItMatters" rows={2} maxLength={400} className={`${input} py-2`} />
        {err("whyItMatters")}
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="sensitive" className="mt-1" />
        This place is sensitive (for example fragile, private or sacred). Its exact location should never be shown.
      </label>
      {state.error && (
        <p role="alert" className="rounded-xl bg-rose/15 p-3 text-sm">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        Send for review
      </Button>
    </form>
  );
}
