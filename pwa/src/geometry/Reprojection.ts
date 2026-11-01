import type { SphericalAngleData, Vec3 } from './SphericalGeometry';
import { Alignment } from './Alignment';

/** Seam grid consumed by the renderers (see Seams.ts). */
export interface SeamLabelGrid {
  width: number;
  height: number;
  labels: Uint8Array;
  /** Optional: 1 = region of difference owned by one frame (both bands follow the label). */
  hard?: Uint8Array;
}

export class RasterImage {
  constructor(
    public width: number,
    public height: number,
    public rgba: Uint8ClampedArray
  ) {}

  sample(x: number, y: number): [number, number, number] {
    const ix = Math.min(this.width - 2, Math.max(0, Math.floor(x)));
    const iy = Math.min(this.height - 2, Math.max(0, Math.floor(y)));
    const dx = Math.min(1, Math.max(0, x - ix));
    const dy = Math.min(1, Math.max(0, y - iy));
    const w4 = this.width * 4;
    const i = (iy * this.width + ix) * 4;
    const rgba = this.rgba;

    const r00 = rgba[i] / 255, g00 = rgba[i + 1] / 255, b00 = rgba[i + 2] / 255;
    const r10 = rgba[i + 4] / 255, g10 = rgba[i + 5] / 255, b10 = rgba[i + 6] / 255;
    const r01 = rgba[i + w4] / 255, g01 = rgba[i + w4 + 1] / 255, b01 = rgba[i + w4 + 2] / 255;
    const r11 = rgba[i + w4 + 4] / 255, g11 = rgba[i + w4 + 5] / 255, b11 = rgba[i + w4 + 6] / 255;

    const r = (r00 * (1 - dx) + r10 * dx) * (1 - dy) + (r01 * (1 - dx) + r11 * dx) * dy;
    const g = (g00 * (1 - dx) + g10 * dx) * (1 - dy) + (g01 * (1 - dx) + g11 * dx) * dy;
    const b = (b00 * (1 - dx) + b10 * dx) * (1 - dy) + (b01 * (1 - dx) + b11 * dx) * dy;
    return [r, g, b];
  }

  clone(): RasterImage {
    return new RasterImage(this.width, this.height, new Uint8ClampedArray(this.rgba));
  }
}

export interface SIMD4Float {
  x: number;
  y: number;
  z: number;
  w: number;
}

export class Projection {
  public x: SIMD4Float;
  public y: SIMD4Float;
  public z: SIMD4Float;
  public meta: SIMD4Float; // cx, cy, width, height

  constructor(x: SIMD4Float, y: SIMD4Float, z: SIMD4Float, meta: SIMD4Float) {
    this.x = { ...x };
    this.y = { ...y };
    this.z = { ...z };
    this.meta = { ...meta };
  }

  static virtual(
    angle: SphericalAngleData,
    width: number,
    height: number,
    verticalFOV: number,
    gain = 1
  ): Projection {
    const a = (angle.yaw * Math.PI) / 180;
    const p = (angle.pitch * Math.PI) / 180;
    const f = height / 2 / Math.tan((verticalFOV * Math.PI) / 360);
    return new Projection(
      { x: Math.cos(a), y: 0, z: Math.sin(a), w: f },
      { x: -Math.sin(a) * Math.sin(p), y: Math.cos(p), z: Math.cos(a) * Math.sin(p), w: f },
      { x: -Math.sin(a) * Math.cos(p), y: -Math.sin(p), z: Math.cos(a) * Math.cos(p), w: gain },
      { x: width / 2, y: height / 2, z: width, w: height }
    );
  }

  project(d: Vec3): [number, number, number] | null {
    const depth = -(this.z.x * d.x + this.z.y * d.y + this.z.z * d.z);
    if (depth <= 0) return null;
    const px = ((this.x.x * d.x + this.x.y * d.y + this.x.z * d.z) / depth) * this.x.w + this.meta.x;
    const py = -((this.y.x * d.x + this.y.y * d.y + this.y.z * d.z) / depth) * this.y.w + this.meta.y;
    const edge = Math.min(
      px / this.meta.z,
      1 - px / this.meta.z,
      py / this.meta.w,
      1 - py / this.meta.w
    );
    if (edge <= 0.04) return null;
    return [px, py, edge];
  }

  unclippedProject(d: Vec3): [number, number] | null {
    const depth = -(this.z.x * d.x + this.z.y * d.y + this.z.z * d.z);
    if (depth <= 1e-4) return null;
    const px = ((this.x.x * d.x + this.x.y * d.y + this.x.z * d.z) / depth) * this.x.w + this.meta.x;
    const py = -((this.y.x * d.x + this.y.y * d.y + this.y.z * d.z) / depth) * this.y.w + this.meta.y;
    return [px, py];
  }

  direction(px: number, py: number): Vec3 {
    const rx = (px - this.meta.x) / this.x.w;
    const ry = -(py - this.meta.y) / this.y.w;
    const vx = this.x.x * rx + this.y.x * ry - this.z.x;
    const vy = this.x.y * rx + this.y.y * ry - this.z.y;
    const vz = this.x.z * rx + this.y.z * ry - this.z.z;
    const len = Math.sqrt(vx * vx + vy * vy + vz * vz);
    return { x: vx / len, y: vy / len, z: vz / len };
  }

  plane(px: number, py: number): [number, number] {
    return [(px - this.meta.x) / this.x.w, -(py - this.meta.y) / this.y.w];
  }

  rotated(r: { x: Vec3; y: Vec3; z: Vec3 }, focalScale = 1): Projection {
    return new Projection(
      { x: r.x.x, y: r.x.y, z: r.x.z, w: this.x.w * focalScale },
      { x: r.y.x, y: r.y.y, z: r.y.z, w: this.y.w * focalScale },
      { x: r.z.x, y: r.z.y, z: r.z.z, w: this.z.w },
      { ...this.meta }
    );
  }

  clone(): Projection {
    return new Projection(this.x, this.y, this.z, this.meta);
  }
}

