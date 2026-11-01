import { Geometry, SphericalAngle } from '../geometry/SphericalGeometry';

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

/**
 * Converts W3C DeviceOrientation Euler angles (alpha, beta, gamma in degrees)
 * and screen orientation angle (0, 90, -90, 180) into a unit quaternion.
 */
export function eulerDeviceToQuaternion(
  alphaDeg: number,
  betaDeg: number,
  gammaDeg: number,
  screenOrientationDeg = 0
): Quaternion {
  const deg2rad = Math.PI / 180;
  const z = alphaDeg * deg2rad;
  const x = betaDeg * deg2rad;
  const y = gammaDeg * deg2rad;

  const cX = Math.cos(x / 2), sX = Math.sin(x / 2);
  const cY = Math.cos(y / 2), sY = Math.sin(y / 2);
  const cZ = Math.cos(z / 2), sZ = Math.sin(z / 2);

  // Intrinsic Z-X'-Y'' quaternion
  let qw = cX * cY * cZ - sX * sY * sZ;
  let qx = sX * cY * cZ - cX * sY * sZ;
  let qy = cX * sY * cZ + sX * cY * sZ;
  let qz = cX * cY * sZ + sX * sY * cZ;

  // Apply screen orientation rotation around device Z axis
  if (screenOrientationDeg !== 0) {
    const so = (-screenOrientationDeg * deg2rad) / 2;
    const cS = Math.cos(so), sS = Math.sin(so);
    const nw = qw * cS - qz * sS;
    const nx = qx * cS + qy * sS;
    const ny = -qx * sS + qy * cS;
    const nz = qw * sS + qz * cS;
    qw = nw;
    qx = nx;
    qy = ny;
    qz = nz;
  }

  return normalizeQuaternion({ x: qx, y: qy, z: qz, w: qw });
}

export function normalizeQuaternion(q: Quaternion): Quaternion {
  const len = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
  if (len < 1e-12) return { x: 0, y: 0, z: 0, w: 1 };
  return { x: q.x / len, y: q.y / len, z: q.z / len, w: q.w / len };
}

/**
 * Spherical linear interpolation (SLERP) for low-pass filtering sensor noise.
 */
export function slerpQuaternion(a: Quaternion, b: Quaternion, t: number): Quaternion {
  const clampedT = Math.min(1, Math.max(0, t));
  let bx = b.x, by = b.y, bz = b.z, bw = b.w;
  let cosHalfTheta = a.x * bx + a.y * by + a.z * bz + a.w * bw;

  if (cosHalfTheta < 0) {
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
    cosHalfTheta = -cosHalfTheta;
  }

  if (cosHalfTheta >= 0.9995) {
    return normalizeQuaternion({
      x: a.x + clampedT * (bx - a.x),
      y: a.y + clampedT * (by - a.y),
      z: a.z + clampedT * (bz - a.z),
      w: a.w + clampedT * (bw - a.w)
    });
  }

  const halfTheta = Math.acos(Math.min(1, cosHalfTheta));
  const sinHalfTheta = Math.sqrt(1 - cosHalfTheta * cosHalfTheta);
  const ratioA = Math.sin((1 - clampedT) * halfTheta) / sinHalfTheta;
  const ratioB = Math.sin(clampedT * halfTheta) / sinHalfTheta;

  return normalizeQuaternion({
    x: a.x * ratioA + bx * ratioB,
    y: a.y * ratioA + by * ratioB,
    z: a.z * ratioA + bz * ratioB,
    w: a.w * ratioA + bw * ratioB
  });
}
export function quaternionAngularDistanceDeg(a: Quaternion, b: Quaternion): number {
  const dot = Math.min(1, Math.abs(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w));
  return (2 * Math.acos(dot) * 180) / Math.PI;
}

/**
 * Camera axes in panorama coordinates (X East, Y Up, -Z North), each a unit vector:
 * [rightX, rightY, rightZ, upX, upY, upZ, forwardX, forwardY, forwardZ].
 * Forward is the back-camera viewing direction. This is the web equivalent of the
 * ARKit camera transform the iOS app uses, so it includes the phone's real roll.
 */
