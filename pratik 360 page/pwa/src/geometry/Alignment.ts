import { Vec3 } from './SphericalGeometry';
import { Projection, RasterFrame, RasterImage } from './Reprojection';
import { detectFeatures, matchFeatures } from './FeatureMatcher';
import type { FeatureSet } from './FeatureMatcher';

export interface AlignmentReport {
  pairs: number;
  /** Geometrically verified matches used for the pose solve. */
  matches: number;
  /** Matches found before pair verification (a high count alone proves nothing). */
  rawMatches: number;
  /** Distinct points that had several equally good matches (repeating structure). */
  ambiguousMatches: number;
  /** Points whose matches failed geometric verification. */
  rejectedMatches: number;
  /** Matches from pairs with < 3 distinct points: used with low weight, NOT verified. */
  insufficientMatches: number;
  /** Verified pairs whose inliers are bunched in a tiny area (down-weighted). */
  weakPairs: number;
  verifiedPairs: number;
  /** Verified neighbour links per frame. */
  frameLinks: number[];
  /** Connected groups of frames through verified links (1 = one consistent panorama). */
  components: number;
  /** Group id per frame (frames sharing an id are linked by verified matches). */
  componentOf?: number[];
  converged: boolean;
  iterations: number;
  /** Implausible focal estimate that was rejected (then re-solved with focal fixed). */
  focalRejected?: number;
  /** True when the solve made verified matches worse and sensor poses were kept. */
  reverted: boolean;
  /** 0..1 overall trust in the alignment. */
  confidence: number;
  /** Sampled verified matches with their final residual (for the residual map). */
  matchPoints: Array<{ x: number; y: number; z: number; errorPx: number }>;
  rmsBefore: number;
  rmsAfter: number;
  focalScale: number;
  /** Frames with no verified link to any neighbour: placed by motion sensors only. */
  unconstrainedFrames: number[];
  /** World directions where verified matches still disagree after solving (parallax, motion). */
  ghostRisk: Array<{ x: number; y: number; z: number; errorPx: number }>;
  description: string;
}

interface Match {
  i: number;
  j: number;
  a: [number, number];
  b: [number, number];
  /** Feature point id within its pair; several matches may share one (repeating structure). */
  patch?: number;
  /** True when this point had several equally good matches. */
  ambiguous?: boolean;
  /** Solve weight (1 verified; lower for weak pairs). */
  weight?: number;
  /** From a pair too small to verify geometrically. */
  unverified?: boolean;
}

class Gray {
  public width: number;
  public height: number;
  public scale: number;
  public v: Float32Array;

  constructor(image: RasterImage, maxSize: number) {
    const f = Math.max(1, Math.ceil(Math.max(image.width, image.height) / maxSize));
    this.width = Math.floor(image.width / f);
    this.height = Math.floor(image.height / f);
    this.scale = f;
    this.v = new Float32Array(this.width * this.height);

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        let s = 0;
        for (let yy = y * f; yy < (y + 1) * f; yy++) {
          for (let xx = x * f; xx < (x + 1) * f; xx++) {
            const i = (yy * image.width + xx) * 4;
            s += 0.299 * image.rgba[i] + 0.587 * image.rgba[i + 1] + 0.114 * image.rgba[i + 2];
          }
        }
        this.v[y * this.width + x] = s / (f * f * 255);
      }
    }
  }

  frame(x: number, y: number): [number, number] {
    return [(x + 0.5) * this.scale - 0.5, (y + 0.5) * this.scale - 0.5];
  }

  sample(frameX: number, frameY: number): number | null {
    const x = (frameX + 0.5) / this.scale - 0.5;
    const y = (frameY + 0.5) / this.scale - 0.5;
    if (this.width < 2 || this.height < 2 || x < 0 || y < 0 || x > this.width - 1 || y > this.height - 1) {
      return null;
    }
    const ix = Math.min(this.width - 2, Math.floor(x));
    const iy = Math.min(this.height - 2, Math.floor(y));
    const dx = x - ix;
    const dy = y - iy;
    const i = iy * this.width + ix;
    return (
      (this.v[i] * (1 - dx) + this.v[i + 1] * dx) * (1 - dy) +
      (this.v[i + this.width] * (1 - dx) + this.v[i + this.width + 1] * dx) * dy
    );
  }
}

class Rotation {
  public x: Vec3;
  public y: Vec3;
  public z: Vec3;

  constructor(p: Projection) {
    this.x = { x: p.x.x, y: p.x.y, z: p.x.z };
    this.y = { x: p.y.x, y: p.y.y, z: p.y.z };
    this.z = { x: p.z.x, y: p.z.y, z: p.z.z };
  }

  world(l: Vec3): Vec3 {
    return {
      x: this.x.x * l.x + this.y.x * l.y + this.z.x * l.z,
      y: this.x.y * l.x + this.y.y * l.y + this.z.y * l.z,
      z: this.x.z * l.x + this.y.z * l.y + this.z.z * l.z
    };
  }

  rotate(w: Vec3): void {
    this.x = Alignment.exp(w, this.x);
    this.y = Alignment.exp(w, this.y);
    this.z = Alignment.exp(w, this.z);
  }
}

export class Alignment {
  static readonly priorDegrees = 1.5;
  static readonly focalPrior = 0.05;
  /** Focal prior actually used by adjust() (tightened to fix the focal length). */
  static focalPriorWeight = 0.05;
  static readonly patchRadius = 7;
  /** Sensor-independent feature matching (ORB-style) as the first alignment stage. */
  static featureMatching = true;
  /** Longest side (px) of the grayscale image the descriptors are computed on. */
  static featureSize = 800;

  /** World direction of every feature (3 floats each) under the frame's current pose. */
  static featureDirections(p: Projection, g: Gray, f: FeatureSet): Float32Array {
    const out = new Float32Array(f.count * 3);
    for (let k = 0; k < f.count; k++) {
      const [fx, fy] = g.frame(f.x[k], f.y[k]);
      const d = p.direction(fx, fy);
      out[k * 3] = d.x; out[k * 3 + 1] = d.y; out[k * 3 + 2] = d.z;
    }
    return out;
  }

