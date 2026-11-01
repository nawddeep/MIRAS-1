import { PlanBuilder } from "@/components/PlanBuilder";
import { pick } from "@/lib/i18n";
import { getLang } from "@/lib/lang-server";
import { placeholderCoordinateIds } from "@/lib/planner";
import { getRepos } from "@/lib/repos";
import { getVisiblePlaces } from "@/lib/services/content";

export default async function PlanPage() {
  const lang = await getLang();
  // Placeholder detection looks at every place in content, not only the visible ones.
  const placeholders = placeholderCoordinateIds(getRepos().places.list());
  const places = getVisiblePlaces().map((p) => ({
    id: p.id,
    slug: p.slug,
    name: pick(lang, p.name, p.name_hi),
    lat: p.lat,
    lng: p.lng,
    typicalVisitMinutes: p.typicalVisitMinutes,
    openingTimes: p.openingTimes,
    placeholderCoords: placeholders.has(p.id),
    photo: p.photos[0],
  }));
  return (
    <div className="plan-reference space-y-4">
      <h1 className="text-3xl">Your Udaipur day</h1>
      <p className="text-ink-soft">Plan a relaxed day around heritage, lakes and local life.</p>
      <PlanBuilder places={places} />
    </div>
  );
}