export type CameraBasis = [number, number, number, number, number, number, number, number, number];

/**
 * Device local frame: X right, Y up on screen, -Z out the back camera.
 * World frame (W3C): X East (or arbitrary horizontal), Y North, Z Up.
 */
export function quaternionToCameraBasis(q: Quaternion, out?: CameraBasis): CameraBasis {
  const { x, y, z, w } = q;
  const xx = x * x, yy = y * y, zz = z * z;
  const xy = x * y, xz = x * z, yz = y * z;
  const wx = w * x, wy = w * y, wz = w * z;

  // Rotation matrix columns in the W3C world frame.
  const rxW = 1 - 2 * (yy + zz), ryW = 2 * (xy + wz), rzW = 2 * (xz - wy);
  const uxW = 2 * (xy - wz), uyW = 1 - 2 * (xx + zz), uzW = 2 * (yz + wx);
  const fxW = -2 * (xz + wy), fyW = -2 * (yz - wx), fzW = -(1 - 2 * (xx + yy));

  // W3C (xE, yN, zU) -> panorama (x = xE, y = zU, z = -yN)
  const b = out ?? ([0, 0, 0, 0, 0, 0, 0, 0, 0] as CameraBasis);
  b[0] = rxW; b[1] = rzW; b[2] = -ryW;
  b[3] = uxW; b[4] = uzW; b[5] = -uyW;
  b[6] = fxW; b[7] = fzW; b[8] = -fyW;
  return b;
}

/** Basis for a camera at (yaw, pitch, roll) — used for touch-drag aiming without a gyro. */
export function sphericalToCameraBasis(yaw: number, pitch: number, roll = 0): CameraBasis {
  const a = (yaw * Math.PI) / 180;
  const p = (pitch * Math.PI) / 180;
  const r = (roll * Math.PI) / 180;
  const r0x = Math.cos(a), r0y = 0, r0z = Math.sin(a);
  const u0x = -Math.sin(a) * Math.sin(p), u0y = Math.cos(p), u0z = Math.cos(a) * Math.sin(p);
  const cr = Math.cos(r), sr = Math.sin(r);
  return [
    cr * r0x + sr * u0x, cr * r0y + sr * u0y, cr * r0z + sr * u0z,
    -sr * r0x + cr * u0x, -sr * r0y + cr * u0y, -sr * r0z + cr * u0z,
    Math.sin(a) * Math.cos(p), Math.sin(p), -Math.cos(a) * Math.cos(p)
  ];
}

/**
 * Extracts yaw, pitch, and true camera roll in panorama coordinates from a device quaternion.
 */
export function quaternionToSphericalPose(q: Quaternion): {
  yaw: number;
  pitch: number;
  roll: number;
} {
  const [rx, ry, rz, ux, uy, uz, fx, fy, fz] = quaternionToCameraBasis(q);

  const angle = SphericalAngle.fromVector({ x: fx, y: fy, z: fz });
  const yaw = Geometry.wrap(angle.yaw);
  const pitch = Math.min(89.5, Math.max(-89.5, angle.pitch));

  // True roll around the forward axis relative to the horizon-level right/up basis
  const yawRad = (yaw * Math.PI) / 180;
  const pitchRad = (pitch * Math.PI) / 180;
  const levelRightX = Math.cos(yawRad), levelRightY = 0, levelRightZ = Math.sin(yawRad);
  const levelUpX = -Math.sin(yawRad) * Math.sin(pitchRad);
  const levelUpY = Math.cos(pitchRad);
  const levelUpZ = Math.cos(yawRad) * Math.sin(pitchRad);

  const rDotRight = rx * levelRightX + ry * levelRightY + rz * levelRightZ;
  const rDotUp = rx * levelUpX + ry * levelUpY + rz * levelUpZ;
  const uDotUp = ux * levelUpX + uy * levelUpY + uz * levelUpZ;
  const roll =
    Math.abs(rDotRight) + Math.abs(rDotUp) > 1e-4 || Math.abs(uDotUp) > 1e-4
      ? (Math.atan2(rDotUp, rDotRight) * 180) / Math.PI
      : 0;

  return { yaw, pitch, roll };
}

