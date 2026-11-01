import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ModeratorSignIn, PickReview } from "@/components/Moderation";
import { isModerator, MOD_COOKIE, moderationEnabled } from "@/lib/admin-auth";
import { getRepos } from "@/lib/repos";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ModerationPage() {
  if (!moderationEnabled()) {
    return (
      <div className="space-y-3">
        <h1 className="text-3xl">Moderation</h1>
        <p role="status" className="rounded-xl bg-saffron/15 p-3">
          Moderation is disabled because <code>ADMIN_PASSCODE</code> is not set in <code>.env</code>. Visitor picks stay pending and hidden.
        </p>
      </div>
    );
  }
  if (!isModerator((await cookies()).get(MOD_COOKIE)?.value)) {
    return (
      <div className="space-y-3">
        <h1 className="text-3xl">Moderation</h1>
        <ModeratorSignIn />
      </div>
    );
  }
  const pending = getRepos()
    .picks.list()
    .filter((p) => p.status === "pending");
  return (
    <div className="space-y-4">
      <h1 className="text-3xl">Moderation</h1>
      <p className="text-ink-soft">Approving needs your name and a &ldquo;sourced by&rdquo; note. Sensitive picks never show their location to visitors.</p>
      {pending.length ? pending.map((p) => <PickReview key={p.id} pick={p} />) : <p className="text-ink-soft">Nothing waiting.</p>}
    </div>
  );
}
