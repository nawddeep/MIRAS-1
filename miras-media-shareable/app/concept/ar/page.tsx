import { ArConcept } from "@/components/ArConcept";
import { NotRealLabel } from "@/components/ui";
import { pick } from "@/lib/i18n";
import { getLang } from "@/lib/lang-server";
import { getVisiblePlaces, getVisibleStories } from "@/lib/services/content";

export default async function ArConceptPage() {
  const lang = await getLang();
  const cards = getVisiblePlaces().flatMap((p) => {
    const s = getVisibleStories(p.id)[0];
    return s
      ? [{ placeName: pick(lang, p.name, p.name_hi), title: pick(lang, s.title, s.title_hi), text: pick(lang, s.text, s.text_hi), sourceType: s.sourceType, isSample: s.isSample }]
      : [];
  });
  return (
    <div className="space-y-4">
      <NotRealLabel lang={lang} kind="concept" />
      <h1 className="text-3xl">Story view (concept)</h1>
      <p className="text-ink-soft">
        Concept. Not real AR. The story card is placed on your screen, not on the monument. Whether real AR works at Udaipur&rsquo;s sites has not
        been checked, so it has not been built.
      </p>
      <ArConcept cards={cards} lang={lang} />
    </div>
  );
}
