import { Passport } from "@/components/Passport";
import { pick } from "@/lib/i18n";
import { getLang } from "@/lib/lang-server";
import { getVisiblePlaces, getVisibleStories } from "@/lib/services/content";

export default async function PassportPage() {
  const lang = await getLang();
  const places = getVisiblePlaces().map((p) => ({
    id: p.id,
    slug: p.slug,
    name: pick(lang, p.name, p.name_hi),
    isSample: p.isSample,
    storyIds: getVisibleStories(p.id).map((s) => s.id),
  }));
  return (
    <div className="space-y-4">
      <h1 className="text-3xl">Heritage passport</h1>
      <p className="text-ink-soft">
        Earn a stamp by reading or listening to a place&rsquo;s story. Stamps are <strong>not location-verified</strong>: they only show which
        stories you opened on this device. They are saved in this browser and nowhere else.
      </p>
      <Passport places={places} lang={lang} />
    </div>
  );
}