export class LowPass {
  static readonly factor = 8;
  public width: number;
  public height: number;
  public rgba: Float32Array;

  constructor(image: RasterImage) {
    const f = LowPass.factor;
    const w = Math.floor((image.width + f - 1) / f);
    const h = Math.floor((image.height + f - 1) / f);
    this.width = w;
    this.height = h;

    const sums = new Float32Array(w * h * 4);
    for (let y = 0; y < image.height; y++) {
      const row = Math.floor(y / f) * w;
      for (let x = 0; x < image.width; x++) {
        const i = (y * image.width + x) * 4;
        const j = (row + Math.floor(x / f)) * 4;
        sums[j] += image.rgba[i];
        sums[j + 1] += image.rgba[i + 1];
        sums[j + 2] += image.rgba[i + 2];
        sums[j + 3] += 1;
      }
    }
    for (let j = 0; j < sums.length; j += 4) {
      const n = sums[j + 3] * 255;
      sums[j] /= n;
      sums[j + 1] /= n;
      sums[j + 2] /= n;
      sums[j + 3] = 1;
    }

    const horizontal = new Float32Array(sums);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const xm = Math.max(0, x - 1);
        const xp = Math.min(w - 1, x + 1);
        for (let c = 0; c < 3; c++) {
          horizontal[(y * w + x) * 4 + c] =
            (sums[(y * w + xm) * 4 + c] + 2 * sums[(y * w + x) * 4 + c] + sums[(y * w + xp) * 4 + c]) / 4;
        }
      }
    }

    const smooth = new Float32Array(horizontal);
    for (let y = 0; y < h; y++) {
      const ym = Math.max(0, y - 1);
      const yp = Math.min(h - 1, y + 1);
      for (let x = 0; x < w; x++) {
        for (let c = 0; c < 3; c++) {
          smooth[(y * w + x) * 4 + c] =
            (horizontal[(ym * w + x) * 4 + c] +
              2 * horizontal[(y * w + x) * 4 + c] +
              horizontal[(yp * w + x) * 4 + c]) /
            4;
        }
      }
    }
    this.rgba = smooth;
  }

  sample(x: number, y: number): [number, number, number] {
    const f = LowPass.factor;
    const lx = Math.min(this.width - 1, Math.max(0, (x + 0.5) / f - 0.5));
    const ly = Math.min(this.height - 1, Math.max(0, (y + 0.5) / f - 0.5));
    const ix = Math.floor(lx);
    const iy = Math.floor(ly);
    const ix1 = Math.min(this.width - 1, ix + 1);
    const iy1 = Math.min(this.height - 1, iy + 1);
    const dx = lx - ix;
    const dy = ly - iy;

    const i00 = (iy * this.width + ix) * 4;
    const i10 = (iy * this.width + ix1) * 4;
    const i01 = (iy1 * this.width + ix) * 4;
    const i11 = (iy1 * this.width + ix1) * 4;
    const rgba = this.rgba;

    const r =
      (rgba[i00] * (1 - dx) + rgba[i10] * dx) * (1 - dy) +
      (rgba[i01] * (1 - dx) + rgba[i11] * dx) * dy;
    const g =
      (rgba[i00 + 1] * (1 - dx) + rgba[i10 + 1] * dx) * (1 - dy) +
      (rgba[i01 + 1] * (1 - dx) + rgba[i11 + 1] * dx) * dy;
    const b =
      (rgba[i00 + 2] * (1 - dx) + rgba[i10 + 2] * dx) * (1 - dy) +
      (rgba[i01 + 2] * (1 - dx) + rgba[i11 + 2] * dx) * dy;
    return [r, g, b];
  }
}

export class RasterFrame {
  constructor(
    public image: RasterImage,
    public projection: Projection
  ) {}

  clone(): RasterFrame {
    return new RasterFrame(this.image.clone(), this.projection.clone());
  }
}

class LinearBlocks {
  static readonly factor = 8;
  public width: number;
  public height: number;
  public rgb: Float32Array;

  constructor(image: RasterImage) {
    const f = LinearBlocks.factor;
    const w = Math.floor((image.width + f - 1) / f);
    const h = Math.floor((image.height + f - 1) / f);
    this.width = w;
    this.height = h;
    const sums = new Float32Array(w * h * 4);
    const t = Reprojection.linearTable;
    for (let y = 0; y < image.height; y++) {
      const row = Math.floor(y / f) * w;
      for (let x = 0; x < image.width; x++) {
        const i = (y * image.width + x) * 4;
        const j = (row + Math.floor(x / f)) * 4;
        sums[j] += t[image.rgba[i]];
        sums[j + 1] += t[image.rgba[i + 1]];
        sums[j + 2] += t[image.rgba[i + 2]];
        sums[j + 3] += 1;
      }
    }
    this.rgb = new Float32Array(w * h * 3);
    for (let k = 0; k < w * h; k++) {
      const count = sums[k * 4 + 3] || 1;
      this.rgb[k * 3] = sums[k * 4] / count;
      this.rgb[k * 3 + 1] = sums[k * 4 + 1] / count;
      this.rgb[k * 3 + 2] = sums[k * 4 + 2] / count;
    }
  }

  at(x: number, y: number): [number, number, number] {
    const i = (y * this.width + x) * 3;
    return [this.rgb[i], this.rgb[i + 1], this.rgb[i + 2]];
  }

