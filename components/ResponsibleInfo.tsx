import { t, type Lang } from "@/lib/i18n";
import type { CheckedNote, Place } from "@/lib/schemas";

const isChecked = (x?: { verifiedBy?: string }) => Boolean(x?.verifiedBy?.trim());
const STEP_FREE = { yes: "Step-free access: yes", no: "Step-free access: no", unknown: "Step-free access: not known" } as const;

function Checked({ by, lang }: { by: string; lang: Lang }) {
  return (
    <span className="text-xs text-ink-soft">
      {" "}
      ({t(lang, "verifiedBy")}: {by})
    </span>
  );
}

function Notes({ title, notes, lang }: { title: string; notes?: CheckedNote[]; lang: Lang }) {
  if (!notes?.length) return null;
  const checked = notes.filter(isChecked);
  return (
    <div>
      <h3 className="font-sans text-sm font-semibold text-ink-soft">{title}</h3>
      {checked.length ? (
        <ul className="list-disc pl-5">
          {checked.map((n) => (
            <li key={n.text}>
              {n.text}
              <Checked by={n.verifiedBy!} lang={lang} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-soft">{t(lang, "unverified")}</p>
      )}
    </div>
  );
}

/**
 * Accessibility, etiquette, conservation and photography notes.
 * Each claim renders only when someone has checked it (verifiedBy); otherwise "Not yet verified".
 * Wording states what was checked and by whom; it never implies certification.
 */
export function ResponsibleInfo({ place, lang }: { place: Place; lang: Lang }) {
  const { accessibility: a, photographyRules: photo } = place;
  if (!a && !place.etiquette?.length && !place.conservation?.length && !photo) return null;
  return (
    <section className="space-y-3 rounded-2xl border border-line bg-white/60 p-4" data-testid="responsible-info">
      <h2 className="text-2xl">Visiting responsibly</h2>
      {a && (
        <div>
          <h3 className="font-sans text-sm font-semibold text-ink-soft">Accessibility</h3>
          {isChecked(a) ? (
            <p>
              {STEP_FREE[a.stepFree]}
              {a.notes && `. ${a.notes}`}
              <Checked by={a.verifiedBy!} lang={lang} />
            </p>
          ) : (
            <p className="text-ink-soft">{t(lang, "unverified")}</p>
          )}
        </div>
      )}
      <Notes title="Etiquette" notes={place.etiquette} lang={lang} />
      <Notes title="Conservation" notes={place.conservation} lang={lang} />
      {photo && <Notes title="Photography" notes={[photo]} lang={lang} />}
    </section>
  );
}
