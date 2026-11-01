import type { CameraLockDetail, CameraSettingsSnapshot } from '../services/CameraLock';
import type { CapturePlanState } from '../geometry/CapturePlanner';
import type { ShotTarget, SphericalAngleData } from '../geometry/SphericalGeometry';
import { SphericalAngle } from '../geometry/SphericalGeometry';
import { defaultSafePanoramaWidth } from './DeviceCapabilities';
import type { CameraIdentity } from '../geometry/ResumeSync';

export interface FrameRecord {
  index: number;
  target: SphericalAngleData;
  transform: number[]; // 16 floats, column-major camera-to-world
  intrinsics: number[]; // 9 floats, column-major 3x3
  width: number;
  height: number;
  timestamp: number;
  exposure: number;
  file?: string;
  /** Capture-time quality metrics (blur ratio, exposure) and any accepted-with-caveat note. */
  quality?: FrameQualityRecord;
  /** How the pose was tied to the image (see CaptureService.captureFrame). */
  poseSync?: { method: 'captureTime' | 'frameCallback' | 'immediate' | 'simulated'; lagMs: number; uncertaintyDeg: number };
  /** Capture session (changes on resume / camera restart). */
  session?: string;
  /** Settings the camera reported when this photo was taken (exposure / ISO / white balance drift). */
  camera?: CameraSettingsSnapshot;
}

/** Capture-time quality of one photo. */
export interface FrameQualityRecord {
  /** passed = checked OK; failed = failed checks but kept by the user; unavailable = could not be measured; simulated = synthetic frame. */
  status: 'passed' | 'failed' | 'unavailable' | 'simulated';
  /** Explicit user decision when the photo failed or could not be checked. */
  decision?: 'accepted-with-warning';
  blurRatio: number;
  structureRatio?: number;
  meanLuma: number;
  clipped: number;
  shadowClipped?: number;
  lowTexture: boolean;
  note: string | null;
}

export interface CaptureSession {
  id: string;
  startedAt: string;
  /** first = original session; image-sync = yaw re-measured from the photos; unverified = user continued without a verified re-sync. */
  method: 'first' | 'image-sync' | 'unverified';
  /** Yaw added to this session's sensor readings (degrees). */
  yawOffsetDeg: number;
  /** Match score of the re-sync (NCC), when measured. */
  syncScore?: number;
  /** Estimated yaw uncertainty of the re-sync (degrees). */
  uncertaintyDeg?: number;
}

export function frameFileName(index: number): string {
  return `${String(index).padStart(3, '0')}.jpg`;
}

export interface HeadingRecord {
  degrees: number;
  accuracy: number;
}

