/**
 * Sensor-independent feature matching (ORB-style): Shi-Tomasi corners, intensity-centroid
 * orientation, 256-bit rotated-BRIEF descriptors, Hamming matching with a ratio test and a
 * mutual check. It replaces the old "search ±2.5° around the sensor prediction" patch search as
 * the FIRST alignment stage: browser gyro yaw is often 5–10° off between photos, which made the
 * patch search miss the true match entirely (corridor capture: 19/30 photos unmatched).
 *
 * Descriptors are per photo (computed once, reused for every pair and every round). The sensor
 * pose is used only as a generous prior to limit which features are compared.
 */

export interface FeatureSet {
  count: number;
  /** Pixel position in the (working-size) gray image. */
  x: Float32Array;
  y: Float32Array;
  /** Corner strength (min-eigenvalue), kept for diagnostics. */
  score: Float32Array;
  /** 8 × uint32 = 256-bit descriptor per feature. */
  desc: Uint32Array;
}

export interface TentativeMatch {
  a: number;
  b: number;
  distance: number;
  /** Shared by the (up to 3) hypotheses of one point when the point is ambiguous. */
  point: number;
  ambiguous: boolean;
}

const PATCH = 15; // descriptor patch radius (px at working size)
const MARGIN = PATCH + 3;

/** Fixed sampling pattern: 256 point pairs, Gaussian around the centre (σ = PATCH/2.2). */
const PATTERN: Int8Array = (() => {
  const out = new Int8Array(256 * 4);
  let s = 0x2545f491;
  const rnd = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) / 4294967296) || 1e-9;
  };
  const gauss = () => Math.sqrt(-2 * Math.log(rnd())) * Math.cos(2 * Math.PI * rnd());
  const clamp = (v: number) => Math.max(-PATCH + 1, Math.min(PATCH - 1, Math.round(v)));
  for (let k = 0; k < 256; k++) {
    for (let c = 0; c < 4; c++) out[k * 4 + c] = clamp(gauss() * (PATCH / 2.2));
  }
  return out;
})();

function boxBlur(src: Float32Array, w: number, h: number, radius: number): Float32Array {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const n = 2 * radius + 1;
  for (let y = 0; y < h; y++) {
    let sum = 0;
    const row = y * w;
    for (let x = -radius; x <= radius; x++) sum += src[row + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = sum / n;
      sum += src[row + Math.min(w - 1, x + radius + 1)] - src[row + Math.max(0, x - radius)];
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = -radius; y <= radius; y++) sum += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum / n;
      sum += tmp[Math.min(h - 1, y + radius + 1) * w + x] - tmp[Math.max(0, y - radius) * w + x];
    }
  }
  return out;
}

/**
 * Detects up to `maxFeatures` well-spread corners and describes them.
 * Local contrast is normalised first so dim/bright and warm/cool photos are comparable.
 */
export function detectFeatures(v: Float32Array, w: number, h: number, maxFeatures = 1400): FeatureSet {
  const empty: FeatureSet = { count: 0, x: new Float32Array(0), y: new Float32Array(0), score: new Float32Array(0), desc: new Uint32Array(0) };
  if (w <= 2 * MARGIN + 4 || h <= 2 * MARGIN + 4) return empty;

  // Local contrast normalisation: (v - localMean) / localStd — removes exposure and WB gain.
  const mean = boxBlur(v, w, h, 12);
  const sq = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) sq[i] = v[i] * v[i];
  const meanSq = boxBlur(sq, w, h, 12);
  const norm = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) {
    const sd = Math.sqrt(Math.max(1e-6, meanSq[i] - mean[i] * mean[i]));
    norm[i] = (v[i] - mean[i]) / Math.max(sd, 0.02);
  }
  const smooth = boxBlur(boxBlur(norm, w, h, 1), w, h, 1); // ≈ Gaussian σ 1.4, used for descriptors

  // Shi–Tomasi response on the lightly smoothed image.
  const ix2 = new Float32Array(v.length), iy2 = new Float32Array(v.length), ixy = new Float32Array(v.length);
  const base = boxBlur(norm, w, h, 1);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = (base[i + 1] - base[i - 1]) / 2;
      const gy = (base[i + w] - base[i - w]) / 2;
      ix2[i] = gx * gx;
      iy2[i] = gy * gy;
      ixy[i] = gx * gy;
    }
  }
  const sxx = boxBlur(ix2, w, h, 2), syy = boxBlur(iy2, w, h, 2), sxy = boxBlur(ixy, w, h, 2);
  const resp = new Float32Array(v.length);
  for (let y = MARGIN; y < h - MARGIN; y++) {
    for (let x = MARGIN; x < w - MARGIN; x++) {
      const i = y * w + x;
      const a = sxx[i], c = syy[i], b = sxy[i];
      resp[i] = (a + c) / 2 - Math.sqrt(((a - c) * (a - c)) / 4 + b * b);
    }
  }

  // Best corner per cell, cell size chosen so the grid yields ≈ maxFeatures × 1.3 candidates.
  const cell = Math.max(6, Math.round(Math.sqrt(((w - 2 * MARGIN) * (h - 2 * MARGIN)) / (maxFeatures * 1.3))));
  const cand: Array<{ x: number; y: number; s: number }> = [];
  let maxResp = 0;
  for (let i = 0; i < resp.length; i++) if (resp[i] > maxResp) maxResp = resp[i];
  const floor = maxResp * 0.01;
  for (let cy = MARGIN; cy < h - MARGIN; cy += cell) {
    for (let cx = MARGIN; cx < w - MARGIN; cx += cell) {
      let best = floor, bx = -1, by = -1;
      const ye = Math.min(cy + cell, h - MARGIN), xe = Math.min(cx + cell, w - MARGIN);
      for (let y = cy; y < ye; y++) {
        for (let x = cx; x < xe; x++) {
          const s = resp[y * w + x];
          if (s > best) { best = s; bx = x; by = y; }
        }
      }
      if (bx >= 0) cand.push({ x: bx, y: by, s: best });
    }
  }
  cand.sort((p, q) => q.s - p.s);
  const picked = cand.slice(0, maxFeatures);
  const n = picked.length;
  const out: FeatureSet = {
    count: n,
    x: new Float32Array(n),
    y: new Float32Array(n),
    score: new Float32Array(n),
    desc: new Uint32Array(n * 8)
  };

  const sampleAt = (px: number, py: number) => smooth[Math.round(py) * w + Math.round(px)];
  for (let k = 0; k < n; k++) {
    const { x, y, s } = picked[k];
    out.x[k] = x; out.y[k] = y; out.score[k] = s;
    // Orientation: intensity centroid inside a circular patch.
    let m10 = 0, m01 = 0;
    for (let dy = -PATCH; dy <= PATCH; dy++) {
      for (let dx = -PATCH; dx <= PATCH; dx++) {
        if (dx * dx + dy * dy > PATCH * PATCH) continue;
        const val = smooth[(y + dy) * w + x + dx];
        m10 += dx * val;
        m01 += dy * val;
      }
    }
    const angle = Math.atan2(m01, m10);
    const ca = Math.cos(angle), sa = Math.sin(angle);
    for (let bit = 0; bit < 256; bit++) {
      const x1 = PATTERN[bit * 4], y1 = PATTERN[bit * 4 + 1], x2 = PATTERN[bit * 4 + 2], y2 = PATTERN[bit * 4 + 3];
      const r1 = sampleAt(x + ca * x1 - sa * y1, y + sa * x1 + ca * y1);
      const r2 = sampleAt(x + ca * x2 - sa * y2, y + sa * x2 + ca * y2);
      if (r1 < r2) out.desc[k * 8 + (bit >> 5)] |= 1 << (bit & 31);
    }
  }
  return out;
}