export interface PoseSample {
  yaw: number;
  pitch: number;
  roll: number;
  quaternion: Quaternion;
  basis: CameraBasis;
  velocityDegPerSec: number;
  timestamp: number;
  /** True on the sample where a large persistent orientation jump was accepted. */
  discontinuity?: boolean;
}

/** Window over which rotation speed is measured. Long enough that sensor jitter averages out. */
const VELOCITY_WINDOW_SEC = 0.15;
const HISTORY_LIMIT = 48;

/** Live tracking-quality numbers from the filter (all measured, none assumed). */
export interface FilterStats {
  samples: number;
  /** Measured update rate (Hz, exponential average of inter-sample times). */
  rateHz: number;
  /** Jitter while nearly still: angular distance between raw and filtered orientation (°). */
  noiseDeg: number;
  /** Rejected single-sample jumps. */
  outliersRejected: number;
  /** Accepted large orientation jumps (sensor re-referenced / relocalised). */
  discontinuities: number;
  lastTimestamp: number;
}

/** A jump bigger than this between two samples is physically implausible for a hand-held phone. */
const OUTLIER_BASE_DEG = 12;
const OUTLIER_MAX_RATE_DEG_PER_SEC = 900;
const OUTLIER_CONFIRM_SAMPLES = 3;

export class PoseFilter {
  private currentQ: Quaternion | null = null;
  // Ring buffer of recent filtered orientations for windowed speed (no per-event allocation).
  private histQ: Quaternion[] = [];
  private histT = new Float64Array(HISTORY_LIMIT);
  private histHead = 0;
  private histCount = 0;
  private smoothedVelocity = 0;
  private readonly smoothingAlpha: number;
  private lastT = -1;
  private rateEma = 0;
  private noiseEma = 0;
  private sampleCount = 0;
  private outliers = 0;
  private jumps = 0;
  private pendingJump: Quaternion[] = [];
  /** Set on the sample where a confirmed discontinuity was accepted. */
  public lastWasDiscontinuity = false;

  constructor(smoothingAlpha = 0.35) {
    this.smoothingAlpha = smoothingAlpha;
    for (let i = 0; i < HISTORY_LIMIT; i++) this.histQ.push({ x: 0, y: 0, z: 0, w: 1 });
  }

  reset(): void {
    this.currentQ = null;
    this.histHead = 0;
    this.histCount = 0;
    this.smoothedVelocity = 0;
    this.lastT = -1;
    this.pendingJump = [];
    this.rateEma = 0;
    this.noiseEma = 0;
  }

  stats(): FilterStats {
    return {
      samples: this.sampleCount,
      rateHz: this.rateEma > 0 ? 1 / this.rateEma : 0,
      noiseDeg: this.noiseEma,
      outliersRejected: this.outliers,
      discontinuities: this.jumps,
      lastTimestamp: this.lastT
    };
  }

  updateFromEuler(
    alpha: number,
    beta: number,
    gamma: number,
    timestampSec: number,
    screenOrientationDeg = 0
  ): PoseSample {
    const rawQ = eulerDeviceToQuaternion(alpha, beta, gamma, screenOrientationDeg);
    return this.updateFromQuaternion(rawQ, timestampSec);
  }

  private pushHistory(q: Quaternion, t: number): void {
    const slot = this.histQ[this.histHead];
    slot.x = q.x; slot.y = q.y; slot.z = q.z; slot.w = q.w;
    this.histT[this.histHead] = t;
    this.histHead = (this.histHead + 1) % HISTORY_LIMIT;
    if (this.histCount < HISTORY_LIMIT) this.histCount++;
  }

  /**
   * Rotation speed measured over ~150 ms instead of between consecutive events.
   * At 60 Hz, 0.1° of sensor jitter between two events reads as 6°/s — exactly the
   * "hold still" limit — so per-event speed made the shutter never fire.
   */
  private windowedVelocity(q: Quaternion, t: number): number {
    let refIdx = -1;
    for (let k = 1; k <= this.histCount; k++) {
      const idx = (this.histHead - k + HISTORY_LIMIT) % HISTORY_LIMIT;
      refIdx = idx;
      if (t - this.histT[idx] >= VELOCITY_WINDOW_SEC) break;
    }
    if (refIdx < 0) return 0;
    const dt = t - this.histT[refIdx];
    if (dt < 0.01) return this.smoothedVelocity;
    return quaternionAngularDistanceDeg(this.histQ[refIdx], q) / dt;
  }

