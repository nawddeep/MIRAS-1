"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { t, type Lang } from "@/lib/i18n";
import { PauseIcon, PlayIcon } from "./icons";
import { SyntheticVoiceBadge } from "./ui";

const subscribeNoop = () => () => {};
const BARS = [6, 12, 18, 10, 22, 14, 8, 16, 24, 12, 6, 18, 10, 20, 14, 8, 12, 22, 16, 10];

/** Reads text aloud with the browser's built-in speech synthesis. No new audio engine. */
export function AudioBar({ text, speechLang, lang, title, onPlay }: { text: string; speechLang: string; lang: Lang; title: string; onPlay?: () => void }) {
  const canSpeak = useSyncExternalStore(
    subscribeNoop,
    () => "speechSynthesis" in window,
    () => false,
  );
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  useEffect(
    () => () => {
      window.speechSynthesis?.cancel();
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );

  function toggle() {
    const synth = window.speechSynthesis;
    if (playing) {
      synth.cancel();
      stopTimer();
      setPlaying(false);
      return;
    }
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = speechLang;
    u.onend = u.onerror = () => {
      stopTimer();
      setPlaying(false);
    };
    synth.speak(u);
    setPlaying(true);
    setElapsed(0);
    timer.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    onPlay?.();
  }

  if (!canSpeak) return <p className="text-sm text-muted-paper">Audio narration is unavailable in this browser. You can read the story below.</p>;
  const mm = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;
  return (
    <div className="flex items-center gap-3 rounded-card border border-line bg-paper-2 p-3" data-testid="audio-bar">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={playing}
        aria-label={`${playing ? t(lang, "stop") : t(lang, "listen")}: ${title}`}
        className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-saffron text-ink"
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex h-6 items-center gap-[3px]" aria-hidden="true">
          {BARS.map((h, i) => (
            <span key={i} className={`w-[3px] rounded-full ${playing ? "bg-saffron-text" : "bg-ink/25"}`} style={{ height: `${h}px` }} />
          ))}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <SyntheticVoiceBadge lang={lang} />
          <span className="t-small tnum text-muted-paper">{mm}</span>
        </div>
      </div>
    </div>
  );
}
