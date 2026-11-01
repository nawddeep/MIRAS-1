import { ShotPlanner, SphericalAngle, Vec3 } from './SphericalGeometry';
import { Projection, RasterFrame, RasterImage, Reprojection } from './Reprojection';

export interface SyntheticMetrics {
  meanAbsoluteError: number;
  bestHorizontalShift: number;
  seamError: number;
  coverage: number;
  description: string;
}

export class SyntheticFixture {
  static color(d: Vec3): [number, number, number] {
    const yaw = Math.atan2(d.x, -d.z);
    const pitch = Math.asin(Math.min(1, Math.max(-1, d.y)));
    let c0 = 0.43 + 0.18 * d.x + 0.09 * d.y;
    let c1 = 0.43 + 0.16 * d.z + 0.08 * d.x;
    let c2 = 0.43 + 0.17 * d.y + 0.07 * d.z;
    const yg = Math.abs(Math.sin(yaw * 6));
    const pg = Math.abs(Math.sin(pitch * 6));
    const grid = Math.max(Math.exp(-Math.pow(yg / 0.04, 2)), Math.exp(-Math.pow(pg / 0.04, 2)));
    const mult = 1 - 0.45 * grid;
    const wave = 0.025 * Math.sin(yaw * 17) * Math.cos(pitch * 9);
    c0 = c0 * mult + wave;
    c1 = c1 * mult + wave;
    c2 = c2 * mult + wave;
    return [c0, c1, c2];
  }

