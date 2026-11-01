import type { Viewport } from "next";
import Link from "next/link";
import { StoryCard } from "@/components/domain";
import { SearchIcon } from "@/components/icons";
import { IDontKnow } from "@/components/ui";
import { pick, t, type DictKey } from "@/lib/i18n";
import { getLang } from "@/lib/lang-server";
import { SOURCE_TYPES, type SourceType } from "@/lib/schemas";
import { getVisiblePlaces, getVisibleStories } from "@/lib/services/content";

export const viewport: Viewport = { themeColor: "#F5EEE0" };

export default async function StoriesPage({ searchParams }: PageProps<"/stories">) {
  const lang = await getLang();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 200).toLocaleLowerCase() : "";
  const type = SOURCE_TYPES.find((s) => s === sp.type) as SourceType | undefined;

  // Only visible stories, through getVisibleStories.
  const all = getVisiblePlaces().flatMap((place) => getVisibleStories(place.id).map((story) => ({ story, place })));
  const shown = all.filter(
    ({ story }) =>
      (!type || story.sourceType === type) &&
      (!q || [story.title, story.title_hi, story.text, story.text_hi].some((f) => f?.toLocaleLowerCase().includes(q))),
  );
  const href = (ty?: SourceType) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (ty) p.set("type", ty);
    const s = p.toString();
    return s ? `/stories?${s}` : "/stories";
  };

  return (
    <div className="stories-screen space-y-5">
      <header>
        <h1 className="t-title">{t(lang, "navStories")}</h1>
        <p lang="hi" className="font-display text-lg text-muted-paper">
          {t("hi", "navStories")}
        </p>
      </header>

      <form action="/stories" method="get" role="search">
        {type && <input type="hidden" name="type" value={type} />}
        <label htmlFor="stories-q" className="sr-only">
          {t(lang, "searchPlaceholder")}
        </label>
        <div className="relative">
          <SearchIcon size={20} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted-paper" />
          <input
            id="stories-q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder={t(lang, "searchPlaceholder")}
            className="min-h-[52px] w-full rounded-full border border-line bg-paper-2 pr-4 pl-11 text-base outline-none focus:border-lake-deep"
          />
        </div>
      </form>

      <nav aria-label="Story types" className="-mx-5 overflow-x-auto px-5">
        <ul className="flex w-max gap-2">
          {[undefined, ...SOURCE_TYPES].map((ty) => (
            <li key={ty ?? "all"}>
              <Link
                href={href(ty)}
                aria-current={ty === type ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm ${ty === type ? "border-ink bg-ink text-on-dark" : "border-line bg-paper-2"}`}
              >
                {ty ? t(lang, `sourceType_${ty}` as DictKey) : t(lang, "all")}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {shown.length ? (
        <ul className="space-y-4">
          {shown.map(({ story, place }) => (
            <li key={story.id}>
              <StoryCard story={story} lang={lang} placeName={pick(lang, place.name, place.name_hi)} imageSrc={place.photos[0]} />
            </li>
          ))}
        </ul>
      ) : (
        <IDontKnow lang={lang} body={t(lang, "noResults")} />
      )}
    </div>
  );
}
