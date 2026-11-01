/**
 * Camera exposure / white-balance / focus lock — requested, then READ BACK.
 *
 * A browser that advertises a capability and resolves applyConstraints() has not proven the
 * camera stopped adapting (Safari exposes almost nothing; some Android builds ignore manual
 * modes). So the lock state is derived from the settings the track reports afterwards, and every
 * photo records the settings it was taken with so drift can be measured instead of assumed.
 */

export interface CameraSettingsSnapshot {
  exposureMode?: string;
  exposureTime?: number;
  iso?: number;
  whiteBalanceMode?: string;
  colorTemperature?: number;
  focusMode?: string;
  focusDistance?: number;
}

export type LockState =
  /** Manual mode reported back by the camera. */
  | 'verified'
  /** Requested, accepted, but the browser does not report the mode: cannot be confirmed. */
  | 'requested-unconfirmed'
  /** The browser does not offer manual control. */
  | 'unsupported'
  /** Requested but the camera reports it is still automatic. */
  | 'failed';

export interface CameraLockDetail {
  exposure: LockState;
  whiteBalance: LockState;
  focus: LockState;
  /** Settings the camera reported right after the lock attempt. */
  effective: CameraSettingsSnapshot;
  notes: string[];
}

type Dict = Record<string, unknown>;

export function snapshotSettings(settings: Dict): CameraSettingsSnapshot {
  const num = (k: string) => (typeof settings[k] === 'number' && Number.isFinite(settings[k] as number) ? (settings[k] as number) : undefined);
  const str = (k: string) => (typeof settings[k] === 'string' ? (settings[k] as string) : undefined);
  return {
    exposureMode: str('exposureMode'),
    exposureTime: num('exposureTime'),
    iso: num('iso'),
    whiteBalanceMode: str('whiteBalanceMode'),
    colorTemperature: num('colorTemperature'),
    focusMode: str('focusMode'),
    focusDistance: num('focusDistance')
  };
}

/** Constraints to request, from the capabilities and the current settings. */
export function planLock(caps: Dict, settings: Dict): { advanced: Dict; offered: { exposure: boolean; whiteBalance: boolean; focus: boolean } } {
  const advanced: Dict = {};
  const has = (key: string, value: string) => Array.isArray(caps[key]) && (caps[key] as string[]).includes(value);
  const offered = { exposure: false, whiteBalance: false, focus: false };
  if (has('exposureMode', 'manual')) {
    advanced.exposureMode = 'manual';
    if (typeof settings.exposureTime === 'number') advanced.exposureTime = settings.exposureTime;
    if (typeof settings.iso === 'number') advanced.iso = settings.iso;
    offered.exposure = true;
  }
  if (has('whiteBalanceMode', 'manual')) {
    advanced.whiteBalanceMode = 'manual';
    if (typeof settings.colorTemperature === 'number') advanced.colorTemperature = settings.colorTemperature;
    offered.whiteBalance = true;
  }
  if (has('focusMode', 'manual') && typeof settings.focusDistance === 'number') {
    advanced.focusMode = 'manual';
    advanced.focusDistance = settings.focusDistance;
    offered.focus = true;
  } else if (has('focusMode', 'single-shot')) {
    advanced.focusMode = 'single-shot';
  }
  return { advanced, offered };
}

const near = (a: number | undefined, b: number | undefined, tol = 0.03): boolean =>
  a !== undefined && b !== undefined && Math.abs(a - b) <= tol * Math.max(Math.abs(a), Math.abs(b), 1e-9);

/** What the camera reports after the attempt decides the state, never what was asked for. */
export function verifyLock(
  offered: { exposure: boolean; whiteBalance: boolean; focus: boolean },
  requested: Dict,
  effective: CameraSettingsSnapshot,
  applyError: string | null
): CameraLockDetail {
  const notes: string[] = [];
  const decide = (isOffered: boolean, modeKey: 'exposureMode' | 'whiteBalanceMode' | 'focusMode', valueKey: keyof CameraSettingsSnapshot | null, label: string): LockState => {
    if (!isOffered) {
      notes.push(`${label} lock unsupported by this browser/camera`);
      return 'unsupported';
    }
    if (applyError) {
      notes.push(`${label} lock failed: ${applyError}`);
      return 'failed';
    }
    const mode = effective[modeKey];
    if (mode === undefined) {
      notes.push(`${label} lock requested but the browser does not report it, so it cannot be confirmed`);
      return 'requested-unconfirmed';
    }
    if (mode !== 'manual') {
      notes.push(`${label} is still "${mode}" after the lock request`);
      return 'failed';
    }
    if (valueKey && requested[valueKey] !== undefined && effective[valueKey] !== undefined && !near(requested[valueKey] as number, effective[valueKey] as number, 0.05)) {
      notes.push(`${label} is manual but at a different value than requested`);
      return 'failed';
    }
    return 'verified';
  };
  return {
    exposure: decide(offered.exposure, 'exposureMode', 'exposureTime', 'Exposure'),
    whiteBalance: decide(offered.whiteBalance, 'whiteBalanceMode', 'colorTemperature', 'White balance'),
    focus: decide(offered.focus, 'focusMode', null, 'Focus'),
    effective,
    notes
  };
}

export interface CameraDrift {
  /** Relative change of exposure time vs the reference (0.1 = 10 %). */
  exposure: number | null;
  colorTemperature: number | null;
  iso: number | null;
  drifted: boolean;
  message: string | null;
}

/** Compare a photo's recorded settings with the reference (lock-time) settings. */
export function settingsDrift(reference: CameraSettingsSnapshot, current: CameraSettingsSnapshot, tolerance = 0.08): CameraDrift {
  const rel = (a?: number, b?: number): number | null => (a !== undefined && b !== undefined && a !== 0 ? Math.abs(b - a) / Math.abs(a) : null);
  const exposure = rel(reference.exposureTime, current.exposureTime);
  const colorTemperature = rel(reference.colorTemperature, current.colorTemperature);
  const iso = rel(reference.iso, current.iso);
  const parts: string[] = [];
  if (exposure !== null && exposure > tolerance) parts.push(`exposure time ${Math.round(exposure * 100)}%`);
  if (iso !== null && iso > tolerance) parts.push(`ISO ${Math.round(iso * 100)}%`);
  if (colorTemperature !== null && colorTemperature > tolerance) parts.push(`white balance ${Math.round(colorTemperature * 100)}%`);
  return { exposure, colorTemperature, iso, drifted: parts.length > 0, message: parts.length ? `Camera auto-adjusted between photos (${parts.join(', ')})` : null };
}
