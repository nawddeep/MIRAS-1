import type { Viewport } from "next";
import Link from "next/link";
import { PlaceCard } from "@/components/domain";
import { SearchIcon } from "@/components/icons";
import { EmptyState } from "@/components/ui";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang-server";
import { filterPlaces, getVisiblePlaces, getVisibleStories } from "@/lib/services/content";

export const viewport: Viewport = { themeColor: "#F5EEE0" };

export default async function ExplorePage({ searchParams }: PageProps<"/places">) {
  const lang = await getLang();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 200) : "";
  const cat = typeof sp.cat === "string" ? sp.cat : "";
  const order = ['city-palace','jagdish-temple','saheliyon-ki-bari','pichhola','sajjangarh'];
  const rank = (id: string) => order.includes(id) ? order.indexOf(id) : order.length;
  const all = getVisiblePlaces().sort((a,b)=>rank(a.id)-rank(b.id) || a.name.localeCompare(b.name));
  // Filter chips come only from the categories that exist in content.
  const categories = [...new Set(all.map((p) => p.category))].sort();
  const places = filterPlaces(all, q, cat);
  const href = (c: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (c) p.set("cat", c);
    const s = p.toString();
    return s ? `/places?${s}` : "/places";
  };

  return (
    <div className="explore-screen space-y-5">
      <header>
        <h1 className="t-title">{t(lang, "explorePlaces")}</h1>
        <p lang="hi" className="font-display text-lg text-muted-paper">
          {t("hi", "explorePlaces")}
        </p>
      </header>

      <form action="/places" method="get" role="search">
        {cat && <input type="hidden" name="cat" value={cat} />}
        <label htmlFor="places-q" className="sr-only">
          {t(lang, "searchPlaceholder")}
        </label>
        <div className="relative">
          <SearchIcon size={20} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted-paper" />
          <input
            id="places-q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder={t(lang, "searchPlaceholder")}
            className="min-h-[52px] w-full rounded-full border border-line bg-paper-2 pr-4 pl-11 text-base outline-none focus:border-lake-deep"
          />
        </div>
      </form>

      <div className="explore-context"><p>{places.length} {places.length === 1 ? "place" : "places"} to explore{cat ? ` · ${cat}` : " · Curated for your visit"}</p><Link href="/discover">All features ↗</Link></div>

      <nav aria-label="Categories" className="-mx-5 overflow-x-auto px-5">
        <ul className="flex w-max gap-2">
          {["", ...categories].map((c) => (
            <li key={c || "all"}>
              <Link
                href={href(c)}
                aria-current={c === cat ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm ${c === cat ? "border-ink bg-ink text-on-dark" : "border-line bg-paper-2"}`}
              >
                {c || t(lang, "all")}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {places.length ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {places.map((p) => (
            <li key={p.id}>
              <PlaceCard place={p} lang={lang} firstStoryType={getVisibleStories(p.id)[0]?.sourceType} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title={t(lang, "noResults")}>
          <Link href="/places" className="underline">
            {t(lang, "all")}
          </Link>
        </EmptyState>
      )}
    </div>
  );
}