  updateFromQuaternion(rawQ: Quaternion, timestampSec: number): PoseSample {
    let normRaw = normalizeQuaternion(rawQ);
    this.lastWasDiscontinuity = false;
    const dt = this.lastT >= 0 ? timestampSec - this.lastT : 0;
    if (this.lastT >= 0 && dt <= 0) {
      // Duplicate / out-of-order timestamp: keep the current pose, do not corrupt velocity.
      return this.sampleFor(this.currentQ ?? normRaw, this.lastT);
    }
    if (this.currentQ && dt > 0) {
      this.rateEma = this.rateEma > 0 ? this.rateEma * 0.9 + Math.min(dt, 0.5) * 0.1 : Math.min(dt, 0.5);
      // Outlier rejection: a jump faster than a hand can turn is a sensor glitch. A new
      // orientation that persists for several consecutive samples is a real discontinuity
      // (sensor re-referenced): it is accepted, counted and flagged so callers can react.
      const jump = quaternionAngularDistanceDeg(this.currentQ, normRaw);
      if (jump > Math.max(OUTLIER_BASE_DEG, OUTLIER_MAX_RATE_DEG_PER_SEC * Math.min(dt, 0.25))) {
        const last = this.pendingJump[this.pendingJump.length - 1];
        if (last && quaternionAngularDistanceDeg(last, normRaw) > 4) this.pendingJump = [];
        this.pendingJump.push(normRaw);
        if (this.pendingJump.length < OUTLIER_CONFIRM_SAMPLES) {
          this.outliers++;
          this.lastT = timestampSec;
          return this.sampleFor(this.currentQ, timestampSec);
        }
        this.jumps++;
        this.lastWasDiscontinuity = true;
        this.pendingJump = [];
        this.currentQ = null; // restart smoothing/velocity history from the new orientation
        this.histCount = 0;
        this.histHead = 0;
      } else {
        this.pendingJump = [];
      }
    }
    this.lastT = timestampSec;
    this.sampleCount++;
    let filteredQ: Quaternion;
    if (!this.currentQ) {
      filteredQ = normRaw;
      this.smoothedVelocity = 0;
    } else {
      // Time-aware smoothing: the configured alpha is the weight per 1/60 s step, converted to
      // a time constant so 30 Hz, 60 Hz and 200 Hz sensors all lag by the same amount of time.
      const steps = Math.min(15, Math.max(0.25, dt * 60));
      const alpha = 1 - Math.pow(1 - Math.min(0.999, this.smoothingAlpha), steps);
      filteredQ = slerpQuaternion(this.currentQ, normRaw, alpha);
      const raw = quaternionAngularDistanceDeg(filteredQ, normRaw);
      if (this.smoothedVelocity < 4) this.noiseEma = this.noiseEma * 0.95 + raw * 0.05;
      const vel = this.windowedVelocity(filteredQ, timestampSec);
      this.smoothedVelocity = this.smoothedVelocity * 0.5 + vel * 0.5;
    }
    this.currentQ = filteredQ;
    this.pushHistory(filteredQ, timestampSec);
    return this.sampleFor(filteredQ, timestampSec);
  }

  private sampleFor(q: Quaternion, timestampSec: number): PoseSample {
    const pose = quaternionToSphericalPose(q);
    return {
      ...pose,
      quaternion: q,
      basis: quaternionToCameraBasis(q),
      velocityDegPerSec: this.smoothedVelocity,
      timestamp: timestampSec,
      discontinuity: this.lastWasDiscontinuity
    };
  }
}

export type SensorSource = 'relative-sensor' | 'deviceorientation' | 'none';

