"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { compressImage, fetchWithTimeout, mediaErrorMessage, TimeoutError } from "@/lib/client/media";
import { t, type Lang } from "@/lib/i18n";
import type { CameraResult } from "@/lib/services/camera";
import { StoryBlock } from "./domain";
import { ImageIcon, InfoIcon } from "./icons";
import { ArchFrame } from "./scene";
import { Button, DemoBadge, IDontKnow, PermissionDenied } from "./ui";

const TOO_DARK = 40; // mean brightness out of 255

/** High or Medium from the real confidence. Never a percentage. Only called above the threshold. */
export const confidenceBand = (confidence: number, threshold: number): "high" | "medium" =>
  confidence >= threshold + (1 - threshold) / 2 ? "high" : "medium";

function Brackets({ snapped, busy }: { snapped: boolean; busy: boolean }) {
  const c = "absolute h-8 w-8 border-saffron";
  return (
    <div className={`pointer-events-none absolute inset-4 ${snapped ? "anim-snap" : ""} ${busy ? "scan-busy" : ""}`} aria-hidden="true">
      <span className={`${c} top-0 left-0 rounded-tl-lg border-t-[3px] border-l-[3px]`} />
      <span className={`${c} top-0 right-0 rounded-tr-lg border-t-[3px] border-r-[3px]`} />
      <span className={`${c} bottom-0 left-0 rounded-bl-lg border-b-[3px] border-l-[3px]`} />
      <span className={`${c} right-0 bottom-0 rounded-br-lg border-r-[3px] border-b-[3px]`} />
    </div>
  );
}

