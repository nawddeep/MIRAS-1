"use client";

import { useState } from "react";
import { BookmarkPlace } from "./BookmarkPlace";

/** The supplied photographs stay separate from the interactive UI. */
export function PhotoGallery({ photos, name, slug, caption = "", compact = false }: { photos: string[]; name: string; slug?: string; caption?: string; compact?: boolean }) {
  const [selected, setSelected] = useState(0);
  const [imageStates, setImageStates] = useState<Record<string, "ready" | "error">>({});
  if (!photos.length) return null;
  const src = photos[selected];
  const state = imageStates[src];
  return <figure className={`photo-gallery ${compact ? "photo-gallery-compact" : ""}`}>
    <div className="gallery-hero" aria-busy={!state}>
      {!state && <span className="gallery-feedback" role="status">Loading image…</span>}
      {state === "error" && <span className="gallery-feedback" role="status">This image couldn’t load. Choose another view below.</span>}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img key={src} ref={image => { if (image?.complete && !state) setImageStates(states => ({ ...states, [src]: image.naturalWidth ? "ready" : "error" })); }} src={src} alt={`${name}, view ${selected + 1}`} hidden={state === "error"} data-loading={!state} onLoad={() => setImageStates(states => ({ ...states, [src]: "ready" }))} onError={() => setImageStates(states => ({ ...states, [src]: "error" }))} fetchPriority={compact ? "auto" : "high"} width={720} height={720} />
      {slug && <BookmarkPlace slug={slug} />}
    </div>
    <div className="gallery-thumbnails" role="group" aria-label={`${name} gallery`}>
      {photos.map((src, index) => <button key={src} type="button" aria-label={`Show image ${index + 1}`} aria-pressed={selected === index} onClick={() => setSelected(index)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" loading="lazy" width={100} height={80} />
      </button>)}
    </div>
    <figcaption aria-live="polite" aria-atomic="true">{caption && `${caption} · `}{selected + 1} / {photos.length}</figcaption>
  </figure>;
}
