"use client";

import { useActionState } from "react";
import { moderate, signIn, type ModState } from "@/lib/actions/moderation";
import type { Pick } from "@/lib/schemas";
import { Button, Label } from "./ui";

const input = "min-h-11 w-full rounded-xl border border-ink/25 bg-white px-3";

export function ModeratorSignIn() {
  const [state, action, pending] = useActionState<ModState, FormData>(signIn, {});
  return (
    <form action={action} className="space-y-3">
      <label htmlFor="passcode" className="block font-medium">
        Moderator passcode
      </label>
      <input id="passcode" name="passcode" type="password" autoComplete="current-password" className={input} />
      {state.error && (
        <p role="alert" className="text-sm text-[#9b3b28]">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        Sign in
      </Button>
    </form>
  );
}

export function PickReview({ pick }: { pick: Pick }) {
  const [state, action, pending] = useActionState<ModState, FormData>(moderate, {});
  return (
    <form action={action} className="space-y-2 rounded-2xl border border-line bg-white/60 p-4" data-testid="pending-pick">
      <input type="hidden" name="id" value={pick.id} />
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-xl">{pick.name}</h3>
        {pick.sensitive && <Label tone="rose">Sensitive</Label>}
      </div>
      <p>{pick.description}</p>
      <p className="text-sm">
        <span className="font-semibold">Why it matters:</span> {pick.whyItMatters}
      </p>
      <p className="text-xs text-ink-soft">Submitted {new Date(pick.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</p>
      <input name="moderator" placeholder="Your name (moderator)" aria-label="Your name (moderator)" className={input} />
      <input name="sourcedBy" placeholder="Sourced by (who confirmed this, and how)" aria-label="Sourced by" className={input} />
      {state.error && (
        <p role="alert" className="text-sm text-[#9b3b28]">
          {state.error}
        </p>
      )}
      {state.ok && <p role="status">{state.ok}</p>}
      <div className="flex gap-2">
        <Button type="submit" name="decision" value="approve" variant="accent" disabled={pending}>
          Approve
        </Button>
        <Button type="submit" name="decision" value="reject" variant="secondary" disabled={pending}>
          Reject
        </Button>
      </div>
    </form>
  );
}
