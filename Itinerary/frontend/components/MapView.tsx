"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/* One map component, two engines:
   - Google Maps JavaScript API when NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY is set. That key is a
     browser key by design: restrict it to your domains and to the Maps JavaScript API only.
   - Otherwise Leaflet with OpenStreetMap tiles (filtered dark for the dark theme). */

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  title: string;
  label?: string;
  kind?: "place" | "start" | "end" | "stop" | "me" | "rental";
  active?: boolean;
}

export interface MapViewProps {
  center: { lat: number; lng: number };
  zoom?: number;
  markers?: MapMarker[];
  polyline?: [number, number][];
  circle?: { lat: number; lng: number; radius: number };
  dark?: boolean;
  arrows?: boolean;
  fit?: "markers" | "polyline" | "circle" | "none";
  onMarkerClick?: (id: string) => void;
  className?: string;
  ariaLabel: string;
  children?: ReactNode;
}

const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY ?? "";

export function MapView(props: MapViewProps) {
  return (
    <div className={`map-frame ${props.className ?? "h-[320px]"}`}>
      {GOOGLE_KEY ? <GoogleMapImpl {...props} /> : <LeafletMapImpl {...props} />}
      {props.children}
    </div>
  );
}

function bearing(a: [number, number], b: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(b[1] - a[1])) * Math.cos(toRad(b[0]));
  const x = Math.cos(toRad(a[0])) * Math.sin(toRad(b[0])) - Math.sin(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.cos(toRad(b[1] - a[1]));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function arrowPoints(line: [number, number][], every = 8): { at: [number, number]; deg: number }[] {
  const out = [];
  for (let i = every; i < line.length - 1; i += every) out.push({ at: line[i], deg: bearing(line[i], line[i + 1]) });
  return out;
}

const ROUTE_COLOR = { light: "#101718", dark: "#ffd23f" };

/* ---------------- Leaflet ---------------- */

function LeafletMapImpl({ center, zoom = 14, markers = [], polyline, circle, dark, arrows, fit = "markers", onMarkerClick, ariaLabel }: MapViewProps) {
  const el = useRef<HTMLDivElement>(null);
  const state = useRef<{ L?: typeof import("leaflet"); map?: import("leaflet").Map; tiles?: import("leaflet").TileLayer; layer?: import("leaflet").LayerGroup }>({});
  const [ready, setReady] = useState(false);
  const clickRef = useRef(onMarkerClick);
  useEffect(() => {
    clickRef.current = onMarkerClick;
  }, [onMarkerClick]);

  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !el.current || state.current.map) return;
      const map = L.map(el.current, { zoomControl: true, attributionControl: true }).setView([center.lat, center.lng], zoom);
      state.current = { L, map, layer: L.layerGroup().addTo(map) };
      setReady(true);
    });
    return () => {
      cancelled = true;
      state.current.map?.remove();
      state.current = {};
    };
    // Created once; later prop changes are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const { L, map } = state.current;
    if (!ready || !L || !map) return;
    state.current.tiles?.remove();
    // Dark theme = the same OSM tiles through a CSS filter (no extra tile provider or key).
    state.current.tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap contributors",
      className: dark ? "tiles-dark" : "",
    });
    state.current.tiles.addTo(map);
  }, [ready, dark]);

  useEffect(() => {
    const { L, map, layer } = state.current;
    if (!ready || !L || !map || !layer) return;
    layer.clearLayers();
    const theme = dark ? "dark" : "light";
    if (circle) L.circle([circle.lat, circle.lng], { radius: circle.radius, color: dark ? "#ffd23f" : "#243b42", weight: 1.5, fillOpacity: 0.06 }).addTo(layer);
    if (polyline && polyline.length > 1) {
      if (dark) L.polyline(polyline, { color: "#000", weight: 9, opacity: 0.35 }).addTo(layer);
      L.polyline(polyline, { color: ROUTE_COLOR[theme], weight: 5, opacity: 0.95, dashArray: dark ? undefined : "1 9", lineCap: "round" }).addTo(layer);
      if (arrows) {
        for (const a of arrowPoints(polyline, Math.max(4, Math.floor(polyline.length / 10)))) {
          L.marker(a.at, {
            interactive: false,
            keyboard: false,
            icon: L.divIcon({ className: "", html: `<div class="route-arrow" data-theme="${theme}" style="transform:rotate(${a.deg - 90}deg)">➤</div>`, iconSize: [14, 14], iconAnchor: [7, 7] }),
          }).addTo(layer);
        }
      }
    }
    for (const m of markers) {
      const html =
        m.kind === "me"
          ? `<div class="marker-me"></div>`
          : `<div class="marker-pin" data-kind="${m.kind ?? "place"}" data-theme="${dark && m.kind !== "start" && m.kind !== "end" ? "dark" : "light"}" data-active="${!!m.active}"><span>${escapeHtml(m.label ?? "")}</span></div>`;
      const mk = L.marker([m.lat, m.lng], {
        title: m.title,
        alt: m.title,
        keyboard: !!clickRef.current,
        icon: L.divIcon({ className: "", html, iconSize: [28, 28], iconAnchor: m.kind === "me" ? [9, 9] : [14, 30] }),
        zIndexOffset: m.active ? 1000 : 0,
      }).addTo(layer);
      if (clickRef.current) mk.on("click", () => clickRef.current?.(m.id));
    }
    const pts: [number, number][] =
      fit === "polyline" && polyline?.length ? polyline : fit === "markers" ? markers.map((m) => [m.lat, m.lng]) : [];
    if (fit === "circle" && circle) map.fitBounds(L.latLng(circle.lat, circle.lng).toBounds(circle.radius * 2), { padding: [10, 10] });
    else if (pts.length > 1) map.fitBounds(L.latLngBounds(pts), { padding: [30, 30], maxZoom: 16 });
    else if (pts.length === 1) map.setView(pts[0], Math.max(map.getZoom(), 15));
    else map.setView([center.lat, center.lng], zoom);
  }, [ready, markers, polyline, circle, dark, arrows, fit, center.lat, center.lng, zoom]);

  return <div ref={el} className="absolute inset-0" role="region" aria-label={ariaLabel} />;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/* ---------------- Google Maps JavaScript API ---------------- */