  sample(x: number, y: number): [number, number, number] {
    const f = LinearBlocks.factor;
    const lx = Math.min(this.width - 1, Math.max(0, (x + 0.5) / f - 0.5));
    const ly = Math.min(this.height - 1, Math.max(0, (y + 0.5) / f - 0.5));
    const ix = Math.floor(lx);
    const iy = Math.floor(ly);
    const ix1 = Math.min(this.width - 1, ix + 1);
    const iy1 = Math.min(this.height - 1, iy + 1);
    const dx = lx - ix;
    const dy = ly - iy;
    const c00 = this.at(ix, iy);
    const c10 = this.at(ix1, iy);
    const c01 = this.at(ix, iy1);
    const c11 = this.at(ix1, iy1);
    return [
      (c00[0] * (1 - dx) + c10[0] * dx) * (1 - dy) + (c01[0] * (1 - dx) + c11[0] * dx) * dy,
      (c00[1] * (1 - dx) + c10[1] * dx) * (1 - dy) + (c01[1] * (1 - dx) + c11[1] * dx) * dy,
      (c00[2] * (1 - dx) + c10[2] * dx) * (1 - dy) + (c01[2] * (1 - dx) + c11[2] * dx) * dy
    ];
  }

  flat(x: number, y: number): boolean {
    const lum = (v: [number, number, number]) => v[0] * 0.2126 + v[1] * 0.7152 + v[2] * 0.0722;
    const centre = lum(this.at(x, y));
    const limit = 0.2 * centre + 0.01;
    const neighbors = [
      this.at(x - 1, y),
      this.at(x + 1, y),
      this.at(x, y - 1),
      this.at(x, y + 1)
    ];
    return neighbors.every((n) => Math.abs(lum(n) - centre) <= limit);
  }
}

export class Reprojection {
  static readonly seamSharpness = 400;
  static readonly lowSharpness = 60;

  static linear(c: number): number {
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  static encoded(l: number): number {
    const c = Math.min(1, Math.max(0, l));
    return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  }

  static readonly linearTable: Float32Array = (() => {
    const arr = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      arr[i] = Reprojection.linear(i / 255);
    }
    return arr;
  })();

  static direction(x: number, y: number, width: number, height: number): Vec3 {
    const a = ((x + 0.5) / width) * 2 * Math.PI - Math.PI;
    const p = Math.PI / 2 - ((y + 0.5) / height) * Math.PI;
    return {
      x: Math.sin(a) * Math.cos(p),
      y: Math.sin(p),
      z: -Math.cos(a) * Math.cos(p)
    };
  }

  static pixel(
    d: Vec3,
    frames: RasterFrame[],
    lows: LowPass[]
  ): [number, number, number, number] {
    let low0 = 0, low1 = 0, low2 = 0, lowTotal = 0;
    let detail0 = 0, detail1 = 0, detail2 = 0, detailTotal = 0;
    let best = -1;

    for (let idx = 0; idx < frames.length; idx++) {
      const frame = frames[idx];
      const proj = frame.projection.project(d);
      if (!proj) continue;
      const [x, y, e] = proj;
      const gain = frame.projection.z.w;
      const base = lows[idx].sample(x, y);

      if (e > best) {
        const s = Math.exp(Reprojection.seamSharpness * (best - e));
        const sl = Math.exp(Reprojection.lowSharpness * (best - e));
        detail0 *= s;
        detail1 *= s;
        detail2 *= s;
        detailTotal *= s;
        low0 *= sl;
        low1 *= sl;
        low2 *= sl;
        lowTotal *= sl;
        best = e;
      }

      const ramp = Math.min(1, (e - 0.04) * 25);
      const w = Math.exp(Reprojection.seamSharpness * (e - best)) * ramp;
      const wl = Math.exp(Reprojection.lowSharpness * (e - best)) * ramp;

      low0 += base[0] * gain * wl;
      low1 += base[1] * gain * wl;
      low2 += base[2] * gain * wl;
      lowTotal += wl;

      const sRgb = frame.image.sample(x, y);
      detail0 += (sRgb[0] - base[0]) * gain * w;
      detail1 += (sRgb[1] - base[1]) * gain * w;
      detail2 += (sRgb[2] - base[2]) * gain * w;
      detailTotal += w;
    }

    if (lowTotal > 0) {
      return [
        low0 / lowTotal + detail0 / detailTotal,
        low1 / lowTotal + detail1 / detailTotal,
        low2 / lowTotal + detail2 / detailTotal,
        1
      ];
    }
    return [0, 0, 0, 0];
  }

