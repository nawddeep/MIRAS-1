// Integrated client-side 360° spherical geometry, guided shot planner,
// multi-photo equirectangular stitcher, and GPano XMP metadata encoder
// adapted from /pwa/src.

export interface SphericalTarget {
  id: string;
  yaw: number;
  pitch: number;
  ring: string;
  captured?: boolean;
  previewDataUrl?: string;
}

export type RingLayoutMode = "multi-ring" | "horizon-only";

export interface StitchFrameInput {
  id: string;
  label: string;
  yaw: number;
  pitch: number;
  roll?: number;
  fovH?: number;
  imageData: ImageData;
}

export interface StitchProgress {
  phase: string;
  percent: number;
}

export interface StitchOutput {
  width: number;
  height: number;
  dataUrl: string;
  thumbnailDataUrl: string;
  frameCount: number;
}

export const Math3D = {
  degToRad: (d: number): number => (d * Math.PI) / 180,
  radToDeg: (r: number): number => (r * 180) / Math.PI,

  sphericalToCartesian(yawDeg: number, pitchDeg: number): [number, number, number] {
    const yaw = Math3D.degToRad(yawDeg);
    const pitch = Math3D.degToRad(pitchDeg);
    const cp = Math.cos(pitch);
    return [cp * Math.sin(yaw), Math.sin(pitch), cp * Math.cos(yaw)];
  },

  angularDistanceDeg(yaw1: number, pitch1: number, yaw2: number, pitch2: number): number {
    const [x1, y1, z1] = Math3D.sphericalToCartesian(yaw1, pitch1);
    const [x2, y2, z2] = Math3D.sphericalToCartesian(yaw2, pitch2);
    const dot = Math.max(-1, Math.min(1, x1 * x2 + y1 * y2 + z1 * z2));
    return Math3D.radToDeg(Math.acos(dot));
  },
};

/**
 * Generates guided spherical capture targets from /pwa/src/geometry/SphericalGeometry.ts
 */
export function generateGuidedTargets(mode: RingLayoutMode = "horizon-only"): SphericalTarget[] {
  const targets: SphericalTarget[] = [];
  // Horizon ring (8 targets around 360° for fast mobile capture, or 12 in full multi-ring)
  const horizonSteps = mode === "horizon-only" ? 8 : 8;
  for (let i = 0; i < horizonSteps; i++) {
    const yaw = -180 + i * (360 / horizonSteps);
    targets.push({ id: `H_${i}`, yaw, pitch: 0, ring: "horizon" });
  }
  if (mode === "multi-ring") {
    for (let i = 0; i < 4; i++) {
      targets.push({ id: `U_${i}`, yaw: -180 + i * 90, pitch: 40, ring: "up" });
      targets.push({ id: `D_${i}`, yaw: -180 + i * 90, pitch: -40, ring: "down" });
    }
  }
  return targets;
}

/**
 * Assigns yaw/pitch orientations to an uploaded list of photos based on layout mode
 * (adapted from /pwa/src/ui/App.ts & /pwa/src/geometry/SphericalGeometry.ts)
 */
export function assignOrientationsToPhotos(
  count: number,
  layout: RingLayoutMode
): Array<{ yaw: number; pitch: number; ring: string }> {
  if (count <= 0) return [];
  if (layout === "horizon-only" || count < 10) {
    const step = 360 / count;
    return Array.from({ length: count }, (_, idx) => ({
      yaw: -180 + idx * step,
      pitch: 0,
      ring: "horizon",
    }));
  }

  // Multi-ring distribution
  const horizonCount = Math.max(4, Math.round(count * 0.5));
  const upCount = Math.max(2, Math.round((count - horizonCount) * 0.5));
  const downCount = Math.max(0, count - horizonCount - upCount);
  const result: Array<{ yaw: number; pitch: number; ring: string }> = [];

  for (let i = 0; i < horizonCount; i++) {
    result.push({ yaw: -180 + i * (360 / horizonCount), pitch: 0, ring: "horizon" });
  }
  for (let i = 0; i < upCount; i++) {
    result.push({ yaw: -180 + i * (360 / upCount), pitch: 38, ring: "up" });
  }
  for (let i = 0; i < downCount; i++) {
    result.push({ yaw: -180 + i * (360 / Math.max(1, downCount)), pitch: -38, ring: "down" });
  }
  return result;
}

/**
 * Reprojects and feather-blends multiple perspective frames onto a 2:1 equirectangular canvas.
 * Adapted from /pwa/src/geometry/SphericalGeometry.ts (Reprojection + Feathering).
 */
