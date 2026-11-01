import { RasterImage } from './Reprojection';

export class Enhancement {
  static luminance(px: Uint8ClampedArray, i: number): number {
    return (77 * px[i] + 150 * px[i + 1] + 29 * px[i + 2]) >> 8;
  }

  static levels(
    image: RasterImage,
    low = 0.003,
    high = 0.998,
    maxGain = 1.3
  ): void {
    const w = image.width;
    const h = image.height;
    if (w <= 0 || h <= 0) return;

    const histogram = new Float64Array(256);
    let total = 0;
    const px = image.rgba;
    for (let y = 0; y < h; y++) {
      const weight = Math.cos(((y + 0.5) / h) * Math.PI - Math.PI / 2);
      for (let x = 0; x < w; x++) {
        histogram[Enhancement.luminance(px, (y * w + x) * 4)] += weight;
      }
      total += weight * w;
    }

    const percentile = (p: number): number => {
      let sum = 0;
      for (let value = 0; value < 256; value++) {
        sum += histogram[value];
        if (sum >= p * total) return value;
      }
      return 255;
    };

    let black = Math.min(percentile(low), 24);
    let white = Math.max(percentile(high), 200);
    if (255 / (white - black) > maxGain) {
      const excess = white - black - 255 / maxGain;
      black += excess / 2;
      white -= excess / 2;
    }
    if (black <= 0.5 && white >= 254.5) return;

    const lut = new Uint8Array(256);
    for (let v = 0; v < 256; v++) {
      const mapped = Math.round(((v - black) * 255) / (white - black));
      lut[v] = Math.min(255, Math.max(0, mapped));
    }
    for (let i = 0; i < px.length; i += 4) {
      px[i] = lut[px[i]];
      px[i + 1] = lut[px[i + 1]];
      px[i + 2] = lut[px[i + 2]];
    }
  }

