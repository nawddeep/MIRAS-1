"use client";

import { useEffect, useState } from "react";
import { idbAll, idbDelete, idbPut } from "@/lib/client/idb";
import { compressImage, fetchWithTimeout, TimeoutError } from "@/lib/client/media";
import { t, type Lang } from "@/lib/i18n";
import type { SourceType } from "@/lib/schemas";
import type { Moment } from "@/lib/services/memories";
import { Button, Label, SourceTypeLabel } from "./ui";

const MAX = 5;

type Item = { frame: Blob; url: string; fileDate: string; placeId: string };
type FaceChoice = "cut" | "blur" | "keep";
/** What is saved on the device: a small manifest plus the (possibly blurred) frames. */
type ReelMoment = { frame: Blob; caption: string; demo: boolean; stamp: string; story: { title: string; text: string; sourceType: SourceType } | null };
type SavedMemory = { id: string; createdAt: string; moments: ReelMoment[] };

async function videoFrame(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.src = url;
    await new Promise((res, rej) => {
      v.onloadeddata = res;
      v.onerror = rej;
    });
    v.currentTime = Math.min(1, (v.duration || 2) / 2);
    await new Promise((res) => (v.onseeked = res));
    return (await compressImage(v, 960, 0.7)).blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function blurWhole(blob: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(blob);
  const c = document.createElement("canvas");
  c.width = bmp.width;
  c.height = bmp.height;
  const ctx = c.getContext("2d")!;
  ctx.filter = "blur(18px)";
  ctx.drawImage(bmp, 0, 0);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("blur failed"))), "image/jpeg", 0.7));
}