export interface LocationRecord {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export interface StitchSettings {
  width: number; // 2048 | 3072 | 4096 | 5760 | 6144 | 8192
  includeFrames: boolean;
  nadirCap: boolean;
  refinement: boolean; // Wide alignment search (6 deg vs 2.5 deg)
  enhance: boolean;
  /** Fill unphotographed areas with a smooth blur. Off = leave them black (honest gaps). */
  fillGaps: boolean;
}

/**
 * Diagnostics recorded for every stitch (shown in the app and exported in capture.json —
 * both come from buildStitchReport, so they always agree). Every number has one meaning.
 */
export interface StitchReport {
  /** Share of the sphere above the optional nadir (pitch ≥ −70°) with real photo pixels. */
  photographedCoverage: number;
  /** Share of the whole sphere synthesised by gap filling (0 when filling is off). */
  filledFraction: number;
  /** Share of the whole sphere with no photo at all (before any fill). */
  missingFraction: number;
  matches: {
    pairs: number;
    verifiedPairs: number;
    /** Distinct candidate points before verification. */
    raw: number;
    /** Points with several equally good candidates (repeating structure). */
    ambiguous: number;
    /** Geometrically verified inliers (3-D rotation consensus). */
    verified: number;
    /** Points rejected by verification. */
    rejected: number;
    /** Matches from pairs too small to verify (< 3 points): low weight, not verified. */
    insufficient: number;
    /** Verified pairs with inliers bunched in a small area (down-weighted). */
    weakPairs: number;
  };
  alignment: {
    /** RMS error (px at the 512 px working size) of the final verified matches, with the sensor poses. */
    rmsBeforePx: number;
    /** Same matches, after the global solve. */
    rmsAfterPx: number;
    focalScale: number;
    /** Implausible focal estimate that was rejected (solve repeated with focal fixed). */
    focalRejected: number | null;
    /** The solve made matches worse, so sensor poses were kept. */
    reverted: boolean;
    converged: boolean;
    iterations: number;
    /** Groups of photos connected by verified matches (1 = one consistent panorama). */
    components: number;
    /** Photos with no verified link: placed by motion sensors only. */
    unconstrainedFrames: number[];
    confidence: number;
  };
  seams: {
    regionsDetected: number;
    regionsAssigned: number;
    regionsSkippedTooLarge: number;
    regionsSkippedNoCoveringPhoto: number;
    regionsSkippedLowConfidence: number;
    /** Share of seam-grid cells left to the soft blend (no confirmed photo overlaps there). */
    lowConfidenceShare: number;
    /** Low-confidence cells ÷ all panorama cells. */
    lowConfidencePanoramaShare?: number;
  };
  vignetting: { cornerLoss: number; applied: boolean; samples: number };
  ghostRiskAreas: Array<{ yaw: number; pitch: number; errorPx: number }>;
  renderer: 'webgl2' | 'cpu';
  outputWidth: number;
  decodeSize: number;
  /** Frame px/radian ÷ output px/radian (< 0.85: output larger than the captured detail). */
  detailRatio: number;
  millis: number;
  timings: Record<string, number>;
  /** Estimate of the large buffers alive at once (MB), not a measured process peak. */
  peakMBEstimate: number;
  /** Per-photo capture quality summary. */
  frameQuality: { checked: number; unavailable: number; acceptedWithWarning: number; lowTexture: number };
  /**
   * Overall trust in the result. 'retake' = do not use for documentation as is; 'review' = usable
   * with the listed caveats; 'good' = every photo is verified against neighbours and no
   * unresolved conflicts remain. A small alignment error alone never yields 'good'.
   */
  verdict?: 'good' | 'review' | 'retake';
  /** Why the verdict is what it is. */
  verdictReasons?: string[];
  /** Specific photos to retake, where to aim, and why. */
  retake?: Array<{ frame: number; yaw: number; pitch: number; reasons: string[] }>;
  /** Verified links per photo (0 = placed by motion sensors only). */
  frameLinks?: number[];
  warnings: string[];
}

export function defaultStitchSettings(): StitchSettings {
  return {
    width: defaultSafePanoramaWidth(),
    includeFrames: false,
    nadirCap: false,
    // ±6° patch refinement after the sensor-independent feature rounds.
    refinement: true,
    // Heritage default: no tone/contrast enhancement and no synthetic fill until the user asks
    // for them. Enhancement can hide geometry problems; filled areas are not photographs.
    enhance: false,
    fillGaps: false
  };
}

export function normalizeStitchSettings(raw?: Partial<StitchSettings> | null): StitchSettings {
  const d = defaultStitchSettings();
  return {
    width: typeof raw?.width === 'number' ? raw.width : d.width,
    includeFrames: typeof raw?.includeFrames === 'boolean' ? raw.includeFrames : d.includeFrames,
    nadirCap: typeof raw?.nadirCap === 'boolean' ? raw.nadirCap : d.nadirCap,
    refinement: typeof raw?.refinement === 'boolean' ? raw.refinement : d.refinement,
    enhance: typeof raw?.enhance === 'boolean' ? raw.enhance : d.enhance,
    fillGaps: typeof raw?.fillGaps === 'boolean' ? raw.fillGaps : d.fillGaps
  };
}

export interface Hotspot {
  id: string;
  view: string;
  title: string;
  yaw: number;
  pitch: number;
  caption: string;
  sources: string[];
}

export interface CaptureDocument {
  id: string;
  name: string;
  date: string; // ISO 8601
  place: string | null;
  frames: FrameRecord[];
  heading: HeadingRecord | null;
  location: LocationRecord | null;
  yawReference: 'firstShot' | 'trueNorth';
  referenceWorldYaw: number;
  targets: ShotTarget[];
  hotspots: Hotspot[];
  settings: StitchSettings;
  stitchedSettings: StitchSettings | null;
  stitched: boolean;
  coverage: number;
  warnings: string[];
  /** Camera configuration (lens + stream shape) the frames were taken with. */
  cameraKey: string | null;
  /** Full identity of the camera used (checked before any resumed photo is added). */
  camera: CameraIdentity | null;
  /** Capture sessions: the first, plus one per resume / sensor restart, with how the yaw
   *  reference was carried over. */
  sessions: CaptureSession[];
  /** User finished with measured coverage below target and acknowledged it. */
  /** Orientation source the photos were taken with ('relative-sensor' | 'deviceorientation'); frozen once photos exist. */
  orientationSource?: 'relative-sensor' | 'deviceorientation' | null;
  /** Capture plan: inputs, refinement rounds and why each extra target was added. Saved so resume never re-plans. */
  plan?: CapturePlanState | null;
  /** Verified result of the exposure / white-balance / focus lock attempt, with the reference settings. */
  cameraLock?: { detail: CameraLockDetail; reference: CameraSettingsSnapshot } | null;
  incompleteAcknowledged: { coverage: number; gaps: Array<{ yaw: number; pitch: number }> } | null;
  stitchReport: StitchReport | null;
}

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().toLowerCase();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function createCaptureDocument(partial?: Partial<CaptureDocument>): CaptureDocument {
  const id = partial?.id ?? generateUUID();
  return {
    id,
    name: partial?.name ?? 'Untitled heritage view',
    date: partial?.date ?? new Date().toISOString(),
    place: partial?.place ?? null,
    frames: partial?.frames ?? [],
    heading: partial?.heading ?? null,
    location: partial?.location ?? null,
    yawReference: partial?.yawReference ?? 'firstShot',
    referenceWorldYaw: partial?.referenceWorldYaw ?? 0,
    targets: (partial?.targets ?? []).map((t) => ({
      id: t.id,
      angle: new SphericalAngle(t.angle.yaw, t.angle.pitch),
      optional: t.optional
    })),
    hotspots: partial?.hotspots ?? [],
    settings: normalizeStitchSettings(partial?.settings),
    stitchedSettings: partial?.stitchedSettings ? normalizeStitchSettings(partial.stitchedSettings) : null,
    stitched: partial?.stitched ?? false,
    coverage: partial?.coverage ?? 0,
    warnings: partial?.warnings ?? [],
    cameraKey: partial?.cameraKey ?? null,
    camera: partial?.camera ?? null,
    sessions: partial?.sessions ?? [],
    orientationSource: partial?.orientationSource ?? null,
    plan: partial?.plan ?? null,
    cameraLock: partial?.cameraLock ?? null,
    incompleteAcknowledged: partial?.incompleteAcknowledged ?? null,
    stitchReport: partial?.stitchReport ?? null
  };
}

export function captureSlug(doc: CaptureDocument): string {
  const words = doc.name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 0);
  const base = words.length === 0 ? 'miras' : words.join('-');
  return `${base}-${doc.id.slice(0, 8).toLowerCase()}`;
}

export function captureStatus(doc: CaptureDocument): 'Frames only' | 'Stitched' | 'Tagged' {
  if (!doc.stitched) return 'Frames only';
  if (doc.hotspots.length === 0) return 'Stitched';
  return 'Tagged';
}

export class CaptureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CaptureError';
  }
}
