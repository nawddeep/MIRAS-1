import { notFound } from "next/navigation";
import { ArtisanCard, IllustrativeScene, PlaceHeader, StoryBlock } from "@/components/domain";
import { ClockIcon, TicketIcon } from "@/components/icons";
import { PlaceActions } from "@/components/PlaceActions";
import { PhotoCredits } from "@/components/PhotoCredits";
import { PhotoGallery } from "@/components/PhotoGallery";
import { SectionNav } from "@/components/SectionNav";
import { Pano360 } from "@/components/Pano360";
import { ResponsibleInfo } from "@/components/ResponsibleInfo";
import { SaveOffline } from "@/components/SaveOffline";
import { IDontKnow, SampleBadge } from "@/components/ui";
import { currentMode } from "@/lib/config";
import { pick, t } from "@/lib/i18n";
import { getLang } from "@/lib/lang-server";
import { getRepos } from "@/lib/repos";
import { getVisibleArtisans } from "@/lib/services/artisans";
import { getVisiblePlaceBySlug, getVisiblePlaces, getVisibleStories } from "@/lib/services/content";

export default async function PlacePage({ params }: PageProps<"/places/[slug]">) {
  const { slug } = await params;
  const lang = await getLang();
  const place = getVisiblePlaceBySlug(slug);
  if (!place) notFound();
  const name = pick(lang, place.name, place.name_hi);
  const photoCaption = place.id === "ahar-museum" ? "Objects from the museum collection" : place.id === "moti-magri" ? "Lake views from Moti Magri" : "";
  const stories = getVisibleStories(place.id);
  // No artisan-to-place link in the data model yet, so show a few makers from the city.
  const artisans = getVisibleArtisans().filter(artisan=>!artisan.isSample).slice(0, 3);

  return (
    <div className="place-screen space-y-6">
      <section className="place-visual"><div id="photos" className="place-hero-wrap">
        {place.photos.length ? <PhotoGallery photos={place.photos} name={name} caption={photoCaption} slug={place.slug} /> : <IllustrativeScene lang={lang} />}
      </div>
      <div id="overview" className="scroll-mt-28">
        <PlaceHeader place={place} lang={lang} />
      </div>

      <div className="place-reference-details"><p className="place-reference-facts"><ClockIcon size={18}/>{place.typicalVisitMinutes} min suggested <span>│</span>{place.category} &amp; heritage</p>{stories.length > 0 && <><h2>Explore this place</h2><div className="place-story-strip">{stories.slice(0,3).map((story,index)=><a href={`/stories/${story.id}`} key={story.id}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={place.photos[index % place.photos.length]} alt=""/><span>{pick(lang,story.title,story.title_hi)}</span></a>)}</div></>}</div>
      <PlaceActions id={place.id} name={place.name}/></section>

      <SectionNav sections={[
        { id: "overview", label: t(lang, "overview") }, { id: "stories", label: t(lang, "stories") },
        { id: "photos", label: t(lang, "photos") }, { id: "visit", label: t(lang, "visit") },
      ]} />

      <p className="place-introduction">{pick(lang, place.summary, place.summary_hi)}</p>
      {place.sourceRefs?.length && <details className="text-sm"><summary className="min-h-11 cursor-pointer">Sources &amp; map information</summary><ul className="space-y-2">{place.sourceRefs.map(source=><li key={source}><a href={source} target="_blank" rel="noopener noreferrer" className="underline">Official place information ↗</a></li>)}</ul><p className="mt-2">{place.coordinateNote}</p><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name}, Udaipur, Rajasthan`)}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline">Find the named place on Google Maps ↗</a></details>}
      {/* Facts: only content values. Entry fee and hours have no verified field yet, so they say so. */}
      <section aria-label="Facts" className="grid grid-cols-3 gap-2 rounded-card border border-line bg-paper-2 p-3 text-center">
        <div className="space-y-1">
          <ClockIcon className="mx-auto text-lake-deep" />
          <p className="tnum font-semibold">
            {place.typicalVisitMinutes} {t(lang, "minutes")}
          </p>
          <p className="t-small text-muted-paper">{t(lang, "typicalVisit")}</p>
          {place.isSample && <SampleBadge lang={lang} />}
        </div>
        <div className="space-y-1">
          <TicketIcon className="mx-auto text-lake-deep" />
          <p className="font-medium">Check locally</p>
          <p className="t-small text-muted-paper">{t(lang, "entryFee")}</p>
        </div>
        <div className="space-y-1">
          <ClockIcon className="mx-auto text-lake-deep" />
          <p className="font-medium">{place.openingTimes ? `${place.openingTimes.open}–${place.openingTimes.close}` : "Confirm hours"}</p>
          <p className="t-small text-muted-paper">{t(lang, "openingHours")}</p>
        </div>
      </section>

      <section id="stories" className="scroll-mt-28 space-y-3">
        <h2 className="t-heading">{t(lang, "stories")}</h2>
        {stories.length ? stories.map((s) => <StoryBlock key={s.id} story={s} lang={lang} />) : <IDontKnow lang={lang} />}
      </section>

      <section id="visit" className="scroll-mt-28">
        <h2 className="t-heading mb-2">{t(lang, "visitTips")}</h2>
        <ul className="list-disc space-y-1 pl-5">
          {place.visitTips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </section>

      <ResponsibleInfo place={place} lang={lang} />

      <div id="save" className="scroll-mt-28" />
      <SaveOffline
        place={{
          slug: place.slug,
          name,
          summary: pick(lang, place.summary, place.summary_hi),
          openingHours: place.openingHours,
          visitTips: place.visitTips,
          isSample: place.isSample,
          stories: stories.map((s) => ({
            title: pick(lang, s.title, s.title_hi),
            text: pick(lang, s.text, s.text_hi),
            sourceType: s.sourceType,
            sourceRef: s.sourceRef,
            isSample: s.isSample,
          })),
        }}
        phrases={getRepos()
          .phrases.list()
          .filter((p) => !p.isSample || currentMode() === "demo")}
        placeNames={Object.fromEntries(getVisiblePlaces().map((p) => [p.id, pick(lang, p.name, p.name_hi)]))}
      />

      {artisans.length > 0 && (
        <section className="space-y-3">
          <h2 className="t-heading">{t(lang, "meetArtisans")}</h2>
          <ul className="grid gap-3">
            {artisans.map((a) => (
              <li key={a.id}>
                <ArtisanCard artisan={a} lang={lang} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <PhotoCredits paths={place.photos} />
      {place.preview360 && <section className="space-y-3"><h2 className="t-heading">360 preview</h2><Pano360 src={place.preview360.path} poster={place.photos[0]} illustrative={place.preview360.illustrative} lang={lang} alt={name}/></section>}

    </div>
  );
}