// The Maps JS API ships its own globals; typed loosely to avoid an extra types package.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type G = any;
let googleLoader: Promise<G> | null = null;

function loadGoogle(): Promise<G> {
  if (googleLoader) return googleLoader;
  googleLoader = new Promise((resolve, reject) => {
    const w = window as unknown as { google?: G; __gmapsReady?: () => void };
    if (w.google?.maps) return resolve(w.google);
    w.__gmapsReady = () => resolve(w.google);
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_KEY)}&v=weekly&loading=async&callback=__gmapsReady`;
    s.async = true;
    s.onerror = () => {
      googleLoader = null;
      reject(new Error("Google Maps failed to load"));
    };
    document.head.appendChild(s);
  });
  return googleLoader;
}

const DARK_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#131b31" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#a9b0c6" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0b1128" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2e3a63" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#172044" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0b1128" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

function GoogleMapImpl({ center, zoom = 14, markers = [], polyline, circle, dark, arrows, fit = "markers", onMarkerClick, ariaLabel }: MapViewProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<G>(null);
  const overlays = useRef<G[]>([]);
  const [g, setG] = useState<G>(null);
  const [failed, setFailed] = useState(false);
  const clickRef = useRef(onMarkerClick);
  useEffect(() => {
    clickRef.current = onMarkerClick;
  }, [onMarkerClick]);

  useEffect(() => {
    loadGoogle().then(setG, () => setFailed(true));
  }, []);

  useEffect(() => {
    if (!g || !el.current) return;
    const c = { lat: center.lat, lng: center.lng };
    if (!map.current) {
      map.current = new g.maps.Map(el.current, { center: c, zoom, disableDefaultUI: true, zoomControl: true, clickableIcons: false, gestureHandling: "cooperative" });
    }
    map.current.setOptions({ styles: dark ? DARK_STYLE : [] });
    overlays.current.forEach((o) => o.setMap(null));
    overlays.current = [];
    const add = (o: G) => overlays.current.push(o);
    const color = dark ? ROUTE_COLOR.dark : ROUTE_COLOR.light;
    if (circle) add(new g.maps.Circle({ map: map.current, center: { lat: circle.lat, lng: circle.lng }, radius: circle.radius, strokeColor: color, strokeWeight: 1.5, fillOpacity: 0.06 }));
    if (polyline && polyline.length > 1) {
      add(new g.maps.Polyline({
        map: map.current,
        path: polyline.map(([lat, lng]) => ({ lat, lng })),
        strokeColor: color,
        strokeWeight: 5,
        icons: arrows ? [{ icon: { path: g.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 2.5, strokeColor: color, fillColor: color, fillOpacity: 1 }, offset: "40px", repeat: "90px" }] : [],
      }));
    }
    for (const m of markers) {
      const isEnd = m.kind === "start" || m.kind === "end";
      const marker = new g.maps.Marker({
        map: map.current,
        position: { lat: m.lat, lng: m.lng },
        title: m.title,
        label: m.label ? { text: m.label, color: isEnd || m.active || dark ? "#080d0f" : "#ffffff", fontSize: "12px", fontWeight: "700" } : undefined,
        icon: {
          path: g.maps.SymbolPath.CIRCLE,
          scale: m.kind === "me" ? 8 : m.active ? 15 : 12,
          fillColor: m.kind === "me" ? "#2a7fff" : isEnd || m.active ? "#f0a140" : m.kind === "rental" ? "#2e6f8e" : dark ? "#ffd23f" : "#101718",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
        zIndex: m.active ? 1000 : undefined,
      });
      if (clickRef.current) marker.addListener("click", () => clickRef.current?.(m.id));
      add(marker);
    }
    const pts = fit === "polyline" && polyline?.length ? polyline : fit === "markers" ? markers.map((m) => [m.lat, m.lng] as [number, number]) : [];
    if (fit === "circle" && circle) {
      map.current.fitBounds(new g.maps.Circle({ center: { lat: circle.lat, lng: circle.lng }, radius: circle.radius }).getBounds());
    } else if (pts.length > 1) {
      const b = new g.maps.LatLngBounds();
      pts.forEach(([lat, lng]) => b.extend({ lat, lng }));
      map.current.fitBounds(b, 40);
    } else if (pts.length === 1) {
      map.current.setCenter({ lat: pts[0][0], lng: pts[0][1] });
      map.current.setZoom(15);
    } else {
      map.current.setCenter(c);
      map.current.setZoom(zoom);
    }
  }, [g, markers, polyline, circle, dark, arrows, fit, center.lat, center.lng, zoom]);

  if (failed) return <div className="absolute inset-0 grid place-items-center p-6 text-center text-[15px] text-muted">The map could not load. The list below still works.</div>;
  return <div ref={el} className="absolute inset-0" role="region" aria-label={ariaLabel} />;
}
