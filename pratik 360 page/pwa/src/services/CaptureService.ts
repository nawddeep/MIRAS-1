import type { FrameRecord, HeadingRecord, LocationRecord } from '../models/CaptureModels';
import { CaptureError } from '../models/CaptureModels';
import { Geometry, SphericalAngle } from '../geometry/SphericalGeometry';
import { planLock, snapshotSettings, verifyLock } from './CameraLock';
import type { CameraLockDetail, CameraSettingsSnapshot } from './CameraLock';
import {
  PoseFilter,
  SensorSourceGate,
  evaluateSensorHealth,
  type SensorHealth,
  type SensorSource,
  quaternionToCameraBasis,
  quaternionToSphericalPose,
  slerpQuaternion,
  sphericalToCameraBasis,
  type CameraBasis,
  type PoseSample,
  type Quaternion
} from './PosePipeline';
import { FrameQuality, type FrameQualityMetrics } from '../geometry/FrameQuality';
import type { CameraIdentity } from '../geometry/ResumeSync';

/**
 * Documented initial vertical FOV fallback (in degrees) for standard ~26mm smartphone main cameras
 * in portrait orientation before the first bundle-adjustment focal calibration completes.
 */
export const INITIAL_PORTRAIT_VFOV_DEG = 63.0;
// Calibration is stored per camera (lens + stream aspect). One shared value was wrong as soon
// as the user switched between main, ultra-wide or tele lenses, or between 4:3 and 16:9.
const CALIBRATION_STORAGE_KEY = 'miras_lens_calibration_v2';
const LEGACY_VFOV_STORAGE_KEY = 'miras_calibrated_vfov_deg';
const DEFAULT_CAMERA_KEY = 'default';

export interface LensCalibration {
  /** Field of view across the frame's long side, degrees. */
  vfov: number;
  /** Accumulated evidence weight (sum of per-stitch confidences, 0..1 each). */
  weight: number;
  updated: string;
}

/** Stable key for a camera configuration: lens label + long:short aspect (rounded). */
export function cameraKeyFor(label: string | null | undefined, width: number, height: number): string {
  const aspect = Math.max(width, height) / Math.max(1, Math.min(width, height));
  const lens = (label ?? '').trim().toLowerCase().replace(/\s+/g, ' ') || DEFAULT_CAMERA_KEY;
  return `${lens}|${aspect.toFixed(2)}`;
}

function readCalibrations(): Record<string, LensCalibration> {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(CALIBRATION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, LensCalibration>) : {};
  } catch {
    return {};
  }
}

export function getLensCalibration(cameraKey?: string | null): LensCalibration | null {
  const entry = readCalibrations()[cameraKey ?? DEFAULT_CAMERA_KEY];
  return entry && Number.isFinite(entry.vfov) && entry.vfov >= 25 && entry.vfov <= 110 ? entry : null;
}

/** Calibrated long-side FOV for this camera, or the documented default. */
export function getCalibratedVerticalFOV(cameraKey?: string | null): number {
  const entry = getLensCalibration(cameraKey);
  if (entry) return entry.vfov;
  if (!cameraKey) {
    // Pre-v2 single value, only used when no camera is known.
    try {
      const legacy = parseFloat(localStorage.getItem(LEGACY_VFOV_STORAGE_KEY) ?? '');
      if (Number.isFinite(legacy) && legacy >= 25 && legacy <= 110) return legacy;
    } catch {
      // ignore
    }
  }
  return INITIAL_PORTRAIT_VFOV_DEG;
}

/** Long-side FOV implied by recorded intrinsics (fx in px, frame size in px). */
export function fovFromIntrinsics(fx: number, width: number, height: number): number {
  return (2 * Math.atan(Math.max(width, height) / 2 / fx) * 180) / Math.PI;
}

/**
 * Folds a stitch's focal estimate into the stored calibration for that camera, weighted by
 * how trustworthy the alignment was. `captureVfov` is the FOV the frames were recorded with
 * (not today's calibration, which may have changed since), so the update is exact.
 * Returns the new calibrated FOV, or null when the evidence was too weak to use.
 */
export function updateLensCalibration(
  cameraKey: string | null | undefined,
  captureVfov: number,
  focalScale: number,
  confidence: number
): number | null {
  if (!Number.isFinite(focalScale) || focalScale <= 0.7 || focalScale >= 1.4) return null;
  if (!Number.isFinite(confidence) || confidence < 0.35) return null;
  const measured =
    (2 * Math.atan(Math.tan((captureVfov * Math.PI) / 360) / focalScale) * 180) / Math.PI;
  if (measured < 25 || measured > 110) return null;
  const key = cameraKey ?? DEFAULT_CAMERA_KEY;
  const all = readCalibrations();
  const prev = all[key];
  const weight = (prev?.weight ?? 0) + confidence;
  const vfov = prev ? (prev.vfov * prev.weight + measured * confidence) / weight : measured;
  all[key] = { vfov, weight: Math.min(weight, 20), updated: new Date().toISOString() };
  try {
    localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(all));
  } catch {
    // ignore storage errors
  }
  return vfov;
}

export function isSimulatorModeEnabled(): boolean {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('sim') === '1') return true;
  }
  return false;
}

export function isDebugToolsEnabled(): boolean {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('debug') === '1' || params.get('sim') === '1') return true;
  }
  try {
    return Boolean(import.meta.env?.DEV);
  } catch {
    return false;
  }
}

export interface CameraDeviceOption {
  deviceId: string;
  label: string;
}

export interface CameraSample {
  angle: SphericalAngle;
  roll: number;
  basis: CameraBasis; // camera right/up/forward in world (panorama) space
  transform: number[]; // 16 floats column-major
  intrinsics: number[]; // 9 floats column-major
  resolution: { width: number; height: number };
  timestamp: number;
  velocity: number;
  dark: boolean;
  hasGyro: boolean;
}

