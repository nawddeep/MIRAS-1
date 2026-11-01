export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export class Vector3 implements Vec3 {
  constructor(
    public x: number,
    public y: number,
    public z: number
  ) {}

  dot(b: Vec3): number {
    return this.x * b.x + this.y * b.y + this.z * b.z;
  }

  get length(): number {
    return Math.sqrt(this.dot(this));
  }

  get normalized(): Vector3 {
    const n = Math.max(this.length, 1e-12);
    return new Vector3(this.x / n, this.y / n, this.z / n);
  }
}

export interface SphericalAngleData {
  yaw: number;
  pitch: number;
}

export class SphericalAngle implements SphericalAngleData {
  public yaw: number;
  public pitch: number;

  constructor(yaw: number, pitch: number) {
    this.yaw = yaw;
    this.pitch = pitch;
  }

  static fromVector(vector: Vec3): SphericalAngle {
    const v = new Vector3(vector.x, vector.y, vector.z).normalized;
    const yaw = (Math.atan2(v.x, -v.z) * 180) / Math.PI;
    const pitch = (Math.asin(Math.min(1, Math.max(-1, v.y))) * 180) / Math.PI;
    return new SphericalAngle(yaw, pitch);
  }

  static fromUV(u: number, v: number): SphericalAngle {
    const yaw = (Geometry.wrap(u, 1) - 0.5) * 360;
    const pitch = 90 - Math.min(1, Math.max(0, v)) * 180;
    return new SphericalAngle(yaw, pitch);
  }

  get vector(): Vector3 {
    const y = (this.yaw * Math.PI) / 180;
    const p = (this.pitch * Math.PI) / 180;
    return new Vector3(Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p));
  }

  get uv(): { u: number; v: number } {
    return {
      u: Geometry.wrap(0.5 + this.yaw / 360, 1),
      v: Math.min(1, Math.max(0, 0.5 - this.pitch / 180))
    };
  }

  distance(to: SphericalAngleData): number {
    const b = to instanceof SphericalAngle ? to : new SphericalAngle(to.yaw, to.pitch);
    const dot = Math.min(1, Math.max(-1, this.vector.dot(b.vector)));
    return (Math.acos(dot) * 180) / Math.PI;
  }

  pixel(width: number, height: number): { x: number; y: number } {
    const { u, v } = this.uv;
    return { x: u * width, y: v * height };
  }
}

export class Geometry {
  static hasReliableHeading(heading: number | null | undefined, accuracy: number | null | undefined): boolean {
    if (heading === null || heading === undefined || accuracy === null || accuracy === undefined) {
      return false;
    }
    return (
      Number.isFinite(heading) &&
      Number.isFinite(accuracy) &&
      heading >= 0 &&
      heading < 360 &&
      accuracy >= 0 &&
      accuracy <= 15
    );
  }

  static wrap(value: number, period = 360): number {
    return ((value % period) + period) % period;
  }

  static northReference(
    firstWorldYaw: number,
    heading?: number | null,
    accuracy?: number | null
  ): number {
    if (!Geometry.hasReliableHeading(heading, accuracy) || heading === null || heading === undefined) {
      return firstWorldYaw;
    }
    return firstWorldYaw - heading;
  }

  static tapRay(
    x: number,
    y: number,
    width: number,
    height: number,
    verticalFOV: number,
    look: SphericalAngleData
  ): SphericalAngle {
    const scale = Math.tan((verticalFOV * Math.PI) / 360);
    const rx = (((2 * x) / width - 1) * width) / height * scale;
    const ry = (1 - (2 * y) / height) * scale;
    const p = (look.pitch * Math.PI) / 180;
    const a = (look.yaw * Math.PI) / 180;
    const lookAngle = look instanceof SphericalAngle ? look : new SphericalAngle(look.yaw, look.pitch);
    const forward = lookAngle.vector;
    const right = new Vector3(Math.cos(a), 0, Math.sin(a));
    const up = new Vector3(-Math.sin(a) * Math.sin(p), Math.cos(p), Math.cos(a) * Math.sin(p));
    return SphericalAngle.fromVector(
      new Vector3(
        forward.x + rx * right.x + ry * up.x,
        forward.y + rx * right.y + ry * up.y,
        forward.z + rx * right.z + ry * up.z
      )
    );
  }
}