  static render(
    frames: RasterFrame[],
    width: number,
    lows?: LowPass[],
    cancelled: () => boolean = () => false,
    progress: (p: number) => void = () => {},
    seams?: SeamLabelGrid | null
  ): RasterImage {
    const lowPasses = lows ?? frames.map((f) => new LowPass(f.image));
    // Seam grid (optional): which frame supplies detail; feathered bilinearly over one cell.
    const sW = seams ? seams.width : 0;
    const sH = seams ? seams.height : 0;
    const sL = seams ? seams.labels : null;
    const sHard = seams && seams.hard && seams.hard.length === sW * sH ? seams.hard : null;
    const height = Math.floor(width / 2);
    const bytes = new Uint8ClampedArray(width * height * 4);
    const nFrames = frames.length;

    // Precompute frame parameters and bounding cone cos(halfDiagonal) for fast culling
    const xx = new Float32Array(nFrames);
    const xy = new Float32Array(nFrames);
    const xz = new Float32Array(nFrames);
    const xw = new Float32Array(nFrames);

    const yx = new Float32Array(nFrames);
    const yy = new Float32Array(nFrames);
    const yz = new Float32Array(nFrames);
    const yw = new Float32Array(nFrames);

    const zx = new Float32Array(nFrames);
    const zy = new Float32Array(nFrames);
    const zz = new Float32Array(nFrames);
    const zw = new Float32Array(nFrames);

    const cx = new Float32Array(nFrames);
    const cy = new Float32Array(nFrames);
    const fw = new Float32Array(nFrames);
    const fh = new Float32Array(nFrames);
    const invFw = new Float32Array(nFrames);
    const invFh = new Float32Array(nFrames);
    const minDepth = new Float32Array(nFrames);

    for (let i = 0; i < nFrames; i++) {
      const p = frames[i].projection;
      xx[i] = p.x.x; xy[i] = p.x.y; xz[i] = p.x.z; xw[i] = p.x.w;
      yx[i] = p.y.x; yy[i] = p.y.y; yz[i] = p.y.z; yw[i] = p.y.w;
      zx[i] = p.z.x; zy[i] = p.z.y; zz[i] = p.z.z; zw[i] = p.z.w;
      cx[i] = p.meta.x; cy[i] = p.meta.y; fw[i] = p.meta.z; fh[i] = p.meta.w;
      invFw[i] = 1 / p.meta.z;
      invFh[i] = 1 / p.meta.w;

      // Bounding cone half-angle: tan(theta) = hypot(width/2, height/2) / focal
      const halfDiagTan = Math.hypot(p.meta.z * 0.5, p.meta.w * 0.5) / Math.min(p.x.w, p.y.w);
      minDepth[i] = Math.max(0.001, 1 / Math.sqrt(1 + halfDiagTan * halfDiagTan) - 0.02);
    }

    // Precompute longitude sin/cos across width once
    const sinA = new Float32Array(width);
    const cosA = new Float32Array(width);
    for (let x = 0; x < width; x++) {
      const a = ((x + 0.5) / width) * 2 * Math.PI - Math.PI;
      sinA[x] = Math.sin(a);
      cosA[x] = Math.cos(a);
    }

    const seamSharp = Reprojection.seamSharpness;
    const lowSharp = Reprojection.lowSharpness;
    const lowFactorInv = 1 / LowPass.factor;
    const inv255 = 1 / 255;
    const activeIndices = new Int32Array(nFrames);

    for (let y = 0; y < height; y++) {
      if ((y & 15) === 0) {
        if (cancelled()) {
          throw new Error('Cancelled');
        }
        progress(y / height);
      }

      const pitch = Math.PI * 0.5 - ((y + 0.5) / height) * Math.PI;
      const sinP = Math.sin(pitch);
      const cosP = Math.cos(pitch);
      const dy = sinP;

      // Latitude band culling: skip frames whose pitch band cannot intersect this latitude row
      let activeCount = 0;
      for (let idx = 0; idx < nFrames; idx++) {
        const horizLen = Math.hypot(zx[idx], zz[idx]);
        const maxPossibleDepth = -zy[idx] * dy + horizLen * cosP;
        if (maxPossibleDepth >= minDepth[idx]) {
          activeIndices[activeCount++] = idx;
        }
      }

      const rowBase = y * width * 4;
      let sy0 = 0, sy1 = 0, sfy = 0;
      if (sL) {
        const gy = Math.min(sH - 1, Math.max(0, ((y + 0.5) * sH) / height - 0.5));
        sy0 = Math.floor(gy);
        sfy = gy - sy0;
        sy1 = Math.min(sH - 1, sy0 + 1);
      }
      for (let x = 0; x < width; x++) {
        const dx = sinA[x] * cosP;
        const dz = -cosA[x] * cosP;

        let low0 = 0, low1 = 0, low2 = 0, lowTotal = 0;
        let detail0 = 0, detail1 = 0, detail2 = 0, detailTotal = 0;
        let seam0 = 0, seam1 = 0, seam2 = 0, seamTotal = 0;
        let l00 = 255, l10 = 255, l01 = 255, l11 = 255, w00 = 0, w10 = 0, w01 = 0, w11 = 0;
        let hardW = 0;
        let rlow0 = 0, rlow1 = 0, rlow2 = 0, rlowTotal = 0;
        if (sL) {
          const gx = ((x + 0.5) * sW) / width - 0.5;
          const fx0 = Math.floor(gx);
          const fx = gx - fx0;
          const x0 = ((fx0 % sW) + sW) % sW;
          const x1 = (x0 + 1) % sW;
          l00 = sL[sy0 * sW + x0]; l10 = sL[sy0 * sW + x1];
          l01 = sL[sy1 * sW + x0]; l11 = sL[sy1 * sW + x1];
          w00 = (1 - fx) * (1 - sfy); w10 = fx * (1 - sfy); w01 = (1 - fx) * sfy; w11 = fx * sfy;
          if (sHard) {
            hardW = sHard[sy0 * sW + x0] * w00 + sHard[sy0 * sW + x1] * w10 + sHard[sy1 * sW + x0] * w01 + sHard[sy1 * sW + x1] * w11;
          }
        }
        let best = -1;

        for (let k = 0; k < activeCount; k++) {
          const idx = activeIndices[k];
          const depth = -(zx[idx] * dx + zy[idx] * dy + zz[idx] * dz);
          if (depth <= minDepth[idx]) continue;

          const invDepth = 1 / depth;
          const px = (xx[idx] * dx + xy[idx] * dy + xz[idx] * dz) * invDepth * xw[idx] + cx[idx];
          const ux = px * invFw[idx];
          if (ux <= 0.04 || ux >= 0.96) continue;

          const py = -(yx[idx] * dx + yy[idx] * dy + yz[idx] * dz) * invDepth * yw[idx] + cy[idx];
          const uy = py * invFh[idx];
          if (uy <= 0.04 || uy >= 0.96) continue;

          const ex = ux < 0.5 ? ux : 1 - ux;
          const ey = uy < 0.5 ? uy : 1 - uy;
          const e = ex < ey ? ex : ey;

          // Inline lowPass bilinear sample (zero allocations)
          const lp = lowPasses[idx];
          const lw = lp.width;
          const lh = lp.height;
          const lRgba = lp.rgba;
          let lx = (px + 0.5) * lowFactorInv - 0.5;
          let ly = (py + 0.5) * lowFactorInv - 0.5;
          if (lx < 0) lx = 0; else if (lx > lw - 1) lx = lw - 1;
          if (ly < 0) ly = 0; else if (ly > lh - 1) ly = lh - 1;
          const lix = lx | 0;
          const liy = ly | 0;
          const lix1 = lix + 1 < lw ? lix + 1 : lw - 1;
          const liy1 = liy + 1 < lh ? liy + 1 : lh - 1;
          const ldx = lx - lix;
          const ldy = ly - liy;
          const ldx1 = 1 - ldx;
          const ldy1 = 1 - ldy;

          const li00 = (liy * lw + lix) * 4;
          const li10 = (liy * lw + lix1) * 4;
          const li01 = (liy1 * lw + lix) * 4;
          const li11 = (liy1 * lw + lix1) * 4;

          const base0 =
            (lRgba[li00] * ldx1 + lRgba[li10] * ldx) * ldy1 +
            (lRgba[li01] * ldx1 + lRgba[li11] * ldx) * ldy;
          const base1 =
            (lRgba[li00 + 1] * ldx1 + lRgba[li10 + 1] * ldx) * ldy1 +
            (lRgba[li01 + 1] * ldx1 + lRgba[li11 + 1] * ldx) * ldy;
          const base2 =
            (lRgba[li00 + 2] * ldx1 + lRgba[li10 + 2] * ldx) * ldy1 +
            (lRgba[li01 + 2] * ldx1 + lRgba[li11 + 2] * ldx) * ldy;

          // Inline full-res image bilinear sample (zero allocations)
          const img = frames[idx].image;
          const iw = img.width;
          const ih = img.height;
          const iRgba = img.rgba;
          let ix = px | 0;
          let iy = py | 0;
          if (ix < 0) ix = 0; else if (ix > iw - 2) ix = iw - 2;
          if (iy < 0) iy = 0; else if (iy > ih - 2) iy = ih - 2;
          let idxFrac = px - ix;
          let idyFrac = py - iy;
          if (idxFrac < 0) idxFrac = 0; else if (idxFrac > 1) idxFrac = 1;
          if (idyFrac < 0) idyFrac = 0; else if (idyFrac > 1) idyFrac = 1;
          const idxFrac1 = 1 - idxFrac;
          const idyFrac1 = 1 - idyFrac;
          const iw4 = iw * 4;
          const ii = (iy * iw + ix) * 4;

          const sr =
            ((iRgba[ii] * idxFrac1 + iRgba[ii + 4] * idxFrac) * idyFrac1 +
              (iRgba[ii + iw4] * idxFrac1 + iRgba[ii + iw4 + 4] * idxFrac) * idyFrac) *
            inv255;
          const sg =
            ((iRgba[ii + 1] * idxFrac1 + iRgba[ii + 5] * idxFrac) * idyFrac1 +
              (iRgba[ii + iw4 + 1] * idxFrac1 + iRgba[ii + iw4 + 5] * idxFrac) * idyFrac) *
            inv255;
          const sb =
            ((iRgba[ii + 2] * idxFrac1 + iRgba[ii + 6] * idxFrac) * idyFrac1 +
              (iRgba[ii + iw4 + 2] * idxFrac1 + iRgba[ii + iw4 + 6] * idxFrac) * idyFrac) *
            inv255;

          const gain = zw[idx];
          if (e > best) {
            const diff = best - e;
            const s = Math.exp(seamSharp * diff);
            const sl = Math.exp(lowSharp * diff);
            detail0 *= s; detail1 *= s; detail2 *= s; detailTotal *= s;
            low0 *= sl; low1 *= sl; low2 *= sl; lowTotal *= sl;
            best = e;
          }

          const ramp = (e - 0.04) * 25 < 1 ? (e - 0.04) * 25 : 1;
          const diffBest = e - best;
          const w = Math.exp(seamSharp * diffBest) * ramp;
          const wl = Math.exp(lowSharp * diffBest) * ramp;

          low0 += base0 * gain * wl;
          low1 += base1 * gain * wl;
          low2 += base2 * gain * wl;
          lowTotal += wl;

          detail0 += (sr - base0) * gain * w;
          detail1 += (sg - base1) * gain * w;
          detail2 += (sb - base2) * gain * w;
          detailTotal += w;

          if (sL) {
            const sw =
              ((l00 === idx ? w00 : 0) + (l10 === idx ? w10 : 0) + (l01 === idx ? w01 : 0) + (l11 === idx ? w11 : 0)) * ramp;
            if (sw > 0) {
              seam0 += (sr - base0) * gain * sw;
              seam1 += (sg - base1) * gain * sw;
              seam2 += (sb - base2) * gain * sw;
              seamTotal += sw;
              if (hardW > 0) {
                rlow0 += base0 * gain * sw;
                rlow1 += base1 * gain * sw;
                rlow2 += base2 * gain * sw;
                rlowTotal += sw;
              }
            }
          }
        }

        if (seamTotal > 1e-3) {
          // Detail from the seam-selected frame(s); fall back to edge weighting elsewhere.
          detail0 = seam0; detail1 = seam1; detail2 = seam2; detailTotal = seamTotal;
        }
        if (hardW > 0 && rlowTotal > 1e-3 && lowTotal > 0) {
          // Inside a region of difference the low band follows the chosen frame as well, so the
          // removed object leaves no faint halo; feathered by the region weight.
          const k = hardW;
          low0 = (low0 / lowTotal) * (1 - k) + (rlow0 / rlowTotal) * k;
          low1 = (low1 / lowTotal) * (1 - k) + (rlow1 / rlowTotal) * k;
          low2 = (low2 / lowTotal) * (1 - k) + (rlow2 / rlowTotal) * k;
          lowTotal = 1;
        }
        if (lowTotal > 0) {
          const outI = rowBase + x * 4;
          const rVal = low0 / lowTotal + detail0 / detailTotal;
          const gVal = low1 / lowTotal + detail1 / detailTotal;
          const bVal = low2 / lowTotal + detail2 / detailTotal;
          // Round (not truncate), matching the GPU path's 8-bit conversion.
          bytes[outI] = rVal <= 0 ? 0 : rVal >= 1 ? 255 : (rVal * 255 + 0.5) | 0;
          bytes[outI + 1] = gVal <= 0 ? 0 : gVal >= 1 ? 255 : (gVal * 255 + 0.5) | 0;
          bytes[outI + 2] = bVal <= 0 ? 0 : bVal >= 1 ? 255 : (bVal * 255 + 0.5) | 0;
          bytes[outI + 3] = 255;
        }
      }
    }
    progress(1);
    return new RasterImage(width, height, bytes);
  }

