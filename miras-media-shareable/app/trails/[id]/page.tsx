import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink, SampleBadge } from "@/components/ui";
import { pick, t } from "@/lib/i18n";
import { getLang } from "@/lib/lang-server";
import { getTrailWithStops } from "@/lib/services/trails";

export default async function TrailPage({ params }: PageProps<"/trails/[id]">) {
  const { id } = await params;
  const lang = await getLang();
  const data = getTrailWithStops(id);
  if (!data) notFound();
  const { trail, stops } = data;
  return (
    <div className="space-y-5">
      <header className="space-y-1">
        {trail.isSample && <SampleBadge lang={lang} />}
        <h1 className="text-3xl">{trail.title}</h1>
        <p className="text-ink-soft">
          {trail.theme} · about {Math.round(trail.approxMinutes / 60)} h in total
        </p>
      </header>
      <ButtonLink href={`/trails/${trail.id}/walk`} variant="accent">
        Start the audio walk
      </ButtonLink>
      <ol className="space-y-2" data-testid="trail-stops">
        {stops.map(({ place }, i) => (
          <li key={place.id} className="flex items-center gap-3 rounded-xl border border-line bg-white/60 p-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-sm text-paper">{i + 1}</span>
            <Link href={`/places/${place.slug}`} className="flex-1 underline">
              {pick(lang, place.name, place.name_hi)}
            </Link>
            <span className="text-sm text-ink-soft">
              {place.typicalVisitMinutes} {t(lang, "minutes")}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