  /** Descriptor matches between two photos as solver Match records (frame-plane coordinates). */
  static featureMatch(
    i: number,
    j: number,
    projections: Projection[],
    grays: Gray[],
    sets: FeatureSet[],
    dirs: Float32Array[],
    gateDegrees: number
  ): Match[] {
    const a = projections[i], b = projections[j];
    const slackPx = (gateDegrees * Math.PI) / 180 * Math.min(a.x.w, b.x.w);
    const inside = (p: Projection, d: Float32Array, k: number): boolean => {
      const q = p.unclippedProject({ x: d[k * 3], y: d[k * 3 + 1], z: d[k * 3 + 2] });
      return !!q && q[0] > -slackPx && q[1] > -slackPx && q[0] < p.meta.z + slackPx && q[1] < p.meta.w + slackPx;
    };
    const candA: number[] = [], candB: number[] = [];
    for (let k = 0; k < sets[i].count; k++) if (inside(b, dirs[i], k)) candA.push(k);
    for (let k = 0; k < sets[j].count; k++) if (inside(a, dirs[j], k)) candB.push(k);
    if (candA.length < 4 || candB.length < 4) return [];
    const { matches: tentative } = matchFeatures(sets[i], sets[j], candA, candB, dirs[i], dirs[j], Math.cos((gateDegrees * Math.PI) / 180), {
      ratio: 0.8,
      maxDistance: 90,
      ambiguousHypotheses: Alignment.multiHypothesis
    });
    const result: Match[] = [];
    for (const t of tentative) {
      const [ax, ay] = grays[i].frame(sets[i].x[t.a], sets[i].y[t.a]);
      const [bx, by] = grays[j].frame(sets[j].x[t.b], sets[j].y[t.b]);
      result.push({ i, j, a: a.plane(ax, ay), b: b.plane(bx, by), patch: 1_000_000 + t.point, ambiguous: t.ambiguous });
    }
    return result;
  }

  static createReport(
    pairs = 0,
    matches = 0,
    rmsBefore = 0,
    rmsAfter = 0,
    focalScale = 1
  ): AlignmentReport {
    return {
      pairs,
      matches,
      rawMatches: matches,
      ambiguousMatches: 0,
      rejectedMatches: 0,
      insufficientMatches: 0,
      weakPairs: 0,
      verifiedPairs: 0,
      frameLinks: [] as number[],
      components: 0,
      converged: true,
      iterations: 0,
      reverted: false,
      confidence: 0,
      matchPoints: [] as Array<{ x: number; y: number; z: number; errorPx: number }>,
      unconstrainedFrames: [] as number[],
      ghostRisk: [] as Array<{ x: number; y: number; z: number; errorPx: number }>,
      rmsBefore,
      rmsAfter,
      focalScale,
      get description() {
        return `${this.matches} matches over ${this.pairs} pairs · residual ${this.rmsBefore.toFixed(2)} → ${this.rmsAfter.toFixed(2)} px · focal ×${this.focalScale.toFixed(4)}`;
      }
    };
  }

