import type { Viewport } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isVerifiedSource, MediaImage, TwoLineName } from "@/components/domain";
import { PhotoCredits } from "@/components/PhotoCredits";
import { HeroScene } from "@/components/scene";
import { BookmarkPlace } from "@/components/BookmarkPlace";
import { StoryReader } from "@/components/StoryReader";
import { IllustrativeBadge, NotVerified, SampleBadge, SourceTypeLabel, VerifiedSourceBadge } from "@/components/ui";
import { pick, t } from "@/lib/i18n";
import { readMinutes } from "@/lib/read-time";
import { getLang } from "@/lib/lang-server";
import { getVisiblePlaces, getVisibleStories } from "@/lib/services/content";

export const viewport: Viewport = { themeColor: "#F5EEE0" };

export default async function StoryPage({ params }: PageProps<"/stories/[id]">) {
  const { id } = await params;
  const lang = await getLang();
  // Read only through getVisibleStories: a hidden or unknown story is a 404.
  const found = getVisiblePlaces()
    .flatMap((place) => getVisibleStories(place.id).map((story) => ({ story, place })))
    .find((x) => x.story.id === id);
  if (!found) notFound();
  const { story, place } = found;
  const fmt = new Intl.DateTimeFormat(lang === "hi" ? "hi-IN" : "en-IN", { dateStyle: "medium" });

  return (
    <article className="story-screen anim-open space-y-5" data-testid="story" data-story-id={story.id}>
      <figure className="relative -mx-5 -mt-5 overflow-hidden">
        {place.photos[0] ? <MediaImage src={place.photos[0]} alt={place.name} /> : <HeroScene scene="golden" className="aspect-[16/9] w-full" />}
        <figcaption className="absolute top-3 left-3">
          <IllustrativeBadge lang={lang} />
        </figcaption>
        <BookmarkPlace slug={story.id} kind="story" />
      </figure>

      <div className="flex flex-wrap gap-2">
        <SourceTypeLabel lang={lang} type={story.sourceType} />
        {isVerifiedSource(story) ? <VerifiedSourceBadge lang={lang} /> : story.isSample && <SampleBadge lang={lang} />}
      </div>

      <TwoLineName lang={lang} en={story.title} hi={story.title_hi} as="h1" className="t-title" />

      <div className="story-reading-meta"><Link href={`/places/${place.slug}`}>{pick(lang, place.name, place.name_hi)} ↗</Link><span>{readMinutes(story.text)} min read</span></div>

      <StoryReader story={story} lang={lang} />
      <details className="story-source-details"><summary>Sources &amp; review</summary>{story.sourceRef && <a href={story.sourceRef} target="_blank" rel="noopener noreferrer">Read the historical source ↗</a>}<p>{story.verifiedBy?.trim() && story.verifiedAt ? `${t(lang, "verifiedBy")} ${story.verifiedBy} · ${fmt.format(new Date(story.verifiedAt))}` : <NotVerified lang={lang}/>}</p></details>
      <PhotoCredits paths={place.photos.slice(0,1)} />
    </article>
  );
}
