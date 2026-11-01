import Link from "next/link";
import { PlaceCard, StoryBlock } from "@/components/domain";
import { IDontKnow, SearchBox } from "@/components/ui";
import { pick, t } from "@/lib/i18n";
import { getLang } from "@/lib/lang-server";
import { filterPlaces, getVisiblePlaces, searchVisibleStories } from "@/lib/services/content";

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const lang = await getLang();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 200) : "";
  const places = q ? filterPlaces(getVisiblePlaces(), q) : [];
  const stories = q ? searchVisibleStories(q) : [];

  return (
    <div className="space-y-5">
      <h1 className="text-3xl">{t(lang, "navSearch")}</h1>
      <SearchBox lang={lang} defaultValue={q} autoFocus={!q} />
      {q && !places.length && !stories.length && <IDontKnow lang={lang} body={t(lang, "noResults")} />}
      {places.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2">
          {places.map((p) => (
            <li key={p.id}>
              <PlaceCard place={p} lang={lang} />
            </li>
          ))}
        </ul>
      )}
      {stories.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-2xl">{t(lang, "stories")}</h2>
          {stories.map(({ story, place }) => (
            <div key={story.id} className="space-y-1">
              <Link href={`/places/${place.slug}#stories`} className="text-sm underline">
                {pick(lang, place.name, place.name_hi)}
              </Link>
              <StoryBlock story={story} lang={lang} />
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