  static align(
    frames: RasterFrame[],
    searchDegrees = 2.5,
    workingSize = 512,
    options: { fixFocal?: boolean } = {}
  ): { frames: RasterFrame[]; report: AlignmentReport } {
    const report = Alignment.createReport();
    report.frameLinks = new Array(frames.length).fill(0);
    if (frames.length <= 1) {
      return { frames, report };
    }

    const grays = frames.map((f) => new Gray(f.image, workingSize));
    const features = grays.map((g) => Alignment.corners(g, Alignment.patchRadius + 1));
    // Sensor-independent descriptors (computed once, reused every round). Larger working size
    // than the patch matcher: descriptors need real texture, not a thumbnail.
    const useFeatures = Alignment.featureMatching;
    const featGrays = useFeatures ? frames.map((f) => new Gray(f.image, Alignment.featureSize)) : [];
    const descriptors: FeatureSet[] = useFeatures ? featGrays.map((g) => detectFeatures(g.v, g.width, g.height)) : [];
    const rotations = frames.map((f) => new Rotation(f.projection));
    const initial = frames.map((f) => new Rotation(f.projection)); // sensor poses, kept for checks
    const corrections: Vec3[] = frames.map(() => ({ x: 0, y: 0, z: 0 }));
    let focal = 0.0;
    const focalPriorSaved = Alignment.focalPriorWeight;
    if (options.fixFocal) Alignment.focalPriorWeight = 1e-4;

    // Wide, sensor-independent feature rounds first (tolerates large gyro error and focal
    // mismatch), then the precise patch matcher around the already-corrected poses.
    type Round = { kind: 'feature' | 'patch'; degrees: number; tolPx: number; slack: number };
    const rounds: Round[] = [];
    if (useFeatures) {
      rounds.push({ kind: 'feature', degrees: 14, tolPx: 9, slack: 10 });
      rounds.push({ kind: 'feature', degrees: 10, tolPx: 4, slack: 6 });
    }
    rounds.push({ kind: 'patch', degrees: searchDegrees, tolPx: 3, slack: useFeatures ? 3 : 0 });
    rounds.push({ kind: 'patch', degrees: Math.min(searchDegrees, 0.75), tolPx: 3, slack: useFeatures ? 3 : 0 });
    let finalMatches: Match[] = [];
    let finalPixelAngle: number[] = [];
    let finalCurrent: Projection[] = [];
    let converged = true;
    let iterations = 0;
    try {
      for (let round = 0; round < rounds.length; round++) {
        const { kind, degrees, tolPx, slack } = rounds[round];
        const current = frames.map((f, idx) => f.projection.rotated(rotations[idx], Math.exp(focal)));
        const pairs = Alignment.overlappingPairs(current, slack);
        const dirs = kind === 'feature' || useFeatures ? current.map((c, k) => Alignment.featureDirections(c, featGrays[k], descriptors[k])) : [];
        const pixelAngle = grays.map((g, idx) => g.scale / current[idx].x.w);
        const matches: Match[] = [];
        const counts = { raw: 0, ambiguous: 0, verified: 0, rejected: 0, insufficient: 0, weakPairs: 0, verifiedPairs: 0 };
        const links = new Array(frames.length).fill(0);
        const parent = frames.map((_, k) => k);
        const find = (k: number): number => (parent[k] === k ? k : (parent[k] = find(parent[k])));

        for (const [i, j] of pairs) {
          const patchList: Match[] = kind === 'patch' ? Alignment.match(i, j, current, grays, features[i], degrees) : [];
          let featureList: Match[] = [];
          let pairMatches: Match[] = patchList;
          if (useFeatures) {
            const fm = Alignment.featureMatch(i, j, current, featGrays, descriptors, dirs, Math.min(degrees, 30) + 8);
            // Skip feature points that duplicate a precise patch match (keeps counts honest).
            const tol = (2 * featGrays[i].scale) / current[i].x.w;
            featureList = patchList.length
              ? fm.filter((m) => !patchList.some((p) => Math.abs(p.a[0] - m.a[0]) < tol && Math.abs(p.a[1] - m.a[1]) < tol))
              : fm;
            pairMatches = patchList.concat(featureList);
          }
          const points = new Set(pairMatches.map((m, k) => m.patch ?? -1 - k)).size;
          const ambiguousPoints = new Set(pairMatches.filter((m) => m.ambiguous).map((m) => m.patch)).size;
          counts.raw += points;
          counts.ambiguous += ambiguousPoints;
          const unambiguous = pairMatches.filter((m) => !m.ambiguous);

          if (!Alignment.pairVerification) {
            // Previous behaviour (benchmarks only): ambiguous points discarded, nothing verified.
            for (const m of unambiguous) matches.push(m);
            if (unambiguous.length > 0) {
              links[i]++;
              links[j]++;
              parent[find(i)] = find(j);
            }
            counts.verified += unambiguous.length;
            continue;
          }

          // Too few distinct points to verify geometrically: weak, explicitly unverified
          // information (low weight in the solve), never counted as verified.
          if (points < 3) {
            for (const m of unambiguous) {
              m.weight = Alignment.insufficientWeight;
              m.unverified = true;
              matches.push(m);
            }
            counts.insufficient += unambiguous.length;
            continue;
          }

          const verify = (list: Match[]) =>
            Alignment.verifyPair(list, current[i], current[j], pixelAngle[j] * tolPx, ((degrees + 2) * Math.PI) / 180);
          // Each source is verified on its own: a pile of unverified feature points must never
          // dilute (or hijack) the consensus of the precise, sensor-bounded patch matches.
          const verifySource = (list: Match[]): Match[] => {
            const clear = list.filter((m) => !m.ambiguous);
            let v = clear.length >= 3 ? verify(clear) : [];
            // Multi-hypothesis fallback only when clear points are genuinely scarce (repeating
            // structure discards most of them) — measured: using it everywhere cost 2–3 dB on
            // ordinary scenes. It must reach 10 agreeing points.
            if (Alignment.multiHypothesis && clear.length < Alignment.minPairInliers && list.length > clear.length) {
              const withHypotheses = verify(list);
              if (withHypotheses.length >= 10 && withHypotheses.length > v.length) v = withHypotheses;
            }
            return v;
          };
          let verified = verifySource(patchList);
          if (verified.length < Alignment.minPairInliers && featureList.length > 0) {
            const fv = verifySource(featureList);
            if (fv.length > verified.length) verified = fv;
          }
          if (verified.length === 0) {
            counts.rejected += points;
            continue;
          }
          counts.rejected += Math.max(0, points - verified.length);

          // Spatial distribution: inliers bunched in a tiny patch constrain rotation poorly.
          let mx = 0, my = 0;
          for (const m of verified) { mx += m.a[0]; my += m.a[1]; }
          mx /= verified.length; my /= verified.length;
          let sx = 0, sy = 0;
          for (const m of verified) { sx += (m.a[0] - mx) ** 2; sy += (m.a[1] - my) ** 2; }
          const spread = Math.sqrt(sx / verified.length) + Math.sqrt(sy / verified.length);
          const weak = spread < 0.05; // ≈ 3° combined spread
          if (weak) counts.weakPairs++;
          for (const m of verified) {
            m.weight = weak ? Alignment.weakPairWeight : 1;
            matches.push(m);
          }
          counts.verified += verified.length;
          counts.verifiedPairs++;
          links[i]++;
          links[j]++;
          parent[find(i)] = find(j);
        }

        const adj = Alignment.adjust(rotations, corrections, focal, matches, pixelAngle);
        focal = adj.focal;
        converged = adj.converged;
        iterations += adj.iterations;
        report.pairs = pairs.length;
        report.rawMatches = counts.raw;
        report.ambiguousMatches = counts.ambiguous;
        report.matches = counts.verified;
        report.rejectedMatches = counts.rejected;
        report.insufficientMatches = counts.insufficient;
        report.weakPairs = counts.weakPairs;
        report.verifiedPairs = counts.verifiedPairs;
        report.frameLinks = links;
        report.unconstrainedFrames = links.map((c, k) => (c === 0 ? k : -1)).filter((k) => k >= 0);
        const roots = new Set(frames.map((_, k) => find(k)));
        report.components = roots.size;
        report.componentOf = frames.map((_, k) => find(k));
        finalMatches = matches.filter((m) => !m.unverified); // verified population only
        finalPixelAngle = pixelAngle;
        finalCurrent = current;
      }
    } finally {
      Alignment.focalPriorWeight = focalPriorSaved;
    }

    report.focalScale = Math.exp(focal);
    report.converged = converged;
    report.iterations = iterations;
    // Error before vs after on the SAME (final, verified) matches, in working-size pixels:
    // sensor poses (focal ×1) vs solved poses (with the solved focal length).
    const sensorProj = frames.map((f) => f.projection);
    const solvedProj = frames.map((f, idx) => f.projection.rotated(rotations[idx], Math.exp(focal)));
    report.rmsBefore = Alignment.rmsWith(finalMatches, finalCurrent, sensorProj, finalPixelAngle);
    report.rmsAfter = Alignment.rmsWith(finalMatches, finalCurrent, solvedProj, finalPixelAngle);

    // Safeguards: an implausible focal estimate is rejected and the solve repeated with the
    // focal length fixed; a solve that made the verified matches worse is reverted.
    if (!options.fixFocal && (report.focalScale < 0.85 || report.focalScale > 1.15)) {
      const retry = Alignment.align(frames, searchDegrees, workingSize, { fixFocal: true });
      retry.report.focalRejected = report.focalScale;
      return retry;
    }
    if (finalMatches.length > 0 && report.rmsAfter > report.rmsBefore * 1.05) {
      report.reverted = true;
      report.focalScale = 1;
      report.rmsAfter = report.rmsBefore;
      return { frames, report: Alignment.finishReport(report, frames.length, [], initial, finalPixelAngle) };
    }

    const finished = Alignment.finishReport(report, frames.length, finalMatches, rotations, finalPixelAngle);
    const output = frames.map((frame, idx) => new RasterFrame(frame.image, frame.projection.rotated(rotations[idx], report.focalScale)));
    return { frames: output, report: finished };
  }