  static panorama(width: number): RasterImage {
    const h = Math.floor(width / 2);
    const bytes = new Uint8ClampedArray(width * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < width; x++) {
        const c = SyntheticFixture.color(Reprojection.direction(x, y, width, h));
        const i = (y * width + x) * 4;
        bytes[i] = Math.round(c[0] * 255);
        bytes[i + 1] = Math.round(c[1] * 255);
        bytes[i + 2] = Math.round(c[2] * 255);
        bytes[i + 3] = 255;
      }
    }
    return new RasterImage(width, h, bytes);
  }

  static poses(width = 1920, height = 1440): Projection[] {
    const hfov = (2 * Math.atan((width / height) * Math.tan((63 * Math.PI) / 360)) * 180) / Math.PI;
    return ShotPlanner.plan(hfov, 63).map((t) =>
      Projection.virtual(t.angle, width, height, 63)
    );
  }

  static frames(options?: {
    width?: number;
    height?: number;
    source?: RasterImage | null;
    noise?: number;
    roll?: number;
    focalError?: number;
    veil?: number;
  }): RasterFrame[] {
    const width = options?.width ?? 1920;
    const height = options?.height ?? 1440;
    const source = options?.source ?? null;
    const noise = options?.noise ?? 0.5;
    const roll = options?.roll ?? 0;
    const focalError = options?.focalError ?? 0;
    const veil = options?.veil ?? 0;

    const hfov = (2 * Math.atan((width / height) * Math.tan((63 * Math.PI) / 360)) * 180) / Math.PI;
    const plan = ShotPlanner.plan(hfov, 63);

    return plan.map((target, index) => {
      const actual = Projection.virtual(target.angle, width, height, 63);
      const noiseYaw = Math.sin(index * 12.9898) * noise;
      const noisePitch = Math.cos(index * 7.832) * noise;
      const recorded = Projection.virtual(
        new SphericalAngle(target.angle.yaw + noiseYaw, target.angle.pitch + noisePitch),
        width,
        height,
        63
      );
      const r = (Math.sin(index * 3.71) * roll * Math.PI) / 180;
      const x = { ...recorded.x };
      const y = { ...recorded.y };
      const f = 1 + focalError;
      recorded.x = {
        x: Math.cos(r) * x.x + Math.sin(r) * y.x,
        y: Math.cos(r) * x.y + Math.sin(r) * y.y,
        z: Math.cos(r) * x.z + Math.sin(r) * y.z,
        w: x.w * f
      };
      recorded.y = {
        x: -Math.sin(r) * x.x + Math.cos(r) * y.x,
        y: -Math.sin(r) * x.y + Math.cos(r) * y.y,
        z: -Math.sin(r) * x.z + Math.cos(r) * y.z,
        w: y.w * f
      };

      const gain = 1 + 0.15 * Math.sin(index * 2.39996);
      const glare = veil * Math.max(0, Math.sin(index * 1.7));
      const bytes = new Uint8ClampedArray(width * height * 4);

      for (let py = 0; py < height; py++) {
        for (let px = 0; px < width; px++) {
          const d = actual.direction(px, py);
          let c: [number, number, number];
          if (source) {
            const uv = SphericalAngle.fromVector(d).uv;
            const s = source.sample(uv.u * (source.width - 1), uv.v * (source.height - 1));
            c = [s[0] * gain, s[1] * gain, s[2] * gain];
          } else {
            const s = SyntheticFixture.color(d);
            c = [s[0] * gain, s[1] * gain, s[2] * gain];
          }
          if (glare > 0) {
            c = [
              Reprojection.encoded(Reprojection.linear(c[0]) + glare),
              Reprojection.encoded(Reprojection.linear(c[1]) + glare),
              Reprojection.encoded(Reprojection.linear(c[2]) + glare)
            ];
          }
          const i = (py * width + px) * 4;
          bytes[i] = Math.min(255, Math.max(0, Math.floor(c[0] * 255)));
          bytes[i + 1] = Math.min(255, Math.max(0, Math.floor(c[1] * 255)));
          bytes[i + 2] = Math.min(255, Math.max(0, Math.floor(c[2] * 255)));
          bytes[i + 3] = 255;
        }
      }
      return new RasterFrame(new RasterImage(width, height, bytes), recorded);
    });
  }

  static metrics(image: RasterImage, source?: RasterImage | null): SyntheticMetrics {
    let error = 0;
    let count = 0;
    let covered = 0;
    let seam = 0;
    let seamCount = 0;
    const w = image.width;
    const h = image.height;

    const reference = (x: number, y: number): [number, number, number] => {
      if (source) {
        return source.sample(
          (x * (source.width - 1)) / (w - 1),
          (y * (source.height - 1)) / (h - 1)
        );
      }
      return SyntheticFixture.color(Reprojection.direction(x, y, w, h));
    };

    for (let y = 0; y < h; y++) {
      if (Math.abs(90 - (y * 180) / h) >= 80) continue;
      for (let x = 0; x < w; x++) {
        const c = reference(x, y);
        const i = (y * w + x) * 4;
        error +=
          (Math.abs(image.rgba[i] / 255 - c[0]) +
            Math.abs(image.rgba[i + 1] / 255 - c[1]) +
            Math.abs(image.rgba[i + 2] / 255 - c[2])) /
          3;
        count += 1;
        if (image.rgba[i + 3] > 0) covered += 1;
      }
      for (let c = 0; c < 3; c++) {
        const first = image.rgba[y * w * 4 + c];
        const last = image.rgba[(y * w + w - 1) * 4 + c];
        const next = image.rgba[(y * w + 1) * 4 + c];
        const previous = image.rgba[(y * w + w - 2) * 4 + c];
        seam +=
          Math.max(0, Math.abs(first - last) - (Math.abs(first - next) + Math.abs(last - previous)) / 2) /
          255;
        seamCount += 1;
      }
    }

    let bestShift = 0;
    let bestError = Infinity;
    for (let shift = -12; shift <= 12; shift++) {
      let e = 0;
      for (let y = Math.floor(h / 10); y < Math.floor((h * 9) / 10); y += 11) {
        for (let x = 0; x < w; x += 7) {
          const j = (y * w + ((x + shift + w) % w)) * 4;
          const c = reference(x, y);
          e +=
            Math.abs(image.rgba[j] / 255 - c[0]) +
            Math.abs(image.rgba[j + 1] / 255 - c[1]) +
            Math.abs(image.rgba[j + 2] / 255 - c[2]);
        }
      }
      if (e < bestError) {
        bestError = e;
        bestShift = shift;
      }
    }

    const meanAbsoluteError = error / Math.max(1, count);
    const seamError = seam / Math.max(1, seamCount);
    const coverage = covered / Math.max(1, count);

    return {
      meanAbsoluteError,
      bestHorizontalShift: bestShift,
      seamError,
      coverage,
      get description() {
        return `MAE ${this.meanAbsoluteError.toFixed(5)} · shift ${this.bestHorizontalShift} px · seam ${this.seamError.toFixed(5)} · coverage ${(this.coverage * 100).toFixed(2)}%`;
      }
    };
  }
}