  /**
   * Exact area-average (box) resize. Every source pixel contributes in proportion to the
   * area it covers, so shrinking never aliases (no moiré, no sparkle on fine detail).
   */
  static areaResize(image: RasterImage, outW: number, outH: number): RasterImage {
    const { width: inW, height: inH, rgba } = image;
    const sx = inW / outW;
    const sy = inH / outH;

    // Horizontal pass -> Float32 rows (inH x outW x 3)
    const tmp = new Float32Array(inH * outW * 3);
    for (let x = 0; x < outW; x++) {
      const x0 = x * sx;
      const x1 = x0 + sx;
      const i0 = Math.floor(x0);
      const i1 = Math.min(inW, Math.ceil(x1));
      for (let y = 0; y < inH; y++) {
        let r = 0, g = 0, b = 0;
        const row = y * inW;
        for (let i = i0; i < i1; i++) {
          const wgt = Math.min(x1, i + 1) - Math.max(x0, i);
          const k = (row + i) * 4;
          r += rgba[k] * wgt;
          g += rgba[k + 1] * wgt;
          b += rgba[k + 2] * wgt;
        }
        const o = (y * outW + x) * 3;
        tmp[o] = r / sx;
        tmp[o + 1] = g / sx;
        tmp[o + 2] = b / sx;
      }
    }

    // Vertical pass -> bytes
    const out = new Uint8ClampedArray(outW * outH * 4);
    for (let y = 0; y < outH; y++) {
      const y0 = y * sy;
      const y1 = y0 + sy;
      const j0 = Math.floor(y0);
      const j1 = Math.min(inH, Math.ceil(y1));
      for (let x = 0; x < outW; x++) {
        let r = 0, g = 0, b = 0;
        for (let j = j0; j < j1; j++) {
          const wgt = Math.min(y1, j + 1) - Math.max(y0, j);
          const k = (j * outW + x) * 3;
          r += tmp[k] * wgt;
          g += tmp[k + 1] * wgt;
          b += tmp[k + 2] * wgt;
        }
        const o = (y * outW + x) * 4;
        out[o] = r / sy + 0.5;
        out[o + 1] = g / sy + 0.5;
        out[o + 2] = b / sy + 0.5;
        out[o + 3] = 255;
      }
    }
    return new RasterImage(outW, outH, out);
  }

