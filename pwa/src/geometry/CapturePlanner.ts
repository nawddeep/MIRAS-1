import { SphericalAngle } from './SphericalGeometry';
import type { ShotTarget } from './SphericalGeometry';
import type { CoverageFrame, CoverageReport } from './Coverage';

/**
 * Deterministic, FOV-aware capture planning.
 *
 * `initial()` turns the calibrated camera (field of view, stream shape, orientation) and a few
 * scene hints into a spherical plan: the same inputs always give the same targets. `refine()`
 * adds a bounded number of explained targets while capturing (uncovered patches, isolated photos
 * with too little overlap to be matched, low-texture scenes that need more overlap). Everything
 * the planner decided is returned as plain data (`CapturePlanState`) so it can be saved with the
 * capture and restored on resume — a resumed capture never re-plans or resets its limits.
 */

export const PLANNER_VERSION = 2;
/** Hard bounds so the dot count can never run away. */
export const MAX_INITIAL_TARGETS = 90;
export const MAX_REFINEMENT_ROUNDS = 3;
export const MAX_ADDED_TARGETS = 14;

export type TextureHint = 'unknown' | 'normal' | 'low';

export interface PlannerInput {
  /** FOV across the frame's LONG side (degrees) — the calibrated value for the active lens. */
  longSideFov: number;
  /** short / long side of the delivered frame (≤ 1). */
  aspect: number;
  /** Phone held upright (short side horizontal) or sideways. */
  orientation: 'portrait' | 'landscape';
  /** Requested yaw overlap between neighbours (0.2–0.6). */
  overlap?: number;
  texture?: TextureHint;
  /** Dark scene: longer exposures blur more and matching is harder → more overlap. */
  dark?: boolean;
  /** Typical sensor yaw error (°): large errors need more overlap to be matched safely. */
  sensorNoiseDeg?: number;
}

export interface PlannedRing {
  pitch: number;
  count: number;
}

export interface InitialPlan {
  targets: ShotTarget[];
  rings: PlannedRing[];
  /** Overlaps actually used after scene adjustments. */
  yawOverlap: number;
  pitchOverlap: number;
  yawFov: number;
  pitchFov: number;
  /** Plain-language reasons for any increase over the default overlap. */
  notes: string[];
}

export type AdditionReason = 'coverage-gap' | 'weak-overlap' | 'low-texture-overlap';

export interface CapturePlanState {
  version: number;
  input: Required<PlannerInput>;
  initialCount: number;
  yawOverlap: number;
  pitchOverlap: number;
  notes: string[];
  /** Refinement rounds already used (persisted: resuming never resets this). */
  rounds: number;
  additions: Array<{ id: number; reason: AdditionReason; round: number; detail: string }>;
  coverageHistory: Array<{ shots: number; fraction: number }>;
}

const SAFETY = 0.9; // usable part of the nominal FOV (frame borders, FOV uncertainty)

export class CapturePlanner {
  static normalizeInput(i: PlannerInput): Required<PlannerInput> {
    return {
      longSideFov: Math.min(120, Math.max(30, i.longSideFov)),
      aspect: Math.min(1, Math.max(0.4, i.aspect)),
      orientation: i.orientation,
      overlap: Math.min(0.6, Math.max(0.2, i.overlap ?? 0.3)),
      texture: i.texture ?? 'unknown',
      dark: i.dark ?? false,
      sensorNoiseDeg: Math.max(0, i.sensorNoiseDeg ?? 0)
    };
  }

  static shortSideFov(longSideFov: number, aspect: number): number {
    return (2 * Math.atan(aspect * Math.tan((longSideFov * Math.PI) / 360)) * 180) / Math.PI;
  }

  static initial(raw: PlannerInput): InitialPlan {
    const input = CapturePlanner.normalizeInput(raw);
    const short = CapturePlanner.shortSideFov(input.longSideFov, input.aspect);
    const yawFov = (input.orientation === 'portrait' ? short : input.longSideFov) * SAFETY;
    const pitchFov = (input.orientation === 'portrait' ? input.longSideFov : short) * SAFETY;

    // More overlap where matching is harder; each reason is reported, never silent.
    let yawOverlap = input.overlap;
    const notes: string[] = [];
    if (input.texture === 'low') {
      yawOverlap += 0.1;
      notes.push('low-texture scene: +10% overlap so photos can be matched');
    }
    if (input.dark) {
      yawOverlap += 0.05;
      notes.push('dark scene: +5% overlap (blur and weak matching)');
    }
    if (input.sensorNoiseDeg > 3) {
      yawOverlap += 0.05;
      notes.push('noisy motion sensor: +5% overlap');
    }
    yawOverlap = Math.min(0.6, yawOverlap);
    const pitchOverlap = Math.max(0.2, yawOverlap - 0.1);

    const yawStep = yawFov * (1 - yawOverlap);
    const pitchStep = pitchFov * (1 - pitchOverlap);
    const bands = Math.max(1, Math.ceil(90 / pitchStep));
    const spacing = 90 / bands;

    const pitches: number[] = [0];
    for (let k = 1; k < bands; k++) pitches.push(k * spacing, -k * spacing);
    pitches.push(90, -90);

    const targets: ShotTarget[] = [];
    const rings: PlannedRing[] = [];
    pitches.forEach((pitch) => {
      const pole = Math.abs(pitch) === 90;
      const count = pole ? 1 : Math.max(3, Math.ceil((360 * Math.cos((pitch * Math.PI) / 180)) / yawStep));
      const ringNumber = Math.round(Math.abs(pitch) / spacing);
      const offset = ringNumber % 2 === 1 && !pole ? 180 / count : 0; // stagger alternate rings
      rings.push({ pitch, count });
      for (let i = 0; i < count; i++) {
        targets.push({
          id: targets.length,
          angle: new SphericalAngle(pole ? 0 : offset + (i * 360) / count, pitch),
          optional: pitch === -90
        });
      }
    });
    if (targets.length > MAX_INITIAL_TARGETS) targets.length = MAX_INITIAL_TARGETS;
    return { targets, rings, yawOverlap, pitchOverlap, yawFov, pitchFov, notes };
  }

