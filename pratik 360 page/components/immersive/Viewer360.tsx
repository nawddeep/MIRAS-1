"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ImmersiveHotspot } from "@/lib/client/immersive-store";

export type ViewerMode = "360" | "vr";

export interface Viewer360Props {
  src: string;
  title: string;
  mode?: ViewerMode;
  onModeChange?: (mode: ViewerMode) => void;
  initialGyro?: boolean;
  hotspots?: ImmersiveHotspot[];
  placingHotspot?: boolean;
  onHotspotPlace?: (coords: { yaw: number; pitch: number }) => void;
  aspectWarning?: string | null;
}

/**
 * Ported from /pwa/src/services/PosePipeline.ts (eulerDeviceToQuaternion + quaternionToCameraBasis)
 * so Gyroscope look-around in Viewer360 behaves identically to the standalone /pwa viewer.
 */
function eulerToSphericalPose(
  alphaDeg: number,
  betaDeg: number,
  gammaDeg: number,
  screenOrientationDeg = 0
): { yaw: number; pitch: number } {
  const deg2rad = Math.PI / 180;
  const z = alphaDeg * deg2rad;
  const x = betaDeg * deg2rad;
  const y = gammaDeg * deg2rad;

  const cX = Math.cos(x / 2),
    sX = Math.sin(x / 2);
  const cY = Math.cos(y / 2),
    sY = Math.sin(y / 2);
  const cZ = Math.cos(z / 2),
    sZ = Math.sin(z / 2);

  let qw = cX * cY * cZ - sX * sY * sZ;
  let qx = sX * cY * cZ - cX * sY * sZ;
  let qy = cX * sY * cZ + sX * cY * sZ;
  let qz = cX * cY * sZ + sX * sY * cZ;

  if (screenOrientationDeg !== 0) {
    const so = (-screenOrientationDeg * deg2rad) / 2;
    const cS = Math.cos(so),
      sS = Math.sin(so);
    const nw = qw * cS - qz * sS;
    const nx = qx * cS + qy * sS;
    const ny = -qx * sS + qy * cS;
    const nz = qw * sS + qz * cS;
    qw = nw;
    qx = nx;
    qy = ny;
    qz = nz;
  }

  const len = Math.hypot(qx, qy, qz, qw) || 1;
  qx /= len;
  qy /= len;
  qz /= len;
  qw /= len;

  const xx = qx * qx,
    yy = qy * qy;
  const xz = qx * qz,
    yz = qy * qz;
  const wx = qw * qx,
    wy = qw * qy;

  // Back-camera forward vector in W3C world frame -> panorama frame
  const fxW = -2 * (xz + wy);
  const fyW = -2 * (yz - wx);
  const fzW = -(1 - 2 * (xx + yy));

  const fx = fxW;
  const fy = fzW;
  const fz = -fyW;

  const yaw = (Math.atan2(fx, -fz) * 180) / Math.PI;
  const pitch = (Math.asin(Math.max(-1, Math.min(1, fy))) * 180) / Math.PI;
  return { yaw, pitch };
}

const VERT_SHADER = `
attribute vec2 a_pos;
varying vec2 v_ndc;
void main() {
  v_ndc = a_pos;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAG_SHADER = `
precision highp float;
varying vec2 v_ndc;
uniform sampler2D u_tex;
uniform float u_yaw;
uniform float u_pitch;
uniform float u_fov;
uniform float u_aspect;
const float PI = 3.141592653589793;

