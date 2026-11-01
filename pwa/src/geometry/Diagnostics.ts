import { RasterImage } from './Reprojection';
import type { SeamLabelGrid } from './Reprojection';

/**
 * Visual stitch diagnostics, built from the blended panorama BEFORE gap filling:
 *  - coverage mask: white = photographed, black = no photo (what any fill would invent);
 *  - overview: dimmed panorama tinted by which photo supplied the detail, seam lines in
 *    white, regions of difference (people / parallax / misalignment given to one photo) in
 *    magenta, unphotographed areas in red, likely-ghosting spots circled in yellow.
 */
export class Diagnostics {
  static readonly WIDTH = 1024;

  static build(
    raster: RasterImage,
    seams: SeamLabelGrid | null,
    ghostRisk: Array<{ yaw: number; pitch: number }>
  ): { overview: RasterImage; mask: RasterImage } {
    const W = Diagnostics.WIDTH;
    const H = W / 2;
    const overview = new Uint8ClampedArray(W * H * 4);
    const mask = new Uint8ClampedArray(W * H * 4);
    const hue = (label: number): [number, number, number] => {
      // Golden-angle hues so neighbouring photos get clearly different tints.
      const h = (label * 137.508) % 360;
      const f = (n: number) => {
        const k = (n + h / 60) % 6;
        return 0.5 - 0.5 * Math.max(-1, Math.min(k - 3, 4 - k, 1));
      };
      return [f(5), f(3), f(1)];
    };
    const labelAt = (x: number, y: number): number => {
      if (!seams) return 255;
      const gx = Math.min(seams.width - 1, Math.floor((x * seams.width) / W));
      const gy = Math.min(seams.height - 1, Math.floor((y * seams.height) / H));
      return seams.labels[gy * seams.width + gx];
    };
    const hardAt = (x: number, y: number): boolean => {
      if (!seams || !seams.hard || seams.hard.length !== seams.labels.length) return false;
      const gx = Math.min(seams.width - 1, Math.floor((x * seams.width) / W));
      const gy = Math.min(seams.height - 1, Math.floor((y * seams.height) / H));
      return seams.hard[gy * seams.width + gx] === 1;
    };

    for (let y = 0; y < H; y++) {
      const sy = Math.min(raster.height - 1, Math.floor(((y + 0.5) * raster.height) / H));
      for (let x = 0; x < W; x++) {
        const sx = Math.min(raster.width - 1, Math.floor(((x + 0.5) * raster.width) / W));
        const si = (sy * raster.width + sx) * 4;
        const o = (y * W + x) * 4;
        const covered = raster.rgba[si + 3] > 0;
        mask[o] = mask[o + 1] = mask[o + 2] = covered ? 255 : 0;
        mask[o + 3] = 255;
        if (!covered) {
          overview[o] = 200; overview[o + 1] = 30; overview[o + 2] = 30; overview[o + 3] = 255;
          continue;
        }
        const g = (0.299 * raster.rgba[si] + 0.587 * raster.rgba[si + 1] + 0.114 * raster.rgba[si + 2]) * 0.55;
        const label = labelAt(x, y);
        let [r, gg, b] = label === 255 ? [0.5, 0.5, 0.5] : hue(label);
        if (hardAt(x, y)) [r, gg, b] = [1, 0.1, 0.9];
        const seamLine =
          label !== 255 &&
          (labelAt((x + 1) % W, y) !== label || labelAt(x, Math.min(H - 1, y + 1)) !== label);
        if (seamLine) {
          overview[o] = overview[o + 1] = overview[o + 2] = 255;
        } else {
          overview[o] = g * 0.6 + r * 100;
          overview[o + 1] = g * 0.6 + gg * 100;
          overview[o + 2] = g * 0.6 + b * 100;
        }
        overview[o + 3] = 255;
      }
    }

    // Yellow rings at likely-ghosting spots (radius ≈ 5°).
    for (const spot of ghostRisk) {
      const cx = ((spot.yaw + 180) / 360) * W;
      const cy = ((90 - spot.pitch) / 180) * H;
      const rad = (5 / 360) * W;
      for (let t = 0; t < 360; t += 1) {
        const a = (t * Math.PI) / 180;
        for (const rr of [rad, rad + 1]) {
          const px = Math.round(cx + rr * Math.cos(a));
          const py = Math.round(cy + rr * Math.sin(a));
          if (py < 0 || py >= H) continue;
          const o = (py * W + (((px % W) + W) % W)) * 4;
          overview[o] = 255; overview[o + 1] = 220; overview[o + 2] = 0;
        }
      }
    }
    return { overview: new RasterImage(W, H, overview), mask: new RasterImage(W, H, mask) };
  }

  /**
   * Verified-match / residual map: dimmed panorama with each sampled verified match drawn
   * at its position, coloured by its final alignment error — green < 1 px, yellow < 2 px,
   * red ≥ 2 px. Clusters of red mark parallax, movement or residual misalignment.
   */
  static matchMap(
    raster: RasterImage,
    points: Array<{ x: number; y: number; z: number; errorPx: number }>
  ): RasterImage {
    const W = Diagnostics.WIDTH;
    const H = W / 2;
    const px = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) {
      const sy = Math.min(raster.height - 1, Math.floor(((y + 0.5) * raster.height) / H));
      for (let x = 0; x < W; x++) {
        const sx = Math.min(raster.width - 1, Math.floor(((x + 0.5) * raster.width) / W));
        const si = (sy * raster.width + sx) * 4;
        const o = (y * W + x) * 4;
        const g = raster.rgba[si + 3] > 0 ? (0.299 * raster.rgba[si] + 0.587 * raster.rgba[si + 1] + 0.114 * raster.rgba[si + 2]) * 0.35 : 0;
        px[o] = px[o + 1] = px[o + 2] = g;
        px[o + 3] = 255;
      }
    }
    for (const p of points) {
      const yaw = Math.atan2(p.x, -p.z);
      const pitch = Math.asin(Math.max(-1, Math.min(1, p.y)));
      const cx = Math.round(((yaw / (2 * Math.PI)) + 0.5) * W);
      const cy = Math.round((0.5 - pitch / Math.PI) * H);
      const color = p.errorPx < 1 ? [40, 220, 90] : p.errorPx < 2 ? [240, 210, 40] : [235, 50, 50];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const yy = cy + dy;
          if (yy < 0 || yy >= H) continue;
          const o = (yy * W + ((((cx + dx) % W) + W) % W)) * 4;
          px[o] = color[0]; px[o + 1] = color[1]; px[o + 2] = color[2];
        }
      }
    }
    return new RasterImage(W, H, px);
  }
}