function popcount32(v: number): number {
  v -= (v >>> 1) & 0x55555555;
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
  return (((v + (v >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

export function hamming(da: Uint32Array, ia: number, db: Uint32Array, ib: number): number {
  let d = 0;
  for (let k = 0; k < 8; k++) d += popcount32(da[ia * 8 + k] ^ db[ib * 8 + k]);
  return d;
}

export interface MatchOptions {
  ratio: number;
  maxDistance: number;
  /** Keep up to 3 near-equal hypotheses for points failing the ratio test (repeating structure). */
  ambiguousHypotheses: boolean;
}

/**
 * Matches the candidate subsets A of `fa` and B of `fb`. `dirA/dirB` are world directions (3 per
 * feature) predicted from the current poses; features are only compared when the directions are
 * within `cosGate` (a loose prior — sensor pose never decides the match).
 */
export function matchFeatures(
  fa: FeatureSet,
  fb: FeatureSet,
  candA: number[],
  candB: number[],
  dirA: Float32Array,
  dirB: Float32Array,
  cosGate: number,
  opt: MatchOptions
): { matches: TentativeMatch[] } {
  const bestForB = new Map<number, { a: number; d: number }>();
  const perA: Array<{ a: number; list: Array<{ b: number; d: number }> }> = [];
  for (const a of candA) {
    const ax = dirA[a * 3], ay = dirA[a * 3 + 1], az = dirA[a * 3 + 2];
    let b1 = -1, d1 = 1e9, d2 = 1e9, b2 = -1, b3 = -1, d3 = 1e9;
    for (const b of candB) {
      if (ax * dirB[b * 3] + ay * dirB[b * 3 + 1] + az * dirB[b * 3 + 2] < cosGate) continue;
      const d = hamming(fa.desc, a, fb.desc, b);
      if (d < d1) { d3 = d2; b3 = b2; d2 = d1; b2 = b1; d1 = d; b1 = b; }
      else if (d < d2) { d3 = d2; b3 = b2; d2 = d; b2 = b; }
      else if (d < d3) { d3 = d; b3 = b; }
      const cur = bestForB.get(b);
      if (!cur || d < cur.d) bestForB.set(b, { a, d });
    }
    if (b1 < 0 || d1 > opt.maxDistance) continue;
    const list = [{ b: b1, d: d1 }];
    if (d2 < 1e9) list.push({ b: b2, d: d2 });
    if (d3 < 1e9) list.push({ b: b3, d: d3 });
    perA.push({ a, list });
  }

  const out: TentativeMatch[] = [];
  let point = 0;
  for (const { a, list } of perA) {
    const [best, second] = list;
    const clear = !second || best.d < second.d * opt.ratio;
    if (clear) {
      // Mutual: b's closest a must be this a.
      if (bestForB.get(best.b)?.a !== a) continue;
      out.push({ a, b: best.b, distance: best.d, point: point++, ambiguous: false });
    } else if (opt.ambiguousHypotheses) {
      const near = list.filter((c) => c.d <= best.d + 10 && c.d <= opt.maxDistance);
      if (near.length < 2) continue;
      const id = point++;
      for (const c of near) out.push({ a, b: c.b, distance: c.d, point: id, ambiguous: true });
    }
  }
  return { matches: out };
}