  /**
   * Shrinks frames whose angular resolution is well above the panorama's, so blending samples
   * pre-averaged pixels instead of skipping most of them. Without this, a 2048 px panorama from
   * ~20 px/degree frames sampled 1 pixel in 3.5 and turned fine texture into moiré and noise.
   * Frames already at or below the output resolution are returned unchanged.
   */
  static prefilterForOutput(frames: RasterFrame[], outWidth: number): RasterFrame[] {
    const outPxPerRadian = outWidth / (2 * Math.PI);
    return frames.map((frame) => {
      const p = frame.projection;
      const framePxPerRadian = Math.min(p.x.w, p.y.w);
      // Keep ~15% extra resolution: the final bilinear sample then stays slightly oversampled.
      const scale = (outPxPerRadian * 1.15) / framePxPerRadian;
      if (scale >= 0.85) return frame;
      const w = Math.max(16, Math.round(frame.image.width * scale));
      const h = Math.max(16, Math.round(frame.image.height * scale));
      const sx = w / frame.image.width;
      const sy = h / frame.image.height;
      const image = Reprojection.areaResize(frame.image, w, h);
      const projection = new Projection(
        { ...p.x, w: p.x.w * sx },
        { ...p.y, w: p.y.w * sy },
        p.z,
        { x: p.meta.x * sx, y: p.meta.y * sy, z: w, w: h }
      );
      return new RasterFrame(image, projection);
    });
  }

  static compensate(input: RasterFrame[]): RasterFrame[] {
    const cloned = input.map((f) => f.clone());
    Reprojection.compensateInPlace(cloned);
    return cloned;
  }

  /** Last estimated lens falloff, for diagnostics: V(r) = exp(a r² + b r⁴), r = 1 at corners. */
  static lastVignetting: { a: number; b: number; samples: number; applied: boolean; inlierShare: number } = {
    a: 0,
    b: 0,
    samples: 0,
    applied: false,
    inlierShare: 0
  };

  /**
   * Estimates and removes radial lens falloff (vignetting) shared by all frames.
   *
   * Where two frames see the same spot at different distances from their centres, the log
   * brightness difference is (log gain_i − log gain_j) + v(r_i) − v(r_j), with
   * v(r) = a r² + b r⁴. Solving all overlaps jointly (robust IRLS) gives a and b; each frame is
   * then divided by V(r) in linear light. Without this, darker frame edges show as light/dark
   * bands at every seam, which exposure gains alone cannot remove.
   */
  /** Benchmark switch: false reproduces the previous pipeline (no falloff correction). */
  static vignettingCorrection = true;