export interface SensorHealth {
  source: SensorSource;
  state: 'none' | 'ok' | 'degraded' | 'stale' | 'faulted';
  /** Milliseconds since the last reading (Infinity when none yet). */
  ageMs: number;
  rateHz: number;
  noiseDeg: number;
  discontinuities: number;
  outliersRejected: number;
  /** Permission / API error text, if any. */
  error: string | null;
  /** True when automatic capture may fire. */
  usable: boolean;
  message: string;
}

/** Readings older than this mean tracking stopped (tab throttled, sensor died, permission revoked). */
export const SENSOR_STALE_MS = 500;

/**
 * Turns filter statistics into a verdict. One valid reading never proves healthy tracking:
 * the verdict is re-evaluated against the clock every time it is asked for.
 */
export function evaluateSensorHealth(
  source: SensorSource,
  stats: FilterStats | null,
  nowSec: number,
  error: string | null
): SensorHealth {
  const base = { source, error, rateHz: stats?.rateHz ?? 0, noiseDeg: stats?.noiseDeg ?? 0, discontinuities: stats?.discontinuities ?? 0, outliersRejected: stats?.outliersRejected ?? 0 };
  if (error) return { ...base, state: 'faulted', ageMs: Infinity, usable: false, message: `Motion sensor error: ${error}` };
  if (!stats || stats.samples === 0 || source === 'none') {
    return { ...base, state: 'none', ageMs: Infinity, usable: false, message: 'No motion data yet' };
  }
  const ageMs = Math.max(0, (nowSec - stats.lastTimestamp) * 1000);
  if (ageMs > SENSOR_STALE_MS) {
    return { ...base, state: 'stale', ageMs, usable: false, message: 'Motion sensor stopped updating — automatic capture paused' };
  }
  if (stats.samples >= 20 && (stats.rateHz < 12 || stats.noiseDeg > 2)) {
    return { ...base, state: 'degraded', ageMs, usable: true, message: stats.rateHz < 12 ? 'Slow motion sensor — turn slowly' : 'Noisy motion sensor — hold steadier' };
  }
  return { ...base, state: 'ok', ageMs, usable: true, message: 'Tracking OK' };
}

/**
 * Decides which orientation source may feed the pose filter. Sources have different yaw
 * references, so once photos exist only the source those photos were taken with is accepted.
 *
 *  - unlocked: any source is accepted; a change of source is reported so the caller resets the
 *    filter (nothing has been recorded yet, so nothing is invalidated);
 *  - locked: only the locked source is accepted; everything else is rejected and counted.
 *    If the locked source was never seen (resume after a restart) it locks to the first source
 *    that delivers, unless the capture recorded which source it used.
 */
export class SensorSourceGate {
  private current: SensorSource = 'none';
  private locked = false;
  private expected: SensorSource = 'none';
  public rejected = 0;

  get source(): SensorSource {
    return this.current;
  }
  get isLocked(): boolean {
    return this.locked;
  }
  get lockedTo(): SensorSource {
    return this.locked ? this.expected : 'none';
  }

  /** @param expected the source the capture's existing photos used, when known. */
  lock(expected?: SensorSource): void {
    if (this.locked) return;
    this.locked = true;
    this.expected = expected && expected !== 'none' ? expected : this.current;
  }

  unlock(): void {
    this.locked = false;
    this.expected = 'none';
  }

  /** New camera/sensor session (restart): forget the live source but keep any lock. */
  restart(): void {
    this.current = 'none';
  }

  /** Full reset for a genuinely new capture. */
  reset(): void {
    this.current = 'none';
    this.locked = false;
    this.expected = 'none';
    this.rejected = 0;
  }

  /** 'accept' = feed the filter; 'switch' = accept after resetting it; 'reject' = ignore. */
  offer(source: Exclude<SensorSource, 'none'>): 'accept' | 'switch' | 'reject' {
    if (this.locked) {
      if (this.expected === 'none') this.expected = source;
      if (source !== this.expected) {
        this.rejected++;
        return 'reject';
      }
    }
    if (this.current === source) return 'accept';
    const first = this.current === 'none';
    this.current = source;
    return first ? 'accept' : 'switch';
  }
}