export interface CameraLockReport {
  /** True only when the camera REPORTED manual exposure after the request (verified read-back). */
  exposureLocked: boolean;
  whiteBalanceLocked: boolean;
  note: string | null;
  detail?: CameraLockDetail;
  /** Settings right after the lock attempt: reference for per-photo drift checks. */
  reference?: CameraSettingsSnapshot;
}

const GEOCODE_CACHE_KEY = 'miras_geocode_cache_v1';
let lastGeocodeTimestamp = 0;

export class HeadingService {
  public heading: HeadingRecord | null = null;
  public location: LocationRecord | null = null;
  public place: string | null = null;
  public message: string | null = null;
  public motionPermissionState: 'unknown' | 'granted' | 'denied' = 'unknown';

  private orientationListener: ((e: DeviceOrientationEvent) => void) | null = null;

  async requestMotionPermission(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    const DevOrient = window.DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
    if (DevOrient && typeof DevOrient.requestPermission === 'function') {
      try {
        const state = await DevOrient.requestPermission();
        this.motionPermissionState = state;
        if (state !== 'granted') {
          this.message = 'Motion sensor permission was denied. Enable Motion & Orientation access in browser settings.';
          return false;
        }
      } catch {
        this.motionPermissionState = 'denied';
        return false;
      }
    } else {
      this.motionPermissionState = 'granted';
    }

    this.startCompassListener();
    return true;
  }

  startCompassListener(): void {
    if (typeof window === 'undefined' || this.orientationListener) return;
    this.orientationListener = (e: DeviceOrientationEvent) => {
      const webkitCompassHeading = (e as unknown as { webkitCompassHeading?: number })
        .webkitCompassHeading;
      const webkitCompassAccuracy = (e as unknown as { webkitCompassAccuracy?: number })
        .webkitCompassAccuracy;

      if (
        typeof webkitCompassHeading === 'number' &&
        typeof webkitCompassAccuracy === 'number' &&
        webkitCompassHeading >= 0 &&
        webkitCompassAccuracy >= 0
      ) {
        this.heading = { degrees: webkitCompassHeading, accuracy: webkitCompassAccuracy };
      } else if (e.absolute && typeof e.alpha === 'number') {
        const deg = Geometry.wrap(360 - e.alpha);
        this.heading = { degrees: deg, accuracy: 10 };
      }
    };

    window.addEventListener(
      'deviceorientationabsolute' as keyof WindowEventMap,
      this.orientationListener as EventListener,
      { passive: true }
    );
    window.addEventListener('deviceorientation', this.orientationListener, { passive: true });
  }