export interface ShotTarget {
  id: number;
  angle: SphericalAngle;
  optional: boolean;
}

export class ShotPlanner {
  /** Number of dots in the web app's live capture. */
  static readonly WEB_TARGET_COUNT = 30;

  /**
   * Fixed 30-dot layout used by the web app's live capture:
   * 12 on the horizon (every 30°), 8 at +45° and 8 at −45° (every 45°, offset 22.5° so each
   * one overlaps two horizon shots), plus zenith and nadir (nadir optional, as in iOS).
   *
   * Checked against a typical phone main camera in portrait (~49° × 63°): 100% of the sphere
   * is covered, still 100% with the field of view 8% smaller, and 100% with a 49° × 49°
   * footprint (robust to tilting the phone). Horizon neighbours overlap by ~19° (≈39%).
   */
  static planWeb(): ShotTarget[] {
    const rings: Array<[pitch: number, count: number, yawOffset: number]> = [
      [0, 12, 0],
      [45, 8, 22.5],
      [-45, 8, 22.5],
      [90, 1, 0],
      [-90, 1, 0]
    ];
    const result: ShotTarget[] = [];
    for (const [pitch, count, offset] of rings) {
      for (let i = 0; i < count; i++) {
        result.push({
          id: result.length,
          angle: new SphericalAngle(offset + (i * 360) / count, pitch),
          optional: pitch === -90
        });
      }
    }
    return result;
  }

  static plan(horizontalFOV: number, verticalFOV: number, overlap = 0.3): ShotTarget[] {
    // Inscribed circular footprint guarantees coverage regardless of camera roll.
    const fov = Math.min(120, Math.max(10, Math.min(horizontalFOV, verticalFOV)));
    const clampedOverlap = Math.min(0.6, Math.max(0.2, overlap));
    const step = fov * (1 - clampedOverlap) * 0.85;
    const bands = Math.max(2, Math.ceil(90 / step));
    const spacing = 90 / bands;
    const result: ShotTarget[] = [];
    const pitches: number[] = [0];
    for (let band = 1; band < bands; band++) {
      pitches.push(band * spacing);
      pitches.push(-band * spacing);
    }
    pitches.push(90, -90);
    for (const pitch of pitches) {
      const count =
        Math.abs(pitch) === 90
          ? 1
          : Math.max(1, Math.ceil((360 * Math.cos((pitch * Math.PI) / 180)) / step));
      for (let i = 0; i < count; i++) {
        result.push({
          id: result.length,
          angle: new SphericalAngle((i * 360) / count, pitch),
          optional: pitch === -90
        });
      }
    }
    return result;
  }

  static covers(
    direction: SphericalAngleData,
    target: SphericalAngleData,
    horizontalFOV: number,
    verticalFOV: number
  ): boolean {
    const dir = direction instanceof SphericalAngle ? direction : new SphericalAngle(direction.yaw, direction.pitch);
    const tgt = target instanceof SphericalAngle ? target : new SphericalAngle(target.yaw, target.pitch);
    const yaw = (tgt.yaw * Math.PI) / 180;
    const pitch = (tgt.pitch * Math.PI) / 180;
    const d = dir.vector;
    const f = d.dot(tgt.vector);
    if (f <= 0) return false;
    const right = new Vector3(Math.cos(yaw), 0, Math.sin(yaw));
    const up = new Vector3(-Math.sin(yaw) * Math.sin(pitch), Math.cos(pitch), Math.cos(yaw) * Math.sin(pitch));
    return (
      Math.abs(d.dot(right) / f) <= Math.tan((horizontalFOV * Math.PI) / 360) &&
      Math.abs(d.dot(up) / f) <= Math.tan((verticalFOV * Math.PI) / 360)
    );
  }
}
