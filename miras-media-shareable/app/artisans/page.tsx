import { ArtisanCard } from "@/components/domain";
import { EmptyState } from "@/components/ui";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang-server";
import { getVisibleArtisans } from "@/lib/services/artisans";

export default async function ArtisansPage() {
  const lang = await getLang();
  const artisans = getVisibleArtisans();
  return (
    <div className="space-y-4">
      <h1 className="text-3xl">{t(lang, "meetArtisans")}</h1>
      <p className="text-ink-soft">Discover the patient hands and living craft traditions of Udaipur. Example profiles are marked as sample content.</p>
      {artisans.length ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {artisans.map((a) => (
            <li key={a.id}>
              <ArtisanCard artisan={a} lang={lang} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title={t(lang, "emptyTitle")} />
      )}
    </div>
  );
}
