/**
 * Per-photo quality checks run before a captured frame is accepted. Every capture path
 * (worker encode, canvas fallback, simulator, import) measures with this module and the app
 * applies one policy (FrameQuality.assess + the explicit accept/retake decision).
 *
 * Blur is judged by scale ratios rather than a raw sharpness number. Laplacian variance is
 * measured at three scales (2×2, 4×4 and 8×8 binned pixels; binning keeps sensor noise from
 * looking like detail):
 *  - blurRatio = fine / coarse: defocus and motion blur remove fine detail first;
 *  - structureRatio = coarse / very coarse: extreme blur also removes medium detail while the
 *    large shapes of a building remain — so a badly blurred facade is NOT mistaken for a plain
 *    wall. A plain wall or sky is quiet at every scale and is reported as low texture.
 * Ratios do not depend on resolution or on how textured the scene is.
 */
export interface FrameQualityMetrics {
  meanLuma: number; // 0..255
  darkFraction: number; // share of pixels with luma < 16
  shadowClippedFraction: number; // share of pixels with luma <= 4 (crushed to black)
  clippedFraction: number; // share of pixels with a channel >= 252
  fineDetail: number; // Laplacian variance at the fine scale
  coarseDetail: number; // Laplacian variance at the coarse scale
  veryCoarseDetail: number; // Laplacian variance at the very coarse scale
  blurRatio: number; // fineDetail / coarseDetail (lower = blurrier)
  structureRatio: number; // coarseDetail / veryCoarseDetail (lower = large shapes only)
  lowTexture: boolean; // quiet at every scale: blur cannot be judged (plain wall / sky)
  blurredStructure: boolean; // large shapes present but fine and medium detail gone
}

export type FrameQualityStatus = 'passed' | 'failed' | 'unavailable';

export interface FrameQualityVerdict {
  status: FrameQualityStatus;
  /** Convenience: status === 'passed'. */
  ok: boolean;
  /** Short user-facing reason when failed or unavailable. */
  reason: string | null;
  /** Passed, but with a caveat worth recording (e.g. low texture). */
  note: string | null;
}

export const QUALITY_LIMITS = {
  /** Mean luma below this: too dark to stitch or align. */
  minMeanLuma: 18,
  /** More than this share blown out: unusable. */
  maxClippedFraction: 0.6,
  /** More than this share crushed to black: unusable detail in the shadows. */
  maxShadowClippedFraction: 0.5,
  /** Coarse-scale Laplacian std-dev (luma levels) below this: little medium detail. */
  minTexture: 1.6,
  /** Very-coarse Laplacian std-dev above this: large shapes exist (so quiet ≠ plain). */
  minStructure: 3.0,
  /** Faint large shapes (std-dev) that, with a low blur ratio, still mean "blurred scene". */
  minFaintStructure: 1.2,
  /** Blur ratio below which a quiet frame with faint shapes is blur, not a plain surface. */
  quietBlurRatio: 0.9,
  /**
   * Absolute blur floor for the per-axis fine/coarse ratio (worse axis). Calibrated on 1/f
   * (natural-image) texture from 960x1280 frames at the 360x480 measuring size, with sensor
   * noise: sharp ≈ 1.82–1.91, 2 px defocus ≈ 1.2, 8 px motion ≈ 0.70, 16 px ≈ 0.38,
   * 48 px ≈ 0.56; plain wall ≈ 2.8 (low texture), sky gradient ≈ 2.0. NOT yet calibrated on
   * real phone frames.
   */
  minBlurRatio: 0.8,
  /** Reject when below this share of the median ratio of already accepted frames. */
  relativeBlur: 0.6,
  /** Accepted frames needed before the relative test is trusted. */
  historyForRelative: 3
} as const;

function bin(src: Float32Array, w: number, h: number): { v: Float32Array; w: number; h: number } {
  const bw = w >> 1;
  const bh = h >> 1;
  const v = new Float32Array(bw * bh);
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const i = 2 * y * w + 2 * x;
      v[y * bw + x] = (src[i] + src[i + 1] + src[i + w] + src[i + w + 1]) * 0.25;
    }
  }
  return { v, w: bw, h: bh };
}

/** Variance of the second derivative along x (axis 0) or y (axis 1). */
function directionalVariance(img: Float32Array, w: number, h: number, axis: 0 | 1): number {
  let sum = 0, sq = 0, n = 0;
  const step = axis === 0 ? 1 : w;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const d = 2 * img[i] - img[i - step] - img[i + step];
      sum += d;
      sq += d * d;
      n++;
    }
  }
  if (n === 0) return 0;
  const mean = sum / n;
  return sq / n - mean * mean;
}

function laplacianVariance(img: Float32Array, w: number, h: number): number {
  let sum = 0;
  let sq = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const l = 4 * img[i] - img[i - 1] - img[i + 1] - img[i - w] - img[i + w];
      sum += l;
      sq += l * l;
      n++;
    }
  }
  if (n === 0) return 0;
  const mean = sum / n;
  return sq / n - mean * mean;
}

