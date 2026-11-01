import { PickForm } from "@/components/PickForm";
import { Card, Label } from "@/components/ui";
import { getPublicPicks } from "@/lib/services/picks";

export default function PicksPage() {
  const picks = getPublicPicks();
  return (
    <div className="space-y-5">
      <h1 className="text-3xl">Hidden Udaipur</h1>
      <p className="text-ink-soft">Local picks suggested by visitors and residents. Each one is checked by a named moderator before it appears.</p>
      {picks.length ? (
        <ul className="space-y-3" data-testid="public-picks">
          {picks.map((p) => (
            <li key={p.id}>
              <Card>
                <h2 className="text-2xl">{p.name}</h2>
                <p className="mt-1">{p.description}</p>
                <p className="mt-1 text-sm">
                  <span className="font-semibold">Why it matters:</span> {p.whyItMatters}
                </p>
                <p className="mt-2 text-xs text-ink-soft">
                  Sourced by {p.sourcedBy} · checked by {p.moderatedBy}
                </p>
                {p.sensitive ? (
                  <Label tone="rose">Exact location not shared</Label>
                ) : (
                  p.lat !== undefined &&
                  p.lng !== undefined && (
                    <p className="text-xs text-ink-soft">
                      Location: {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
                    </p>
                  )
                )}
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-soft">No approved picks yet.</p>
      )}
      <section className="space-y-3">
        <h2 className="text-2xl">Suggest a pick</h2>
        <PickForm />
      </section>
    </div>
  );
}