export function CameraMode({
  lang,
  demo,
  places,
  uploadTimeoutMs,
}: {
  lang: Lang;
  demo: boolean;
  places: { id: string; name: string; slug: string; photo?: string; summary?: string; category?: string }[];
  uploadTimeoutMs: number;
  threshold: number;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [noCamera, setNoCamera] = useState(false);
  const [result, setResult] = useState<CameraResult | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchError, setTorchError] = useState<string | null>(null);

  useEffect(() => {
    if (result?.known) window.scrollTo({ top: 0, behavior: "instant" });
  }, [result]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  useEffect(() => {
    const hide = () => { if(document.hidden) { stream.current?.getTracks().forEach(tr=>tr.stop()); stream.current=null; setLive(false); setTorchSupported(false); setTorchOn(false); } };
    document.addEventListener('visibilitychange',hide);
    return () => {document.removeEventListener('visibilitychange',hide);stream.current?.getTracks().forEach(tr=>tr.stop());};
  }, []);

  async function startCamera() {
    setMessage(null);
    setResult(null);
    setDenied(false);
    setNoCamera(false);
    if (!navigator.mediaDevices?.getUserMedia) {
      // Phones only allow the camera on https (or localhost), so say that when it is the likely cause.
      setNoCamera(true);
      setMessage(window.isSecureContext ? "This browser cannot open the camera here. Choose a photo instead." : "The camera needs a secure (https) connection. Choose a photo instead.");
      return;
    }
    try {
      stream.current?.getTracks().forEach(tr=>tr.stop());
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      if (video.current) {
        video.current.srcObject = stream.current;
        await video.current.play();
      }
      const track = stream.current.getVideoTracks()[0];
      setTorchSupported(Boolean((track.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean })?.torch));
      setTorchOn(false);
      setLive(true);
    } catch (e) {
      if ((e as { name?: string })?.name === "NotAllowedError") setDenied(true);
      else setMessage(mediaErrorMessage(e, "camera").replace("use the typed form below", "choose a photo instead"));
    }
  }

  function stopCamera() {
    stream.current?.getTracks().forEach((tr) => tr.stop());
    stream.current = null;
    setLive(false);
    setTorchSupported(false);
    setTorchOn(false);
  }

  async function toggleTorch() {
    try {
      await stream.current?.getVideoTracks()[0]?.applyConstraints({ advanced: [{ torch: !torchOn } as MediaTrackConstraintSet] });
      setTorchOn(!torchOn);
      setTorchError(null);
    } catch { setTorchError("Flash is unavailable on this camera."); }
  }

  async function send(input: { source: Blob | HTMLVideoElement } | { demoPlaceId: string }) {
    setBusy(true);
    setMessage(null);
    setResult(null);
    if ("source" in input && input.source instanceof Blob) setPreview(URL.createObjectURL(input.source));
    try {
      const form = new FormData();
      if ("demoPlaceId" in input) form.append("demoPlaceId", input.demoPlaceId);
      else {
        const { blob, brightness } = await compressImage(input.source, 1024, 0.7);
        if (brightness < TOO_DARK) {
          setMessage("That photo is too dark. Try again with more light.");
          return;
        }
        form.append("frame", blob, "frame.jpg");
      }
      const res = await fetchWithTimeout("/api/camera/match", { method: "POST", body: form }, uploadTimeoutMs);
      const body = await res.json();
      if (!res.ok) setMessage(body.error ?? t(lang, "errorBody"));
      else {
        setResult(body);
        if (body.known) stopCamera();
      }
    } catch (e) {
      setMessage(e instanceof TimeoutError ? "Slow connection. Please try again." : "Could not check that photo. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const matchedPlace = result?.known ? places.find((p) => p.id === result.place.id) : undefined;

  // Shown when the camera is blocked or unavailable, so the visitor can still reach a place by hand.
  const placePicker = (
    <>
      <p className="mb-2 text-sm">Pick the place you are at instead:</p>
      <ul className="flex flex-wrap gap-2">
        {places.map((p) => (
          <li key={p.id}>
            <Link href={`/places/${p.slug}`} className="inline-flex min-h-11 items-center rounded-full border border-current/30 px-4 text-sm underline">
              {p.name}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );

  return (
    <div className="camera-mode space-y-4">
      <div className="relative mx-auto aspect-[3/4] w-full max-w-sm">
        <ArchFrame className="h-full w-full">
          <div className="h-full w-full bg-ink-3">
            <video ref={video} playsInline muted className={`h-full w-full object-cover ${live ? "" : "hidden"}`} />
            {!live && (
              <div className="camera-poster grid h-full place-items-end justify-center p-6 text-center">
                <Button type="button" variant="accent" onClick={startCamera}>
                  Open camera
                </Button>
              </div>
            )}
          </div>
        </ArchFrame>
        <Brackets snapped={Boolean(result?.known)} busy={busy} />
      </div>
      {live && torchSupported && <button type="button" onClick={toggleTorch} aria-pressed={torchOn} className="min-h-11 rounded-full border border-line-dark px-4">Flash {torchOn ? "on" : "off"}</button>}
      {torchError && <p role="status" className="text-sm">{torchError}</p>}
      <p className="text-center text-on-dark">{t(lang, "pointAtMonument")}</p>

      <div className="camera-controls flex items-center justify-between gap-3">
        <div role="group" aria-label="Mode" aria-disabled={busy} className="flex rounded-full border border-line-dark p-1 text-sm">
          <button type="button" onClick={startCamera} disabled={busy} aria-pressed={live} className={`min-h-10 rounded-full px-4 ${live ? "bg-saffron text-ink" : ""}`}>
            {t(lang, "scan")}
          </button>
          <label className="inline-flex min-h-11 cursor-pointer items-center rounded-full px-4">Photo<input type="file" accept="image/*" capture="environment" className="sr-only" onChange={e=>{const f=e.target.files?.[0];if(f) send({source:f});e.target.value='';}}/></label>
          <label className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full px-4">
            <ImageIcon size={18} />
            {t(lang, "upload")}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) send({ source: f });
                e.target.value = "";
              }}
            />
          </label>
        </div>
        {(
          <button
            type="button"
            aria-label={live ? "What is this?" : "Activate camera"}
            disabled={busy}
            onClick={() => live ? video.current && send({ source: video.current }) : startCamera()}
            className="grid h-[76px] w-[76px] shrink-0 place-items-center rounded-full border-4 border-on-dark bg-paper-2 disabled:opacity-60"
          />
        )}
      </div>
      <p className="t-small text-center text-muted-dark">{t(lang, "photoDiscarded")}</p>

      {busy && <p role="status" className="camera-processing">Checking your photo…</p>}
      {preview && !result?.known && <div className="camera-preview">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt="Your selected photograph" />
        <span>Selected photo · used for this check only</span>
      </div>}

      {denied && <PermissionDenied what="camera">{placePicker}</PermissionDenied>}
      {noCamera && <div className="rounded-card border border-line-dark p-4">{placePicker}</div>}

      {demo && (
        <div className="camera-demo space-y-2 rounded-card border border-dashed border-saffron p-3">
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <DemoBadge lang={lang} /> AI is not configured, so the camera cannot recognise places. Pick one to see how it works:
          </p>
          <div className="flex flex-wrap gap-2">
            {places.map((p) => (
              <Button key={p.id} type="button" variant="secondary" disabled={busy} onClick={() => send({ demoPlaceId: p.id })}>
                {p.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      {message && (
        <p role="alert" className="rounded-xl bg-rose/20 p-3 text-sm">
          {message}
        </p>
      )}

      <div aria-live="polite">
        {result && !result.known && (
          <IDontKnow
            lang={lang}
            title={t(lang, "dontKnowPlace")}
            body={
              result.reason === "person"
                ? "This looks like a photo of a person. Point the camera at a monument instead. People's photos are not used."
                : "Try a clearer photo, or search for the place."
            }
          />
        )}

        {result?.known && (
          <section className="recognition-result anim-open -mx-5 space-y-3 rounded-t-[24px] bg-paper px-5 pt-5 pb-6 text-on-paper" data-testid="camera-match">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="recognition-photo" src={matchedPlace?.photo || "/media/pichhola/palace.webp"} alt="Illustrative preview of the selected monument"/>
            <p className="text-sm"><span className="hours-sample">Not yet verified</span> · Illustrative preview</p>
            <div className="flex flex-wrap items-center gap-2">
              {result.demo ? (
                <DemoBadge lang={lang} />
              ) : (
                <>
                  <span className="text-sm">Suggested match · not independently verified</span>
                  <button type="button" aria-label="About this suggestion" onClick={()=>setShowInfo(!showInfo)} className="grid h-11 w-11 place-items-center"><InfoIcon size={20}/></button>
                </>
              )}
            </div>
            {showInfo && <p className="t-small text-muted-paper">Model suggestions have not been calibrated against a labelled monument dataset. Confirm the location before relying on this result.</p>}
            <div>
              <h2 className="t-title">{result.place.name}</h2>
              {result.place.name_hi && (
                <p lang="hi" className="font-display text-lg text-muted-paper">
                  {result.place.name_hi}
                </p>
              )}
            </div>
            <p className="text-sm text-muted-paper">{matchedPlace?.category} · Udaipur, Rajasthan</p>
            <p className="text-base leading-relaxed">{matchedPlace?.summary || "Historical source review is pending. Explore the available stories for this place."}</p>
            {matchedPlace && (
              <Link href={result.stories[0] ? `/stories/${result.stories[0].id}` : `/places/${matchedPlace.slug}`} className="result-action inline-flex min-h-11 items-center font-semibold text-lake-deep underline">
                View Full Story →
              </Link>
            )}
            <button type="button" className="min-h-11 w-full text-sm underline" onClick={() => { setResult(null); setPreview(null); }}>Scan another place</button>
            <details className="result-stories"><summary>Story previews and source details</summary>{result.stories.length ? result.stories.map((s) => <StoryBlock key={s.id} story={s} lang={lang}/>) : <IDontKnow lang={lang}/>}</details>
          </section>
        )}
      </div>
    </div>
  );
}