  static createState(raw: PlannerInput, plan: InitialPlan): CapturePlanState {
    return {
      version: PLANNER_VERSION,
      input: CapturePlanner.normalizeInput(raw),
      initialCount: plan.targets.length,
      yawOverlap: plan.yawOverlap,
      pitchOverlap: plan.pitchOverlap,
      notes: plan.notes,
      rounds: 0,
      additions: [],
      coverageHistory: []
    };
  }

  /** Capture-relative direction of a recorded frame's optical axis. */
  static frameDirection(f: CoverageFrame, referenceWorldYaw: number): SphericalAngle {
    const t = f.transform;
    const fx = -t[8], fy = -t[9], fz = -t[10];
    const r = (referenceWorldYaw * Math.PI) / 180;
    const c = Math.cos(r), s = Math.sin(r);
    return SphericalAngle.fromVector({ x: fx * c + fz * s, y: fy, z: -fx * s + fz * c });
  }

  /**
   * Targets to add now, with reasons, honouring the persisted limits. Returns [] when nothing
   * is needed or the budget is used up. Mutates `state` (rounds, additions, coverage history).
   *
   * @param requiredDone every required planned target has been photographed
   */
  static refine(
    state: CapturePlanState,
    frames: CoverageFrame[],
    referenceWorldYaw: number,
    coverage: CoverageReport | null,
    targets: ShotTarget[],
    done: Set<number>,
    requiredDone: boolean,
    textureHint: TextureHint = 'unknown'
  ): ShotTarget[] {
    if (coverage) {
      const last = state.coverageHistory[state.coverageHistory.length - 1];
      if (!last || last.shots !== frames.length) state.coverageHistory.push({ shots: frames.length, fraction: coverage.fraction });
    }
    if (!requiredDone || state.rounds >= MAX_REFINEMENT_ROUNDS || state.additions.length >= MAX_ADDED_TARGETS) return [];

    let nextId = targets.reduce((m, t) => Math.max(m, t.id), -1) + 1;
    const budget = MAX_ADDED_TARGETS - state.additions.length;
    const extra: ShotTarget[] = [];
    const pendingNear = (a: SphericalAngle) => targets.some((t) => !done.has(t.id) && a.distance(t.angle) < 15) || extra.some((t) => a.distance(t.angle) < 15);
    const round = state.rounds + 1;
    const add = (angle: SphericalAngle, reason: AdditionReason, detail: string) => {
      if (extra.length >= budget || pendingNear(angle)) return;
      extra.push({ id: nextId++, angle: new SphericalAngle(angle.yaw, angle.pitch), optional: false });
      state.additions.push({ id: extra[extra.length - 1].id, reason, round, detail });
    };

    // 1) photographed-coverage gaps
    if (coverage && coverage.fraction < 0.995) {
      for (const g of coverage.gaps) add(g, 'coverage-gap', `uncovered area near yaw ${Math.round(g.yaw)}°, pitch ${Math.round(g.pitch)}°`);
    }

    // 2) photos too isolated to be matched: the nearest neighbour is farther than the footprint allows
    const needOverlap = textureHint === 'low' ? Math.max(0.4, state.yawOverlap) : 0.2;
    const reach = CapturePlanner.footprint(state) * (1 - needOverlap);
    const dirs = frames.map((f) => CapturePlanner.frameDirection(f, referenceWorldYaw));
    dirs.forEach((d, i) => {
      let nearest = Infinity, nearestIdx = -1;
      dirs.forEach((e, j) => {
        if (i === j) return;
        const dist = d.distance(e);
        if (dist < nearest) { nearest = dist; nearestIdx = j; }
      });
      if (nearestIdx >= 0 && nearest > reach * 1.15) {
        const e = dirs[nearestIdx];
        const a = d.vector, b = e.vector;
        const mid = SphericalAngle.fromVector({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
        const reason: AdditionReason = textureHint === 'low' ? 'low-texture-overlap' : 'weak-overlap';
        add(mid, reason, `photo ${i + 1} overlaps its nearest neighbour by only ${Math.max(0, Math.round((1 - nearest / CapturePlanner.footprint(state)) * 100))}%`);
      }
    });

    if (extra.length > 0) state.rounds = round;
    return extra;
  }

  /** Footprint (long side, with safety margin) (degrees, with safety margin). */
  static footprint(state: CapturePlanState): number {
    // Neighbours may lie along either axis (rings are spaced by the long side), so the longer
    // footprint is the distance within which two photos are expected to overlap.
    return state.input.longSideFov * SAFETY;
  }

  /** One-line explanation for the UI: why the target count is what it is. */
  static explain(state: CapturePlanState, total: number, done: number): string {
    const added = state.additions.length;
    const base = `${state.initialCount} planned`;
    if (added === 0) return `${done}/${total} photos · ${base}`;
    const last = state.additions[state.additions.length - 1];
    const why: Record<AdditionReason, string> = {
      'coverage-gap': 'uncovered area',
      'weak-overlap': 'too little overlap to match photos',
      'low-texture-overlap': 'plain surfaces need more overlap'
    };
    return `${done}/${total} photos · ${base} + ${added} added (${why[last.reason]}: ${last.detail})`;
  }
}