  static devignetteInPlace(input: RasterFrame[], alignmentConfidence = 1): void {
    Reprojection.lastVignetting = { a: 0, b: 0, samples: 0, applied: false, inlierShare: 0 };
    if (input.length <= 1 || !Reprojection.vignettingCorrection) return;
    // Overlap geometry must be trustworthy: with poorly aligned frames the "same spot" in two
    // photos is not the same spot, and the fit would invent falloff.
    if (alignmentConfidence < 0.3) return;
    const n = input.length;
    const lum = (v: [number, number, number]) => 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
    const radius2 = (p: Projection, x: number, y: number) => {
      const hx = p.meta.z / 2, hy = p.meta.w / 2;
      return ((x - hx) * (x - hx) + (y - hy) * (y - hy)) / (hx * hx + hy * hy);
    };
    const blocks = input.map((f) => new LinearBlocks(f.image));
    const rows: Array<{ i: number; j: number; ri: number; rj: number; d: number }> = [];
    for (const [i, j] of Alignment.overlappingPairs(input.map((f) => f.projection))) {
      const pa = input[i].projection;
      const pb = input[j].projection;
      const t = blocks[i];
      for (let ty = 1; ty < t.height - 1; ty += 2) {
        for (let tx = 1; tx < t.width - 1; tx += 2) {
          const f = LinearBlocks.factor;
          const x = (tx + 0.5) * f - 0.5;
          const y = (ty + 0.5) * f - 0.5;
          const proj = pb.project(pa.direction(x, y));
          if (!proj || !t.flat(tx, ty)) continue;
          const la = lum(t.at(tx, ty));
          const lb = lum(blocks[j].sample(proj[0], proj[1]));
          if (la < 0.02 || lb < 0.02 || la > 0.85 || lb > 0.85) continue;
          rows.push({ i, j, ri: radius2(pa, x, y), rj: radius2(pb, proj[0], proj[1]), d: Math.log(la / lb) });
        }
      }
    }
    if (rows.length < 500) return;

    // Unknowns: log gains (n) + a + b. Normal equations with IRLS (Cauchy, scale 0.05).
    const size = n + 2;
    let sol: number[] = new Array(size).fill(0);
    const w = new Float64Array(rows.length).fill(1);
    for (let iter = 0; iter < 4; iter++) {
      const h = new Float64Array(size * size);
      const rhs = new Float64Array(size);
      for (let k = 0; k < rows.length; k++) {
        const r = rows[k];
        // residual = (g_i − g_j) + a (ri − rj) + b (ri² − rj²) − d
        const cols: Array<[number, number]> = [
          [r.i, 1],
          [r.j, -1],
          [n, r.ri - r.rj],
          [n + 1, r.ri * r.ri - r.rj * r.rj]
        ];
        for (const [p, vp] of cols) {
          rhs[p] += w[k] * vp * r.d;
          for (const [q, vq] of cols) h[p * size + q] += w[k] * vp * vq;
        }
      }
      for (let k = 0; k < n; k++) {
        h[k * size + k] += 1; // weak prior on gains (and fixes the gauge with the next line)
        for (let l = 0; l < n; l++) h[k * size + l] += 1e3 / n;
      }
      h[n * size + n] += 1;
      h[(n + 1) * size + n + 1] += 1;
      const s = Alignment.solve(h, rhs, size);
      if (!s) return;
      sol = s;
      for (let k = 0; k < rows.length; k++) {
        const r = rows[k];
        const res = sol[r.i] - sol[r.j] + sol[n] * (r.ri - r.rj) + sol[n + 1] * (r.ri * r.ri - r.rj * r.rj) - r.d;
        w[k] = 1 / (1 + (res / 0.05) * (res / 0.05));
      }
    }
    // Physical falloff only darkens towards the corners; clamp to a plausible range and never
    // brighten corners by more than 2x (log 2 ≈ 0.69) — guards against colour shifts/clipping.
    let a = Math.min(0.1, Math.max(-1.2, sol[n]));
    let b = Math.min(0.6, Math.max(-0.6, sol[n + 1]));
    if (a + b < -0.69) {
      const s = -0.69 / (a + b);
      a *= s;
      b *= s;
    }
    const cornerLoss = a + b; // log V at r = 1
    let inl = 0;
    for (let k = 0; k < w.length; k++) if (w[k] > 0.5) inl++;
    const inlierShare = inl / Math.max(1, w.length);
    Reprojection.lastVignetting = { a, b, samples: rows.length, applied: false, inlierShare };
    // < 3% at the corners: not worth touching pixels. Fewer than half the samples agreeing
    // with the model: the overlaps are not explained by falloff — leave the photos alone.
    if (Math.abs(cornerLoss) < 0.03 || inlierShare < 0.4) return;
    Reprojection.lastVignetting.applied = true;

    // Divide by V(r) in linear light; a 4096-entry encode table keeps it fast.
    const encodeLut = new Uint8Array(4096);
    for (let k = 0; k < 4096; k++) encodeLut[k] = Math.round(Reprojection.encoded(k / 4095) * 255);
    const lin = Reprojection.linearTable;
    for (const frame of input) {
      const { width, height, rgba } = frame.image;
      const hx = width / 2, hy = height / 2, norm = 1 / (hx * hx + hy * hy);
      for (let y = 0; y < height; y++) {
        const dy2 = (y + 0.5 - hy) * (y + 0.5 - hy);
        for (let x = 0; x < width; x++) {
          const r2 = ((x + 0.5 - hx) * (x + 0.5 - hx) + dy2) * norm;
          const gain = Math.exp(-(a * r2 + b * r2 * r2));
          const i = (y * width + x) * 4;
          for (let c = 0; c < 3; c++) {
            const v = lin[rgba[i + c]] * gain;
            rgba[i + c] = encodeLut[v >= 1 ? 4095 : (v * 4095) | 0];
          }
        }
      }
    }
  }

  /** Weight pulling per-frame offsets to zero (large = offsets only when strongly supported). */
  static offsetPrior = 5000;
  /** Benchmark switch: false reproduces the earlier unconstrained per-channel solve. */
  static constrainChroma = true;
  /** Largest per-channel gain relative to the frame's overall gain. */
  static chromaRatioMax = 1.4;

