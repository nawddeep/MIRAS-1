"use client";

import { useEffect, useRef, useState } from "react";
import { mediaErrorMessage } from "@/lib/client/media";
import type { Lang } from "@/lib/i18n";
import type { SourceType } from "@/lib/schemas";
import { Button, Label, SourceTypeLabel } from "./ui";

type Card = { placeName: string; title: string; text: string; sourceType: SourceType; isSample: boolean };

/** Camera view with a story card laid over the screen. It is not anchored to the world: this is a concept, not AR. */
export function ArConcept({ cards, lang }: { cards: Card[]; lang: Lang }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [live, setLive] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [i, setI] = useState(0);
  const card = cards[i];

  useEffect(() => () => stream.current?.getTracks().forEach((t) => t.stop()), []);

  async function start() {
    setMessage(null);
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      if (video.current) {
        video.current.srcObject = stream.current;
        await video.current.play();
      }
      setLive(true);
    } catch (e) {
      setMessage(mediaErrorMessage(e, "camera").replace(" Please use the typed form below.", ""));
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl bg-ink" data-testid="ar-concept">
        <video ref={video} playsInline muted className={`aspect-[3/4] w-full object-cover ${live ? "" : "invisible"}`} />
        <div className="absolute inset-x-0 top-0 bg-saffron px-3 py-1.5 text-center text-sm font-semibold text-ink">Concept. Not real AR.</div>
        {card && (
          <div className="absolute inset-x-3 bottom-3 rounded-xl bg-paper/95 p-3 text-ink shadow">
            <div className="flex flex-wrap items-center gap-2">
              <SourceTypeLabel lang={lang} type={card.sourceType} />
              {card.isSample && <Label tone="sample">Sample content</Label>}
            </div>
            <p className="mt-1 text-xs text-ink-soft">{card.placeName}</p>
            <p className="font-display text-lg">{card.title}</p>
            <p className="line-clamp-3 text-sm">{card.text}</p>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {!live && (
          <Button type="button" onClick={start}>
            Open camera
          </Button>
        )}
        {cards.length > 1 && (
          <Button type="button" variant="secondary" onClick={() => setI((i + 1) % cards.length)}>
            Next story card
          </Button>
        )}
      </div>
      {message && (
        <p role="alert" className="rounded-xl bg-rose/15 p-3 text-sm">
          {message}
        </p>
      )}
    </div>
  );
}
