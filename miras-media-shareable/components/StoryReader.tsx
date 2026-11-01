"use client";

import { useState } from "react";
import { t, type Lang } from "@/lib/i18n";
import { earnStamp, loadStamps, saveStamps, type Stamp } from "@/lib/passport";
import type { StoryEntry } from "@/lib/schemas";
import { AudioBar } from "./AudioBar";

/**
 * Story body with the audio bar and two toggles: "Simple version" (only when a person checked it)
 * and Hindi (only when the story has text_hi). Reading or listening earns the passport stamp.
 */
export function StoryReader({ story, lang }: { story: StoryEntry; lang: Lang }) {
  const canSimple = story.simpleTextChecked && Boolean(story.simpleText?.trim());
  const hasHi = Boolean(story.text_hi?.trim());
  const [simple, setSimple] = useState(false);
  const [hindi, setHindi] = useState(lang === "hi" && hasHi);
  const [stamped, setStamped] = useState(false);
  const showHi = hindi && hasHi && !(simple && canSimple);
  const text = simple && canSimple ? story.simpleText! : showHi ? story.text_hi! : story.text;

  // StoryReader is only rendered with a visible story, so it counts as visible for the stamp.
  const stamp = (how: Stamp["how"]) => {
    saveStamps(earnStamp(loadStamps(), story, new Set([story.id]), how));
    setStamped(true);
  };

  const toggle = "min-h-11 rounded-full border px-4 text-sm";
  return (
    <div className="space-y-4">
      <AudioBar key={`${showHi}-${simple}`} text={text} speechLang={showHi ? "hi-IN" : "en-IN"} lang={lang} title={story.title} onPlay={() => stamp("listened")} />
      {(canSimple || hasHi) && (
        <div className="flex flex-wrap gap-2">
          {canSimple && (
            <button type="button" aria-pressed={simple} onClick={() => setSimple(!simple)} className={`${toggle} ${simple ? "border-ink bg-ink text-on-dark" : "border-line"}`}>
              {t(lang, "simpleVersion")}
            </button>
          )}
          {hasHi && (
            <button type="button" aria-pressed={hindi} onClick={() => setHindi(!hindi)} className={`${toggle} ${hindi ? "border-ink bg-ink text-on-dark" : "border-line"}`}>
              <span lang="hi">हिंदी</span>
            </button>
          )}
        </div>
      )}
      <p lang={showHi ? "hi" : undefined} className="t-story whitespace-pre-line">
        {text}
      </p>
      <button type="button" onClick={() => stamp("read")} disabled={stamped} className="min-h-11 text-sm font-semibold text-lake-deep underline">
        {stamped ? "Passport stamp saved" : "Mark as read"}
      </button>
    </div>
  );
}