  static compensateInPlace(input: RasterFrame[], options: { alignmentConfidence?: number } = {}): void {
    if (input.length <= 1) return;
    Reprojection.devignetteInPlace(input, options.alignmentConfidence ?? 1);
    const n = input.length;
    const blocks = input.map((f) => new LinearBlocks(f.image));

    const pairs: Array<{
      i: number;
      j: number;
      a: Array<[number, number, number]>;
      b: Array<[number, number, number]>;
    }> = [];

    for (const [i, j] of Alignment.overlappingPairs(input.map((f) => f.projection))) {
      const pa = input[i].projection;
      const pb = input[j].projection;
      const t = blocks[i];
      const a: Array<[number, number, number]> = [];
      const b: Array<[number, number, number]> = [];

      for (let ty = 1; ty < t.height - 1; ty += 2) {
        for (let tx = 1; tx < t.width - 1; tx += 2) {
          const f = LinearBlocks.factor;
          const x = (tx + 0.5) * f - 0.5;
          const y = (ty + 0.5) * f - 0.5;
          const edge = Math.min(x / pa.meta.z, 1 - x / pa.meta.z, y / pa.meta.w, 1 - y / pa.meta.w);
          if (edge <= 0.04) continue;
          const proj = pb.project(pa.direction(x, y));
          if (!proj) continue;
          const [bx, by] = proj;
          const va = t.at(tx, ty);
          const vb = blocks[j].sample(bx, by);
          const maxVal = Math.max(va[0], va[1], va[2], vb[0], vb[1], vb[2]);
          if (maxVal >= 0.85 || !t.flat(tx, ty)) continue;
          a.push(va);
          b.push(vb);
        }
      }
      if (a.length >= 8) {
        pairs.push({ i, j, a, b });
      }
    }

    const gainPrior = 1.0;
    const offsetPrior = Reprojection.offsetPrior;
    const gauge = 1e6;
    const gains: Array<[number, number, number]> = Array.from({ length: n }, () => [1, 1, 1]);
    const offsets: Array<[number, number, number]> = Array.from({ length: n }, () => [0, 0, 0]);

    for (let c = 0; c < 3; c++) {
      const weights = pairs.map((p) => new Float64Array(p.a.length).fill(1));
      let x: number[] = Array.from({ length: 2 * n }, (_, idx) => (idx % 2 === 0 ? 1.0 : 0.0));

      for (let iter = 0; iter < 8; iter++) {
        const h = new Float64Array(4 * n * n);
        const rhs = new Float64Array(2 * n);
        const add = (r: number, k: number, v: number) => {
          h[r * 2 * n + k] += v;
          if (r !== k) h[k * 2 * n + r] += v;
        };

        for (let p = 0; p < pairs.length; p++) {
          const pair = pairs[p];
          let saa = 0, sa = 0, sab = 0, sb = 0, sbb = 0, sw = 0;
          for (let k = 0; k < pair.a.length; k++) {
            const av = pair.a[k][c];
            const bv = pair.b[k][c];
            const w = weights[p][k];
            saa += w * av * av;
            sa += w * av;
            sab += w * av * bv;
            sb += w * bv;
            sbb += w * bv * bv;
            sw += w;
          }
          const ai = 2 * pair.i, bi = ai + 1, aj = 2 * pair.j, bj = aj + 1;
          add(ai, ai, saa); add(ai, bi, sa); add(ai, aj, -sab); add(ai, bj, -sa);
          add(bi, bi, sw); add(bi, aj, -sb); add(bi, bj, -sw);
          add(aj, aj, sbb); add(aj, bj, sb); add(bj, bj, sw);
        }

        for (let k = 0; k < n; k++) {
          h[2 * k * 2 * n + 2 * k] += gainPrior;
          rhs[2 * k] += gainPrior;
          h[(2 * k + 1) * 2 * n + 2 * k + 1] += offsetPrior;
        }
        for (let k = 0; k < n; k++) {
          rhs[2 * k] += gauge * n;
          for (let l = 0; l < n; l++) {
            h[2 * k * 2 * n + 2 * l] += gauge;
            h[(2 * k + 1) * 2 * n + 2 * l + 1] += gauge;
          }
        }

        const solution = Alignment.solve(h, rhs, 2 * n);
        if (!solution) break;
        x = solution;

        for (let p = 0; p < pairs.length; p++) {
          const pair = pairs[p];
          for (let k = 0; k < pair.a.length; k++) {
            const r =
              x[2 * pair.i] * pair.a[k][c] +
              x[2 * pair.i + 1] -
              x[2 * pair.j] * pair.b[k][c] -
              x[2 * pair.j + 1];
            weights[p][k] = Math.min(1, 0.02 / Math.max(1e-9, Math.abs(r)));
          }
        }
      }

      for (let k = 0; k < n; k++) {
        gains[k][c] = Math.min(2.5, Math.max(0.4, x[2 * k]));
        offsets[k][c] = Math.min(0.1, Math.max(-0.1, x[2 * k + 1]));
      }
    }

    if (Reprojection.constrainChroma) {
      for (let k = 0; k < n; k++) {
        // Veiling glare / black-level offset is achromatic: one offset for all channels, so it
        // cannot tint shadows. Channel gains may differ (white balance) but only around the
        // frame's own overall gain, within a plausible range — an unconstrained fit trades gain
        // against offset per channel and paints colour casts (measured on real corridor imagery).
        const common = (offsets[k][0] + offsets[k][1] + offsets[k][2]) / 3;
        const overall = Math.cbrt(gains[k][0] * gains[k][1] * gains[k][2]);
        for (let c = 0; c < 3; c++) {
          offsets[k][c] = common;
          const ratio = Math.min(Reprojection.chromaRatioMax, Math.max(1 / Reprojection.chromaRatioMax, gains[k][c] / overall));
          gains[k][c] = overall * ratio;
        }
      }
    }

    for (let k = 0; k < n; k++) {
      const tables = [0, 1, 2].map((c) => {
        const lut = new Uint8Array(256);
        for (let v = 0; v < 256; v++) {
          const val = Math.round(
            Reprojection.encoded(gains[k][c] * Reprojection.linearTable[v] + offsets[k][c]) * 255
          );
          lut[v] = Math.min(255, Math.max(0, val));
        }
        return lut;
      });

      const px = input[k].image.rgba;
      for (let i = 0; i < px.length; i += 4) {
        px[i] = tables[0][px[i]];
        px[i + 1] = tables[1][px[i + 1]];
        px[i + 2] = tables[2][px[i + 2]];
      }
      input[k].projection.z.w = 1;
    }
  }
}