export async function stitchFramesToEquirectangular(
  frames: StitchFrameInput[],
  options: {
    outWidth?: number;
    outHeight?: number;
    defaultFovH?: number;
    onProgress?: (p: StitchProgress) => void;
  } = {}
): Promise<StitchOutput> {
  const outWidth = options.outWidth ?? 1600;
  const outHeight = options.outHeight ?? 800;
  const defaultFovH = options.defaultFovH ?? 75;

  options.onProgress?.({ phase: "Preparing spherical projection...", percent: 8 });

  const accumR = new Float32Array(outWidth * outHeight);
  const accumG = new Float32Array(outWidth * outHeight);
  const accumB = new Float32Array(outWidth * outHeight);
  const accumW = new Float32Array(outWidth * outHeight);

  for (let fIdx = 0; fIdx < frames.length; fIdx++) {
    const f = frames[fIdx];
    const sw = f.imageData.width;
    const sh = f.imageData.height;
    const sData = f.imageData.data;

    const fovH = Math3D.degToRad(f.fovH ?? defaultFovH);
    const focal = (sw * 0.5) / Math.tan(fovH * 0.5);

    const [fx, fy, fz] = Math3D.sphericalToCartesian(f.yaw, f.pitch);
    // Right vector = normalize(cross(forward, up=[0,1,0]))
    let rx = fz;
    const ry = 0;
    let rz = -fx;
    const rLen = Math.hypot(rx, ry, rz) || 1;
    rx /= rLen;
     rz /= rLen;
    // True up vector = cross(right, forward)
    const ux = ry * fz - rz * fy;
    const uy = rz * fx - rx * fz;
    const uz = rx * fy - ry * fx;

    for (let y = 0; y < outHeight; y++) {
      const lat = (0.5 - y / outHeight) * Math.PI;
      const cosLat = Math.cos(lat);
      const sinLat = Math.sin(lat);

      for (let x = 0; x < outWidth; x++) {
        const lon = (x / outWidth - 0.5) * 2 * Math.PI;
        const wx = cosLat * Math.sin(lon);
        const wy = sinLat;
        const wz = cosLat * Math.cos(lon);

        // Dot with camera forward
        const cz = wx * fx + wy * fy + wz * fz;
        if (cz <= 0.05) continue;

        const cx = wx * rx + wy * ry + wz * rz;
        const cy = wx * ux + wy * uy + wz * uz;

        const px = (cx / cz) * focal + sw * 0.5;
        const py = (-cy / cz) * focal + sh * 0.5;

        if (px < 0 || px >= sw - 1 || py < 0 || py >= sh - 1) continue;

        // Cosine-raised feather weight from frame center
        const nx = (px - sw * 0.5) / (sw * 0.5);
        const ny = (py - sh * 0.5) / (sh * 0.5);
        const r2 = nx * nx + ny * ny;
        if (r2 >= 1) continue;
        const weight = Math.pow(1 - r2, 1.6);

        const ix = Math.floor(px);
        const iy = Math.floor(py);
        const sIdx = (iy * sw + ix) * 4;

        const outIdx = y * outWidth + x;
        accumR[outIdx] += sData[sIdx] * weight;
        accumG[outIdx] += sData[sIdx + 1] * weight;
        accumB[outIdx] += sData[sIdx + 2] * weight;
        accumW[outIdx] += weight;
      }
    }

    const pct = Math.min(88, Math.round(12 + ((fIdx + 1) / frames.length) * 74));
    options.onProgress?.({
      phase: `Blended frame ${fIdx + 1} of ${frames.length}...`,
      percent: pct,
    });
    await new Promise((r) => setTimeout(r, 10));
  }

  options.onProgress?.({ phase: "Completing zenith & nadir sky fill...", percent: 94 });

  const canvas = document.createElement("canvas");
  canvas.width = outWidth;
  canvas.height = outHeight;
  const ctx = canvas.getContext("2d")!;
  const outImg = ctx.createImageData(outWidth, outHeight);
  const dst = outImg.data;

  // Ambient Udaipur lake-and-sandstone gradient for uncovered zenith/nadir pixels
  for (let y = 0; y < outHeight; y++) {
    const v = y / outHeight;
    const skyR = Math.round(215 - v * 65);
    const skyG = Math.round(228 - v * 65);
    const skyB = Math.round(234 - v * 60);

    for (let x = 0; x < outWidth; x++) {
      const idx = y * outWidth + x;
      const pIdx = idx * 4;
      const w = accumW[idx];
      if (w > 1e-4) {
        const blend = Math.min(1, w * 2.5);
        const r = accumR[idx] / w;
        const g = accumG[idx] / w;
        const b = accumB[idx] / w;
        dst[pIdx] = Math.round(r * blend + skyR * (1 - blend));
        dst[pIdx + 1] = Math.round(g * blend + skyG * (1 - blend));
        dst[pIdx + 2] = Math.round(b * blend + skyB * (1 - blend));
        dst[pIdx + 3] = 255;
      } else {
        dst[pIdx] = skyR;
        dst[pIdx + 1] = skyG;
        dst[pIdx + 2] = skyB;
        dst[pIdx + 3] = 255;
      }
    }
  }

  ctx.putImageData(outImg, 0, 0);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
  const thumbnailDataUrl = createThumbnailFromCanvas(canvas, 360, 180);

  options.onProgress?.({ phase: "360° panorama ready", percent: 100 });

  return {
    width: outWidth,
    height: outHeight,
    dataUrl,
    thumbnailDataUrl,
    frameCount: frames.length,
  };
}