void main() {
  float f = 1.0 / tan(u_fov * 0.5);
  vec3 dir = normalize(vec3(v_ndc.x * u_aspect / f, v_ndc.y / f, 1.0));

  float cp = cos(u_pitch), sp = sin(u_pitch);
  vec3 d1 = vec3(dir.x, dir.y * cp - dir.z * sp, dir.y * sp + dir.z * cp);

  float cy = cos(u_yaw), sy = sin(u_yaw);
  vec3 world = vec3(d1.x * cy + d1.z * sy, d1.y, -d1.x * sy + d1.z * cy);

  float lon = atan(world.x, world.z);
  float lat = asin(clamp(world.y, -1.0, 1.0));

  vec2 uv = vec2(0.5 + lon / (2.0 * PI), 0.5 - lat / PI);
  uv.x = fract(uv.x);
  uv.y = clamp(uv.y, 0.001, 0.999);

  gl_FragColor = texture2D(u_tex, uv);
}
`;

function WebGLEyeSphere({
  src,
  yawDeg,
  pitchDeg,
  fovDeg,
}: {
  src: string;
  yawDeg: number;
  pitchDeg: number;
  fovDeg: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glStateRef = useRef<{
    gl: WebGLRenderingContext;
    prog: WebGLProgram;
    tex: WebGLTexture;
    ready: boolean;
  } | null>(null);
  const [webglReady, setWebglReady] = useState(false);

  // Initialize WebGL context & shader program (ported from /pwa PanoramaViewer.ts)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { alpha: false, antialias: true });
    if (!gl) return;

    const compile = (type: number, source: string) => {
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, source);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        gl.deleteShader(s);
        return null;
      }
      return s;
    };

    const vs = compile(gl.VERTEX_SHADER, VERT_SHADER);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG_SHADER);
    if (!vs || !fs) return;

    const prog = gl.createProgram();
    if (!prog) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;

    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    const aPos = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const tex = gl.createTexture();
    if (!tex) return;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    glStateRef.current = { gl, prog, tex, ready: false };

    return () => {
      glStateRef.current = null;
    };
  }, []);

  // Load equirectangular image into WebGL texture
  useEffect(() => {
    const state = glStateRef.current;
    if (!state || !src) return;
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled || !glStateRef.current) return;
      const { gl, tex } = glStateRef.current;
      try {
        const maxTexSize = (gl.getParameter(gl.MAX_TEXTURE_SIZE) as number) || 4096;
        let uploadSource: TexImageSource = img;
        if (img.naturalWidth > maxTexSize || img.naturalHeight > maxTexSize) {
          const scale = maxTexSize / Math.max(img.naturalWidth, img.naturalHeight);
          const dw = Math.max(1, Math.floor(img.naturalWidth * scale));
          const dh = Math.max(1, Math.floor(img.naturalHeight * scale));
          const c = document.createElement("canvas");
          c.width = dw;
          c.height = dh;
          const ctx = c.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, dw, dh);
            uploadSource = c;
          }
        }
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, uploadSource);
        glStateRef.current.ready = true;
        setWebglReady(true);
      } catch {
        setWebglReady(false);
      }
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  // Draw frame whenever yaw, pitch, fov, or texture readiness updates
  useEffect(() => {
    const state = glStateRef.current;
    const canvas = canvasRef.current;
    if (!state || !state.ready || !canvas) return;
    const { gl, prog } = state;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(prog);
    gl.uniform1f(gl.getUniformLocation(prog, "u_yaw"), (yawDeg * Math.PI) / 180);
    gl.uniform1f(gl.getUniformLocation(prog, "u_pitch"), (pitchDeg * Math.PI) / 180);
    gl.uniform1f(gl.getUniformLocation(prog, "u_fov"), (fovDeg * Math.PI) / 180);
    gl.uniform1f(gl.getUniformLocation(prog, "u_aspect"), canvas.width / Math.max(1, canvas.height));
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }, [yawDeg, pitchDeg, fovDeg, webglReady]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        opacity: webglReady ? 1 : 0,
        pointerEvents: "none",
      }}
    />
  );
}

export function Viewer360({
  src,
  title,
  mode: controlledMode,
  onModeChange,
  initialGyro = false,
  hotspots = [],
  placingHotspot = false,
  onHotspotPlace,
  aspectWarning,
}: Viewer360Props) {
  const [internalMode, setInternalMode] = useState<ViewerMode>(controlledMode ?? "360");
  const activeMode = controlledMode ?? internalMode;

  const setMode = useCallback(
    (next: ViewerMode) => {
      setInternalMode(next);
      onModeChange?.(next);
    },
    [onModeChange]
  );

  const stageRef = useRef<HTMLDivElement>(null);
  const [yaw, setYaw] = useState(0); // -180..180 degrees
  const [pitch, setPitch] = useState(0); // -75..75 degrees
  const [fov, setFov] = useState(75); // 35..100 degrees
  const [dragging, setDragging] = useState(false);
  const [gyroActive, setGyroActive] = useState(initialGyro);
  const [gyroNote, setGyroNote] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [selectedHotspot, setSelectedHotspot] = useState<ImmersiveHotspot | null>(null);

  const motionOriginRef = useRef<{ yaw: number; pitch: number } | null>(null);
  const lookOriginRef = useRef<{ yaw: number; pitch: number }>({ yaw: 0, pitch: 0 });

  const dragOrigin = useRef<{
    x: number;
    y: number;
    lastX: number;
    lastY: number;
    yaw: number;
    pitch: number;
    moved: boolean;
  } | null>(null);
  const velocityRef = useRef<{ yaw: number; pitch: number }>({ yaw: 0, pitch: 0 });
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchDistRef = useRef<number | null>(null);

  // Normalize yaw into [-180, 180)
  const wrapYaw = (d: number) => {
    let w = (((d + 180) % 360) + 360) % 360 - 180;
    if (w === -180) w = 180;
    return w;
  };

  // Momentum / inertia loop (ported from /pwa PanoramaViewer.ts)
  useEffect(() => {
    let raf = 0;
    const step = () => {
      if (!dragOrigin.current && !gyroActive) {
        const vy = velocityRef.current.yaw;
        const vp = velocityRef.current.pitch;
        if (Math.abs(vy) > 0.04 || Math.abs(vp) > 0.04) {
          setYaw((prev) => wrapYaw(prev + vy));
          setPitch((prev) => Math.max(-75, Math.min(75, prev + vp)));
          velocityRef.current.yaw *= 0.91;
          velocityRef.current.pitch *= 0.91;
        }
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [gyroActive]);

  // Device orientation (gyroscope) listener ported from /pwa PanoramaViewer.ts
  useEffect(() => {
    if (!gyroActive) return;
    motionOriginRef.current = null;
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.alpha == null || e.beta == null || e.gamma == null) return;
      const screenAngle =
        typeof window.screen?.orientation?.angle === "number"
          ? window.screen.orientation.angle
          : 0;
      const sample = eulerToSphericalPose(e.alpha, e.beta, e.gamma, screenAngle);
      if (!motionOriginRef.current) {
        motionOriginRef.current = { yaw: sample.yaw, pitch: sample.pitch };
      }
      const dyaw = ((sample.yaw - motionOriginRef.current.yaw + 540) % 360) - 180;
      const dpitch = sample.pitch - motionOriginRef.current.pitch;
      setYaw(wrapYaw(lookOriginRef.current.yaw + dyaw));
      setPitch(Math.max(-80, Math.min(80, lookOriginRef.current.pitch + dpitch)));
    };
    window.addEventListener("deviceorientation", handleOrientation, { passive: true });
    return () => window.removeEventListener("deviceorientation", handleOrientation);
  }, [gyroActive]);

  const toggleGyro = async () => {
    if (gyroActive) {
      setGyroActive(false);
      setGyroNote(null);
      return;
    }
    if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) {
      setGyroNote("Gyroscope not detected on this device; drag to look around.");
      return;
    }
    try {
      const DOE = DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<"granted" | "denied">;
      };
      if (typeof DOE.requestPermission === "function") {
        const res = await DOE.requestPermission();
        if (res !== "granted") {
          setGyroNote("Gyro permission declined; drag to look around.");
          return;
        }
      }
      motionOriginRef.current = null;
      lookOriginRef.current = { yaw, pitch };
      setGyroActive(true);
      setGyroNote("Gyro active — move your phone to look around.");
    } catch {
      setGyroNote("Gyro unavailable here; drag to look around.");
    }
  };

  const toggleExpanded = async () => {
    const next = !expanded;
    setExpanded(next);
    if (stageRef.current) {
      try {
        if (next && stageRef.current.requestFullscreen) {
          await stageRef.current.requestFullscreen();
        } else if (!next && document.fullscreenElement) {
          await document.exitFullscreen();
        }
      } catch {
        // CSS expanded mode still works when Fullscreen API is restricted
      }
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointersRef.current.size === 2) {
      const pts = Array.from(activePointersRef.current.values());
      pinchDistRef.current = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      dragOrigin.current = null;
      return;
    }

    velocityRef.current = { yaw: 0, pitch: 0 };
    setDragging(true);
    dragOrigin.current = {
      x: e.clientX,
      y: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      yaw,
      pitch,
      moved: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    // Two-finger pinch-to-zoom on mobile touchscreens
    if (activePointersRef.current.size === 2) {
      const pts = Array.from(activePointersRef.current.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (pinchDistRef.current != null && dist > 8) {
        const ratio = pinchDistRef.current / dist;
        setFov((prev) => Math.max(35, Math.min(100, prev * ratio)));
      }
      pinchDistRef.current = dist;
      return;
    }

    if (!dragOrigin.current) return;
    const dx = e.clientX - dragOrigin.current.x;
    const dy = e.clientY - dragOrigin.current.y;
    const stepX = e.clientX - dragOrigin.current.lastX;
    const stepY = e.clientY - dragOrigin.current.lastY;
    dragOrigin.current.lastX = e.clientX;
    dragOrigin.current.lastY = e.clientY;

    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      dragOrigin.current.moved = true;
    }
    const speed = fov / 320;
    const nextYaw = wrapYaw(dragOrigin.current.yaw - dx * speed);
    const nextPitch = Math.max(-75, Math.min(75, dragOrigin.current.pitch + dy * speed * 0.75));
    velocityRef.current = {
      yaw: -stepX * speed * 0.55,
      pitch: stepY * speed * 0.45,
    };
    setYaw(nextYaw);
    setPitch(nextPitch);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(e.pointerId);
    if (activePointersRef.current.size < 2) {
      pinchDistRef.current = null;
    }
    const origin = dragOrigin.current;
    dragOrigin.current = null;
    setDragging(false);

    if (origin && !origin.moved && placingHotspot && onHotspotPlace && stageRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width - 0.5;
      const relY = 0.5 - (e.clientY - rect.top) / rect.height;
      const clickYaw = wrapYaw(yaw + relX * fov);
      const clickPitch = Math.max(-65, Math.min(65, pitch + relY * (fov * 0.6)));
      onHotspotPlace({
        yaw: Math.round(clickYaw),
        pitch: Math.round(clickPitch),
      });
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    setFov((prev) => Math.max(35, Math.min(100, prev + (e.deltaY > 0 ? 4 : -4))));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setYaw((y) => wrapYaw(y - 12));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setYaw((y) => wrapYaw(y + 12));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setPitch((p) => Math.min(75, p + 8));
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setPitch((p) => Math.max(-75, p - 8));
    }
  };

  const zoomScale = 75 / fov;
  const compassLabel = (() => {
    const deg = ((Math.round(yaw) % 360) + 360) % 360;
    const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const d = dirs[Math.round(deg / 45) % 8];
    return `${d} · ${deg}°`;
  })();

  const renderEyeViewport = (eyeOffsetDeg: number, eyeLabel?: string) => {
    const eyeYaw = wrapYaw(yaw + eyeOffsetDeg);
    const normX = (eyeYaw + 180) / 360;
    const normY = 0.5 - pitch / 160;
    const bgWidthPct = Math.round(240 * zoomScale);
    const bgHeightPct = Math.round(145 * zoomScale);
    const posX = `${Math.round(normX * 100)}%`;
    const posY = `${Math.max(5, Math.min(95, Math.round(normY * 100)))}%`;

    return (
      <div
        className={`immersive-eye-frame ${activeMode === "vr" ? "immersive-eye-vr" : ""}`}
        aria-label={eyeLabel}
      >
        {/* Instant CSS fallback layer */}
        <div
          className="immersive-equirect-layer"
          style={{
            backgroundImage: `url("${src}")`,
            backgroundSize: `${bgWidthPct}% ${bgHeightPct}%`,
            backgroundPosition: `${posX} ${posY}`,
          }}
        />
        {/* True WebGL 3D spherical equirectangular shader (from /pwa PanoramaViewer.ts) */}
        <WebGLEyeSphere src={src} yawDeg={eyeYaw} pitchDeg={pitch} fovDeg={fov} />
        {activeMode === "vr" && (
          <div className="immersive-vr-reticle" aria-hidden="true">
            <span />
          </div>
        )}
        {/* Render visible hotspots within FOV */}
        {hotspots.map((h) => {
          let dYaw = h.yaw - eyeYaw;
          if (dYaw > 180) dYaw -= 360;
          if (dYaw < -180) dYaw += 360;
          const dPitch = h.pitch - pitch;
          if (Math.abs(dYaw) > fov * 0.6 || Math.abs(dPitch) > fov * 0.45) return null;
          const leftPct = 50 + (dYaw / fov) * 100;
          const topPct = 50 - (dPitch / (fov * 0.65)) * 100;
          return (
            <button
              key={`${eyeLabel ?? "mono"}-${h.id}`}
              type="button"
              onClick={() => setSelectedHotspot(h)}
              style={{ left: `${leftPct}%`, top: `${topPct}%` }}
              className="immersive-hotspot-pin"
              aria-label={`Hotspot: ${h.title}`}
            >
              <span className="immersive-hotspot-dot" />
              <span className="immersive-hotspot-label">{h.title}</span>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <section
      ref={stageRef}
      data-testid="viewer-360"
      data-viewer-mode={activeMode}
      className={`immersive-viewer-card ${expanded ? "immersive-viewer-expanded" : ""}`}
      aria-label={`${title} — ${activeMode === "vr" ? "VR-style headset preview" : "Immersive 360 view"}`}
    >
      {/* Top status bar */}
      <div className="immersive-viewer-topbar">
        <div className="immersive-viewer-badges">
          <span className="immersive-mode-pill" data-testid="viewer-mode-badge">
            {activeMode === "vr" ? "VR-style preview · Headset preview" : "Immersive 360 view"}
          </span>
          <span className="immersive-compass-pill" aria-label="Viewing direction">
            {compassLabel}
          </span>
        </div>

        <div className="immersive-mode-switcher" role="group" aria-label="Viewer display mode">
          <button
            type="button"
            aria-pressed={activeMode === "360"}
            onClick={() => setMode("360")}
            className="immersive-chip-btn"
          >
            View 360
          </button>
          <button
            type="button"
            aria-pressed={gyroActive}
            onClick={toggleGyro}
            className="immersive-chip-btn"
            data-testid="viewer-gyro-btn"
          >
            {gyroActive ? "Gyro: On" : "Gyro"}
          </button>
          <button
            type="button"
            aria-pressed={activeMode === "vr"}
            onClick={() => setMode("vr")}
            className="immersive-chip-btn"
          >
            View in VR
          </button>
        </div>
      </div>

      {/* Interactive 360 / Stereoscopic VR viewport */}
      <div
        role="application"
        tabIndex={0}
        aria-label={`${title}. Drag or use arrow keys to look around 360 degrees.`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
        className={`immersive-canvas-stage ${
          activeMode === "vr" ? "immersive-stage-stereo" : "immersive-stage-mono"
        } ${dragging ? "cursor-grabbing" : placingHotspot ? "cursor-crosshair" : "cursor-grab"}`}
      >
        {activeMode === "360" ? (
          renderEyeViewport(0, "360 monoscopic view")
        ) : (
          <div className="immersive-stereo-pair" data-testid="vr-stereo-view">
            {renderEyeViewport(-2.5, "Left eye headset view")}
            <div className="immersive-stereo-divider" aria-hidden="true" />
            {renderEyeViewport(2.5, "Right eye headset view")}
          </div>
        )}

        {/* Subtle horizon hint overlay */}
        <div className="immersive-stage-caption">
          <span>{title}</span>
          <small>
            {placingHotspot
              ? "Tap anywhere on the sphere to place a story hotspot"
              : activeMode === "vr"
              ? "Stereoscopic split-screen preview · Rotate device to landscape for headset frame"
              : "Drag horizontally & vertically to look around · Rotate phone for landscape view"}
          </small>
        </div>
      </div>

      {/* Selected hotspot popover */}
      {selectedHotspot && (
        <div className="immersive-hotspot-card" role="status">
          <div>
            <strong>{selectedHotspot.title}</strong>
            <p>{selectedHotspot.caption}</p>
          </div>
          <button
            type="button"
            onClick={() => setSelectedHotspot(null)}
            className="immersive-chip-btn"
            aria-label="Close hotspot note"
          >
            Close
          </button>
        </div>
      )}

      {/* Aspect ratio / validation note if present */}
      {aspectWarning && (
        <p className="immersive-validation-note" role="status">
          {aspectWarning}
        </p>
      )}

      {gyroNote && (
        <p className="immersive-validation-note" role="status">
          {gyroNote}
        </p>
      )}

      {/* Bottom viewer control bar */}
      <div className="immersive-viewer-controls">
        <button
          type="button"
          onClick={() => {
            setYaw(0);
            setPitch(0);
            setFov(75);
          }}
          className="immersive-ctrl-btn"
          aria-label="Reset 360 view center"
        >
          Recenter
        </button>
        <button
          type="button"
          onClick={() => setFov((f) => Math.max(42, f - 12))}
          className="immersive-ctrl-btn"
          aria-label="Zoom in"
        >
          Zoom +
        </button>
        <button
          type="button"
          onClick={() => setFov((f) => Math.min(100, f + 12))}
          className="immersive-ctrl-btn"
          aria-label="Zoom out"
        >
          Zoom −
        </button>
        <button
          type="button"
          aria-pressed={gyroActive}
          onClick={toggleGyro}
          className="immersive-ctrl-btn"
          aria-label="Toggle motion sensor look-around"
        >
          {gyroActive ? "Motion: On" : "Motion tilt"}
        </button>
        <button
          type="button"
          aria-pressed={expanded}
          onClick={toggleExpanded}
          className="immersive-ctrl-btn"
          aria-label={expanded ? "Exit expanded landscape view" : "Expand viewer for landscape"}
        >
          {expanded ? "Compact view" : "Expand"}
        </button>
      </div>
    </section>
  );
}