  static localContrast(
    image: RasterImage,
    columns = 16,
    rows = 8,
    clip = 1.5,
    strength = 0.5
  ): void {
    const w = image.width;
    const h = image.height;
    if (columns < 2 || rows < 2 || w < columns * 8 || h < rows * 8 || strength <= 0) return;

    const curves = new Float32Array(columns * rows * 256);
    const px = image.rgba;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++) {
        const histogram = new Float32Array(256);
        const x0 = Math.floor((c * w) / columns);
        const x1 = Math.floor(((c + 1) * w) / columns);
        const y0 = Math.floor((r * h) / rows);
        const y1 = Math.floor(((r + 1) * h) / rows);

        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            histogram[Enhancement.luminance(px, (y * w + x) * 4)] += 1;
          }
        }
        const n = (x1 - x0) * (y1 - y0);
        const limit = Math.max(1, (clip * n) / 256);
        let sumMean = 0;
        for (let b = 0; b < 256; b++) sumMean += b * histogram[b];
        const mean = sumMean / n;

        let excess = 0;
        for (let b = 0; b < 256; b++) {
          if (histogram[b] > limit) {
            excess += histogram[b] - limit;
            histogram[b] = limit;
          }
        }
        let below = 0;
        const curve = new Float32Array(256);
        for (let b = 0; b < 256; b++) {
          const count = histogram[b] + excess / 256;
          curve[b] = ((below + count / 2) / n) * 255;
          below += count;
        }
        const m = Math.min(254, Math.floor(mean));
        const t = mean - m;
        const shift = curve[m] * (1 - t) + curve[m + 1] * t - mean;
        const baseIdx = (r * columns + c) * 256;
        for (let b = 0; b < 256; b++) {
          curves[baseIdx + b] = curve[b] - shift;
        }
      }
    }

    const protection = new Float32Array(256);
    for (let v = 0; v < 256; v++) {
      const t = Math.min(1, Math.max(0, (v - 170) / 85));
      protection[v] = strength * (1 - 0.75 * t * t * (3 - 2 * t));
    }

    const tileW = w / columns;
    const tileH = h / rows;
    const horizontal: Array<[number, number, number]> = [];
    for (let x = 0; x < w; x++) {
      const f = (x + 0.5) / tileW - 0.5;
      const c = Math.floor(f);
      horizontal.push([
        ((c % columns) + columns) % columns,
        (((c + 1) % columns) + columns) % columns,
        f - c
      ]);
    }

    const vertical: Array<[number, number, number]> = [];
    for (let y = 0; y < h; y++) {
      const f = Math.min(rows - 1, Math.max(0, (y + 0.5) / tileH - 0.5));
      const r = Math.min(rows - 2, Math.floor(f));
      vertical.push([r, r + 1, f - r]);
    }

    for (let y = 0; y < h; y++) {
      const [r0, r1, wy] = vertical[y];
      for (let x = 0; x < w; x++) {
        const [c0, c1, wx] = horizontal[x];
        const i = (y * w + x) * 4;
        const a = (r0 * columns + c0) * 256;
        const b = (r0 * columns + c1) * 256;
        const c = (r1 * columns + c0) * 256;
        const d = (r1 * columns + c1) * 256;
        const v = Enhancement.luminance(px, i);
        const mapped =
          (curves[a + v] * (1 - wx) + curves[b + v] * wx) * (1 - wy) +
          (curves[c + v] * (1 - wx) + curves[d + v] * wx) * wy;
        const delta = protection[v] * (mapped - v);
        px[i] = Math.min(255, Math.max(0, Math.round(px[i] + delta)));
        px[i + 1] = Math.min(255, Math.max(0, Math.round(px[i + 1] + delta)));
        px[i + 2] = Math.min(255, Math.max(0, Math.round(px[i + 2] + delta)));
      }
    }
  }

  /**
   * Seam-wrapped vibrance and luminance sharpening using a compact Uint8Array luma plane
   * (saves 75% scratch memory vs Float32Array at 4096x2048).
   */
  static finish(image: RasterImage, vibranceAmount = 0.15, sharpenAmount = 0.35): void {
    const w = image.width;
    const h = image.height;
    const px = image.rgba;
    const luma = new Uint8Array(w * h);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        let r = px[i] / 255;
        let g = px[i + 1] / 255;
        let b = px[i + 2] / 255;
        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        const sat = maxC - minC;
        const avg = (r + g + b) / 3;
        const amt = vibranceAmount * (1 - sat);
        r += (r - avg) * amt;
        g += (g - avg) * amt;
        b += (b - avg) * amt;
        px[i] = Math.min(255, Math.max(0, Math.round(r * 255)));
        px[i + 1] = Math.min(255, Math.max(0, Math.round(g * 255)));
        px[i + 2] = Math.min(255, Math.max(0, Math.round(b * 255)));
        luma[y * w + x] = (77 * px[i] + 150 * px[i + 1] + 29 * px[i + 2]) >> 8;
      }
    }

    if (sharpenAmount <= 0) return;

    // Denoise + sharpen in one pass, mirroring the iOS chain (CINoiseReduction then
    // CISharpenLuminance radius 1.5). The previous 3x3 sharpen ran with no denoise, so on
    // phone video frames it amplified sensor grain and JPEG blocks into visible crunch.
    //
    // detail = luma - blur(luma) with a 5-tap binomial blur (≈1.2 px radius, wraps at the
    // 360° seam). Differences below the noise threshold are attenuated (soft coring = noise
    // reduction); larger ones — real edges — are boosted by `sharpenAmount`.
    const blurH = new Uint16Array(w * h); // horizontal pass, x16 fixed point
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        const xm2 = (x - 2 + w) % w, xm1 = (x - 1 + w) % w, xp1 = (x + 1) % w, xp2 = (x + 2) % w;
        blurH[row + x] =
          luma[row + xm2] + 4 * luma[row + xm1] + 6 * luma[row + x] + 4 * luma[row + xp1] + luma[row + xp2];
      }
    }
    const noise = 3; // luma levels treated as noise (≈ CINoiseReduction level 0.012–0.015)
    for (let y = 0; y < h; y++) {
      const r0 = Math.max(0, y - 2) * w, r1 = Math.max(0, y - 1) * w, r2 = y * w;
      const r3 = Math.min(h - 1, y + 1) * w, r4 = Math.min(h - 1, y + 2) * w;
      for (let x = 0; x < w; x++) {
        const blur =
          (blurH[r0 + x] + 4 * blurH[r1 + x] + 6 * blurH[r2 + x] + 4 * blurH[r3 + x] + blurH[r4 + x]) / 256;
        const d = luma[r2 + x] - blur;
        const ad = Math.abs(d);
        const shaped =
          ad <= noise
            ? d * (ad / noise) // fade small noise toward the smoothed value
            : Math.sign(d) * (noise + (ad - noise) * (1 + sharpenAmount));
        const delta = shaped - d;
        if (delta > -0.5 && delta < 0.5) continue;
        const i = (r2 + x) * 4;
        px[i] = Math.min(255, Math.max(0, Math.round(px[i] + delta)));
        px[i + 1] = Math.min(255, Math.max(0, Math.round(px[i + 1] + delta)));
        px[i + 2] = Math.min(255, Math.max(0, Math.round(px[i + 2] + delta)));
      }
    }
  }
}
