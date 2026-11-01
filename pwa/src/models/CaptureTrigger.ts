import type { ShotTarget, SphericalAngleData } from '../geometry/SphericalGeometry';
import { SphericalAngle } from '../geometry/SphericalGeometry';

/**
 * Trigger constants calibrated for mobile web sensors (DeviceOrientation / Generic Sensor API)
 * while maintaining compatibility with deterministic unit tests.
 */
export const TRIGGER_CONFIG = {
  RETAKE_DISARM_DEGREES: 5.0,
  MAX_ALIGNMENT_ERROR_DEGREES: 2.5,
  MAX_VELOCITY_DEG_PER_SEC: 6.0,
  INITIAL_DWELL_SECONDS: 1.0,
  RETAKE_DWELL_SECONDS: 1.0,
  STEADY_DWELL_SECONDS: 0.3
} as const;

export class CaptureTrigger {
  private disarmed = new Set<number>();
  private candidate: { id: number; retake: boolean; since: number } | null = null;
  public isRetaking = false;

  reset(): void {
    this.disarmed.clear();
    this.clearTimer();
  }

  rearm(targetId: number): void {
    this.disarmed.delete(targetId);
    if (this.candidate?.id === targetId) {
      this.clearTimer();
    }
  }

  private clearTimer(): void {
    this.candidate = null;
    this.isRetaking = false;
  }

  update(params: {
    angle: SphericalAngleData;
    targets: ShotTarget[];
    completed: Set<number>;
    timestamp: number;
    normal: boolean;
    velocity: number;
    busy: boolean;
    active: boolean;
  }): ShotTarget | null {
    const { targets, completed, timestamp, normal, velocity, busy, active } = params;
    const angle =
      params.angle instanceof SphericalAngle
        ? params.angle
        : new SphericalAngle(params.angle.yaw, params.angle.pitch);

    for (const target of targets) {
      if (angle.distance(target.angle) > TRIGGER_CONFIG.RETAKE_DISARM_DEGREES) {
        this.disarmed.delete(target.id);
      }
    }

    if (
      !active ||
      busy ||
      !normal ||
      !Number.isFinite(timestamp) ||
      !Number.isFinite(velocity) ||
      velocity >= TRIGGER_CONFIG.MAX_VELOCITY_DEG_PER_SEC
    ) {
      this.clearTimer();
      return null;
    }

    const retake = targets.find(
      (t) =>
        completed.has(t.id) &&
        !this.disarmed.has(t.id) &&
        angle.distance(t.angle) < TRIGGER_CONFIG.MAX_ALIGNMENT_ERROR_DEGREES
    );

    let next: ShotTarget | undefined;
    let bestDist = Infinity;
    for (const t of targets) {
      if (!completed.has(t.id)) {
        const d = angle.distance(t.angle);
        if (d < bestDist) {
          bestDist = d;
          next = t;
        }
      }
    }

    const target = retake ?? next;
    if (!target || angle.distance(target.angle) >= TRIGGER_CONFIG.MAX_ALIGNMENT_ERROR_DEGREES) {
      this.clearTimer();
      return null;
    }

    this.isRetaking = retake !== undefined;
    if (
      !this.candidate ||
      this.candidate.id !== target.id ||
      this.candidate.retake !== this.isRetaking ||
      timestamp < this.candidate.since
    ) {
      this.candidate = { id: target.id, retake: this.isRetaking, since: timestamp };
    }

    const duration =
      this.isRetaking
        ? TRIGGER_CONFIG.RETAKE_DWELL_SECONDS
        : completed.size === 0
        ? TRIGGER_CONFIG.INITIAL_DWELL_SECONDS
        : TRIGGER_CONFIG.STEADY_DWELL_SECONDS;

    if (timestamp - this.candidate.since < duration) {
      return null;
    }

    this.disarmed.add(target.id);
    this.clearTimer();
    return target;
  }
}
