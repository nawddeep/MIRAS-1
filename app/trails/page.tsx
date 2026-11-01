import Link from "next/link";
import { EmptyState, SampleBadge } from "@/components/ui";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang-server";
import { getVisibleTrails } from "@/lib/services/trails";

export default async function TrailsPage() {
  const lang = await getLang();
  const trails = getVisibleTrails();
  return (
    <div className="space-y-4">
      <h1 className="text-3xl">Heritage trails</h1>
      <p className="text-ink-soft">Routes put together by the MIRAS team.</p>
      {trails.length ? (
        <ul className="space-y-3">
          {trails.map((tr) => (
            <li key={tr.id}>
              <Link href={`/trails/${tr.id}`} className="block rounded-2xl border border-line bg-white/60 p-4 hover:bg-white">
                {tr.isSample && <SampleBadge lang={lang} />}
                <h2 className="mt-1 text-2xl">{tr.title}</h2>
                <p className="text-sm text-ink-soft">
                  {tr.theme} · {tr.placeIds.length} stops · about {Math.round(tr.approxMinutes / 60)} h
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title={t(lang, "emptyTitle")} />
      )}
    </div>
  );
}
