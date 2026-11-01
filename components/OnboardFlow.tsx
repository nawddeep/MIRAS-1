"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { compressImage, fetchWithTimeout, mediaErrorMessage, TimeoutError } from "@/lib/client/media";
import type { ListingDraft } from "@/lib/schemas";
import { MicIcon } from "./icons";
import { Button, Label } from "./ui";

type Step = "capture" | "drafting" | "review" | "done";
type Fields = { headline: string; craft: string; description: string; description_hi: string; materials: string };
type Done = { status: string; editUrl: string; publishBlockers: string[] };

const MAX_SECONDS = 60;
const EMPTY: Fields = { headline: "", craft: "", description: "", description_hi: "", materials: "" };
// Model field name -> form field it fills.
const FIELD_OF: Record<string, keyof Fields> = { title: "headline", category: "craft", description_en: "description", description_hi: "description_hi", materials: "materials" };

const fromDraft = (d: Partial<ListingDraft>): Fields => ({
  headline: d.title ?? "",
  craft: d.category ?? "",
  description: d.description_en ?? "",
  description_hi: d.description_hi ?? "",
  materials: (d.materials ?? []).join(", "),
});
const list = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

/** Three-bar step indicator: record, check, done. */
function StepBars({ n }: { n: 1 | 2 | 3 }) {
  return (
    <div className="flex gap-1.5" role="img" aria-label={`Step ${n} of 3`}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= n ? "bg-saffron" : "bg-current opacity-20"}`} />
      ))}
    </div>
  );
}

export function OnboardFlow({ uploadTimeoutMs }: { uploadTimeoutMs: number }) {
  const [step, setStep] = useState<Step>("capture");
  const [message, setMessage] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [audio, setAudio] = useState<Blob | null>(null);
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [noFaces, setNoFaces] = useState(false);
  const [slow, setSlow] = useState(false);
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [uncertain, setUncertain] = useState<Set<keyof Fields>>(new Set());
  const [demo, setDemo] = useState(false);
  const [fallback, setFallback] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<Done | null>(null);

  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsed = useRef(0);

  useEffect(
    () => () => {
      stream.current?.getTracks().forEach((t) => t.stop());
      if (tick.current) clearInterval(tick.current);
    },
    [],
  );

  function stopRecording() {
    if (tick.current) clearInterval(tick.current);
    tick.current = null;
    if (recorder.current?.state === "recording") recorder.current.stop();
    setRecording(false);
  }

  async function startRecording() {
    setMessage(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMessage("This browser cannot record audio here. Please use the typed form below.");
      return;
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      setMessage(mediaErrorMessage(e, "microphone"));
      return;
    }
    const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg"].find((m) => MediaRecorder.isTypeSupported(m));
    const rec = new MediaRecorder(stream.current, mime ? { mimeType: mime } : undefined);
    chunks.current = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.current.push(e.data);
    };
    rec.onstop = () => {
      stream.current?.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
      if (blob.size < 2000) {
        setAudio(null);
        setMessage("The recording was empty. Please speak after tapping Start, or use the typed form.");
      } else setAudio(blob);
    };
    recorder.current = rec;
    rec.start();
    setRecording(true);
    elapsed.current = 0;
    setSeconds(0);
    tick.current = setInterval(() => {
      elapsed.current += 1;
      setSeconds(elapsed.current);
      if (elapsed.current >= MAX_SECONDS) stopRecording();
    }, 1000);
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    try {
      const { blob } = await compressImage(file);
      setPhoto({ blob, url: URL.createObjectURL(blob) });
    } catch {
      setMessage("Could not read that photo. Please try another one.");
    }
  }

  async function makeDraft() {
    if (!audio) return;
    setStep("drafting");
    setSlow(false);
    setMessage(null);
    const slowTimer = setTimeout(() => setSlow(true), 8000);
    const form = new FormData();
    form.append("audio", audio, "voice");
    if (photo) form.append("image", photo.blob, "photo.jpg");
    try {
      const res = await fetchWithTimeout("/api/onboard/draft", { method: "POST", body: form }, uploadTimeoutMs);
      const body = await res.json();
      setDemo(Boolean(body.demo));
      if (body.ok) {
        setFields(fromDraft(body.draft));
        setUncertain(new Set<keyof Fields>((body.draft.uncertain_fields as string[]).map((f) => FIELD_OF[f]).filter(Boolean)));
        if (body.draft.photo_shows_face) {
          setNoFaces(false);
          setFallback("The photo seems to show a face. Faces are not stored, so please choose a photo of your work only.");
        } else setFallback(null);
      } else if (body.reason === "empty_audio") {
        setStep("capture");
        setMessage("The recording was empty. Please try again, or use the typed form.");
        return;
      } else {
        setFields(fromDraft(body.partial ?? {}));
        setUncertain(new Set(Object.keys(EMPTY) as (keyof Fields)[]));
        setFallback(
          body.reason === "ai_unavailable"
            ? "The assistant is not reachable right now. Please fill in the form yourself."
            : "The assistant could not make a clean draft. We kept what it understood. Please check and complete the form.",
        );
      }
      setStep("review");
    } catch (e) {
      setStep("capture");
      setMessage(
        e instanceof TimeoutError
          ? "Slow connection. Your recording is still on this phone. Try again, or use the typed form."
          : "No connection. Your recording is still on this phone. Try again when you are online, or use the typed form.",
      );
    } finally {
      clearTimeout(slowTimer);
    }
  }

  function typeInstead() {
    stopRecording();
    setFields(EMPTY);
    setUncertain(new Set());
    setFallback(null);
    setDemo(false);
    setStep("review");
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const publish = (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "publish";
    const f = new FormData(e.currentTarget);
    const s = (k: string) => String(f.get(k) ?? "").trim();
    setBusy(true);
    setFieldErrors({});
    setMessage(null);
    const form = new FormData();
    form.append(
      "data",
      JSON.stringify({
        name: s("name"),
        headline: s("headline") || undefined,
        craft: s("craft"),
        description: s("description"),
        description_hi: s("description_hi") || undefined,
        materials: list(s("materials")),
        languages: list(s("languages")),
        contact: s("contact"),
        locationText: s("locationText"),
        consentAgreed: consent,
        photoHasNoFaces: noFaces,
        publish,
      }),
    );
    if (photo && noFaces) form.append("photo", photo.blob, "photo.jpg");
    try {
      const res = await fetchWithTimeout("/api/onboard/submit", { method: "POST", body: form }, uploadTimeoutMs);
      const body = await res.json();
      if (body.ok) {
        setDone({ status: body.status, editUrl: body.editUrl, publishBlockers: body.publishBlockers ?? [] });
        setStep("done");
      } else {
        setFieldErrors(body.fieldErrors ?? {});
        setMessage(body.error ?? "Please check the form.");
      }
    } catch (err) {
      setMessage(err instanceof TimeoutError ? "Slow connection. Nothing was lost; tap the button again." : "No connection. Nothing was lost; try again when online.");
    } finally {
      setBusy(false);
    }
  }

  const alertBox = message && (
    <p role="alert" className="rounded-xl bg-rose/15 p-3 text-sm">
      {message}
    </p>
  );

  if (step === "done" && done) {
    const url = `${window.location.origin}${done.editUrl}`;
    return (
      <div className="space-y-4 rounded-card bg-paper p-4 text-on-paper" data-testid="onboard-done">
        <StepBars n={3} />
        <p className="rounded-2xl bg-lake/25 p-4 text-lg">
          {done.status === "published" ? "Your listing is published." : "Your listing is saved as a draft. It is not public yet."}
        </p>
        {done.publishBlockers.length > 0 && <p className="text-sm">Not published yet because: {done.publishBlockers.join("; ")}.</p>}
        <div className="rounded-2xl border border-saffron bg-saffron/10 p-4">
          <p className="font-medium">Your private edit link. Save it; anyone with it can edit your listing.</p>
          <p className="mt-2 font-mono text-sm break-all">{url}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => navigator.clipboard?.writeText(url)}>
              Copy link
            </Button>
            <Link href={done.editUrl} className="inline-flex min-h-11 items-center rounded-full bg-ink px-5 text-paper">
              Open
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (step === "review") {
    const input = (k: keyof Fields) =>
      `w-full rounded-xl border bg-white px-3 ${uncertain.has(k) ? "border-rose ring-2 ring-rose" : "border-ink/25"}`;
    const err = (k: string) => fieldErrors[k] && <p className="text-sm text-[#9b3b28]">{fieldErrors[k]}</p>;
    const field = (k: keyof Fields, label: string, multiline = false) => (
      <div data-uncertain={uncertain.has(k) || undefined}>
        <label htmlFor={k} className="mb-1 block font-medium">
          {label}
          {uncertain.has(k) && (
            <span className="ml-2">
              <Label tone="warn">Please check</Label>
            </span>
          )}
        </label>
        {multiline ? (
          <textarea id={k} name={k} rows={4} value={fields[k]} onChange={(e) => setFields({ ...fields, [k]: e.target.value })} className={`${input(k)} py-2`} />
        ) : (
          <input id={k} name={k} value={fields[k]} onChange={(e) => setFields({ ...fields, [k]: e.target.value })} className={`${input(k)} min-h-11`} />
        )}
        {err(k)}
      </div>
    );
    const plain = (name: string, label: string, help?: string) => (
      <div>
        <label htmlFor={name} className="mb-1 block font-medium">
          {label}
        </label>
        <input id={name} name={name} className="min-h-11 w-full rounded-xl border border-ink/25 bg-white px-3" />
        {help && <p className="text-xs opacity-80">{help}</p>}
        {err(name)}
      </div>
    );

    return (
      <form className="space-y-4 rounded-card bg-paper p-4 text-on-paper" onSubmit={submit} data-testid="onboard-review">
        <StepBars n={2} />
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-2xl">Check your listing</h2>
          {demo && <Label tone="warn">Demo response</Label>}
        </div>
        <p className="text-sm opacity-80">
          Edit anything that is wrong. Fields marked <Label tone="warn">Please check</Label> are ones the assistant was unsure about. Nothing is
          public until you tap Publish.
        </p>
        {fallback && <p className="rounded-xl bg-saffron/15 p-3 text-sm">{fallback}</p>}
        {plain("name", "Your name / आपका नाम")}
        {field("headline", "Listing title")}
        {field("craft", "Craft / शिल्प")}
        {field("description", "Description (English)", true)}
        {field("description_hi", "विवरण (हिंदी)", true)}
        {field("materials", "Materials (comma separated)")}
        {plain("languages", "Languages you speak (comma separated)", "For example: Hindi, Mewari, English")}
        {plain("contact", "Phone or email (only you and the team see this)")}
        {plain("locationText", "Area in Udaipur")}

        {photo && (
          <div className="space-y-2 rounded-xl border border-line p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt="Your photo" className="h-40 w-full rounded-lg object-cover" />
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={noFaces} onChange={(e) => setNoFaces(e.target.checked)} />
              This photo shows my work and does not show anyone&rsquo;s face. (Photos with faces are not stored.)
            </label>
          </div>
        )}

        <label className="flex items-start gap-2 rounded-xl bg-lake/15 p-3">
          <input type="checkbox" className="mt-1.5" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>
            I agree that MIRAS may show this listing{photo && noFaces ? " and photo" : ""} publicly, and that I can edit or remove it at any time from my
            private link. / मैं सहमत हूँ कि यह लिस्टिंग सार्वजनिक रूप से दिखाई जा सकती है।
          </span>
        </label>

        {alertBox}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" value="draft" variant="secondary" disabled={busy}>
            Save as draft
          </Button>
          <Button type="submit" value="publish" variant="accent" disabled={busy || !consent}>
            Publish
          </Button>
        </div>
        {!consent && <p className="text-xs opacity-80">Publish needs your consent above. You can save a draft without it.</p>}
      </form>
    );
  }

  return (
    <div className="space-y-5">
      <StepBars n={1} />
      <ol className="space-y-4">
        <li className="rounded-card border border-line-dark bg-ink-2 p-4">
          <p className="font-medium">1. Tell us about your work / अपने काम के बारे में बताइए</p>
          <p className="text-sm opacity-80">Up to {MAX_SECONDS} seconds, in Hindi or English: what you make, the materials, and where.</p>
          <div className="mt-4 flex flex-col items-center gap-3">
            <div className="relative grid h-28 w-28 place-items-center">
              {recording && <span className="anim-pulse absolute inset-0 rounded-full bg-saffron/40" aria-hidden="true" />}
              {recording ? (
                <button type="button" onClick={stopRecording} aria-label={`Stop (${seconds}s)`} className="relative grid h-24 w-24 place-items-center rounded-full bg-rose text-ink">
                  <span className="block h-7 w-7 rounded-md bg-ink" aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={step === "drafting"}
                  aria-label={audio ? "Record again" : "Start recording / रिकॉर्ड करें"}
                  className="relative grid h-24 w-24 place-items-center rounded-full bg-saffron text-ink disabled:opacity-50"
                >
                  <MicIcon size={36} />
                </button>
              )}
            </div>
            <div className="flex h-8 items-center gap-[3px]" aria-hidden="true">
              {[10, 18, 26, 14, 30, 20, 12, 24, 16, 28, 12, 20].map((h, i) => (
                <span
                  key={i}
                  className={`w-1 rounded-full ${recording ? "anim-pulse bg-saffron" : "bg-current opacity-30"}`}
                  style={{ height: `${h}px`, animationDelay: `${i * 90}ms` }}
                />
              ))}
            </div>
            <p className="tnum text-lg" aria-live="off">
              {`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`} / 1:00
            </p>
            <p className="text-sm">{recording ? "Recording… tap to stop" : audio ? "Tap to record again" : "Tap to start / रिकॉर्ड करें"}</p>
            {audio && !recording && <Label tone="info">Recording ready</Label>}
          </div>
        </li>
        <li className="rounded-card border border-line-dark bg-ink-2 p-4">
          <p className="font-medium">2. One photo of your work (optional)</p>
          <p className="text-sm opacity-80">Your work only, no faces. It is made smaller before upload.</p>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="mt-3 block w-full text-sm"
            onChange={(e) => onPhoto(e.target.files?.[0])}
            aria-label="Photo of your work"
          />
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo.url} alt="Your photo" className="mt-3 h-32 rounded-lg object-cover" />
          )}
        </li>
      </ol>

      {alertBox}
      {step === "drafting" && (
        <p role="status" className="rounded-xl bg-lake/20 p-3">
          Making your draft…{slow && " This is taking a while. The connection may be slow."}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="accent" onClick={makeDraft} disabled={!audio || recording || step === "drafting"}>
          Make my draft
        </Button>
        <Button type="button" variant="secondary" onClick={typeInstead}>
          Type instead / लिखकर भरें
        </Button>
      </div>
    </div>
  );
}
