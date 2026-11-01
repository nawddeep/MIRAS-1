import type { Viewport } from "next";
import { notFound } from "next/navigation";
import { CraftPattern, MediaImage, WorkshopCard } from "@/components/domain";
import { PhotoGallery } from "@/components/PhotoGallery";
import { EnquiryForm } from "@/components/EnquiryForm";
import { ArtisanChip, ButtonLink, Card, ConfirmedByMakerBadge, ConsentBadge, SampleBadge } from "@/components/ui";
import { pick, t } from "@/lib/i18n";
import { getLang } from "@/lib/lang-server";
import { getVisibleArtisan, getVisibleWorkshops } from "@/lib/services/artisans";
import { artisanPublishBlockers } from "@/lib/services/publishing";

export const viewport: Viewport = { themeColor: "#F5EEE0" };

export default async function ArtisanPage({ params }: PageProps<"/artisans/[id]">) {
  const { id } = await params;
  const lang = await getLang();
  const artisan = getVisibleArtisan(id);
  if (!artisan) notFound();
  const workshops = getVisibleWorkshops(artisan.id);
  // Consent and maker-confirmation badges only when the publish gates are actually met (rule 5).
  const gatesMet = !artisan.isSample && artisanPublishBlockers(artisan).length === 0;

  return (
    <div className="artisan-screen space-y-6">
      {/* Header image: the maker's first photo (hands and craft only), or a craft pattern. Never a face. */}
      <div className="-mx-5 -mt-5 aspect-[4/3] overflow-hidden bg-mist sm:mx-0 sm:mt-0 sm:aspect-[16/9] sm:rounded-card">
        {artisan.photos[0] ? <MediaImage src={artisan.photos[0]} alt={`${artisan.craft}: work by ${artisan.name}`} /> : <CraftPattern className="h-full w-full" />}
      </div>

      <header className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <ArtisanChip lang={lang} />
          {gatesMet ? (
            <>
              <ConsentBadge lang={lang} />
              <ConfirmedByMakerBadge lang={lang} />
            </>
          ) : (
            artisan.isSample && <SampleBadge lang={lang} />
          )}
        </div>
        <h1 className="t-title">{artisan.name}</h1>
        <p lang={lang === "hi" ? undefined : "hi"} className="text-lg text-muted-paper">{artisan.craft}</p>
        <p className="text-sm text-muted-paper">{artisan.locationText}</p>
        {artisan.headline && <p className="t-heading">{artisan.headline}</p>}
        <p className="whitespace-pre-line">{pick(lang, artisan.description, artisan.description_hi)}</p>
      </header>

      {artisan.photos.length > 1 && <section id="artwork" className="space-y-2 scroll-mt-20">
        <h2 className="t-heading">The art, up close</h2>
        <PhotoGallery photos={artisan.photos.slice(1)} name={artisan.craft} caption="Craft gallery" compact />
        {artisan.isSample && <p className="text-sm text-muted-paper">Example artwork only. Product availability and pricing are not connected.</p>}
      </section>}

      <ButtonLink href="#enquire" variant="accent" className="w-full">
        {t(lang, "enquire")}
      </ButtonLink>

      <Card>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-semibold text-muted-paper">{t(lang, "languages")}</dt>
            <dd>{artisan.languages.join(", ")}</dd>
          </div>
          <div>
            <dt className="font-semibold text-muted-paper">{t(lang, "location")}</dt>
            <dd>{artisan.locationText}</dd>
          </div>
          {artisan.materials.length > 0 && (
            <div className="sm:col-span-2">
              <dt className="font-semibold text-muted-paper">Materials</dt>
              <dd>{artisan.materials.join(", ")}</dd>
            </div>
          )}
        </dl>
      </Card>

      {workshops.length > 0 && (
        <section className="space-y-3" id="workshops">
          <h2 className="t-heading">{t(lang, "workshops")}</h2>
          {workshops.map((w) => (
            <WorkshopCard key={w.id} workshop={w} lang={lang} />
          ))}
        </section>
      )}

      <section className="scroll-mt-24 space-y-3" id="enquire">
        <h2 className="t-heading">{t(lang, "enquire")}</h2>
        {artisan.isSample && <p className="text-sm text-muted-paper">This is a sample listing. Enquiries are stored for the demo only.</p>}
        <EnquiryForm artisanId={artisan.id} lang={lang} />
      </section>
    </div>
  );
}