  /**
   * RMS residual (working-size pixels): each match's two image points (measured in the
   * `measured` projections) are turned into rays with the `evaluate` projections.
   */
  static rmsWith(matches: Match[], measured: Projection[], evaluate: Projection[], pixelAngle: number[]): number {
    if (matches.length === 0 || measured.length === 0) return 0;
    let sum = 0;
    for (const m of matches) {
      const pa = measured[m.i], pb = measured[m.j];
      const u = evaluate[m.i].direction(m.a[0] * pa.x.w + pa.meta.x, -m.a[1] * pa.y.w + pa.meta.y);
      const v = evaluate[m.j].direction(m.b[0] * pb.x.w + pb.meta.x, -m.b[1] * pb.y.w + pb.meta.y);
      const e = Math.hypot(u.x - v.x, u.y - v.y, u.z - v.z) / pixelAngle[m.i];
      sum += e * e;
    }
    return Math.sqrt(sum / matches.length);
  }

  /** RMS residual (working-size pixels) of matches under the given rotations. */
  static rmsOf(matches: Match[], rotations: Rotation[], pixelAngle: number[]): number {
    if (matches.length === 0 || pixelAngle.length === 0) return 0;
    let sum = 0;
    for (const m of matches) {
      const e = Alignment.matchError(m, rotations, pixelAngle);
      sum += e * e;
    }
    return Math.sqrt(sum / matches.length);
  }

  static matchError(m: Match, rotations: Rotation[], pixelAngle: number[]): number {
    const ray = (p: [number, number]): Vec3 => {
      const l = Math.sqrt(p[0] * p[0] + p[1] * p[1] + 1);
      return { x: p[0] / l, y: p[1] / l, z: -1 / l };
    };
    const u = rotations[m.i].world(ray(m.a));
    const v = rotations[m.j].world(ray(m.b));
    return Math.hypot(u.x - v.x, u.y - v.y, u.z - v.z) / pixelAngle[m.i];
  }

  /** Ghost-risk spots, per-match residual points and the overall confidence. */
  static finishReport(
    report: AlignmentReport,
    frameCount: number,
    matches: Match[],
    rotations: Rotation[],
    pixelAngle: number[]
  ): AlignmentReport {
    report.ghostRisk = matches.length ? Alignment.ghostRisk(matches, rotations, pixelAngle) : [];
    const step = Math.max(1, Math.ceil(matches.length / 4000));
    const pts: Array<{ x: number; y: number; z: number; errorPx: number }> = [];
    for (let k = 0; k < matches.length; k += step) {
      const m = matches[k];
      const l = Math.sqrt(m.a[0] * m.a[0] + m.a[1] * m.a[1] + 1);
      const d = rotations[m.i].world({ x: m.a[0] / l, y: m.a[1] / l, z: -1 / l });
      pts.push({ x: d.x, y: d.y, z: d.z, errorPx: Alignment.matchError(m, rotations, pixelAngle) });
    }
    report.matchPoints = pts;
    const raw = Math.max(1, report.rawMatches);
    const linked = frameCount - report.unconstrainedFrames.length;
    report.confidence = report.reverted
      ? 0
      : Math.min(1, report.matches / (10 * Math.max(1, frameCount))) *
        Math.min(1, report.matches / raw / 0.6) *
        (linked / Math.max(1, frameCount)) *
        (report.components <= 1 ? 1 : 0.6) *
        (report.rmsAfter > 0 && report.rmsAfter < 1.5 ? 1 : 0.5);
    return report;
  }