/**
 * Generates a calibrated 2:1 equirectangular 360° heritage scene on-device
 * (adapted from /pwa/src/geometry/SyntheticFixture.ts with Udaipur architectural motifs).
 */
export function generateSynthetic360Scene(options: {
  preset: "dawn-ghat" | "golden-courtyard" | "night-lake";
  showGrid?: boolean;
  width?: number;
  height?: number;
}): { dataUrl: string; thumbnailDataUrl: string; width: number; height: number } {
  const width = options.width ?? 1600;
  const height = options.height ?? 800;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  const palettes = {
    "dawn-ghat": {
      zenith: "#8c9cc0",
      upperSky: "#d7e8ed",
      horizon: "#f5d7aa",
      waterTop: "#8fb0d6",
      waterDeep: "#243b42",
      arch: "#f1e6d6",
      accent: "#f0a140",
    },
    "golden-courtyard": {
      zenith: "#7a5a48",
      upperSky: "#d9774a",
      horizon: "#f7d08a",
      waterTop: "#b8703f",
      waterDeep: "#2c1e16",
      arch: "#f3d7a8",
      accent: "#f0a140",
    },
    "night-lake": {
      zenith: "#0b1128",
      upperSky: "#172044",
      horizon: "#2e3a63",
      waterTop: "#131b31",
      waterDeep: "#080d0f",
      arch: "#3a4466",
      accent: "#f0a140",
    },
  };

  const pal = palettes[options.preset];
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, pal.zenith);
  grad.addColorStop(0.35, pal.upperSky);
  grad.addColorStop(0.5, pal.horizon);
  grad.addColorStop(0.52, pal.waterTop);
  grad.addColorStop(1, pal.waterDeep);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Aravalli hills silhouette wrapping 360° seamlessly
  ctx.fillStyle = options.preset === "night-lake" ? "#101729" : "#49656b";
  ctx.beginPath();
  ctx.moveTo(0, height * 0.5);
  for (let x = 0; x <= width; x += 8) {
    const lon = (x / width) * Math.PI * 2;
    const h =
      Math.sin(lon * 2) * 28 +
      Math.cos(lon * 5) * 16 +
      Math.sin(lon * 9) * 7 +
      34;
    ctx.lineTo(x, height * 0.5 - Math.max(4, h));
  }
  ctx.lineTo(width, height * 0.5);
  ctx.closePath();
  ctx.fill();

  // Rajput ghat pavilions & chhatri domes at cardinal points
  ctx.fillStyle = pal.arch;
  const pavilionLongitudes = [0.15, 0.42, 0.68, 0.88];
  for (const pos of pavilionLongitudes) {
    const cx = width * pos;
    const baseY = height * 0.5;
    // Plinth
    ctx.fillRect(cx - 56, baseY - 46, 112, 46);
    // Columns
    ctx.fillStyle = pal.waterDeep;
    for (let c = -36; c <= 36; c += 24) {
      ctx.fillRect(cx + c - 6, baseY - 38, 12, 38);
    }
    // Dome (Chhatri)
    ctx.fillStyle = pal.arch;
    ctx.beginPath();
    ctx.arc(cx, baseY - 46, 36, Math.PI, 0);
    ctx.fill();
    // Spire
    ctx.fillStyle = pal.accent;
    ctx.fillRect(cx - 2, baseY - 94, 4, 14);
  }

  // Water reflections
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = pal.horizon;
  for (let y = Math.floor(height * 0.52); y < height * 0.88; y += 6) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();

  if (options.showGrid !== false) {
    // Calibrated spherical latitude/longitude grid and compass bearings from /pwa SyntheticFixture
    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.24)";
    ctx.lineWidth = 1.2;

    for (let lonStep = 0; lonStep < 12; lonStep++) {
      const x = (lonStep / 12) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let latStep = 1; latStep < 6; latStep++) {
      const y = (latStep / 6) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Horizon line
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, height * 0.5);
    ctx.lineTo(width, height * 0.5);
    ctx.stroke();

    // Cardinal markers
    const cardinals: Array<[string, number]> = [
      ["N · 0°", 0.5],
      ["E · +90°", 0.75],
      ["S · 180°", 0.02],
      ["W · -90°", 0.25],
    ];
    ctx.font = "600 18px sans-serif";
    ctx.fillStyle = "#ffffff";
    for (const [label, ratio] of cardinals) {
      const x = width * ratio;
      ctx.fillText(label, x + 8, height * 0.5 - 12);
    }
    ctx.restore();
  }

  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  const thumbnailDataUrl = createThumbnailFromCanvas(canvas, 360, 180);
  return { dataUrl, thumbnailDataUrl, width, height };
}

