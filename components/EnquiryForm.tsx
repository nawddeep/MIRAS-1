"use client";

import { useState } from "react";
import { t, type Lang } from "@/lib/i18n";
import { ENQUIRY_MAX } from "@/lib/schemas";
import { Button } from "./ui";

type State = { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "error"; message: string; fields?: Record<string, string> };

export function EnquiryForm({ artisanId, lang }: { artisanId: string; lang: Lang }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          artisanId,
          kind: form.get("kind"),
          message: form.get("message"),
          contactBack: form.get("contactBack"),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setState({ kind: "sent" });
        setMessage("");
      } else setState({ kind: "error", message: body.error ?? t(lang, "errorBody"), fields: body.fieldErrors });
    } catch {
      setState({ kind: "error", message: "No connection. Your message is still here, please try again." });
    }
  }

  if (state.kind === "sent") {
    return (
      <p role="status" className="rounded-2xl bg-lake/25 p-4">
        {t(lang, "sent")}
      </p>
    );
  }

  const fieldError = (name: string) => (state.kind === "error" ? state.fields?.[name] : undefined);

  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      <fieldset className="flex flex-wrap gap-4">
        <legend className="sr-only">Type</legend>
        <label className="flex min-h-11 items-center gap-2">
          <input type="radio" name="kind" value="question" defaultChecked /> {t(lang, "enquiryQuestion")}
        </label>
        <label className="flex min-h-11 items-center gap-2">
          <input type="radio" name="kind" value="appointment" /> {t(lang, "enquiryAppointment")}
        </label>
      </fieldset>
      <div>
        <label htmlFor="message" className="mb-1 block font-medium">
          {t(lang, "yourMessage")}
        </label>
        <textarea
          id="message"
          name="message"
          rows={4}
          maxLength={ENQUIRY_MAX}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          aria-invalid={Boolean(fieldError("message"))}
          aria-describedby="message-help"
          className="w-full rounded-input border border-line bg-paper-2 p-3 text-base"
        />
        <p id="message-help" className="text-right text-xs text-ink-soft">
          {message.length}/{ENQUIRY_MAX}
        </p>
        {fieldError("message") && <p className="text-sm text-[#9b3b28]">{fieldError("message")}</p>}
      </div>
      <div>
        <label htmlFor="contactBack" className="mb-1 block font-medium">
          {t(lang, "contactBack")}
        </label>
        <input
          id="contactBack"
          name="contactBack"
          autoComplete="email"
          aria-invalid={Boolean(fieldError("contactBack"))}
          className="min-h-[52px] w-full rounded-input border border-line bg-paper-2 px-3 text-base"
        />
        {fieldError("contactBack") && <p className="text-sm text-[#9b3b28]">{fieldError("contactBack")}</p>}
      </div>
      {state.kind === "error" && (
        <p role="alert" className="rounded-xl bg-rose/15 p-3 text-sm">
          {state.message}
        </p>
      )}
      <Button type="submit" variant="accent" className="w-full" disabled={state.kind === "sending"}>
        {t(lang, "send")}
      </Button>
      <p className="text-sm text-muted-paper">{t(lang, "noPaymentHere")}</p>
    </form>
  );
}