  static corners(
    g: Gray,
    margin: number,
    cell = 32,
    threshold = 0.002
  ): Array<[number, number]> {
    const w = g.width;
    const h = g.height;
    if (w <= 2 * margin + 2 || h <= 2 * margin + 2) return [];

    const xx = new Float32Array(w * h);
    const yy = new Float32Array(w * h);
    const xy = new Float32Array(w * h);

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const gx = (g.v[i + 1] - g.v[i - 1]) / 2;
        const gy = (g.v[i + w] - g.v[i - w]) / 2;
        xx[i] = gx * gx;
        yy[i] = gy * gy;
        xy[i] = gx * gy;
      }
    }

    const box = (a: Float32Array): Float32Array => {
      const row = new Float32Array(a);
      const out = new Float32Array(a);
      for (let y = 0; y < h; y++) {
        for (let x = 3; x < w - 3; x++) {
          let s = 0;
          for (let k = -3; k <= 3; k++) s += a[y * w + x + k];
          row[y * w + x] = s;
        }
      }
      for (let y = 3; y < h - 3; y++) {
        for (let x = 0; x < w; x++) {
          let s = 0;
          for (let k = -3; k <= 3; k++) s += row[(y + k) * w + x];
          out[y * w + x] = s;
        }
      }
      return out;
    };

    const sxx = box(xx);
    const syy = box(yy);
    const sxy = box(xy);
    const result: Array<[number, number]> = [];

    for (let cy = margin; cy < h - margin; cy += cell) {
      for (let cx = margin; cx < w - margin; cx += cell) {
        let best = threshold;
        let point: [number, number] | null = null;
        const yEnd = Math.min(cy + cell, h - margin);
        const xEnd = Math.min(cx + cell, w - margin);
        for (let y = cy; y < yEnd; y++) {
          for (let x = cx; x < xEnd; x++) {
            const i = y * w + x;
            const a = sxx[i];
            const c = syy[i];
            const b = sxy[i];
            const score = (a + c) / 2 - Math.sqrt(((a - c) * (a - c)) / 4 + b * b);
            if (score > best) {
              best = score;
              point = [x, y];
            }
          }
        }
        if (point) result.push(point);
      }
    }
    return result;
  }

  /** Minimum consistent matches for a photo pair to be trusted at all. */
  static readonly minPairInliers = 6;
  /** Minimum share of a pair's matches that must agree. */
  static readonly minPairInlierRatio = 0.5;
  /** Benchmark switch: false reproduces the old unverified behaviour for comparisons. */
  static pairVerification = true;
  /** Keep several hypotheses for points on repeating structure (see match). */
  static multiHypothesis = true;
  /**
   * Solve weight for matches from pairs too small to verify (< 3 points). Measured: 0.25 cost
   * 0.2–1.5 dB across scenarios (these few matches are often the only link between two
   * photos); the solve's robust loss and 3 px residual rejection bound wrong ones. They are
   * flagged unverified and never counted as verified or used for confidence.
   */
  static insufficientWeight = 1;
  /** Solve weight for verified pairs whose inliers are bunched together. */
  static weakPairWeight = 0.5;

  /**
   * RANSAC check that a pair's matches agree on ONE rotation of the camera.
   *
   * Each match gives a ray from frame i (via its current pose) and a ray from frame j. If the
   * matches are right, a single small 3-D rotation of camera j maps all of j's rays onto i's
   * (exact for a camera turning in place — perspective included; an earlier 2-D image-plane
   * model wrongly rejected good matches near frame edges). Wrong matches on repetitive
   * structure (windows, arches, pillars, carvings) each imply a different rotation. Two
   * matches define a hypothesis; the largest agreeing set wins. Pairs whose matches mostly
   * disagree are dropped, so one bad local match cannot bend the whole panorama.
   *
   * Pairs with fewer than 3 matches cannot be checked and are passed through; the bundle
   * adjustment's robust loss and residual rejection still bound them.
   *
   * @param tolerance angular inlier tolerance in radians (≈ a few working-size pixels)
   * @param maxRotation largest believable correction for this pair, radians
   */
  static verifyPair(
    matches: Match[],
    a: Projection,
    b: Projection,
    tolerance: number,
    maxRotation = (8 * Math.PI) / 180
  ): Match[] {
    const n = matches.length;
    // Distinct feature points (a point on repeating structure can carry up to 3 hypotheses).
    const patchOf = (k: number) => matches[k].patch ?? -1 - k;
    const points = new Set(matches.map((_, k) => patchOf(k))).size;
    if (points < 3) return []; // cannot be verified (handled as insufficient data by align)
    const u: Vec3[] = [];
    const v: Vec3[] = [];
    for (const m of matches) {
      u.push(a.direction(m.a[0] * a.x.w + a.meta.x, -m.a[1] * a.y.w + a.meta.y));
      v.push(b.direction(m.b[0] * b.x.w + b.meta.x, -m.b[1] * b.y.w + b.meta.y));
    }
    const cross = (p: Vec3, q: Vec3): Vec3 => ({
      x: p.y * q.z - p.z * q.y,
      y: p.z * q.x - p.x * q.z,
      z: p.x * q.y - p.y * q.x
    });
    const unit = (p: Vec3): Vec3 | null => {
      const l = Math.hypot(p.x, p.y, p.z);
      return l > 1e-9 ? { x: p.x / l, y: p.y / l, z: p.z / l } : null;
    };
    // Orthonormal frame from two directions.
    const frame = (p: Vec3, q: Vec3): [Vec3, Vec3, Vec3] | null => {
      const n2 = unit(cross(p, q));
      if (!n2) return null;
      return [p, n2, cross(p, n2)];
    };

    const tol2 = tolerance * tolerance;
    const cosMax = Math.cos(maxRotation);
    let bestInliers: number[] = [];
    let bestCos = -2;
    let bestR: number[] = [];
    // Every distinct supported hypothesis, to detect repetition (several rotations fit well).
    const hypotheses: Array<{ inliers: number[]; cos: number; R: number[] }> = [];
    const consider = (s: number, t: number) => {
      const E = frame(v[s], v[t]);
      const F = frame(u[s], u[t]);
      if (!E || !F) return;
      // Two matches must span a meaningful baseline to define a rotation.
      if (v[s].x * v[t].x + v[s].y * v[t].y + v[s].z * v[t].z > 0.99995) return;
      // R = F · Eᵀ maps j-rays onto i-rays.
      const R = [0, 0, 0, 0, 0, 0, 0, 0, 0];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          let sum = 0;
          for (let k = 0; k < 3; k++) {
            const fk = F[k];
            const ek = E[k];
            const fr = r === 0 ? fk.x : r === 1 ? fk.y : fk.z;
            const ec = c === 0 ? ek.x : c === 1 ? ek.y : ek.z;
            sum += fr * ec;
          }
          R[r * 3 + c] = sum;
        }
      }
      const cosAngle = (R[0] + R[4] + R[8] - 1) / 2;
      if (cosAngle < cosMax) return; // implausibly large correction
      // At most one inlier per feature point (the closest of its hypotheses).
      const perPoint = new Map<number, { k: number; e: number }>();
      for (let k = 0; k < n; k++) {
        const p = v[k];
        const ex = R[0] * p.x + R[1] * p.y + R[2] * p.z - u[k].x;
        const ey = R[3] * p.x + R[4] * p.y + R[5] * p.z - u[k].y;
        const ez = R[6] * p.x + R[7] * p.y + R[8] * p.z - u[k].z;
        const e2 = ex * ex + ey * ey + ez * ez;
        if (e2 > tol2) continue;
        const id = patchOf(k);
        const prev = perPoint.get(id);
        if (!prev || e2 < prev.e) perPoint.set(id, { k, e: e2 });
      }
      const inliers = [...perPoint.values()].map((x) => x.k);
      // Prefer more support; when two rotations are similarly supported (a repeating pattern
      // one period apart), prefer the smaller correction — the one nearest the sensor pose.
      const better =
        inliers.length > bestInliers.length * 1.1 ||
        (inliers.length >= bestInliers.length * 0.9 && cosAngle > bestCos);
      if (inliers.length >= 3) hypotheses.push({ inliers, cos: cosAngle, R });
      if (inliers.length > 0 && better) {
        bestInliers = inliers;
        bestCos = cosAngle;
        bestR = R;
      }
    };

    if (n <= 12) {
      for (let s = 0; s < n; s++) for (let t = s + 1; t < n; t++) consider(s, t);
    } else {
      let seed = (0x9e3779b9 ^ n) >>> 0;
      const next = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed % n;
      };
      for (let it = 0; it < 150; it++) {
        const s = next();
        let t = next();
        if (t === s) t = (s + 1) % n;
        consider(s, t);
      }
    }

    // Repetition check: when a clearly different rotation (> 3° from the winner) is supported
    // by at least half as many points, the scene cannot tell the two apart (one pattern period
    // apart). The sensor pose is then the only tie-breaker: take the smallest correction.
    if (bestInliers.length > 0 && bestR.length === 9) {
      let chosen = { inliers: bestInliers, cos: bestCos };
      for (const h of hypotheses) {
        if (h.inliers.length < bestInliers.length * 0.5) continue;
        let tr = 0;
        for (let q = 0; q < 9; q++) tr += h.R[q] * bestR[q];
        const sep = Math.acos(Math.max(-1, Math.min(1, (tr - 1) / 2)));
        if (sep < (3 * Math.PI) / 180) continue;
        if (h.cos > chosen.cos) chosen = h;
      }
      bestInliers = chosen.inliers;
    }

    const needed = points < Alignment.minPairInliers ? Math.max(3, Math.ceil(points * 0.67)) : Alignment.minPairInliers;
    if (bestInliers.length < needed || bestInliers.length < points * Alignment.minPairInlierRatio) {
      return [];
    }
    return bestInliers.map((k) => matches[k]);
  }

  /**
   * Spots where verified matches still disagree after the global solve (> 2 px): what remains
   * there is not a camera-rotation error but parallax (close objects, phone moved) or movement,
   * i.e. likely ghosting. Clustered (≤ 10°) into at most 6 centres with their mean error.
   */
  static ghostRisk(
    matches: Match[],
    rotations: Rotation[],
    pixelAngle: number[]
  ): Array<{ x: number; y: number; z: number; errorPx: number }> {
    const hits: Array<{ d: Vec3; err: number }> = [];
    for (const m of matches) {
      const ray = (p: [number, number]): Vec3 => {
        const l = Math.sqrt(p[0] * p[0] + p[1] * p[1] + 1);
        return { x: p[0] / l, y: p[1] / l, z: -1 / l };
      };
      const u = rotations[m.i].world(ray(m.a));
      const v = rotations[m.j].world(ray(m.b));
      const err = Math.hypot(u.x - v.x, u.y - v.y, u.z - v.z) / pixelAngle[m.i];
      if (err > 2) hits.push({ d: u, err });
    }
    const out: Array<{ x: number; y: number; z: number; errorPx: number }> = [];
    const cos10 = Math.cos((10 * Math.PI) / 180);
    const left = hits.slice().sort((p, q) => q.err - p.err);
    while (left.length >= 3 && out.length < 6) {
      const seed = left[0].d;
      const group = left.filter((h) => h.d.x * seed.x + h.d.y * seed.y + h.d.z * seed.z > cos10);
      if (group.length >= 3) {
        let x = 0, y = 0, z = 0, e = 0;
        for (const g of group) { x += g.d.x; y += g.d.y; z += g.d.z; e += g.err; }
        const l = Math.hypot(x, y, z);
        out.push({ x: x / l, y: y / l, z: z / l, errorPx: e / group.length });
      }
      for (const g of group) left.splice(left.indexOf(g), 1);
    }
    return out;
  }

  static overlappingPairs(projections: Projection[], slackDegrees = 0): Array<[number, number]> {
    const slack = (slackDegrees * Math.PI) / 180;
    const halfDiagonal = (p: Projection) =>
      Math.atan(Math.sqrt(p.meta.z * p.meta.z + p.meta.w * p.meta.w) / 2 / p.x.w);
    const pairs: Array<[number, number]> = [];
    for (let i = 0; i < projections.length; i++) {
      for (let j = i + 1; j < projections.length; j++) {
        const a = projections[i];
        const b = projections[j];
        const dot = Math.min(1, Math.max(-1, a.z.x * b.z.x + a.z.y * b.z.y + a.z.z * b.z.z));
        const angle = Math.acos(dot);
        if (angle < (halfDiagonal(a) + halfDiagonal(b)) * 0.95 + slack) {
          pairs.push([i, j]);
        }
      }
    }
    return pairs;
  }

  static match(
    i: number,
    j: number,
    projections: Projection[],
    grays: Gray[],
    features: Array<[number, number]>,
    searchDegrees: number
  ): Match[] {
    const a = projections[i];
    const b = projections[j];
    const ga = grays[i];
    const gb = grays[j];
    const r = Alignment.patchRadius;
    const radius = Math.min(48, Math.max(3, Math.ceil(((searchDegrees * Math.PI) / 180) * (a.x.w / ga.scale))));
    const span = radius + r;
    const size = 2 * span + 1;

    const normalized = (step: number, origin: [number, number]): Float32Array | null => {
      const values: number[] = [];
      for (let v = -r; v <= r; v += step) {
        for (let u = -r; u <= r; u += step) {
          values.push(ga.v[(origin[1] + v) * ga.width + origin[0] + u]);
        }
      }
      const mean = values.reduce((acc, val) => acc + val, 0) / values.length;
      let normSq = 0;
      for (let k = 0; k < values.length; k++) {
        values[k] -= mean;
        normSq += values[k] * values[k];
      }
      const norm = Math.sqrt(normSq);
      if (norm / Math.sqrt(values.length) <= 0.015) return null;
      const out = new Float32Array(values.length);
      for (let k = 0; k < values.length; k++) out[k] = values[k] / norm;
      return out;
    };

    const score = (
      patch: Float32Array,
      window: Float32Array,
      ox: number,
      oy: number,
      step: number
    ): number => {
      let cross = 0, sum = 0, sq = 0, k = 0;
      for (let v = -r; v <= r; v += step) {
        for (let u = -r; u <= r; u += step) {
          const val = window[(span + oy + v) * size + span + ox + u];
          cross += patch[k] * val;
          sum += val;
          sq += val * val;
          k++;
        }
      }
      const variance = sq - (sum * sum) / k;
      return variance > 1e-6 ? cross / Math.sqrt(variance) : -1;
    };

    const result: Match[] = [];
    const nearB = features.filter((p) => {
      const [fx, fy] = ga.frame(p[0], p[1]);
      const q = b.unclippedProject(a.direction(fx, fy));
      if (!q) return false;
      const m = (span + 2) * gb.scale;
      return q[0] > m && q[1] > m && q[0] < b.meta.z - m && q[1] < b.meta.w - m;
    });

    let patchCounter = 0;
    for (const p of nearB) {
      const fine = normalized(1, p);
      const coarse = normalized(2, p);
      if (!fine || !coarse) continue;

      const window = new Float32Array(size * size);
      let complete = true;
      for (let v = -span; v <= span && complete; v++) {
        for (let u = -span; u <= span; u++) {
          const [fx, fy] = ga.frame(p[0] + u, p[1] + v);
          const q = b.unclippedProject(a.direction(fx, fy));
          if (!q) {
            complete = false;
            break;
          }
          const val = gb.sample(q[0], q[1]);
          if (val === null) {
            complete = false;
            break;
          }
          window[(v + span) * size + u + span] = val;
        }
      }
      if (!complete) continue;

      const candidates: Array<[number, number, number]> = [];
      for (let oy = -radius; oy <= radius; oy += 2) {
        for (let ox = -radius; ox <= radius; ox += 2) {
          candidates.push([score(coarse, window, ox, oy, 2), ox, oy]);
        }
      }
      candidates.sort((p1, p2) => p2[0] - p1[0]);
      const best = candidates[0];
      if (!best || best[0] <= 0.6) continue;
      // Distinct peaks close to the best score. One peak = unambiguous match. Several = repeating
      // structure (pillars, windows, carvings): instead of discarding the point (which left
      // repetitive facades almost unmatched), keep up to 3 hypotheses and let the pair's
      // rotation consensus (verifyPair) choose — at most one per point.
      const peaks: Array<[number, number, number]> = [best];
      for (const c of candidates) {
        if (!Alignment.multiHypothesis) {
          // Single-hypothesis mode: an ambiguous point is discarded outright.
          if (c !== best && c[0] >= best[0] - 0.08 && Math.max(Math.abs(c[1] - best[1]), Math.abs(c[2] - best[2])) > 3) {
            peaks.length = 0;
            break;
          }
          continue;
        }
        if (c[0] < best[0] - 0.08 || peaks.length >= 3) break;
        if (peaks.every((pk) => Math.max(Math.abs(c[1] - pk[1]), Math.abs(c[2] - pk[2])) > 3)) peaks.push(c);
      }
      const patchId = patchCounter++;

      for (const coarsePeak of peaks) {
        let peak: [number, number, number] = [-2, 0, 0];
        const grid = new Float32Array(25).fill(-2);
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const ox = coarsePeak[1] + dx;
            const oy = coarsePeak[2] + dy;
            if (Math.abs(ox) > radius || Math.abs(oy) > radius) continue;
            const s = score(fine, window, ox, oy, 1);
            grid[(dy + 2) * 5 + dx + 2] = s;
            if (s > peak[0]) peak = [s, ox, oy];
          }
        }
        if (peak[0] <= 0.85 || Math.abs(peak[1]) >= radius || Math.abs(peak[2]) >= radius) continue;

        const refine = (left: number, centre: number, right: number): number => {
          const d = left - 2 * centre + right;
          return left > -2 && right > -2 && d < 0 ? Math.min(0.5, Math.max(-0.5, (left - right) / (2 * d))) : 0;
        };
        const gx = peak[1] - coarsePeak[1] + 2;
        const gy = peak[2] - coarsePeak[2] + 2;
        const sx = gx > 0 && gx < 4 ? refine(grid[gy * 5 + gx - 1], peak[0], grid[gy * 5 + gx + 1]) : 0;
        const sy = gy > 0 && gy < 4 ? refine(grid[(gy - 1) * 5 + gx], peak[0], grid[(gy + 1) * 5 + gx]) : 0;

        const [ax, ay] = ga.frame(p[0], p[1]);
        const [bx, by] = ga.frame(p[0] + peak[1] + sx, p[1] + peak[2] + sy);
        const q = b.unclippedProject(a.direction(bx, by));
        if (!q) continue;
        result.push({
          i,
          j,
          a: a.plane(ax, ay),
          b: b.plane(q[0], q[1]),
          patch: patchId,
          ambiguous: peaks.length > 1
        });
      }
    }

    return result;
  }

  static cross(a: Vec3, b: Vec3): Vec3 {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x
    };
  }

  static exp(w: Vec3, v: Vec3): Vec3 {
    const theta = Math.sqrt(w.x * w.x + w.y * w.y + w.z * w.z);
    if (theta <= 1e-12) {
      const c = Alignment.cross(w, v);
      return { x: v.x + c.x, y: v.y + c.y, z: v.z + c.z };
    }
    const k = { x: w.x / theta, y: w.y / theta, z: w.z / theta };
    const kv = k.x * v.x + k.y * v.y + k.z * v.z;
    const c = Alignment.cross(k, v);
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    return {
      x: v.x * cosT + c.x * sinT + k.x * kv * (1 - cosT),
      y: v.y * cosT + c.y * sinT + k.y * kv * (1 - cosT),
      z: v.z * cosT + c.z * sinT + k.z * kv * (1 - cosT)
    };
  }

  static adjust(
    rotations: Rotation[],
    corrections: Vec3[],
    focal: number,
    matches: Match[],
    pixelAngle: number[]
  ): { before: number; after: number; focal: number; converged: boolean; iterations: number } {
    const n = rotations.length;
    const size = 3 * n + 1;
    const prior = 1 / Math.pow((Alignment.priorDegrees * Math.PI) / 180, 2);
    const focalWeight = 1 / (Alignment.focalPriorWeight * Alignment.focalPriorWeight);
    const start = focal;

    const ray = (m: [number, number]): [Vec3, Vec3] => {
      const s = Math.exp(start - focal);
      const rx = m[0] * s;
      const ry = m[1] * s;
      const rz = -1;
      const length = Math.sqrt(rx * rx + ry * ry + rz * rz);
      const unit: Vec3 = { x: rx / length, y: ry / length, z: rz / length };
      const dr: Vec3 = { x: -m[0] * s, y: -m[1] * s, z: 0 };
      const uDotDr = unit.x * dr.x + unit.y * dr.y + unit.z * dr.z;
      return [
        unit,
        {
          x: (dr.x - unit.x * uDotDr) / length,
          y: (dr.y - unit.y * uDotDr) / length,
          z: (dr.z - unit.z * uDotDr) / length
        }
      ];
    };

    let active = matches.slice();
    const residuals = (list: Match[]): number[] =>
      list.map((m) => {
        const u = rotations[m.i].world(ray(m.a)[0]);
        const v = rotations[m.j].world(ray(m.b)[0]);
        const ex = u.x - v.x, ey = u.y - v.y, ez = u.z - v.z;
        return Math.sqrt(ex * ex + ey * ey + ez * ez) / pixelAngle[m.i];
      });

    const rms = (vals: number[]): number =>
      vals.length === 0
        ? 0
        : Math.sqrt(vals.reduce((acc, v) => acc + v * v, 0) / vals.length);

    const before = rms(residuals(active));
    let iterationsDone = 0;
    let convergedFlag = false;
    const axes: Vec3[] = [
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 0, z: 1 }
    ];

    for (let pass = 0; pass < 2; pass++) {
      for (let iter = 0; iter < 8; iter++) {
        const hessian = new Float64Array(size * size);
        const gradient = new Float64Array(size);

        for (const m of active) {
          const [ra, da] = ray(m.a);
          const [rb, db] = ray(m.b);
          const u = rotations[m.i].world(ra);
          const v = rotations[m.j].world(rb);
          const e: Vec3 = { x: u.x - v.x, y: u.y - v.y, z: u.z - v.z };
          const sigma = pixelAngle[m.i];
          const norm = Math.sqrt(e.x * e.x + e.y * e.y + e.z * e.z) / sigma;
          const w = ((norm <= 1.5 ? 1 : 1.5 / norm) / (sigma * sigma)) * (m.weight ?? 1);

          const wda = rotations[m.i].world(da);
          const wdb = rotations[m.j].world(db);
          const columns: Array<[number, Vec3]> = [
            [3 * m.i + 0, Alignment.cross(axes[0], u)],
            [3 * m.i + 1, Alignment.cross(axes[1], u)],
            [3 * m.i + 2, Alignment.cross(axes[2], u)],
            [3 * m.j + 0, Alignment.cross(v, axes[0])],
            [3 * m.j + 1, Alignment.cross(v, axes[1])],
            [3 * m.j + 2, Alignment.cross(v, axes[2])],
            [3 * n, { x: wda.x - wdb.x, y: wda.y - wdb.y, z: wda.z - wdb.z }]
          ];

          for (const [r, a] of columns) {
            gradient[r] += w * (a.x * e.x + a.y * e.y + a.z * e.z);
            for (const [c, b] of columns) {
              hessian[r * size + c] += w * (a.x * b.x + a.y * b.y + a.z * b.z);
            }
          }
        }

        for (let k = 0; k < n; k++) {
          const corr = [corrections[k].x, corrections[k].y, corrections[k].z];
          for (let p = 0; p < 3; p++) {
            hessian[(3 * k + p) * size + 3 * k + p] += prior;
            gradient[3 * k + p] += prior * corr[p];
          }
        }
        hessian[3 * n * size + 3 * n] += focalWeight;
        gradient[3 * n] += focalWeight * focal;

        const negGrad = new Float64Array(size);
        for (let i = 0; i < size; i++) negGrad[i] = -gradient[i];

        const step = Alignment.solve(hessian, negGrad, size);
        if (!step) break;

        let largest = Math.abs(step[3 * n]);
        for (let k = 0; k < n; k++) {
          const w: Vec3 = { x: step[3 * k], y: step[3 * k + 1], z: step[3 * k + 2] };
          rotations[k].rotate(w);
          corrections[k].x += w.x;
          corrections[k].y += w.y;
          corrections[k].z += w.z;
          largest = Math.max(largest, Math.sqrt(w.x * w.x + w.y * w.y + w.z * w.z));
        }
        focal += step[3 * n];
        iterationsDone++;
        if (largest < 1e-7) {
          convergedFlag = true;
          break;
        }
      }

      if (pass === 0) {
        const res = residuals(active);
        active = active.filter((_, idx) => res[idx] < 3);
      }
    }

    return { before, after: rms(residuals(active)), focal, converged: convergedFlag, iterations: iterationsDone };
  }

  static solve(a: Float64Array | number[], b: Float64Array | number[], n: number): number[] | null {
    const l = new Float64Array(n * n);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        let s = a[i * n + j];
        for (let k = 0; k < j; k++) {
          s -= l[i * n + k] * l[j * n + k];
        }
        if (i === j) {
          if (s <= 0) return null;
          l[i * n + i] = Math.sqrt(s);
        } else {
          l[i * n + j] = s / l[j * n + j];
        }
      }
    }
    const y = Array.from(b);
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < i; k++) y[i] -= l[i * n + k] * y[k];
      y[i] /= l[i * n + i];
    }
    for (let i = n - 1; i >= 0; i--) {
      for (let k = i + 1; k < n; k++) y[i] -= l[k * n + i] * y[k];
      y[i] /= l[i * n + i];
    }
    return y;
  }
}
