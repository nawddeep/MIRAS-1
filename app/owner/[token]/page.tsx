import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OwnerEditor } from "@/components/OwnerEditor";
import { OwnerWorkshops } from "@/components/OwnerWorkshops";
import { Card, SampleBadge } from "@/components/ui";
import { getRepos } from "@/lib/repos";
import { artisanPublishBlockers } from "@/lib/services/publishing";

// Private page, reached only by the owner's edit link. Keep it out of search engines and referrer headers.
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function OwnerPage({ params }: PageProps<"/owner/[token]">) {
  const { token } = await params;
  const repos = getRepos();
  const artisan = repos.artisans.getByEditToken(token);
  if (!artisan) notFound();
  const enquiries = repos.enquiries.listByArtisan(artisan.id);
  const workshops = repos.workshops.list().filter((w) => w.artisanId === artisan.id);
  const fmt = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        {artisan.isSample && <SampleBadge lang="en" />}
        <h1 className="text-3xl">Your listing: {artisan.name}</h1>
        <p className="text-sm text-ink-soft">This is your private link. Do not share it.</p>
      </header>

      <OwnerEditor token={token} artisan={artisan} blockers={artisanPublishBlockers(artisan)} />

      <OwnerWorkshops token={token} workshops={workshops} />

      <section className="space-y-3">
        <h2 className="text-2xl">Enquiries ({enquiries.length})</h2>
        <p className="text-sm text-ink-soft">Reply to visitors directly using the contact they left. MIRAS does not send messages for you.</p>
        {enquiries.map((e) => (
          <Card key={e.id}>
            <p className="text-xs text-ink-soft">
              {e.kind === "appointment" ? "Appointment request" : "Question"} · {fmt.format(new Date(e.createdAt))}
            </p>
            <p className="mt-1 whitespace-pre-line">{e.message}</p>
            <p className="mt-1 text-sm">
              Reply to: <span className="font-medium break-all">{e.contactBack}</span>
            </p>
          </Card>
        ))}
      </section>
    </div>
  );
}