  async requestLocationOnce(enableReverseGeocode = false): Promise<void> {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return;
    return new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          if (pos.coords.accuracy >= 0) {
            this.location = {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy
            };
            if (
              typeof pos.coords.heading === 'number' &&
              Number.isFinite(pos.coords.heading) &&
              pos.coords.heading >= 0 &&
              !this.heading
            ) {
              this.heading = { degrees: pos.coords.heading, accuracy: 12 };
            }
            if (enableReverseGeocode && !this.place) {
              await this.reverseGeocodeCached(pos.coords.latitude, pos.coords.longitude);
            }
          }
          resolve();
        },
        () => {
          this.message =
            'Location unavailable. Capture continues using the first shot as its reference.';
          resolve();
        },
        { enableHighAccuracy: false, maximumAge: 60000, timeout: 6000 }
      );
    });
  }

  async reverseGeocodeCached(lat: number, lon: number): Promise<string | null> {
    // Round coordinates to 2 decimal places (~1.1 km) for privacy and cache hit rate
    const rLat = Math.round(lat * 100) / 100;
    const rLon = Math.round(lon * 100) / 100;
    const key = `${rLat.toFixed(2)},${rLon.toFixed(2)}`;

    try {
      const rawCache = localStorage.getItem(GEOCODE_CACHE_KEY);
      if (rawCache) {
        const parsed = JSON.parse(rawCache) as Record<string, string>;
        if (parsed[key]) {
          this.place = parsed[key];
          return this.place;
        }
      }
    } catch {
      // Ignore storage error
    }

    const now = Date.now();
    if (now - lastGeocodeTimestamp < 2000) {
      this.place = `${rLat.toFixed(2)}°, ${rLon.toFixed(2)}°`;
      return this.place;
    }
    lastGeocodeTimestamp = now;

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${rLat.toFixed(2)}&lon=${rLon.toFixed(2)}`,
        { headers: { Accept: 'application/json' } }
      );
      if (res.ok) {
        const data = await res.json();
        const addr = data?.address;
        const resolved =
          addr?.city ||
          addr?.town ||
          addr?.village ||
          addr?.suburb ||
          addr?.county ||
          data?.name ||
          `${rLat.toFixed(2)}°, ${rLon.toFixed(2)}°`;
        this.place = resolved;
        try {
          const rawCache = localStorage.getItem(GEOCODE_CACHE_KEY);
          const parsed = rawCache ? (JSON.parse(rawCache) as Record<string, string>) : {};
          parsed[key] = resolved;
          localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(parsed));
        } catch {
          // Ignore
        }
        return resolved;
      }
    } catch {
      this.place = `${rLat.toFixed(2)}°, ${rLon.toFixed(2)}°`;
    }
    return this.place;
  }

  stop(): void {
    if (typeof window !== 'undefined' && this.orientationListener) {
      window.removeEventListener(
        'deviceorientationabsolute' as keyof WindowEventMap,
        this.orientationListener as EventListener
      );
      window.removeEventListener('deviceorientation', this.orientationListener);
      this.orientationListener = null;
    }
  }
}

export class CaptureService {
  public stream: MediaStream | null = null;
  public videoElement: HTMLVideoElement | null = null;
  public onTrackEnded: (() => void) | null = null;

  public manualYaw = 0;
  public manualPitch = 0;
  public hasHardwareGyro = false;
  public simulatedMode = false;
  public stateDirty = true;

  public currentYaw = 0;
  public currentPitch = 0;
  public currentRoll = 0;
  public currentVelocity = 0;
  public isDark = false;
  public verticalFOV = getCalibratedVerticalFOV();
  /** Lens + stream-shape key for calibration (set once the camera is running). */
  public cameraKey: string | null = null;
  public availableDevices: CameraDeviceOption[] = [];
  public selectedDeviceId: string | null = null;

  /** Camera axes (right, up, forward) in panorama space, including real roll. */
  public currentBasis: CameraBasis | null = null;

  private poseFilter = new PoseFilter(0.35);
  private quatSensor: { stop?: () => void } | null = null;
  // Once the quaternion sensor delivers, deviceorientation events are ignored so the two
  // sources (different yaw references) never feed the same filter.
  private usingQuaternionSensor = false;
  private orientationListener: ((e: DeviceOrientationEvent) => void) | null = null;
  private screenOrientListener: (() => void) | null = null;
  private screenAngle = 0;
  private sourceGate = new SensorSourceGate();
  private get sensorSource(): SensorSource {
    return this.sourceGate.source;
  }
  private sensorError: string | null = null;
  public sensorDiscontinuities = 0;

  /** Freezes the orientation source (call after the first photo). */
  lockSensorSource(locked = true, expected?: SensorSource): void {
    if (locked) this.sourceGate.lock(expected);
    else this.sourceGate.unlock();
  }

  /** Source the locked capture uses, and how many foreign readings were refused. */
  sensorSourceInfo(): { source: SensorSource; lockedTo: SensorSource; rejectedReadings: number } {
    return { source: this.sourceGate.source, lockedTo: this.sourceGate.lockedTo, rejectedReadings: this.sourceGate.rejected };
  }

  /** Current tracking verdict, re-evaluated against the clock on every call. */
  sensorHealth(nowSec = performance.now() / 1000): SensorHealth {
    return evaluateSensorHealth(this.sensorSource, this.hasHardwareGyro ? this.poseFilter.stats() : null, nowSec, this.sensorError);
  }

  /** Sensor timestamp (ms, performance.now timeline) when the browser supplies a sane one. */
  private static sensorTime(stampMs: unknown): number {
    const now = performance.now();
    return typeof stampMs === 'number' && Number.isFinite(stampMs) && Math.abs(stampMs - now) < 1000 ? stampMs / 1000 : now / 1000;
  }

  private lumaCanvas: HTMLCanvasElement | OffscreenCanvas | null = null;
  private lumaCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;
  private lastLumaCheckTime = 0;
  private isCapturingPhoto = false;

  private encodeWorker: Worker | null = null;
  private encodeSeq = 0;
  private pendingEncodes = new Map<
    number,
    { resolve: (bytes: Uint8Array) => void; reject: (err: Error) => void }
  >();

  static getScreenOrientationAngle(): number {
    if (typeof window === 'undefined') return 0;
    if (window.screen?.orientation && typeof window.screen.orientation.angle === 'number') {
      return window.screen.orientation.angle;
    }
    const winOrient = (window as unknown as { orientation?: number }).orientation;
    return typeof winOrient === 'number' ? winOrient : 0;
  }

  async listRearCameras(): Promise<CameraDeviceOption[]> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      return [];
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === 'videoinput');
      // Filter or sort to prefer standard main rear camera and avoid ultra-wide / telephoto by default
      const scored = videoInputs.map((d, idx) => {
        const label = d.label || `Camera ${idx + 1}`;
        const lower = label.toLowerCase();
        let score = 0;
        if (/back|rear|environment/.test(lower)) score += 10;
        if (/ultra|0\.5x|tele|zoom|macro|depth|front|user/.test(lower)) score -= 15;
        if (/wide|main|camera 0|back camera/.test(lower) && !/ultra/.test(lower)) score += 5;
        return { deviceId: d.deviceId, label, score };
      });
      scored.sort((a, b) => b.score - a.score);
      this.availableDevices = scored.map((s) => ({ deviceId: s.deviceId, label: s.label }));
      return this.availableDevices;
    } catch {
      return [];
    }
  }

  async start(
    videoEl: HTMLVideoElement,
    options?: { allowSimulator?: boolean; deviceId?: string }
  ): Promise<void> {
    // Restarting (lens switch, resume from background, Retry) must release the old camera
    // and sensor listeners first: a second live stream fails on many Android phones, and
    // duplicate listeners double-feed the pose filter.
    this.stopInputs();
    this.videoElement = videoEl;
    this.poseFilter.reset();
    this.poseHistory = [];
    this.currentBasis = null;
    this.manualYaw = 0;
    this.manualPitch = 0;
    this.currentYaw = 0;
    this.currentPitch = 0;
    this.currentRoll = 0;
    this.currentVelocity = 0;
    this.hasHardwareGyro = false;
    this.sourceGate.restart();
    this.sensorError = null;
    this.simulatedMode = false;
    this.stateDirty = true;
    this.verticalFOV = getCalibratedVerticalFOV();

    const simAllowed = options?.allowSimulator ?? isSimulatorModeEnabled();

    if (simAllowed) {
      this.simulatedMode = true;
      this.startSensors();
      return;
    }

    if (typeof window !== 'undefined' && !window.isSecureContext) {
      throw new CaptureError(
        'Camera access requires a secure HTTPS connection (or localhost). Open this page over HTTPS and retry.'
      );
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new CaptureError(
        'Camera access is unavailable in this browser. Open in Safari (iOS) or Chrome (Android) over HTTPS.'
      );
    }

    const isPortrait =
      typeof window !== 'undefined' ? window.innerHeight >= window.innerWidth : true;
    const idealW = isPortrait ? 1440 : 1920;
    const idealH = isPortrait ? 1920 : 1440;

    try {
      const videoConstraints: MediaTrackConstraints = options?.deviceId
        ? {
            deviceId: { exact: options.deviceId },
            width: { ideal: idealW },
            height: { ideal: idealH }
          }
        : {
            facingMode: { ideal: 'environment' },
            width: { ideal: idealW },
            height: { ideal: idealH }
          };

      this.stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false
      });

      const cams = await this.listRearCameras();
      const currentTrack = this.stream.getVideoTracks()[0];
      if (currentTrack) {
        this.selectedDeviceId = currentTrack.getSettings().deviceId ?? cams[0]?.deviceId ?? null;
        currentTrack.onended = () => {
          this.onTrackEnded?.();
        };
      }

      videoEl.srcObject = this.stream;
      videoEl.setAttribute('playsinline', 'true');
      await videoEl.play();

      // Use the calibration of THIS lens at THIS stream shape (actual delivered size).
      this.cameraKey = cameraKeyFor(
        currentTrack?.label,
        videoEl.videoWidth || currentTrack?.getSettings().width || 0,
        videoEl.videoHeight || currentTrack?.getSettings().height || 0
      );
      this.verticalFOV = getCalibratedVerticalFOV(this.cameraKey);
    } catch (err) {
      const name = (err as { name?: string })?.name ?? '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        throw new CaptureError(
          'Camera permission was denied. Enable Camera access in your browser/site settings, then tap Retry.'
        );
      }
      if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        throw new CaptureError(
          'No camera was found on this device. Connect a camera or open on your phone, then tap Retry.'
        );
      }
      if (name === 'NotReadableError' || name === 'TrackStartError') {
        throw new CaptureError(
          'The camera is currently in use by another application. Close other camera apps and tap Retry.'
        );
      }
      throw new CaptureError(
        `Could not start camera (${name || 'Error'}). Check permissions and tap Retry.`
      );
    }

    this.startSensors();
  }

  private startSensors(): void {
    if (typeof window === 'undefined') return;
    this.screenAngle = CaptureService.getScreenOrientationAngle();
    this.screenOrientListener = () => {
      this.screenAngle = CaptureService.getScreenOrientationAngle();
      this.stateDirty = true;
    };
    window.addEventListener('orientationchange', this.screenOrientListener, { passive: true });
    window.screen?.orientation?.addEventListener('change', this.screenOrientListener);

    // One orientation source at a time. Mixing sources broke tracking: Android's absolute
    // (compass) sensor and its relative deviceorientation stream disagree on yaw, so the
    // filter flipped between them on every event, dots jittered and the shutter never fired.
    //
    // Preferred: RelativeOrientationSensor (gyro + accelerometer quaternion, like ARKit's
    // gravity-aligned tracking: smooth, no magnetometer jumps, no Euler gimbal lock in
    // landscape). Fallback: deviceorientation (iOS Safari, older browsers).
    const WinAny = window as unknown as {
      RelativeOrientationSensor?: new (opts: { frequency: number; referenceFrame?: string }) => {
        quaternion?: ArrayLike<number> | null;
        timestamp?: number;
        addEventListener: (ev: string, fn: (e?: unknown) => void) => void;
        start: () => void;
        stop: () => void;
      };
    };

    if (typeof WinAny.RelativeOrientationSensor === 'function') {
      try {
        const sensor = new WinAny.RelativeOrientationSensor({
          frequency: 60,
          referenceFrame: 'screen'
        });
        sensor.addEventListener('reading', () => {
          const q = sensor.quaternion;
          if (!q || q.length !== 4) return;
          const verdict = this.sourceGate.offer('relative-sensor');
          if (verdict === 'reject') {
            // Photos already exist with another source's yaw reference: never mix them.
            this.stateDirty = true;
            return;
          }
          if (verdict === 'switch' || !this.usingQuaternionSensor) {
            // Nothing recorded yet: drop whatever deviceorientation fed in so far.
            this.usingQuaternionSensor = true;
            this.poseFilter.reset();
          }
          this.sensorError = null;
          this.applyPose(
            this.poseFilter.updateFromQuaternion(
              { x: q[0], y: q[1], z: q[2], w: q[3] },
              CaptureService.sensorTime(sensor.timestamp)
            )
          );
        });
        sensor.addEventListener('error', (ev?: unknown) => {
          const err = (ev as { error?: { name?: string; message?: string } } | undefined)?.error;
          const text = [err?.name, err?.message].filter(Boolean).join(': ') || 'RelativeOrientationSensor error';
          if (this.quatSensor === sensor) this.quatSensor = null;
          if (this.sourceGate.isLocked) {
            // Photos already exist with this source's yaw reference. Switching to another source
            // would silently mix incompatible poses, so tracking is reported as faulted instead.
            this.sensorError = text;
            this.stateDirty = true;
            return;
          }
          // Nothing captured yet: safe to fall back to deviceorientation.
          if (this.usingQuaternionSensor) {
            this.usingQuaternionSensor = false;
            this.poseFilter.reset();
          }
        });
        sensor.start();
        this.quatSensor = sensor;
      } catch {
        // Constructor blocked by Permissions-Policy or unsupported options
      }
    }

    this.orientationListener = (e: DeviceOrientationEvent) => {
      if (this.usingQuaternionSensor) return;
      if (e.alpha === null || e.beta === null || e.gamma === null) return;
      if (this.sourceGate.offer('deviceorientation') === 'reject') {
        this.stateDirty = true;
        return;
      }
      this.applyPose(
        this.poseFilter.updateFromEuler(
          e.alpha,
          e.beta,
          e.gamma,
          CaptureService.sensorTime(e.timeStamp),
          this.screenAngle
        )
      );
    };
    window.addEventListener('deviceorientation', this.orientationListener, { passive: true });
  }

  /** Sensor handlers only write plain state; the rAF loop does all drawing. */
  private applyPose(sample: PoseSample): void {
    this.poseHistory.push({ t: sample.timestamp * 1000, q: sample.quaternion });
    if (this.poseHistory.length > 90) this.poseHistory.shift(); // ~1.5 s at 60 Hz
    this.hasHardwareGyro = true;
    if (sample.discontinuity) this.sensorDiscontinuities++;
    this.currentYaw = sample.yaw;
    this.currentPitch = sample.pitch;
    this.currentRoll = sample.roll;
    this.currentBasis = sample.basis;
    this.currentVelocity = sample.velocityDegPerSec;
    this.stateDirty = true;
  }

  static deviceEulerToSpherical(
    alpha: number,
    beta: number,
    gamma: number,
    screenAngle = 0
  ): { yaw: number; pitch: number; roll: number } {
    const filter = new PoseFilter(1.0);
    const s = filter.updateFromEuler(alpha, beta, gamma, 0, screenAngle);
    return { yaw: s.yaw, pitch: s.pitch, roll: s.roll };
  }

  static buildTransformFromSpherical(yaw: number, pitch: number, roll = 0): number[] {
    const a = (yaw * Math.PI) / 180;
    const p = (pitch * Math.PI) / 180;
    const r = (roll * Math.PI) / 180;

    const rx0 = Math.cos(a), ry0 = 0, rz0 = Math.sin(a);
    const ux0 = -Math.sin(a) * Math.sin(p), uy0 = Math.cos(p), uz0 = Math.cos(a) * Math.sin(p);
    const zx = -Math.sin(a) * Math.cos(p), zy = -Math.sin(p), zz = Math.cos(a) * Math.cos(p);

    const cosR = Math.cos(r), sinR = Math.sin(r);
    const rx = cosR * rx0 + sinR * ux0;
    const ry = cosR * ry0 + sinR * uy0;
    const rz = cosR * rz0 + sinR * uz0;

    const ux = -sinR * rx0 + cosR * ux0;
    const uy = -sinR * ry0 + cosR * uy0;
    const uz = -sinR * rz0 + cosR * uz0;

    return [
      rx, ry, rz, 0,
      ux, uy, uz, 0,
      zx, zy, zz, 0,
      0, 0, 0, 1
    ];
  }

  /**
   * Column-major camera-to-world transform from camera axes, matching ARKit's layout:
   * col0 = right, col1 = up, col2 = back (-forward).
   */
  static buildTransformFromBasis(b: CameraBasis): number[] {
    return [b[0], b[1], b[2], 0, b[3], b[4], b[5], 0, -b[6], -b[7], -b[8], 0, 0, 0, 0, 1];
  }

  /**
   * `verticalFOV` is the field of view across the frame's LONG side (portrait height).
   * Using the long side keeps the focal length right when the phone is held in landscape,
   * where the frame's height is the short side.
   */
  static buildIntrinsics(
    width: number,
    height: number,
    verticalFOV = getCalibratedVerticalFOV()
  ): number[] {
    const f = Math.max(width, height) / 2 / Math.tan((verticalFOV * Math.PI) / 360);
    return [f, 0, 0, 0, f, 0, width / 2, height / 2, 1];
  }

  /**
   * Throttled (~1 Hz) darkness probe that never runs during shot capture.
   */
  private maybeProbeDarkness(nowSec: number): void {
    if (
      this.simulatedMode ||
      this.isCapturingPhoto ||
      nowSec - this.lastLumaCheckTime < 1.0 ||
      !this.videoElement ||
      this.videoElement.readyState < 2
    ) {
      return;
    }
    this.lastLumaCheckTime = nowSec;

    try {
      if (!this.lumaCanvas) {
        if (typeof OffscreenCanvas !== 'undefined') {
          this.lumaCanvas = new OffscreenCanvas(16, 12);
        } else {
          const c = document.createElement('canvas');
          c.width = 16;
          c.height = 12;
          this.lumaCanvas = c;
        }
        this.lumaCtx = this.lumaCanvas.getContext('2d', {
          willReadFrequently: true
        }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
      }
      if (this.lumaCtx) {
        this.lumaCtx.drawImage(this.videoElement, 0, 0, 16, 12);
        const data = this.lumaCtx.getImageData(0, 0, 16, 12).data;
        let lumaSum = 0;
        for (let i = 0; i < data.length; i += 4) {
          lumaSum += (77 * data[i] + 150 * data[i + 1] + 29 * data[i + 2]) >> 8;
        }
        const prevDark = this.isDark;
        this.isDark = lumaSum / (16 * 12) < 35;
        if (prevDark !== this.isDark) {
          this.stateDirty = true;
        }
      }
    } catch {
      // Ignore transient video frame read errors
    }
  }

  /**
   * Yaw added to every sensor reading (degrees). Relative orientation sensors pick a new,
   * arbitrary yaw reference whenever they restart (resume, app switch); the capture-resume
   * re-sync measures that change from the images and stores it here so new photos land in
   * the same frame of reference as the earlier ones.
   */
  public worldYawOffsetDeg = 0;

  /** Recent filtered orientations with their time (ms, performance.now timeline). */
  private poseHistory: Array<{ t: number; q: Quaternion }> = [];

  /** Identity of the running camera (for capture-resume checks). */
  describeCamera(): CameraIdentity {
    const track = this.stream?.getVideoTracks()[0];
    const width = this.videoElement?.videoWidth || track?.getSettings().width || 0;
    const height = this.videoElement?.videoHeight || track?.getSettings().height || 0;
    const k = CaptureService.buildIntrinsics(width || 1, height || 1, this.verticalFOV);
    return {
      deviceId: this.selectedDeviceId ?? track?.getSettings().deviceId ?? null,
      label: track?.label ?? '',
      key: this.cameraKey ?? cameraKeyFor(track?.label, width, height),
      width,
      height,
      fx: k[0],
      fov: this.verticalFOV
    };
  }

  /** Builds a camera sample from a pose, applying the session yaw offset. */
  private sampleFrom(
    basisIn: CameraBasis,
    yawIn: number,
    pitch: number,
    roll: number,
    velocity: number,
    timestampSec: number
  ): CameraSample {
    const off = (this.worldYawOffsetDeg * Math.PI) / 180;
    const c = Math.cos(off), s = Math.sin(off);
    // Rotate about the vertical axis: yaw increases toward +X (east) from −Z (north).
    const rot = (x: number, y: number, z: number): [number, number, number] => [x * c - z * s, y, x * s + z * c];
    const r = rot(basisIn[0], basisIn[1], basisIn[2]);
    const u = rot(basisIn[3], basisIn[4], basisIn[5]);
    const f = rot(basisIn[6], basisIn[7], basisIn[8]);
    const basis: CameraBasis = [r[0], r[1], r[2], u[0], u[1], u[2], f[0], f[1], f[2]];
    const yaw = Geometry.wrap(yawIn + this.worldYawOffsetDeg);
    const width = this.videoElement?.videoWidth || 1280;
    const height = this.videoElement?.videoHeight || 960;
    return {
      angle: new SphericalAngle(yaw, pitch),
      roll,
      basis,
      transform: CaptureService.buildTransformFromBasis(basis),
      intrinsics: CaptureService.buildIntrinsics(width, height, this.verticalFOV),
      resolution: { width, height },
      timestamp: timestampSec,
      velocity,
      dark: this.isDark,
      hasGyro: this.hasHardwareGyro
    };
  }

  readCurrentSample(): CameraSample {
    const now = performance.now() / 1000;
    this.maybeProbeDarkness(now);
    if (this.hasHardwareGyro && this.currentBasis) {
      return this.sampleFrom(this.currentBasis, this.currentYaw, this.currentPitch, this.currentRoll, this.currentVelocity, now);
    }
    // Simulator / touch aiming (never used to place real photos; see App trigger gating).
    const yaw = Geometry.wrap(this.manualYaw);
    const pitch = Math.min(89.5, Math.max(-89.5, this.manualPitch));
    return this.sampleFrom(sphericalToCameraBasis(yaw, pitch, 0), yaw, pitch, 0, 0, now);
  }

  /**
   * Orientation at time `tMs` (performance.now timeline) by interpolating the pose history,
   * or null if `tMs` is outside the recorded window.
   */
  sampleAt(tMs: number): CameraSample | null {
    const h = this.poseHistory;
    if (h.length < 2 || tMs < h[0].t || tMs > h[h.length - 1].t + 40) return null;
    let k = h.length - 1;
    while (k > 0 && h[k - 1].t > tMs) k--;
    const a = h[Math.max(0, k - 1)];
    const b = h[k];
    const span = b.t - a.t;
    const w = span > 0 ? Math.min(1, Math.max(0, (tMs - a.t) / span)) : 1;
    const q = slerpQuaternion(a.q, b.q, w);
    const pose = quaternionToSphericalPose(q);
    return this.sampleFrom(quaternionToCameraBasis(q), pose.yaw, pose.pitch, pose.roll, this.currentVelocity, tMs / 1000);
  }

  private getOrCreateEncodeWorker(): Worker | null {
    if (this.encodeWorker) return this.encodeWorker;
    if (typeof Worker === 'undefined') return null;
    try {
      const worker = new Worker(
        new URL('../workers/frameEncodeWorker.ts', import.meta.url),
        { type: 'module' }
      );
      worker.onmessage = (
        e: MessageEvent<{ id: number; buffer?: ArrayBuffer; error?: string }>
      ) => {
        const pending = this.pendingEncodes.get(e.data.id);
        if (!pending) return;
        this.pendingEncodes.delete(e.data.id);
        if (e.data.error || !e.data.buffer) {
          pending.reject(new CaptureError(e.data.error ?? 'Worker frame encoding failed'));
        } else {
          pending.resolve(new Uint8Array(e.data.buffer));
        }
      };
      // If the worker fails to load or crashes, drop it so the next shot uses the canvas fallback.
      worker.onerror = () => {
        if (this.encodeWorker === worker) this.encodeWorker = null;
        worker.terminate();
        this.failPendingEncodes('Frame encoder stopped unexpectedly.');
      };
      this.encodeWorker = worker;
      return worker;
    } catch {
      return null;
    }
  }

  private encodeBitmapInWorker(bitmap: ImageBitmap, quality = 0.92): Promise<Uint8Array> {
    const worker = this.getOrCreateEncodeWorker();
    if (!worker) {
      bitmap.close();
      return Promise.reject(new Error('No worker'));
    }
    const id = ++this.encodeSeq;
    return new Promise<Uint8Array>((resolve, reject) => {
      this.pendingEncodes.set(id, { resolve, reject });
      worker.postMessage({ id, bitmap, quality }, [bitmap]);
    });
  }

  async captureFrame(
    index: number,
    target: SphericalAngle,
    sample: CameraSample,
    fallbackPanorama?: HTMLImageElement | null
  ): Promise<{
    record: FrameRecord;
    data: Uint8Array;
    fallback: boolean;
    /** Metrics from the SAME pixels that were saved; null only if they could not be measured. */
    quality: FrameQualityMetrics | null;
  }> {
    this.isCapturingPhoto = true;
    try {
      let width = sample.resolution.width || 1280;
      let height = sample.resolution.height || 960;
      let data: Uint8Array | null = null;
      let usedFallback = false;
      let quality: FrameQualityMetrics | null = null;
      let poseSample = sample;
      let poseSync: NonNullable<FrameRecord['poseSync']> = { method: 'simulated', lagMs: 0, uncertaintyDeg: 0 };

      if (!this.simulatedMode) {
        const track = this.stream?.getVideoTracks()[0];
        if (!track || track.readyState !== 'live' || !this.videoElement || this.videoElement.readyState < 2) {
          throw new CaptureError('Camera stream was interrupted. Wait for the preview to resume or reopen capture.');
        }

        // Grab a live video frame (instant; same field of view as the preview the dots are drawn
        // on). ImageCapture.takePhoto() is not used: on Android it can take ~1 s and returns a
        // differently cropped full-sensor photo, breaking the pose↔image correspondence.
        //
        // Pose sync: wait for the next decoded camera frame. Where the browser reports when that
        // frame was captured (requestVideoFrameCallback metadata.captureTime), the pose is
        // interpolated from the timestamped sensor history at that instant. Otherwise the pose
        // is read at the frame callback, and the remaining uncertainty (rotation speed × the
        // unknown lag) is recorded instead of being assumed zero.
        const frame = await this.waitForFreshVideoFrame();
        const now = performance.now();
        const speed = Math.max(this.currentVelocity, 0.5); // °/s, floor for sensor jitter
        if (this.hasHardwareGyro) {
          const at = frame.captureTime !== null && now - frame.captureTime >= 0 && now - frame.captureTime < 500
            ? this.sampleAt(frame.captureTime)
            : null;
          if (at && frame.captureTime !== null) {
            poseSample = at;
            poseSync = { method: 'captureTime', lagMs: Math.round(now - frame.captureTime), uncertaintyDeg: +(speed * 0.01).toFixed(3) };
          } else if (frame.viaCallback) {
            poseSample = this.readCurrentSample();
            // Unknown sensor-to-display latency: assume up to two frames (~66 ms).
            poseSync = { method: 'frameCallback', lagMs: Math.round(now - frame.callbackTime), uncertaintyDeg: +(speed * 0.066).toFixed(3) };
          } else {
            poseSample = this.readCurrentSample();
            poseSync = { method: 'immediate', lagMs: 0, uncertaintyDeg: +(speed * 0.12).toFixed(3) };
          }
        }

        if (typeof createImageBitmap === 'function' && this.videoElement) {
          try {
            const bitmap = await createImageBitmap(this.videoElement);
            width = bitmap.width;
            height = bitmap.height;
            quality = this.measureSourceQuality(bitmap);
            // Originals are encoded once, at high quality, and never recompressed.
            data = await this.encodeBitmapInWorker(bitmap, 0.95);
          } catch {
            data = null; // fall through to the canvas path (which measures its own pixels)
          }
        }

        // Fallback: main-thread canvas — measured with the same quality function.
        if (!data && this.videoElement) {
          usedFallback = true;
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new CaptureError('Could not allocate capture canvas.');
          ctx.drawImage(this.videoElement, 0, 0, width, height);
          quality = this.measureSourceQuality(canvas);
          const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95));
          canvas.width = 1;
          canvas.height = 1;
          if (!blob) throw new CaptureError('Could not encode camera frame.');
          data = new Uint8Array(await blob.arrayBuffer());
        }
      } else {
        // Explicit simulator mode (synthetic frames, still measured with the same function).
        usedFallback = true;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new CaptureError('Could not allocate simulator canvas.');
        this.renderSimulatedFrame(ctx, width, height, sample.angle, fallbackPanorama);
        quality = this.measureSourceQuality(canvas);
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95));
        canvas.width = 1;
        canvas.height = 1;
        if (!blob) throw new CaptureError('Could not encode simulator frame.');
        data = new Uint8Array(await blob.arrayBuffer());
      }

      if (!data) throw new CaptureError('Could not capture frame from camera.');
      if (width < 64 || height < 64) throw new CaptureError('The camera delivered an unusably small frame. Reopen capture.');

      const intrinsics = CaptureService.buildIntrinsics(width, height, this.verticalFOV);
      const record: FrameRecord = {
        index,
        target: { yaw: target.yaw, pitch: target.pitch },
        transform: poseSample.transform,
        intrinsics,
        width,
        height,
        timestamp: poseSample.timestamp,
        exposure: 0.016,
        poseSync
      };
      return { record, data, fallback: usedFallback, quality };
    } finally {
      this.isCapturingPhoto = false;
    }
  }

  /**
   * Resolves on the next decoded camera frame (or after 120 ms if the API is missing), with
   * the frame's capture time when the browser provides it.
   */
  private waitForFreshVideoFrame(): Promise<{ captureTime: number | null; callbackTime: number; viaCallback: boolean }> {
    type Meta = { captureTime?: number; expectedDisplayTime?: number };
    const video = this.videoElement as
      | (HTMLVideoElement & { requestVideoFrameCallback?: (cb: (now: number, meta: Meta) => void) => number })
      | null;
    return new Promise((resolve) => {
      const timer = setTimeout(
        () => resolve({ captureTime: null, callbackTime: performance.now(), viaCallback: false }),
        120
      );
      if (video && typeof video.requestVideoFrameCallback === 'function') {
        video.requestVideoFrameCallback((now, meta) => {
          clearTimeout(timer);
          const ct = typeof meta?.captureTime === 'number' && Number.isFinite(meta.captureTime) ? meta.captureTime : null;
          resolve({ captureTime: ct, callbackTime: now, viaCallback: true });
        });
      }
    });
  }

  /** Quality metrics from a ~480 px copy of the frame (a few ms; runs before encoding). */
  private measureSourceQuality(source: ImageBitmap | HTMLCanvasElement): FrameQualityMetrics | null {
    const bitmap = source;
    try {
      const scale = 480 / Math.max(bitmap.width, bitmap.height);
      const w = Math.max(16, Math.round(bitmap.width * scale));
      const h = Math.max(16, Math.round(bitmap.height * scale));
      const canvas =
        typeof OffscreenCanvas !== 'undefined'
          ? new OffscreenCanvas(w, h)
          : Object.assign(document.createElement('canvas'), { width: w, height: h });
      const ctx = canvas.getContext('2d', { willReadFrequently: true }) as
        | CanvasRenderingContext2D
        | OffscreenCanvasRenderingContext2D
        | null;
      if (!ctx) return null;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bitmap, 0, 0, w, h);
      return FrameQuality.measure(ctx.getImageData(0, 0, w, h).data, w, h);
    } catch {
      return null;
    }
  }

  private renderSimulatedFrame(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    angle: SphericalAngle,
    panoImg?: HTMLImageElement | null
  ): void {
    if (panoImg && panoImg.complete && panoImg.naturalWidth > 0) {
      const uv = angle.uv;
      const sw = panoImg.naturalWidth * 0.22;
      const sh = panoImg.naturalHeight * 0.35;
      const sx =
        (uv.u * panoImg.naturalWidth - sw / 2 + panoImg.naturalWidth) % panoImg.naturalWidth;
      const sy = Math.min(
        panoImg.naturalHeight - sh,
        Math.max(0, uv.v * panoImg.naturalHeight - sh / 2)
      );
      ctx.drawImage(panoImg, sx, sy, sw, sh, 0, 0, width, height);
      return;
    }

    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#2a3b4c');
    grad.addColorStop(0.5, '#6b5344');
    grad.addColorStop(1, '#3a2e25');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  /**
   * Reads capabilities and locks exposure & white balance using current sensor settings where supported.
   * Reports clearly when exposure lock is unsupported (e.g. iOS Safari).
   */
  /** Current settings as reported by the camera track (for per-photo drift records). */
  readCameraSettings(): CameraSettingsSnapshot | null {
    const track = this.stream?.getVideoTracks()[0];
    if (!track || typeof track.getSettings !== 'function') return null;
    return snapshotSettings(track.getSettings() as Record<string, unknown>);
  }

  async lockCamera(): Promise<CameraLockReport> {
    if (!this.stream) {
      return {
        exposureLocked: false,
        whiteBalanceLocked: false,
        note: null
      };
    }
    const track = this.stream.getVideoTracks()[0];
    if (!track || typeof track.getCapabilities !== 'function') {
      return {
        exposureLocked: false,
        whiteBalanceLocked: false,
        note: 'Browser does not support camera exposure lock; photometric compensation will balance brightness during stitching.'
      };
    }

    const caps = track.getCapabilities() as Record<string, unknown>;
    const before = track.getSettings() as Record<string, unknown>;
    const { advanced, offered } = planLock(caps, before);
    let applyError: string | null = null;
    if (Object.keys(advanced).length > 0) {
      try {
        await track.applyConstraints({ advanced: [advanced as unknown as MediaTrackConstraintSet] });
      } catch (err) {
        applyError = err instanceof Error ? err.message : String(err);
      }
    }
    // The state comes from what the camera reports afterwards, not from what was requested.
    const effective = snapshotSettings(track.getSettings() as Record<string, unknown>);
    const detail = verifyLock(offered, advanced, effective, applyError);
    const exposureLocked = detail.exposure === 'verified';
    const whiteBalanceLocked = detail.whiteBalance === 'verified';
    const notes: string[] = [];
    if (!exposureLocked) notes.push(`Camera exposure is NOT confirmed locked (${detail.exposure}); photometric compensation will balance frame brightness.`);
    if (!whiteBalanceLocked) notes.push(`Camera white balance is NOT confirmed locked (${detail.whiteBalance}); colour may shift between photos.`);
    return { exposureLocked, whiteBalanceLocked, note: notes.join(' ') || null, detail, reference: effective };
  }

  stop(): void {
    this.stopInputs();
    if (this.encodeWorker) {
      this.encodeWorker.terminate();
      this.encodeWorker = null;
      this.failPendingEncodes('Camera stopped before the photo was saved.');
    }
  }

  /** Stops the camera stream and motion sensors (keeps the encode worker for reuse). */
  private stopInputs(): void {
    if (this.quatSensor && typeof this.quatSensor.stop === 'function') {
      try {
        this.quatSensor.stop();
      } catch {
        // ignore
      }
    }
    this.quatSensor = null;
    this.usingQuaternionSensor = false;
    if (typeof window !== 'undefined') {
      if (this.orientationListener) {
        window.removeEventListener('deviceorientation', this.orientationListener);
        this.orientationListener = null;
      }
      if (this.screenOrientListener) {
        window.removeEventListener('orientationchange', this.screenOrientListener);
        window.screen?.orientation?.removeEventListener('change', this.screenOrientListener);
        this.screenOrientListener = null;
      }
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => {
        t.onended = null;
        t.stop();
      });
      this.stream = null;
    }
  }

  /** Rejects every in-flight frame encode so no shot waits forever (and the shutter unlocks). */
  private failPendingEncodes(message: string): void {
    const pending = [...this.pendingEncodes.values()];
    this.pendingEncodes.clear();
    for (const p of pending) p.reject(new CaptureError(message));
  }
}
