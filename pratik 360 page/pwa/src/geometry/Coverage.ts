import type { ShotTarget } from './SphericalGeometry';
import { SphericalAngle } from './SphericalGeometry';

/** The parts of a captured frame needed to know which directions it photographed. */
export interface CoverageFrame {
  transform: number[]; // 16 floats, column-major camera-to-world (col0 right, col1 up, col2 back)
  intrinsics: number[]; // 9 floats, column-major [fx 0 0 0 fy 0 cx cy 1]
  width: number;
  height: number;
}

export interface CoverageReport {
  /** Fraction of the required sphere zone that at least one photo actually covers. */
  fraction: number;
  /** Centres of uncovered patches, in capture (reference-relative) coordinates. */
  gaps: SphericalAngle[];
  /** Number of sample directions checked. */
  samples: number;
}

/**
 * Lowest pitch that must be photographed. The nadir (straight down, where the tripod or the
 * photographer's feet are) is optional, as in the iOS app; everything above this is required.
 */
export const REQUIRED_MIN_PITCH = -70;

/** Frames lose this much border in blending (Reprojection discards the outer 4%). */
const EDGE_MARGIN = 0.05;

/**
 * Measures real photographed coverage from each frame's recorded pose and lens, instead of
 * assuming that "all dots done" means "whole sphere covered". Directions are sampled on a
 * Fibonacci sphere (uniform by area).
 */
export class Coverage {
  static fibonacci(count: number): SphericalAngle[] {
    const out: SphericalAngle[] = [];
    for (let i = 0; i < count; i++) {
      const y = 1 - (2 * (i + 0.5)) / count;
      out.push(new SphericalAngle(i * 137.507764, (Math.asin(y) * 180) / Math.PI));
    }
    return out;
  }

  /** True if `d` (world direction) lands inside the usable part of the frame. */
  static frameSees(f: CoverageFrame, dx: number, dy: number, dz: number): boolean {
    const t = f.transform;
    const depth = -(t[8] * dx + t[9] * dy + t[10] * dz);
    if (depth <= 1e-3) return false;
    const xc = t[0] * dx + t[1] * dy + t[2] * dz;
    const yc = t[4] * dx + t[5] * dy + t[6] * dz;
    const px = (f.intrinsics[0] * xc) / depth + f.intrinsics[6];
    const py = (-f.intrinsics[4] * yc) / depth + f.intrinsics[7];
    const mx = f.width * EDGE_MARGIN;
    const my = f.height * EDGE_MARGIN;
    return px > mx && px < f.width - mx && py > my && py < f.height - my;
  }

  static measure(
    frames: CoverageFrame[],
    referenceWorldYaw: number,
    options: { samples?: number; minPitch?: number; maxGaps?: number } = {}
  ): CoverageReport {
    const samples = options.samples ?? 3000;
    const minPitch = options.minPitch ?? REQUIRED_MIN_PITCH;
    const maxGaps = options.maxGaps ?? 6;
    const ref = (referenceWorldYaw * Math.PI) / 180;
    const cr = Math.cos(ref);
    const sr = Math.sin(ref);

    let required = 0;
    let covered = 0;
    const missing: SphericalAngle[] = [];
    for (const a of Coverage.fibonacci(samples)) {
      if (a.pitch < minPitch) continue;
      required++;
      // Capture-relative direction -> world (rotate by the reference yaw about Y).
      const v = a.vector;
      const wx = v.x * cr - v.z * sr;
      const wz = v.x * sr + v.z * cr;
      if (frames.some((f) => Coverage.frameSees(f, wx, v.y, wz))) covered++;
      else missing.push(a);
    }

    // Greedy clustering of missing samples into patch centres (≤ 25° apart = same gap).
    const gaps: SphericalAngle[] = [];
    const remaining = missing.slice();
    while (remaining.length > 0 && gaps.length < maxGaps) {
      const seed = remaining[0];
      const members = remaining.filter((m) => seed.distance(m) < 25);
      let x = 0, y = 0, z = 0;
      for (const m of members) {
        const v = m.vector;
        x += v.x; y += v.y; z += v.z;
      }
      gaps.push(SphericalAngle.fromVector({ x, y, z }));
      for (const m of members) remaining.splice(remaining.indexOf(m), 1);
    }

    return { fraction: required > 0 ? covered / required : 0, gaps, samples: required };
  }

  /**
   * Extra dots placed at uncovered patches so the user can fill them, with ids after the
   * planned targets. Skips gaps that already have an un-shot target within 15°.
   */
  static gapTargets(report: CoverageReport, targets: ShotTarget[], done: Set<number>): ShotTarget[] {
    let nextId = targets.reduce((m, t) => Math.max(m, t.id), -1) + 1;
    const extra: ShotTarget[] = [];
    for (const g of report.gaps) {
      const pending = targets.some((t) => !done.has(t.id) && g.distance(t.angle) < 15);
      if (pending) continue;
      extra.push({ id: nextId++, angle: new SphericalAngle(g.yaw, g.pitch), optional: false });
    }
    return extra;
  }
}
