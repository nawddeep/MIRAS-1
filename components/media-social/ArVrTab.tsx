"use client";

import { useState, useRef, useEffect } from "react";
import "@photo-sphere-viewer/core/index.css";

interface ArVrTabProps {
  places: { id: string; name: string; slug: string; lat?: number; lng?: number }[];
  initialPost?: unknown;
}

export function ArVrTab({ places }: ArVrTabProps) {
  const [subTab, setSubTab] = useState<"360_tours" | "ar_camera" | "time_travel" | "radar">("360_tours");

  // 360 Panoramas Collection
  const panoramas = [
    {
      id: "p1",
      title: "Lake Pichola & Jag Mandir",
      placeName: "Lake Pichola",
      src: "/media/pichhola/palace-wide.webp",
      description: "Tranquil expanse of Lake Pichola with view of Jag Mandir Island Palace and City Palace façade.",
      hotspots: [
        { title: "Jag Mandir Island", text: "Built in 1620, this island served as a sanctuary for Prince Khurram (later Emperor Shah Jahan)." },
        { title: "City Palace Façade", text: "Spanning 244 meters along the eastern shore, erected over 400 years by successive Maharanas." },
      ],
    },
    {
      id: "p2",
      title: "City Palace Royal Courtyard",
      placeName: "City Palace",
      src: "/media/places/city-palace-2.webp",
      description: "Manek Chowk and the royal courtyard where ceremonial elephant processions once took place.",
      hotspots: [
        { title: "Tripolia Gate", text: "Three-arched gateway built in 1711, the historic grand entrance to the palace." },
        { title: "Suraj Gokhada", text: "The Sun Balcony where the rulers greeted their subjects before embarking on festival processions." },
      ],
    },
    {
      id: "p3",
      title: "Bagore Ki Haveli Waterfront",
      placeName: "Gangaur Ghat",
      src: "/media/places/bagore-ki-haveli-2.webp",
      description: "Historic 18th-century noble residence overlooking Gangaur Ghat with traditional Rajasthani jharokhas.",
      hotspots: [
        { title: "Haveli Archways", text: "Features 138 rooms adorned with stained glass, antique frescoes, and mirror work." },
      ],
    },
    {
      id: "p4",
      title: "Monsoon Palace Heights",
      placeName: "Sajjangarh",
      src: "/media/places/sajjangarh-2.webp",
      description: "3,100 feet elevation on the Aravalli crest looking over Fateh Sagar and Pichola lakes.",
      hotspots: [
        { title: "Monsoon Rain Water Harvesting", text: "Engineered with massive underground cisterns capable of storing 195,000 liters of rainwater." },
      ],
    },
  ];

  const [activePanoIndex, setActivePanoIndex] = useState(0);
  const panoRef = useRef<HTMLDivElement>(null);
  const [panoLoading, setPanoLoading] = useState(false);
  const [activeHotspot, setActiveHotspot] = useState<{ title: string; text: string } | null>(null);

  // Time-travel comparison slider (0 to 100%)
  const [sliderPos, setSliderPos] = useState(50);

  // AR Camera state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [selectedArtifact, setSelectedArtifact] = useState<"shield" | "sword" | "peacock" | "jharokha">("shield");
  const [artifactRotation, setArtifactRotation] = useState(0);

  // Location-based AR radar
  const [userCoord, setUserCoord] = useState({ lat: 24.5764, lng: 73.6835 }); // City Palace default
  const [compassHeading, setCompassHeading] = useState(42);

  // Load 360 viewer
  useEffect(() => {
    if (subTab !== "360_tours" || !panoRef.current) return;
    let viewer: { destroy(): void } | undefined;
    let cancelled = false;

    setPanoLoading(true);
    import("@photo-sphere-viewer/core")
      .then(({ Viewer }) => {
        if (cancelled || !panoRef.current) return;
        panoRef.current.innerHTML = "";
        viewer = new Viewer({
          container: panoRef.current,
          panorama: panoramas[activePanoIndex].src,
          navbar: ["zoom", "move", "fullscreen"],
          loadingTxt: "",
        });
        setPanoLoading(false);
      })
      .catch(() => {
        setPanoLoading(false);
      });

    return () => {
      cancelled = true;
      viewer?.destroy();
    };
  }, [subTab, activePanoIndex]);

  // Handle AR Camera stream
  async function startArCamera() {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch {
      setCameraError("Camera access not available. Showing simulated AR environment.");
      setCameraActive(true);
    }
  }

  function stopArCamera() {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }

  // Calculate distance between two coordinates in meters
  function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  }

  const currentPano = panoramas[activePanoIndex];

  return (
    <div className="mx-auto max-w-4xl px-3 pb-28 pt-2 space-y-4">
      {/* Sub navigation bar */}
      <div className="flex rounded-2xl border border-ink/10 bg-white p-1.5 shadow-sm text-xs font-bold gap-1 overflow-x-auto no-scrollbar">
        {[
          { id: "360_tours", label: "🧭 360° Virtual Tours" },
          { id: "ar_camera", label: "✨ AR Heritage Camera" },
          { id: "time_travel", label: "⏳ Time-Travel Slider" },
          { id: "radar", label: "📡 Monument AR Radar" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              if (subTab === "ar_camera" && tab.id !== "ar_camera") stopArCamera();
              setSubTab(tab.id as typeof subTab);
            }}
            className={`shrink-0 rounded-xl px-3.5 py-2 transition ${
              subTab === tab.id
                ? "bg-gradient-to-r from-ink-2 to-lake-deep text-white shadow-sm"
                : "text-ink-soft hover:bg-ink/5"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 1. 360 Virtual Tours View */}
      {subTab === "360_tours" && (
        <div className="space-y-4">
          <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl bg-ink shadow-xl border border-ink/10 sm:aspect-[16/9]">
            <div ref={panoRef} className="h-full w-full" />

            {panoLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-xs font-semibold text-white backdrop-blur-xs">
                Loading 360° Spherical Environment...
              </div>
            )}

            {/* Title & Hotspot Drawer */}
            <div className="pointer-events-none absolute top-3 left-3 z-20 flex flex-col gap-1.5">
              <div className="pointer-events-auto rounded-full bg-black/65 px-3 py-1 text-xs font-bold text-white backdrop-blur-md">
                📍 {currentPano.title}
              </div>
              <p className="pointer-events-auto max-w-xs text-[11px] text-white/90 bg-black/50 p-2 rounded-xl backdrop-blur-md">
                {currentPano.description}
              </p>
            </div>

            {/* Hotspots button list */}
            <div className="absolute bottom-3 left-3 right-3 z-20 flex flex-wrap gap-2">
              {currentPano.hotspots.map((h) => (
                <button
                  key={h.title}
                  type="button"
                  onClick={() => setActiveHotspot(h)}
                  className="rounded-full bg-saffron-text/90 hover:bg-saffron-text px-3 py-1 text-xs font-bold text-ink shadow-md backdrop-blur-md transition active:scale-95"
                >
                  🔍 {h.title}
                </button>
              ))}
            </div>
          </div>

          {/* Hotspot details card */}
          {activeHotspot && (
            <div className="rounded-2xl border border-saffron/40 bg-saffron/10 p-4 shadow-sm animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="font-display text-sm font-bold text-saffron-text">✦ {activeHotspot.title}</span>
                <button type="button" onClick={() => setActiveHotspot(null)} className="text-saffron-text text-xs font-bold">
                  ✕ Close
                </button>
              </div>
              <p className="mt-1 text-xs text-saffron-text leading-relaxed">{activeHotspot.text}</p>
            </div>
          )}

          {/* Panorama Selector Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {panoramas.map((p, idx) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setActiveHotspot(null);
                  setActivePanoIndex(idx);
                }}
                className={`overflow-hidden rounded-xl border-2 text-left transition ${
                  activePanoIndex === idx ? "border-saffron ring-2 ring-saffron/40" : "border-ink/10 opacity-80 hover:opacity-100"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.src} alt={p.title} className="h-24 w-full object-cover" />
                <div className="bg-white p-2">
                  <p className="text-xs font-bold text-ink truncate">{p.title}</p>
                  <p className="text-[10px] text-ink-soft">{p.placeName}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 2. AR Camera Mode */}
      {subTab === "ar_camera" && (
        <div className="space-y-4">
          <div className="relative aspect-[3/4] w-full max-w-lg mx-auto overflow-hidden rounded-3xl bg-ink-3 shadow-2xl border border-ink/15">
            {/* Live Camera Video */}
            <video ref={videoRef} playsInline muted className={`h-full w-full object-cover ${cameraActive ? "" : "hidden"}`} />

            {/* Simulated AR Background if camera access off or unavailable */}
            {!cameraActive && (
              <div className="relative h-full w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/media/places/city-palace-1.webp" alt="Simulated AR environment" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-black/40" />
              </div>
            )}

            {/* AR 3D Interactive Floating Heritage Artifact */}
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none">
              <div
                className="pointer-events-auto cursor-grab rounded-2xl bg-black/40 p-6 backdrop-blur-md border border-white/20 transition-transform duration-300 select-none shadow-2xl"
                style={{ transform: `rotateY(${artifactRotation}deg) scale(1.1)` }}
                onClick={() => setArtifactRotation((r) => r + 45)}
              >
                {selectedArtifact === "shield" && (
                  <div className="text-center">
                    <div className="text-7xl animate-pulse">🛡️</div>
                    <p className="mt-2 text-xs font-bold text-saffron">Mewar Sun Dhal (16th C.)</p>
                    <p className="text-[10px] text-white/80">Tap to rotate 3D orientation</p>
                  </div>
                )}
                {selectedArtifact === "sword" && (
                  <div className="text-center">
                    <div className="text-7xl animate-bounce">🗡️</div>
                    <p className="mt-2 text-xs font-bold text-saffron">Rajput Ceremonial Khanda</p>
                    <p className="text-[10px] text-white/80">Damascus steel forged in Mewar</p>
                  </div>
                )}
                {selectedArtifact === "peacock" && (
                  <div className="text-center">
                    <div className="text-7xl">🦚</div>
                    <p className="mt-2 text-xs font-bold text-saffron">Mor Chowk Mosaic Peacock</p>
                    <p className="text-[10px] text-white/80">Made with 5,000 glass pieces</p>
                  </div>
                )}
                {selectedArtifact === "jharokha" && (
                  <div className="text-center">
                    <div className="text-7xl">🏛️</div>
                    <p className="mt-2 text-xs font-bold text-saffron">Marble Carved Jharokha</p>
                    <p className="text-[10px] text-white/80">Overlooking Lake Pichola</p>
                  </div>
                )}
              </div>
            </div>

            {/* Camera Overlay HUD */}
            <div className="absolute top-4 inset-x-4 z-20 flex items-center justify-between text-white">
              <div className="rounded-full bg-black/60 px-3 py-1 text-xs font-bold backdrop-blur-md">
                <span>✦ AR Heritage Live Lens</span>
              </div>
              <button
                type="button"
                onClick={cameraActive ? stopArCamera : startArCamera}
                className={`rounded-full px-3 py-1 text-xs font-bold shadow-md transition ${
                  cameraActive ? "bg-ink-2 text-white" : "bg-emerald-600 text-white"
                }`}
              >
                {cameraActive ? "Turn Off Camera" : "Open Camera"}
              </button>
            </div>

            {/* Bottom Artifact Picker */}
            <div className="absolute bottom-4 inset-x-4 z-20 flex justify-center gap-2">
              {[
                { id: "shield", label: "Royal Shield", icon: "🛡️" },
                { id: "sword", label: "Mewar Sword", icon: "🗡️" },
                { id: "peacock", label: "Glass Peacock", icon: "🦚" },
                { id: "jharokha", label: "Jharokha", icon: "🏛️" },
              ].map((art) => (
                <button
                  key={art.id}
                  type="button"
                  onClick={() => setSelectedArtifact(art.id as typeof selectedArtifact)}
                  className={`flex flex-col items-center rounded-xl p-2 transition ${
                    selectedArtifact === art.id
                      ? "bg-saffron-text text-black font-bold scale-105 shadow-lg"
                      : "bg-black/60 text-white hover:bg-black/80"
                  }`}
                >
                  <span className="text-lg">{art.icon}</span>
                  <span className="text-[9px] mt-0.5">{art.label}</span>
                </button>
              ))}
            </div>
          </div>

          {cameraError && (
            <p className="text-xs text-center text-saffron-text font-medium bg-saffron/10 p-2 rounded-xl border border-saffron/40">
              {cameraError}
            </p>
          )}
        </div>
      )}

      {/* 3. Time-Travel Comparison Slider */}
      {subTab === "time_travel" && (
        <div className="space-y-4 rounded-2xl border border-ink/10 bg-white p-4 shadow-sm">
          <div>
            <h3 className="font-display text-base font-bold text-ink">Historical Time-Travel Slider</h3>
            <p className="text-xs text-ink-soft">
              Drag the interactive slider to compare modern Lake Pichola with its 19th-century royal archival rendering.
            </p>
          </div>

          <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl bg-ink shadow-lg select-none sm:aspect-[16/9]">
            {/* Background Image: Historical Sepia Archival View */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/media/pichhola/golden.webp"
              alt="Historical Udaipur"
              className="absolute inset-0 h-full w-full object-cover"
              style={{ filter: "sepia(0.85) contrast(1.2) brightness(0.9)" }}
            />
            <div className="absolute top-4 right-4 z-10 rounded-full bg-black/70 px-3 py-1 text-xs font-bold text-saffron backdrop-blur-md">
              1880 Royal Archive
            </div>

            {/* Foreground Image: Modern Daylight View (Clipped) */}
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${sliderPos}%` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/media/pichhola/palace-wide.webp"
                alt="Present Day Udaipur"
                className="absolute inset-0 h-full w-full max-w-none object-cover"
                style={{ width: "100%", height: "100%" }}
              />
              <div className="absolute top-4 left-4 z-10 rounded-full bg-black/70 px-3 py-1 text-xs font-bold text-white backdrop-blur-md">
                Present Day (2026)
              </div>
            </div>

            {/* Slider Dividing Bar */}
            <div
              className="absolute inset-y-0 z-20 w-1 bg-white shadow-2xl cursor-ew-resize"
              style={{ left: `${sliderPos}%` }}
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 grid h-8 w-8 place-items-center rounded-full bg-white text-ink shadow-xl font-bold text-xs">
                ⇄
              </div>
            </div>

            {/* Transparent Range Input to allow dragging anywhere */}
            <input
              type="range"
              min="0"
              max="100"
              value={sliderPos}
              onChange={(e) => setSliderPos(Number(e.target.value))}
              className="absolute inset-0 z-30 opacity-0 cursor-ew-resize w-full h-full"
              aria-label="Time travel split slider"
            />
          </div>

          <div className="flex justify-between text-xs text-ink-soft font-medium px-2">
            <span>← Present Day Lake Pichola</span>
            <span>Slide to travel through time</span>
            <span>1880 Royal Archive View →</span>
          </div>
        </div>
      )}

      {/* 4. Monument AR Radar */}
      {subTab === "radar" && (
        <div className="space-y-4 rounded-2xl border border-ink/10 bg-white p-4 shadow-sm">
          <div>
            <h3 className="font-display text-base font-bold text-ink">Location-Based Heritage Radar</h3>
            <p className="text-xs text-ink-soft">
              Live distance and bearing to Udaipur&rsquo;s 15 historic monuments from City Palace coordinates.
            </p>
          </div>

          {/* Compass Radar Visualizer */}
          <div className="relative mx-auto flex h-48 w-48 items-center justify-center rounded-full border-4 border-dashed border-saffron/50 bg-gradient-to-tr from-saffron/10 to-saffron/10 shadow-inner">
            <div
              className="absolute h-40 w-40 rounded-full border border-saffron/50 transition-transform duration-700"
              style={{ transform: `rotate(${compassHeading}deg)` }}
            >
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-ink-2 px-2 py-0.5 text-[9px] font-bold text-white shadow">
                N
              </div>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-full bg-ink-2 text-white shadow-lg font-bold text-xs">
              📍 YOU
            </div>
            <div className="absolute bottom-2 text-[10px] font-bold text-saffron-text">
              Heading: {compassHeading}° NE
            </div>
          </div>

          {/* Monument Distance Cards */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {places.map((place) => {
              const dist = place.lat && place.lng
                ? getDistanceMeters(userCoord.lat, userCoord.lng, place.lat, place.lng)
                : 850;

              return (
                <div
                  key={place.id}
                  className="flex items-center justify-between rounded-xl border border-ink/10 bg-paper p-3 hover:bg-ink/5 transition"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">🏛️</span>
                    <div>
                      <p className="text-xs font-bold text-ink">{place.name}</p>
                      <p className="text-[10px] text-ink-soft">Historic Site</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="rounded-full bg-saffron/15 px-2.5 py-1 text-xs font-bold text-saffron-text">
                      {dist > 1000 ? `${(dist / 1000).toFixed(1)} km` : `${dist} m`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

