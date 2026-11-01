import { notFound } from "next/navigation";
import { AudioWalk } from "@/components/AudioWalk";
import { SampleBadge } from "@/components/ui";
import { pick } from "@/lib/i18n";
import { getLang } from "@/lib/lang-server";
import { placeholderCoordinateIds } from "@/lib/planner";
import { getRepos } from "@/lib/repos";
import { getTrailWithStops } from "@/lib/services/trails";

export default async function WalkPage({ params }: PageProps<"/trails/[id]/walk">) {
  const { id } = await params;
  const lang = await getLang();
  const data = getTrailWithStops(id);
  if (!data) notFound();
  const placeholders = placeholderCoordinateIds(getRepos().places.list());
  const chapters = data.stops.map(({ place, story }) => ({
    placeId: place.id,
    name: pick(lang, place.name, place.name_hi),
    lat: place.lat,
    lng: place.lng,
    placeholderCoords: placeholders.has(place.id),
    story: story ? { title: pick(lang, story.title, story.title_hi), text: pick(lang, story.text, story.text_hi), sourceType: story.sourceType } : null,
  }));
  return (
    <div className="space-y-4">
      {data.trail.isSample && <SampleBadge lang={lang} />}
      <h1 className="text-3xl">Audio walk: {data.trail.title}</h1>
      <AudioWalk chapters={chapters} lang={lang} />
    </div>
  );
}