export function createThumbnailFromCanvas(
  source: HTMLCanvasElement | HTMLImageElement,
  thumbWidth = 360,
  thumbHeight = 180
): string {
  const thumb = document.createElement("canvas");
  thumb.width = thumbWidth;
  thumb.height = thumbHeight;
  const tctx = thumb.getContext("2d");
  if (tctx) {
    tctx.drawImage(source, 0, 0, thumbWidth, thumbHeight);
  }
  return thumb.toDataURL("image/jpeg", 0.8);
}

/**
 * Injects standard Google Photo Sphere (GPano) XMP metadata into a JPEG ArrayBuffer
 * Adapted directly from /pwa/src/services/ImageCodec.ts
 */
export function injectGPanoXMP(jpegBuffer: ArrayBuffer, width: number, height: number): ArrayBuffer {
  const src = new Uint8Array(jpegBuffer);
  if (src.length < 4 || src[0] !== 0xff || src[1] !== 0xd8) {
    return jpegBuffer;
  }

  const xmpPayload = `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" xmlns:GPano="http://ns.google.com/photos/1.0/panorama/">
      <GPano:UsePanoramaViewer>True</GPano:UsePanoramaViewer>
      <GPano:CaptureSoftware>MIRAS 360 Studio</GPano:CaptureSoftware>
      <GPano:StitchingSoftware>MIRAS Spherical Stitcher</GPano:StitchingSoftware>
      <GPano:ProjectionType>equirectangular</GPano:ProjectionType>
      <GPano:PoseHeadingDegrees>0.0</GPano:PoseHeadingDegrees>
      <GPano:InitialViewHeadingDegrees>0</GPano:InitialViewHeadingDegrees>
      <GPano:InitialViewPitchDegrees>0</GPano:InitialViewPitchDegrees>
      <GPano:InitialViewRollDegrees>0</GPano:InitialViewRollDegrees>
      <GPano:InitialHorizontalFOVDegrees>75.0</GPano:InitialHorizontalFOVDegrees>
      <GPano:CroppedAreaLeftPixels>0</GPano:CroppedAreaLeftPixels>
      <GPano:CroppedAreaTopPixels>0</GPano:CroppedAreaTopPixels>
      <GPano:CroppedAreaImageWidthPixels>${width}</GPano:CroppedAreaImageWidthPixels>
      <GPano:CroppedAreaImageHeightPixels>${height}</GPano:CroppedAreaImageHeightPixels>
      <GPano:FullPanoWidthPixels>${width}</GPano:FullPanoWidthPixels>
      <GPano:FullPanoHeightPixels>${height}</GPano:FullPanoHeightPixels>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;

  const namespace = "http://ns.adobe.com/xap/1.0/\0";
  const enc = new TextEncoder();
  const nsBytes = enc.encode(namespace);
  const xmlBytes = enc.encode(xmpPayload);

  const segmentLength = 2 + nsBytes.length + xmlBytes.length;
  const app1 = new Uint8Array(2 + segmentLength);
  app1[0] = 0xff;
  app1[1] = 0xe1;
  app1[2] = (segmentLength >> 8) & 0xff;
  app1[3] = segmentLength & 0xff;
  app1.set(nsBytes, 4);
  app1.set(xmlBytes, 4 + nsBytes.length);

  const out = new Uint8Array(src.length + app1.length);
  out.set(src.subarray(0, 2), 0);
  out.set(app1, 2);
  out.set(src.subarray(2), 2 + app1.length);
  return out.buffer;
}
