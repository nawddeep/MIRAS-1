"use client";

import { useEffect, useRef, useState } from "react";
import { t, type Lang } from "@/lib/i18n";
import { distanceKm } from "@/lib/planner";
import type { SourceType } from "@/lib/schemas";
import { Button, Label, SourceTypeLabel } from "./ui";

export type WalkChapter = {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  placeholderCoords: boolean;
  story: { title: string; text: string; sourceType: SourceType } | null;
};

/** A trail played as chapters. Manual navigation always works; location help is optional and off by default. */
export function AudioWalk({ chapters, lang }: { chapters: WalkChapter[]; lang: Lang }) {
  const [i, setI] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [locOn, setLocOn] = useState(false);
  const [locMsg, setLocMsg] = useState<string | null>(null);
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const watch = useRef<number | null>(null);
  const c = chapters[i];

  const stopSpeech = () => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  };
  const stopWatch = () => {
    if (watch.current !== null) navigator.geolocation?.clearWatch(watch.current);
    watch.current = null;
  };
  useEffect(
    () => () => {
      window.speechSynthesis?.cancel();
      if (watch.current !== null) navigator.geolocation?.clearWatch(watch.current);
    },
    [],
  );

  const go = (n: number) => {
    stopSpeech();
    setI(n);
  };

  function play() {
    if (speaking) return stopSpeech();
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(
      [`Stop ${i + 1}: ${c.name}.`, c.story ? `${c.story.title}. ${c.story.text}` : "There is no verified story for this stop yet."].join(" "),
    );
    u.lang = "en-IN";
    u.onend = u.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    setSpeaking(true);
  }

  function toggleLocation() {
    if (locOn) {
      stopWatch();
      setLocOn(false);
      setLocMsg(null);
      setHere(null);
      return;
    }
    if (!navigator.geolocation) {
      setLocMsg("Location is not available in this browser. Use Next and Previous.");
      return;
    }
    setLocOn(true);
    setLocMsg("Asking for your location…");
    watch.current = navigator.geolocation.watchPosition(
      (pos) => {
        setHere({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocMsg(null);
      },
      (err) => {
        stopWatch();
        setLocOn(false);
        setHere(null);
        setLocMsg(err.code === 1 ? "Location is blocked. That is fine: use Next and Previous." : "Could not get your location. Use Next and Previous.");
      },
      { enableHighAccuracy: false, maximumAge: 30_000, timeout: 20_000 },
    );
  }

  const distance = here && !c.placeholderCoords ? distanceKm(here, c) : null;

  return (
    <div className="space-y-4">
      <ol className="flex flex-wrap gap-2" aria-label="Stops">
        {chapters.map((ch, n) => (
          <li key={ch.placeId}>
            <button
              type="button"
              onClick={() => go(n)}
              aria-current={n === i ? "step" : undefined}
              className={`min-h-10 rounded-full border px-3 text-sm ${n === i ? "border-ink bg-ink text-paper" : "border-ink/25"}`}
            >
              {n + 1}. {ch.name}
            </button>
          </li>
        ))}
      </ol>

      <section className="space-y-3 rounded-2xl border border-line bg-white/60 p-4" data-testid="walk-chapter">
        <p className="text-sm text-ink-soft">
          Stop {i + 1} of {chapters.length}
        </p>
        <h2 className="text-3xl">{c.name}</h2>
        {c.story ? (
          <div className="space-y-1">
            <SourceTypeLabel lang={lang} type={c.story.sourceType} />
            <p className="font-display text-xl">{c.story.title}</p>
            <p className="leading-relaxed">{c.story.text}</p>
          </div>
        ) : (
          <p className="text-ink-soft">{t(lang, "dontKnowBody")}</p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="accent" onClick={play}>
            {speaking ? t(lang, "stop") : t(lang, "listen")}
          </Button>
          <Label tone="warn">{t(lang, "syntheticVoice")}</Label>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" disabled={i === 0} onClick={() => go(i - 1)}>
            Previous
          </Button>
          <Button type="button" disabled={i === chapters.length - 1} onClick={() => go(i + 1)}>
            Next
          </Button>
        </div>
      </section>

      <section className="space-y-2 rounded-2xl border border-dashed border-line p-3">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={locOn} onChange={toggleLocation} />
          <span>Help me find the next stop (uses your location)</span>
        </label>
        {locOn && distance !== null && (
          <p className="text-sm">
            About {distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`} in a straight line to {c.name}.{" "}
            <Label tone="warn">{t(lang, "estimate")}</Label>
          </p>
        )}
        {locOn && here && c.placeholderCoords && <p className="text-sm">Distance not shown: this stop needs real coordinates.</p>}
        {locMsg && (
          <p role="status" className="text-sm text-ink-soft">
            {locMsg}
          </p>
        )}
        <p className="text-xs text-ink-soft">Off by default. Your location stays in your browser and is never sent to MIRAS.</p>
      </section>
    </div>
  );
}
