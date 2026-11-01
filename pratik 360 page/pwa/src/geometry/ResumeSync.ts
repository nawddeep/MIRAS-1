/**
 * Capture-resume integrity: camera identity checks and yaw-reference re-synchronisation.
 *
 * Relative orientation sensors (RelativeOrientationSensor, iOS deviceorientation) pick a new
 * arbitrary yaw reference whenever they restart. Pitch and roll are tied to gravity and stay
 * consistent; yaw does not. After a restart, the live view is matched against a stored photo
 * to measure the yaw change, which is then added to every new pose.
 */

export interface CameraIdentity {
  deviceId: string | null;
  label: string;
  /** Lens + stream-aspect key (see cameraKeyFor). */
  key: string;
  width: number;
  height: number;
  /** Focal length in pixels used for the frames (from the recorded intrinsics). */
  fx: number;
  /** Long-side field of view, degrees. */
  fov: number;
}

export interface CompatibilityResult {
  ok: boolean;
  problems: string[];
}

/**
 * Whether new photos from `current` can join a capture made with `saved`. Device ids are not
 * trusted alone (browsers may rotate them), so label, stream size and focal length are also
 * compared. Calibration changes between sessions are not a problem: the resumed session
 * re-uses the saved focal length.
 */
export function checkCameraCompatibility(saved: CameraIdentity | null, current: CameraIdentity): CompatibilityResult {
  if (!saved) {
    return { ok: false, problems: ['This capture has no saved camera identity (made by an older version), so a safe continuation cannot be verified. Start a new capture.'] };
  }
  const problems: string[] = [];
  const norm = (s: string) => s.trim().toLowerCase();
  if (saved.label && current.label && norm(saved.label) !== norm(current.label)) {
    problems.push(`Different camera: the capture used “${saved.label}”, now “${current.label}”.`);
  }
  const sameSize =
    (saved.width === current.width && saved.height === current.height);
  if (!sameSize) {
    const rotated = saved.width === current.height && saved.height === current.width;
    problems.push(
      rotated
        ? `The phone is held the other way (${current.width}×${current.height} instead of ${saved.width}×${saved.height}). Hold it as before.`
        : `Different camera format: ${current.width}×${current.height} instead of ${saved.width}×${saved.height}.`
    );
  }
  if (!saved.label && !current.label && saved.deviceId && current.deviceId && saved.deviceId !== current.deviceId && !sameSize) {
    problems.push('A different camera device appears to be active.');
  }
  return { ok: problems.length === 0, problems };
}

/** Grayscale image for matching. */
export interface GrayImage {
  width: number;
  height: number;
  v: Float32Array;
}

export function grayFromRGBA(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): GrayImage {
  const v = new Float32Array(width * height);
  for (let p = 0; p < width * height; p++) {
    v[p] = 0.299 * rgba[p * 4] + 0.587 * rgba[p * 4 + 1] + 0.114 * rgba[p * 4 + 2];
  }
  return { width, height, v };
}

/**
 * Translation of `live` relative to `ref` by normalised cross-correlation over the overlap:
 * live(x, y) ≈ ref(x + dx, y + dy). Coarse search (step 2) then ±1 px refinement.
 * `score` is the NCC (−1..1); `distinct` is best minus the best score ≥ 4 px away (repetition check).
 */
export function estimateShift(
  live: GrayImage,
  ref: GrayImage,
  maxShift: number
): { dx: number; dy: number; score: number; distinct: number } {
  const w = Math.min(live.width, ref.width);
  const h = Math.min(live.height, ref.height);
  const ncc = (dx: number, dy: number): number => {
    let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0, n = 0;
    const x0 = Math.max(0, -dx), x1 = Math.min(w, w - dx);
    const y0 = Math.max(0, -dy), y1 = Math.min(h, h - dy);
    if (x1 - x0 < w * 0.4 || y1 - y0 < h * 0.4) return -1; // too little overlap
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const a = live.v[y * live.width + x];
        const b = ref.v[(y + dy) * ref.width + x + dx];
        sa += a; sb += b; saa += a * a; sbb += b * b; sab += a * b; n++;
      }
    }
    const va = saa - (sa * sa) / n, vb = sbb - (sb * sb) / n;
    return va > 1e-6 && vb > 1e-6 ? (sab - (sa * sb) / n) / Math.sqrt(va * vb) : -1;
  };
  const coarse: Array<[number, number, number]> = [];
  for (let dy = -maxShift; dy <= maxShift; dy += 2) {
    for (let dx = -maxShift; dx <= maxShift; dx += 2) coarse.push([ncc(dx, dy), dx, dy]);
  }
  coarse.sort((p, q) => q[0] - p[0]);
  let best = coarse[0] ?? [-1, 0, 0];
  for (let dy = best[2] - 1; dy <= best[2] + 1; dy++) {
    for (let dx = best[1] - 1; dx <= best[1] + 1; dx++) {
      const s = ncc(dx, dy);
      if (s > best[0]) best = [s, dx, dy];
    }
  }
  const second = coarse.find((c) => Math.max(Math.abs(c[1] - best[1]), Math.abs(c[2] - best[2])) >= 4);
  return { dx: best[1], dy: best[2], score: best[0], distinct: best[0] - (second ? second[0] : -1) };
}

/**
 * Yaw offset (degrees) to add to new sensor readings so they match the stored photos' frame.
 *
 * @param refTransform stored reference frame (camera→world, column-major, old reference)
 * @param fxSmall focal length in pixels at the matching resolution
 * @param shift live(x, y) ≈ ref(x + dx, y + dy) at the matching resolution
 * @param liveYaw, livePitch current camera direction from the restarted sensor (degrees, raw)
 */
export function yawOffsetFromShift(
  refTransform: number[],
  fxSmall: number,
  shift: { dx: number; dy: number },
  liveYaw: number,
  livePitch: number
): { offsetDeg: number; pitchDisagreementDeg: number } {
  // Live camera forward, expressed in the reference camera: the ray through ref pixel
  // (centre + shift). Camera coords: x right, y up, −z forward.
  const rx = shift.dx / fxSmall;
  const ry = -shift.dy / fxSmall;
  const l = Math.sqrt(rx * rx + ry * ry + 1);
  const c = [rx / l, ry / l, -1 / l];
  const t = refTransform;
  const wx = t[0] * c[0] + t[4] * c[1] + t[8] * c[2];
  const wy = t[1] * c[0] + t[5] * c[1] + t[9] * c[2];
  const wz = t[2] * c[0] + t[6] * c[1] + t[10] * c[2];
  const oldYaw = (Math.atan2(wx, -wz) * 180) / Math.PI;
  const oldPitch = (Math.asin(Math.max(-1, Math.min(1, wy))) * 180) / Math.PI;
  let offset = oldYaw - liveYaw;
  offset = ((offset + 540) % 360) - 180;
  return { offsetDeg: offset, pitchDisagreementDeg: Math.abs(oldPitch - livePitch) };
}

/** Acceptance rule for an automatic re-sync measurement. */
export function syncIsReliable(m: { score: number; distinct: number }, pitchDisagreementDeg: number): boolean {
  return m.score >= 0.75 && m.distinct >= 0.08 && pitchDisagreementDeg <= 3;
}
