"use client";

import { useState, useRef, useEffect } from "react";
import type { MediaAudioTrack } from "@/lib/media-social/db";
import { getHeritageAudioSynth } from "@/lib/media-social/audio-synth";

interface EditorTabProps {
  audioTracks: MediaAudioTrack[];
  places: { id: string; name: string; slug: string }[];
  onPublishSuccess: () => void;
}

interface TextOverlay {
  id: string;
  text: string;
  font: "tiro" | "sans" | "serif";
  color: string;
  bgColor: string;
  animation: "fade" | "slide" | "typewriter" | "none";
  x: number; // percentage
  y: number; // percentage
}

interface StickerOverlay {
  id: string;
  emoji: string;
  label: string;
  x: number;
  y: number;
  size: number;
}

export function EditorTab({ audioTracks, places, onPublishSuccess }: EditorTabProps) {
  // Preset Udaipur heritage media assets for quick creation
  const presetClips = [
    { id: "c1", name: "City Palace Facade", url: "/media/places/city-palace-1.webp", type: "image" },
    { id: "c2", name: "Lake Pichola Sunset", url: "/media/pichhola/golden.webp", type: "image" },
    { id: "c3", name: "Bagore Ki Haveli Courtyard", url: "/media/places/bagore-ki-haveli-1.webp", type: "image" },
    { id: "c4", name: "Saheliyon Rain Fountains", url: "/media/places/saheliyon-ki-bari-1.webp", type: "image" },
    { id: "c5", name: "Monsoon Palace Ridge", url: "/media/places/sajjangarh-1.webp", type: "image" },
    { id: "c6", name: "Gangaur Ghat Steps", url: "/media/spots/gangaur-ghat.webp", type: "image" },
  ];

  // Editor State
  const [clips, setClips] = useState<{ id: string; name: string; url: string; duration: number }[]>([
    { id: "c1", name: "City Palace Facade", url: "/media/places/city-palace-1.webp", duration: 4 },
  ]);
  const [selectedClipIndex, setSelectedClipIndex] = useState(0);
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "1:1" | "4:5">("9:16");
  const [filter, setFilter] = useState<string>("royal_amber");
  const [speed, setSpeed] = useState<number>(1.0);
  const [selectedAudio, setSelectedAudio] = useState<MediaAudioTrack | null>(audioTracks[0] || null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [arOverlay, setArOverlay] = useState<"none" | "sparkles" | "palace_arch" | "floating_diyas" | "dust">("sparkles");

  // Overlays
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([
    {
      id: "t1",
      text: "Udaipur Heritage Walk ✨",
      font: "serif",
      color: "#ffffff",
      bgColor: "rgba(0,0,0,0.5)",
      animation: "fade",
      x: 50,
      y: 20,
    },
  ]);
  const [newText, setNewText] = useState("");
  const [stickers, setStickers] = useState<StickerOverlay[]>([
    { id: "s1", emoji: "☀️", label: "Mewar Sun", x: 80, y: 15, size: 36 },
  ]);

  // Publish Dialog State
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [caption, setCaption] = useState("");
  const [selectedPlaceId, setSelectedPlaceId] = useState(places[0]?.id || "");
  const [mediaType, setMediaType] = useState<"reel" | "photo" | "ar_story">("reel");
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  // Total duration calculation
  const totalDuration = clips.reduce((acc, c) => acc + c.duration, 0);

  // Playhead interval simulation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime((t) => {
          if (t >= totalDuration) {
            return 0;
          }
          return t + 0.1 * speed;
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying, totalDuration, speed]);

  // Sync active clip with timeline current time
  useEffect(() => {
    let accumulated = 0;
    for (let i = 0; i < clips.length; i++) {
      accumulated += clips[i].duration;
      if (currentTime <= accumulated) {
        setSelectedClipIndex(i);
        break;
      }
    }
  }, [currentTime, clips]);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const url = URL.createObjectURL(file);
      setClips((prev) => [
        ...prev,
        {
          id: `upload-${Date.now()}-${Math.random()}`,
          name: file.name,
          url,
          duration: 4,
        },
      ]);
    });
  }

  function handleAddPreset(preset: (typeof presetClips)[0]) {
    setClips((prev) => [
      ...prev,
      {
        id: `preset-${Date.now()}-${Math.random()}`,
        name: preset.name,
        url: preset.url,
        duration: 4,
      },
    ]);
  }

  function removeClip(index: number) {
    if (clips.length <= 1) return;
    setClips((prev) => prev.filter((_, i) => i !== index));
    if (selectedClipIndex >= clips.length - 1) {
      setSelectedClipIndex(Math.max(0, clips.length - 2));
    }
  }

  function addTextOverlay() {
    if (!newText.trim()) return;
    setTextOverlays((prev) => [
      ...prev,
      {
        id: `text-${Date.now()}`,
        text: newText.trim(),
        font: "serif",
        color: "#ffffff",
        bgColor: "rgba(0,0,0,0.5)",
        animation: "slide",
        x: 50,
        y: 50,
      },
    ]);
    setNewText("");
  }

  function addSticker(emoji: string, label: string) {
    setStickers((prev) => [
      ...prev,
      {
        id: `sticker-${Date.now()}`,
        emoji,
        label,
        x: 50,
        y: 60,
        size: 38,
      },
    ]);
  }

  async function handlePublish() {
    setIsPublishing(true);
    setPublishMessage("");

    try {
      const place = places.find((p) => p.id === selectedPlaceId);
      const activeClip = clips[0];

      const res = await fetch("/api/media-social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_post",
          mediaType,
          mediaUrl: activeClip.url,
          caption: caption.trim() || `${place?.name || "Udaipur"} Heritage Reel ✨ #Udaipur #MewarHeritage`,
          placeId: place?.id || null,
          placeName: place?.name || null,
          audioId: selectedAudio?.id || null,
          audioTitle: selectedAudio?.title || null,
          arConfig: arOverlay !== "none" ? { overlayType: arOverlay, effects: ["particles", "lighting"] } : null,
          hashtags: ["#Udaipur", "#MewarHeritage", "#TravelReels"],
        }),
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed to publish reel");

      setPublishMessage("Reel published successfully to feed!");
      setTimeout(() => {
        setShowPublishModal(false);
        onPublishSuccess();
      }, 1200);
    } catch (err) {
      setPublishMessage((err as Error).message);
    } finally {
      setIsPublishing(false);
    }
  }

  const activeClip = clips[selectedClipIndex] || clips[0];

  // CSS Filter styles
  const filterStyles: Record<string, string> = {
    none: "none",
    royal_amber: "sepia(0.2) saturate(1.3) contrast(1.05) brightness(1.03)",
    pichhola_twilight: "hue-rotate(210deg) saturate(1.2) contrast(1.1)",
    vintage_mewar: "sepia(0.55) contrast(1.15) brightness(0.95)",
    palace_noir: "grayscale(1) contrast(1.3)",
    lake_breeze: "saturate(1.25) contrast(1.05) hue-rotate(15deg)",
    vivid_sun: "saturate(1.6) contrast(1.1)",
  };

  return (
    <div className="mx-auto max-w-4xl px-3 pb-28 pt-2">
      {/* Editor Header Bar */}
      <div className="mb-3 flex items-center justify-between rounded-2xl bg-white p-3 shadow-sm border border-stone-200">
        <div>
          <h2 className="font-display text-base font-bold text-stone-900">Story &amp; Reel Studio</h2>
          <p className="text-xs text-stone-500">Craft authentic multi-clip Udaipur reels with music &amp; AR</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Aspect Ratio Switcher */}
          <div className="flex rounded-lg border border-stone-200 bg-stone-50 p-0.5 text-xs">
            {(["9:16", "1:1", "4:5"] as const).map((ratio) => (
              <button
                key={ratio}
                type="button"
                onClick={() => setAspectRatio(ratio)}
                className={`rounded-md px-2 py-1 font-semibold transition ${
                  aspectRatio === ratio ? "bg-white text-rose-600 shadow-xs" : "text-stone-500 hover:text-stone-800"
                }`}
              >
                {ratio}
              </button>
            ))}
          </div>

          {/* Export / Publish Button */}
          <button
            type="button"
            onClick={() => setShowPublishModal(true)}
            className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-600 to-rose-600 px-4 py-2 text-xs font-bold text-white shadow-md transition hover:opacity-95 active:scale-95"
          >
            <span>Publish Reel</span>
            <span>→</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Left: Preview Canvas / Video Screen */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center rounded-2xl border border-stone-200 bg-stone-950 p-4 shadow-sm">
          <div
            className={`relative overflow-hidden rounded-2xl bg-stone-900 shadow-2xl transition-all ${
              aspectRatio === "9:16" ? "aspect-[9/16] w-full max-w-[320px]" : aspectRatio === "1:1" ? "aspect-square w-full max-w-[360px]" : "aspect-[4/5] w-full max-w-[340px]"
            }`}
          >
            {/* Visual Media */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeClip.url}
              alt={activeClip.name}
              className="h-full w-full object-cover transition duration-300"
              style={{ filter: filterStyles[filter] }}
            />

            {/* AR Overlays */}
            {arOverlay === "sparkles" && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                <div className="absolute top-1/4 left-1/4 text-2xl animate-ping">✨</div>
                <div className="absolute top-1/2 right-1/4 text-xl animate-pulse">✨</div>
                <div className="absolute bottom-1/3 left-1/3 text-3xl animate-bounce">✨</div>
              </div>
            )}
            {arOverlay === "floating_diyas" && (
              <div className="pointer-events-none absolute inset-0 z-10">
                <div className="absolute bottom-8 left-1/4 text-2xl animate-bounce">🪔</div>
                <div className="absolute bottom-12 right-1/4 text-2xl animate-bounce" style={{ animationDelay: "0.5s" }}>🪔</div>
                <div className="absolute bottom-16 left-1/2 text-xl animate-bounce" style={{ animationDelay: "1s" }}>🪔</div>
              </div>
            )}
            {arOverlay === "palace_arch" && (
              <div className="pointer-events-none absolute inset-2 z-10 rounded-2xl border-4 border-amber-400/80 shadow-[inset_0_0_20px_rgba(251,191,36,0.3)]">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-stone-900/90 px-3 py-0.5 text-[10px] font-bold text-amber-400 rounded-full border border-amber-400/60">
                  MEWAR ARCHITECTURAL FRAME
                </div>
              </div>
            )}

            {/* Render Text Overlays */}
            {textOverlays.map((t) => (
              <div
                key={t.id}
                className="absolute z-20 -translate-x-1/2 -translate-y-1/2 select-none px-3 py-1 rounded-lg shadow-md font-bold text-center"
                style={{
                  left: `${t.x}%`,
                  top: `${t.y}%`,
                  color: t.color,
                  backgroundColor: t.bgColor,
                  fontFamily: t.font === "serif" ? "var(--font-tiro), serif" : "var(--font-hind), sans-serif",
                }}
              >
                {t.text}
              </div>
            ))}

            {/* Render Stickers */}
            {stickers.map((s) => (
              <div
                key={s.id}
                className="absolute z-20 -translate-x-1/2 -translate-y-1/2 select-none cursor-move transition hover:scale-110"
                style={{ left: `${s.x}%`, top: `${s.y}%`, fontSize: `${s.size}px` }}
              >
                {s.emoji}
              </div>
            ))}

            {/* Play/Pause Overlay Button */}
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className="absolute inset-0 z-25 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              <div className="grid h-14 w-14 place-items-center rounded-full bg-black/60 text-white backdrop-blur-md">
                {isPlaying ? "❚❚" : "▶"}
              </div>
            </button>

            {/* Audio Indicator */}
            {selectedAudio && (
              <div className="absolute bottom-3 left-3 z-20 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur-md">
                <span>🎵 {selectedAudio.title}</span>
              </div>
            )}
          </div>

          {/* Player Playhead Controls */}
          <div className="mt-3 flex w-full max-w-[340px] items-center justify-between text-xs text-stone-300">
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className="rounded-full bg-white/20 px-3 py-1 text-white hover:bg-white/30"
            >
              {isPlaying ? "Pause" : "Play Preview"}
            </button>
            <span>{currentTime.toFixed(1)}s / {totalDuration.toFixed(1)}s</span>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-stone-400">Speed:</span>
              {[0.5, 1.0, 1.5, 2.0].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSpeed(s)}
                  className={`rounded px-1.5 py-0.5 text-[10px] ${
                    speed === s ? "bg-rose-600 text-white font-bold" : "text-stone-400 hover:text-white"
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Studio Controls (Timeline, Audio, Filters, Stickers, Text) */}
        <div className="lg:col-span-5 space-y-4">
          {/* 1. Timeline & Multi-clip Sequencer */}
          <div className="rounded-2xl border border-stone-200 bg-white p-3.5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-stone-800">Timeline Clips ({clips.length})</span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-bold text-rose-600 hover:underline"
              >
                + Add Media
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {/* Timeline Clips Row */}
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              {clips.map((clip, idx) => (
                <div
                  key={clip.id}
                  onClick={() => setSelectedClipIndex(idx)}
                  className={`relative group shrink-0 w-20 cursor-pointer overflow-hidden rounded-xl border-2 transition ${
                    selectedClipIndex === idx ? "border-rose-600 ring-2 ring-rose-200" : "border-stone-200 opacity-80 hover:opacity-100"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={clip.url} alt={clip.name} className="h-14 w-full object-cover" />
                  <div className="bg-stone-900/90 px-1 py-0.5 text-[9px] text-white truncate text-center">
                    {clip.duration}s
                  </div>
                  {clips.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeClip(idx);
                      }}
                      className="absolute top-1 right-1 grid h-4 w-4 place-items-center rounded-full bg-black/70 text-[9px] text-white opacity-0 group-hover:opacity-100"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Quick Presets Picker */}
            <div className="mt-2 border-t border-stone-100 pt-2">
              <span className="text-[10px] text-stone-700 font-semibold block mb-1.5">Add from Udaipur Heritage library:</span>
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                {presetClips.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleAddPreset(p)}
                    className="flex items-center gap-1 shrink-0 rounded-lg border border-stone-200 bg-stone-50 px-2 py-1 text-[10px] font-medium text-stone-700 hover:bg-stone-100"
                  >
                    <span>+</span>
                    <span className="truncate max-w-[90px]">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 2. Audio & Heritage Soundtracks */}
          <div className="rounded-2xl border border-stone-200 bg-white p-3.5 shadow-sm">
            <span className="text-xs font-bold text-stone-800 block mb-2">Heritage Soundtracks</span>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {audioTracks.map((track) => (
                <div
                  key={track.id}
                  onClick={() => {
                    setSelectedAudio(track);
                    getHeritageAudioSynth().playTrack(track.id, false);
                  }}
                  className={`flex items-center justify-between rounded-xl p-2 cursor-pointer transition ${
                    selectedAudio?.id === track.id
                      ? "border border-amber-300 bg-amber-50/80 text-amber-900"
                      : "border border-stone-100 bg-stone-50 hover:bg-stone-100 text-stone-700"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🎵</span>
                    <div>
                      <p className="text-xs font-bold leading-tight">{track.title}</p>
                      <p className="text-[10px] text-stone-500">{track.artist} · {track.category}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold text-stone-500">{track.durationSec}s</span>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Heritage Filters */}
          <div className="rounded-2xl border border-stone-200 bg-white p-3.5 shadow-sm">
            <span className="text-xs font-bold text-stone-800 block mb-2">Visual Filters</span>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: "royal_amber", label: "Royal Amber" },
                { id: "pichhola_twilight", label: "Pichhola Dusk" },
                { id: "vintage_mewar", label: "Vintage Sepia" },
                { id: "palace_noir", label: "Palace Noir" },
                { id: "lake_breeze", label: "Lake Breeze" },
                { id: "vivid_sun", label: "Vivid Sun" },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={`rounded-xl border px-2 py-1.5 text-center text-[11px] font-semibold transition ${
                    filter === f.id
                      ? "border-rose-600 bg-rose-50 text-rose-700 shadow-xs"
                      : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Text & Animated Stickers & AR Overlays */}
          <div className="rounded-2xl border border-stone-200 bg-white p-3.5 shadow-sm space-y-3">
            {/* Text input */}
            <div>
              <span className="text-xs font-bold text-stone-800 block mb-1">Add Captions &amp; Text</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  placeholder="Enter overlay text..."
                  className="flex-1 rounded-xl border border-stone-300 px-3 py-1.5 text-xs text-stone-900 focus:outline-none focus:border-rose-500"
                />
                <button
                  type="button"
                  onClick={addTextOverlay}
                  className="rounded-xl bg-stone-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-stone-800"
                >
                  + Add
                </button>
              </div>
            </div>

            {/* Heritage Stickers */}
            <div>
              <span className="text-[11px] font-bold text-stone-700 block mb-1.5">Mewar Heritage Stickers</span>
              <div className="flex flex-wrap gap-2">
                {[
                  { emoji: "☀️", label: "Mewar Sun" },
                  { emoji: "🐘", label: "Royal Elephant" },
                  { emoji: "🏰", label: "Palace Arch" },
                  { emoji: "🪷", label: "Lotus" },
                  { emoji: "🪔", label: "Diya" },
                  { emoji: "👑", label: "Crown" },
                ].map((stk) => (
                  <button
                    key={stk.label}
                    type="button"
                    onClick={() => addSticker(stk.emoji, stk.label)}
                    className="flex items-center gap-1 rounded-lg border border-stone-200 bg-stone-50 px-2 py-1 text-xs hover:bg-stone-100 active:scale-95"
                  >
                    <span>{stk.emoji}</span>
                    <span className="text-[10px] text-stone-600">{stk.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* AR Overlays */}
            <div>
              <span className="text-[11px] font-bold text-stone-700 block mb-1.5">AR Visual Effects</span>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: "none", label: "None" },
                  { id: "sparkles", label: "✨ Golden Sparkles" },
                  { id: "palace_arch", label: "🏛️ Marble Arch Frame" },
                  { id: "floating_diyas", label: "🪔 Floating Diyas" },
                ].map((ar) => (
                  <button
                    key={ar.id}
                    type="button"
                    onClick={() => setArOverlay(ar.id as any)}
                    className={`rounded-lg border px-2 py-1 text-[11px] font-semibold transition ${
                      arOverlay === ar.id
                        ? "border-amber-500 bg-amber-50 text-amber-900"
                        : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                    }`}
                  >
                    {ar.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Publish Reel Modal */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <h3 className="font-display text-base font-bold text-stone-900">Publish Reel to MIRAS</h3>
              <button
                type="button"
                onClick={() => setShowPublishModal(false)}
                className="grid h-7 w-7 place-items-center rounded-full text-stone-500 hover:bg-stone-100"
              >
                ✕
              </button>
            </div>

            {/* Content Type */}
            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">Post Format</label>
              <div className="flex gap-2">
                {[
                  { id: "reel", label: "🎬 Travel Reel" },
                  { id: "photo", label: "📸 Photo Feed" },
                  { id: "ar_story", label: "✨ AR Story" },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setMediaType(t.id as any)}
                    className={`flex-1 rounded-xl border py-2 text-xs font-semibold ${
                      mediaType === t.id
                        ? "border-rose-600 bg-rose-50 text-rose-700"
                        : "border-stone-200 text-stone-600 hover:bg-stone-50"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Caption */}
            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">Caption</label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Share the story behind this Udaipur discovery... Use #hashtags and @mentions"
                rows={3}
                className="w-full rounded-xl border border-stone-300 p-2.5 text-xs text-stone-900 focus:border-rose-500 focus:outline-none"
              />
            </div>

            {/* Location Tag */}
            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">Tag Destination / Monument</label>
              <select
                value={selectedPlaceId}
                onChange={(e) => setSelectedPlaceId(e.target.value)}
                className="w-full rounded-xl border border-stone-300 p-2 text-xs text-stone-900 focus:border-rose-500 focus:outline-none"
              >
                {places.map((p) => (
                  <option key={p.id} value={p.id}>
                    📍 {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Audio Track Tag */}
            {selectedAudio && (
              <div className="flex items-center gap-2 rounded-xl bg-stone-100 p-2 text-xs text-stone-700">
                <span>🎵 Attached Audio:</span>
                <span className="font-bold text-stone-900">{selectedAudio.title}</span>
              </div>
            )}

            {publishMessage && (
              <p
                className={`text-xs text-center font-semibold ${
                  publishMessage.includes("success") ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {publishMessage}
              </p>
            )}

            <button
              type="button"
              disabled={isPublishing}
              onClick={handlePublish}
              className="w-full rounded-full bg-gradient-to-r from-amber-600 via-rose-600 to-pink-600 py-3 text-xs font-bold text-white shadow-md hover:opacity-95 disabled:opacity-50"
            >
              {isPublishing ? "Publishing..." : "Publish to Social Feed & Reels"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

