import Link from "next/link";
import { pick, t, type Lang } from "@/lib/i18n";
import { readMinutes } from "@/lib/read-time";
import type { Artisan, Place, SourceType, StoryEntry, Workshop } from "@/lib/schemas";
import { BookmarkPlace } from "./BookmarkPlace";
import { ArrowIcon } from "./icons";
import { HeroScene } from "./scene";
import { StoryBody } from "./StoryBody";
import { ConfirmedByMakerBadge, IllustrativeBadge, Label, NotRealLabel, SampleBadge, SourceTypeLabel, VerifiedSourceBadge } from "./ui";

/** Plain <img> on purpose: media is local SVG/JPEG and next/image adds nothing for the demo. */
export function MediaImage({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" className={`block h-full w-full object-cover ${className}`} />;
}

/** A story is a "verified source" only when someone checked it and it is not a sample (rule 5). */
export const isVerifiedSource = (s: StoryEntry) => Boolean(s.verifiedBy?.trim()) && !s.isSample;

/** Name in the current language as the heading, with the other language under it when content has it. */
export function TwoLineName({ lang, en, hi, as: As = "h2", className = "" }: { lang: Lang; en: string; hi?: string; as?: "h1" | "h2" | "h3"; className?: string }) {
  const hasHi = Boolean(hi?.trim());
  const hiFirst = lang === "hi" && hasHi;
  return (
    <div className={className}>
      <As className="font-display" lang={hiFirst ? "hi" : undefined}>
        {hiFirst ? hi : en}
      </As>
      {hasHi && (
        <p lang={hiFirst ? undefined : "hi"} className="font-display text-[0.75em] opacity-80">
          {hiFirst ? en : hi}
        </p>
      )}
    </div>
  );
}

export function PlaceHeader({ place, lang }: { place: Place; lang: Lang }) {
  return (
    <header className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Label tone="info">{place.category}</Label>
        {place.isSample && <SampleBadge lang={lang} />}
      </div>
      <TwoLineName lang={lang} en={place.name} hi={place.name_hi} as="h1" className="t-title" />
      <p className="text-sm text-muted-paper">Udaipur, Rajasthan</p>

    </header>
  );
}

export function PlaceCard({ place, lang, firstStoryType }: { place: Place; lang: Lang; firstStoryType?: SourceType }) {
  return (
    <div className="place-photo-wrap"><Link href={`/places/${place.slug}`} className="place-photo-card group relative block overflow-hidden rounded-card border border-line bg-ink text-on-dark">
      <div className="relative aspect-[16/10]">
        {place.photos[0] ? <MediaImage src={place.photos[0]} alt="" /> : <HeroScene scene="dawn" className="h-full w-full" />}
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-transparent" />
        <div className="absolute top-3 left-3 flex flex-wrap gap-1">{place.isSample && <SampleBadge lang={lang} />}</div>
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4">
          <div className="min-w-0">
            <h2 className="t-heading group-hover:underline">{place.name}</h2>
            {place.name_hi && (
              <p lang="hi" className="text-sm text-muted-dark">
                {place.name_hi}
              </p>
            )}
            <p className="t-label mt-1 text-muted-dark">{place.category}</p>
          </div>
          {firstStoryType && <SourceTypeLabel lang={lang} type={firstStoryType} />}
        </div>
      </div>
    </Link><BookmarkPlace slug={place.slug}/></div>
  );
}

/** Compact story card for lists. Opens the story screen. */
export function StoryCard({ story, lang, placeName, imageSrc }: { story: StoryEntry; lang: Lang; placeName?: string; imageSrc?: string }) {
  const text = pick(lang, story.text, story.text_hi);
  return (
    <Link href={`/stories/${story.id}`} className="editorial-story-card group block overflow-hidden rounded-card border border-line bg-paper-2 text-on-paper" data-testid="story-card">
      <div className="relative aspect-[16/7]">
        {imageSrc ? <MediaImage src={imageSrc} alt="" /> : <HeroScene scene="night" className="h-full w-full" />}
      </div>
      <div className="space-y-2 p-4">
        <div className="flex flex-wrap gap-1.5">
          <SourceTypeLabel lang={lang} type={story.sourceType} />
          {isVerifiedSource(story) ? <VerifiedSourceBadge lang={lang} /> : story.isSample && <SampleBadge lang={lang} />}
        </div>
        <h3 className="t-heading group-hover:underline">{story.title}</h3>
        {story.title_hi && (
          <p lang="hi" className="font-display text-muted-paper">
            {story.title_hi}
          </p>
        )}
        <p className="t-small tnum text-muted-paper">
          {placeName && `${placeName} · `}
          {readMinutes(text)} {t(lang, "minRead")}
          {story.verifiedBy?.trim() && ` · ${t(lang, "verifiedBy")} ${story.verifiedBy}`}
        </p>
      </div>
    </Link>
  );
}

/** Full story inside a place page or a camera match. Only ever rendered with stories from getVisibleStories. */
export function StoryBlock({ story, lang }: { story: StoryEntry; lang: Lang }) {
  return (
    <article className="rounded-card border border-line bg-paper-2 text-on-paper p-4" data-testid="story" data-story-id={story.id}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <SourceTypeLabel lang={lang} type={story.sourceType} />
        {isVerifiedSource(story) ? <VerifiedSourceBadge lang={lang} /> : story.isSample && <SampleBadge lang={lang} />}
      </div>
      <h3 className="t-heading">{pick(lang, story.title, story.title_hi)}</h3>
      <StoryBody story={story} lang={lang} />
      <details className="story-source-details"><summary>Sources &amp; review</summary><p>{story.sourceRef && <a href={story.sourceRef} target="_blank" rel="noopener noreferrer">Read the source ↗</a>}</p><p>Review: {story.verifiedBy ?? t(lang, "unverified")}</p></details>
      <Link href={`/stories/${story.id}`} className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-lake-deep">
        {t(lang, "viewFullStory")} <ArrowIcon size={18} />
      </Link>
    </article>
  );
}

/** Craft-pattern artwork used when an artisan has no photo. Never a face. */
export function CraftPattern({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true" focusable="false">
      <rect width="120" height="120" style={{ fill: "var(--rose)" }} opacity="0.35" />
      <g fill="none" style={{ stroke: "var(--ink)" }} strokeWidth="1.4" opacity="0.5">
        {[20, 40, 60, 80, 100].map((x) => (
          <path key={x} d={`M${x} 10 l10 10 -10 10 -10 -10Z M${x} 50 l10 10 -10 10 -10 -10Z M${x} 90 l10 10 -10 10 -10 -10Z`} />
        ))}
      </g>
    </svg>
  );
}

export function ArtisanCard({ artisan, lang }: { artisan: Artisan; lang: Lang }) {
  return (
    <Link href={`/artisans/${artisan.id}`} className="flex gap-3 rounded-card border border-line bg-paper-2 text-on-paper p-3 hover:bg-paper">
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-mist">
        {artisan.photos[0] ? <MediaImage src={artisan.photos[0]} alt="" /> : <CraftPattern className="h-full w-full" />}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap gap-1">
          <Label tone="rose">{t(lang, "artisanChip")}</Label>
          {artisan.isSample && <SampleBadge lang={lang} />}
        </div>
        <h3 className="t-heading mt-1">{artisan.name}</h3>
        <p className="text-sm text-muted-paper">
          {artisan.craft} · {artisan.locationText}
        </p>
      </div>
    </Link>
  );
}

export function WorkshopCard({ workshop: w, lang }: { workshop: Workshop; lang: Lang }) {
  const confirmed = Boolean(w.confirmedByOwnerAt) && !w.isSample;
  const fmt = new Intl.DateTimeFormat(lang === "hi" ? "hi-IN" : "en-IN", { dateStyle: "medium" });
  return (
    <div className="rounded-card border border-line bg-paper-2 text-on-paper p-4">
      <div className="flex flex-wrap items-center gap-2">{confirmed ? <ConfirmedByMakerBadge lang={lang} /> : w.isSample && <SampleBadge lang={lang} />}</div>
      <h3 className="t-heading mt-1">{w.title}</h3>
      <p className="mt-1">{w.description}</p>
      <dl className="tnum mt-2 grid grid-cols-2 gap-1 text-sm">
        <dt className="text-muted-paper">{t(lang, "duration")}</dt>
        <dd>
          {w.durationMinutes} {t(lang, "minutes")}
        </dd>
        <dt className="text-muted-paper">{t(lang, "cost")}</dt>
        <dd>{w.cost}</dd>
        <dt className="text-muted-paper">{t(lang, "language")}</dt>
        <dd>{w.language}</dd>
        <dt className="text-muted-paper">{t(lang, "howToBook")}</dt>
        <dd className="min-w-0 break-words">{w.howToBook}</dd>
      </dl>
      <p className="tnum mt-2 text-xs text-muted-paper">
        {t(lang, "updated")}: {fmt.format(new Date(w.updatedAt))}
      </p>
    </div>
  );
}

export function IllustrativePhoto({ src, alt, lang }: { src: string; alt: string; lang: Lang }) {
  return (
    <figure className="relative overflow-hidden rounded-card bg-mist">
      <div className="aspect-[16/9]">
        <MediaImage src={src} alt={alt} />
      </div>
      <figcaption className="absolute top-2 left-2">
        <NotRealLabel lang={lang} kind="illustrative" />
      </figcaption>
    </figure>
  );
}

/** Inline-SVG hero with its Illustrative label, for places with no real poster. */
export function IllustrativeScene({ lang, scene = "dawn" }: { lang: Lang; scene?: "dawn" | "golden" | "night" }) {
  return (
    <figure className="relative overflow-hidden rounded-card">
      <HeroScene scene={scene} className="aspect-[16/9] w-full" />
      <figcaption className="absolute top-2 left-2">
        <IllustrativeBadge lang={lang} />
      </figcaption>
    </figure>
  );
}