function Reel({ moments, lang, onClose }: { moments: ReelMoment[]; lang: Lang; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [url, setUrl] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const m = moments[i];

  useEffect(() => {
    const u = URL.createObjectURL(m.frame);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- object URL must be created and revoked with the frame
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [m.frame]);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const speak = () => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    if (speaking) return setSpeaking(false);
    const u = new SpeechSynthesisUtterance([m.caption, m.story?.text].filter(Boolean).join(". "));
    u.lang = "en-IN";
    u.onend = u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
    setSpeaking(true);
  };

  return (
    <section className="space-y-3 rounded-2xl bg-ink p-3 text-paper" data-testid="reel" aria-label="Memory reel">
      <p className="text-xs text-paper/70">
        Moment {i + 1} of {moments.length} · In-app reel, not an exported video
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url && <img src={url} alt={m.caption} className="aspect-[4/3] w-full rounded-xl object-cover" />}
      <p className="text-lg">{m.caption}</p>
      {m.demo && <Label tone="warn">{t(lang, "demoResponse")}</Label>}
      <p className="text-sm text-paper/80">{m.stamp}</p>
      {m.story && (
        <div className="rounded-xl bg-paper p-3 text-ink">
          <SourceTypeLabel lang={lang} type={m.story.sourceType} />
          <p className="mt-1 font-display text-lg">{m.story.title}</p>
          <p className="text-sm">{m.story.text}</p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" className="border-paper/40 text-paper" disabled={i === 0} onClick={() => setI(i - 1)}>
          Previous
        </Button>
        <Button type="button" variant="accent" disabled={i === moments.length - 1} onClick={() => setI(i + 1)}>
          Next
        </Button>
        <Button type="button" variant="secondary" className="border-paper/40 text-paper" onClick={speak}>
          {speaking ? t(lang, "stop") : t(lang, "listen")}
        </Button>
        <Label tone="warn">{t(lang, "syntheticVoice")}</Label>
        <button type="button" onClick={onClose} className="ml-auto min-h-11 px-2 underline">
          Close
        </button>
      </div>
    </section>
  );
}

export function MemoriesFlow({ lang, places, uploadTimeoutMs }: { lang: Lang; places: { id: string; name: string }[]; uploadTimeoutMs: number }) {
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<{ demo: boolean; moments: Moment[] } | null>(null);
  const [faces, setFaces] = useState<Record<number, FaceChoice>>({});
  const [playing, setPlaying] = useState<ReelMoment[] | null>(null);
  const [saved, setSaved] = useState<SavedMemory[]>([]);
  const placeName = (id: string | null) => places.find((p) => p.id === id)?.name;

  const refreshSaved = () => idbAll<SavedMemory>("memories").then(setSaved, () => setSaved([]));
  useEffect(() => {
    refreshSaved();
  }, []);

  async function addFiles(files: FileList | null) {
    if (!files) return;
    setMessage(null);
    const room = MAX - items.length;
    if (files.length > room) setMessage(`Up to ${MAX} moments. Only the first ${room} were added.`);
    const added: Item[] = [];
    for (const f of [...files].slice(0, room)) {
      try {
        const frame = f.type.startsWith("video/") ? await videoFrame(f) : (await compressImage(f, 960, 0.7)).blob;
        added.push({ frame, url: URL.createObjectURL(frame), fileDate: new Date(f.lastModified).toLocaleDateString("en-IN", { dateStyle: "medium" }), placeId: "" });
      } catch {
        setMessage("One file could not be read and was skipped.");
      }
    }
    setItems((cur) => [...cur, ...added]);
    setResult(null);
  }

  async function makeReel() {
    setBusy(true);
    setMessage(null);
    setFaces({});
    const form = new FormData();
    items.forEach((it, i) => form.append("frames", it.frame, `frame-${i}.jpg`));
    form.append("places", JSON.stringify(items.map((it) => it.placeId || null)));
    try {
      const res = await fetchWithTimeout("/api/memories/moments", { method: "POST", body: form }, uploadTimeoutMs);
      const body = await res.json();
      if (!res.ok) setMessage(body.error ?? t(lang, "errorBody"));
      else if (!body.ok)
        setMessage(
          body.reason === "ai_unavailable"
            ? "The assistant is not reachable right now. Please try again later."
            : "The assistant gave an answer MIRAS could not check, so nothing is shown. Please try again.",
        );
      else setResult(body);
    } catch (e) {
      setMessage(e instanceof TimeoutError ? "Slow connection. Your photos are still on this phone. Try again." : "No connection. Your photos are still on this phone.");
    } finally {
      setBusy(false);
    }
  }

  const kept = result?.moments.filter((m) => faces[m.frameIndex] !== "cut") ?? [];
  const undecided = result?.moments.filter((m) => m.faceVisible && !faces[m.frameIndex]) ?? [];

  function buildReel(): Promise<ReelMoment[]> {
    return Promise.all(
      kept.map(async (m) => {
        const it = items[m.frameIndex];
        const place = placeName(m.placeId);
        return {
          frame: faces[m.frameIndex] === "blur" ? await blurWhole(it.frame) : it.frame,
          caption: m.caption,
          demo: Boolean(result?.demo),
          stamp: [place && `${place}${m.placeFrom === "model" ? " (suggested)" : ""}`, `${it.fileDate} (from your file)`].filter(Boolean).join(" · "),
          story: m.story ? { title: m.story.title, text: m.story.text, sourceType: m.story.sourceType } : null,
        };
      }),
    );
  }

  async function save() {
    const moments = await buildReel();
    try {
      await idbPut("memories", { id: crypto.randomUUID(), createdAt: new Date().toISOString(), moments });
      setMessage("Saved on this device.");
      refreshSaved();
    } catch {
      setMessage("Could not save on this device (storage may be blocked in private mode).");
    }
  }

  return (
    <div className="space-y-5">
      {playing && <Reel moments={playing} lang={lang} onClose={() => setPlaying(null)} />}

      <section className="space-y-3 rounded-2xl border border-line bg-white/60 p-4">
        <p className="font-medium">1. Pick up to {MAX} photos or short clips</p>
        <p className="text-sm text-ink-soft">
          MIRAS takes one still frame from each, in your browser. Only those small frames are sent, once, and they are not saved on any server.
        </p>
        <input
          type="file"
          accept="image/*,video/*"
          multiple
          aria-label="Photos or clips"
          disabled={items.length >= MAX}
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
          className="block w-full text-sm"
        />
        {items.length > 0 && (
          <ul className="space-y-2">
            {items.map((it, i) => (
              <li key={it.url} className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.url} alt={`Moment ${i + 1}`} className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-ink-soft">{it.fileDate} (from your file)</p>
                  <select
                    aria-label={`Place for moment ${i + 1}`}
                    value={it.placeId}
                    onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, placeId: e.target.value } : x)))}
                    className="mt-1 min-h-10 w-full rounded-lg border border-ink/25 bg-white px-2 text-sm"
                  >
                    <option value="">Place: not sure</option>
                    {places.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Button type="button" variant="accent" disabled={!items.length || busy} onClick={makeReel}>
          {busy ? "Picking moments…" : "Make my reel"}
        </Button>
      </section>

      {message && (
        <p role={message.startsWith("Saved") ? "status" : "alert"} className="rounded-xl bg-lake/20 p-3 text-sm">
          {message}
        </p>
      )}

      {result && (
        <section className="space-y-3" data-testid="moments">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl">Your moments</h2>
            {result.demo && <Label tone="warn">{t(lang, "demoResponse")}</Label>}
          </div>
          {result.moments.map((m) => {
            const it = items[m.frameIndex];
            const choice = faces[m.frameIndex];
            return (
              <article
                key={m.frameIndex}
                className={`space-y-2 rounded-2xl border border-line bg-white/60 p-3 ${choice === "cut" ? "opacity-50" : ""}`}
                data-testid="moment"
              >
                <div className="flex gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.url} alt="" className={`h-20 w-20 shrink-0 rounded-lg object-cover ${choice === "blur" ? "blur-md" : ""}`} />
                  <div className="min-w-0">
                    <p>{m.caption}</p>
                    {m.uncertain && <Label tone="warn">Please check</Label>}
                    <p className="text-xs text-ink-soft">
                      {placeName(m.placeId) ? `${placeName(m.placeId)}${m.placeFrom === "model" ? " (suggested)" : ""} · ` : ""}
                      {it.fileDate} (from your file)
                    </p>
                  </div>
                </div>
                {m.story && (
                  <div className="rounded-xl bg-paper p-2">
                    <SourceTypeLabel lang={lang} type={m.story.sourceType} /> <span className="font-display">{m.story.title}</span>
                  </div>
                )}
                {m.faceVisible && (
                  <div className="space-y-2 rounded-xl bg-saffron/15 p-2" data-testid="face-choice">
                    <p className="text-sm font-medium">A face may be visible in this moment. What would you like to do?</p>
                    <div className="flex flex-wrap gap-2">
                      {(["cut", "blur", "keep"] as const).map((c) => (
                        <button
                          key={c}
                          type="button"
                          aria-pressed={choice === c}
                          onClick={() => setFaces({ ...faces, [m.frameIndex]: c })}
                          className={`min-h-10 rounded-full border px-3 text-sm ${choice === c ? "border-ink bg-ink text-paper" : "border-ink/30"}`}
                        >
                          {c === "cut" ? "Cut this moment" : c === "blur" ? "Blur whole frame" : "Keep"}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-ink-soft">Blurring covers the whole frame, not just the face.</p>
                  </div>
                )}
              </article>
            );
          })}
          {undecided.length > 0 && <p className="text-sm">Choose what to do with each moment that may show a face before playing or saving.</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={!kept.length || undecided.length > 0} onClick={async () => setPlaying(await buildReel())}>
              Play reel
            </Button>
            <Button type="button" variant="secondary" disabled={!kept.length || undecided.length > 0} onClick={save}>
              Save on this device
            </Button>
          </div>
          <p className="text-xs text-ink-soft">No music is added. Memories are saved only in this browser.</p>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-2xl">Saved on this device</h2>
        {saved.length ? (
          <ul className="space-y-2" data-testid="saved-memories">
            {saved.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white/60 p-3">
                <span className="flex-1 text-sm">
                  {new Date(s.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} · {s.moments.length} moments
                </span>
                <Button type="button" variant="secondary" onClick={() => setPlaying(s.moments)}>
                  Open
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={async () => {
                    await idbDelete("memories", s.id);
                    refreshSaved();
                  }}
                >
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-soft">Nothing saved yet.</p>
        )}
      </section>
    </div>
  );
}