export class FrameQuality {
  /** Metrics from RGBA pixels (ideally a ~480 px copy of the frame). Null if unusable input. */
  static measure(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): FrameQualityMetrics | null {
    const n = width * height;
    if (width < 32 || height < 32 || rgba.length < n * 4) return null;
    const luma = new Float32Array(n);
    let sum = 0, dark = 0, crushed = 0, clipped = 0;
    for (let p = 0; p < n; p++) {
      const i = p * 4;
      const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      luma[p] = l;
      sum += l;
      if (l < 16) dark++;
      if (l <= 4) crushed++;
      if (r >= 252 || g >= 252 || b >= 252) clipped++;
    }
    const fine = bin(luma, width, height);
    const coarse = bin(fine.v, fine.w, fine.h);
    const veryCoarse = bin(coarse.v, coarse.w, coarse.h);
    const fineDetail = laplacianVariance(fine.v, fine.w, fine.h);
    const coarseDetail = laplacianVariance(coarse.v, coarse.w, coarse.h);
    const veryCoarseDetail = laplacianVariance(veryCoarse.v, veryCoarse.w, veryCoarse.h);
    const quietMedium = Math.sqrt(coarseDetail) < QUALITY_LIMITS.minTexture;
    // Motion blur smears along ONE direction and leaves fine detail in the other, so the ratio
    // is measured per axis and the worse one is used (an isotropic Laplacian missed 16–48 px
    // one-directional smears).
    const axisRatio = (axis: 0 | 1) => {
      const f = directionalVariance(fine.v, fine.w, fine.h, axis);
      const c = directionalVariance(coarse.v, coarse.w, coarse.h, axis);
      return c > 1e-6 ? f / c : 0;
    };
    const blurRatio = coarseDetail > 1e-6 ? Math.min(axisRatio(0), axisRatio(1)) : 0;
    // Quiet frames: sensor noise keeps a genuinely plain surface's fine/coarse ratio high
    // (≈ 1.9–2.2 measured); blur pushes it down (≈ 0.6–0.75 measured). Visible large shapes
    // plus a low ratio = a blurred scene, not a plain one.
    const hasStructure =
      Math.sqrt(veryCoarseDetail) >= QUALITY_LIMITS.minStructure ||
      (Math.sqrt(veryCoarseDetail) >= QUALITY_LIMITS.minFaintStructure && blurRatio < QUALITY_LIMITS.quietBlurRatio);
    return {
      meanLuma: sum / n,
      darkFraction: dark / n,
      shadowClippedFraction: crushed / n,
      clippedFraction: clipped / n,
      fineDetail,
      coarseDetail,
      veryCoarseDetail,
      blurRatio,
      structureRatio: veryCoarseDetail > 1e-6 ? coarseDetail / veryCoarseDetail : 0,
      lowTexture: quietMedium && !hasStructure,
      blurredStructure: quietMedium && hasStructure
    };
  }

  /**
   * @param m metrics, or null when they could not be measured (→ 'unavailable', never 'passed')
   * @param acceptedRatios blur ratios of frames already accepted in this capture (textured ones)
   */
  static assess(m: FrameQualityMetrics | null, acceptedRatios: number[] = []): FrameQualityVerdict {
    const fail = (reason: string): FrameQualityVerdict => ({ status: 'failed', ok: false, reason, note: null });
    if (!m) {
      return { status: 'unavailable', ok: false, reason: 'Photo quality could not be measured', note: null };
    }
    if (m.meanLuma < QUALITY_LIMITS.minMeanLuma) return fail('Too dark — add light or hold steadier');
    if (m.clippedFraction > QUALITY_LIMITS.maxClippedFraction) return fail('Overexposed — avoid pointing at the sun');
    if (m.shadowClippedFraction > QUALITY_LIMITS.maxShadowClippedFraction) return fail('Shadows crushed to black — add light');
    if (m.blurredStructure) return fail('Very blurry — hold still');
    if (m.lowTexture) {
      // Plain sky/wall: blur cannot be judged and alignment will lean on the motion sensors.
      return { status: 'passed', ok: true, reason: null, note: 'Low-texture photo (plain surface)' };
    }
    if (m.blurRatio < QUALITY_LIMITS.minBlurRatio) return fail('Blurry — hold still');
    if (acceptedRatios.length >= QUALITY_LIMITS.historyForRelative) {
      const sorted = acceptedRatios.slice().sort((a, b) => a - b);
      const median = sorted[sorted.length >> 1];
      if (m.blurRatio < median * QUALITY_LIMITS.relativeBlur) {
        return fail('Blurry compared with your other photos — hold still');
      }
    }
    const note = m.clippedFraction > 0.25 ? 'Bright highlights clipped' : null;
    return { status: 'passed', ok: true, reason: null, note };
  }
}
