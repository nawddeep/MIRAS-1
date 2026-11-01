import { LowPass, RasterFrame } from './Reprojection';

/**
 * Seam selection: decides which frame supplies the fine detail at each point of the
 * panorama, on a coarse equirectangular grid (≈ 0.35° cells at 1024 px).
 *
 * Energy (minimised by multi-pass ICM from a centre-preferring start):
 *  - data:       prefer frame centres (sharper, less lens falloff/distortion), and where 3+
 *                frames overlap, prefer frames that agree with the consensus (median) — this
 *                drops a person who walked through one photo, or a misaligned copy;
 *  - smoothness: switching frame between neighbouring cells costs the colour disagreement
 *                of the two frames there (Kwatra-style seam cost) plus a small length term,
 *                so seams run where the photos already agree instead of through pillars,
 *                carvings, people or parallax ghosts.
 *
 * The renderer then takes the detail band from the chosen frame (bilinear-feathered across
 * cells) while the low-frequency band keeps its wide blend — i.e. two-band blending along
 * optimised seams. Cells no frame covers get label 255.
 */
/** What the seam finder did, with each number meaning exactly one thing. */
export interface SeamStats {
  /** Connected regions where overlapping photos disagree (people, parallax, misalignment). */
  detected: number;
  /** Regions actually given whole to one photo. */
  assigned: number;
  /** Regions over 5% of the sphere: treated as an exposure/alignment problem, not resolved. */
  skippedTooLarge: number;
  /** Regions no single photo covers completely: unresolved. */
  skippedNoCoveringFrame: number;
  /** Regions only unconfirmed (unmatched) photos cover: unresolved. */
  skippedLowConfidence: number;
  /** Grid cells left to the soft blend because no overlapping photo was confirmed. */
  lowConfidenceCells: number;
  /** Grid cells where the detail source switches photo (seam length). */
  seamCells: number;
  /** All grid cells of the panorama (denominator for panorama-wide shares). */
  gridCells: number;
  /** Grid cells covered by two or more photos (denominator for overlap shares). */
  overlapCells: number;
}

export class SeamMap {
  constructor(
    public width: number,
    public height: number,
    public labels: Uint8Array,
    /** 1 where a region of difference was assigned to a single frame (low band follows too). */
    public hard: Uint8Array = new Uint8Array(0)
  ) {}

  static readonly NONE = 255;
  static readonly MAX_CANDIDATES = 4;
  /** Summed RGB difference (0..3 scale, low-pass colours) that marks a region of difference. */
  static readonly DIFFERENCE_THRESHOLD = 0.12;
  /** Regions of difference found in the last computation (diagnostics; = lastStats.detected). */
  static lastRegions = 0;
  /** What happened to the regions of difference in the last computation. */
  static lastStats: SeamStats = SeamMap.emptyStats();

  static emptyStats(): SeamStats {
    return { detected: 0, assigned: 0, skippedTooLarge: 0, skippedNoCoveringFrame: 0, skippedLowConfidence: 0, lowConfidenceCells: 0, seamCells: 0, gridCells: 0, overlapCells: 0 };
  }

  /** Grid size for a given output width (cells of ~4–6 output pixels, 256–1024 wide). */
  static gridWidth(outWidth: number): number {
    return Math.max(256, Math.min(1024, Math.round(outWidth / 4 / 2) * 2));
  }

  /**
   *  options.frameConfidence 0..1 per frame (1 = tied in by verified matches). Where only
   *   unconfident frames overlap, no hard seam is chosen (label NONE): the renderer keeps the
   *   soft edge-weighted blend instead of switching between possibly misplaced photos.
   *  options.frameSharpness capture-time blur ratio per frame (higher = sharper).
   */
  static compute(
    frames: RasterFrame[],
    lows: LowPass[],
    outWidth: number,
    options: { frameConfidence?: Float32Array; frameSharpness?: Float32Array } = {}
  ): SeamMap {
    const conf = options.frameConfidence ?? new Float32Array(frames.length).fill(1);
    const sharp = options.frameSharpness ?? new Float32Array(frames.length).fill(1);
    const stats = SeamMap.emptyStats();
    const W = SeamMap.gridWidth(outWidth);
    const H = W / 2;
    const K = SeamMap.MAX_CANDIDATES;
    const N = W * H;
    const cand = new Uint8Array(N * K).fill(SeamMap.NONE);
    const edge = new Float32Array(N * K);
    const col = new Float32Array(N * K * 3);
    const count = new Uint8Array(N);

    // 1. Candidates per cell: frames covering it, best-centred first (max K).
    for (let y = 0; y < H; y++) {
      const pitch = Math.PI / 2 - ((y + 0.5) / H) * Math.PI;
      const sp = Math.sin(pitch), cp = Math.cos(pitch);
      for (let x = 0; x < W; x++) {
        const a = ((x + 0.5) / W) * 2 * Math.PI - Math.PI;
        const d = { x: Math.sin(a) * cp, y: sp, z: -Math.cos(a) * cp };
        const cell = y * W + x;
        let c = 0;
        for (let f = 0; f < frames.length && f < 254; f++) {
          const proj = frames[f].projection.project(d);
          if (!proj) continue;
          const [px, py, e] = proj;
          // Insert sorted by edge distance (descending), keep top K.
          let slot = c < K ? c : K;
          while (slot > 0 && edge[cell * K + slot - 1] < e) slot--;
          if (slot >= K) continue;
          for (let s = Math.min(c, K - 1); s > slot; s--) {
            cand[cell * K + s] = cand[cell * K + s - 1];
            edge[cell * K + s] = edge[cell * K + s - 1];
            for (let ch = 0; ch < 3; ch++) col[(cell * K + s) * 3 + ch] = col[(cell * K + s - 1) * 3 + ch];
          }
          const rgb = lows[f].sample(px, py);
          const g = frames[f].projection.z.w;
          cand[cell * K + slot] = f;
          edge[cell * K + slot] = e;
          col[(cell * K + slot) * 3] = rgb[0] * g;
          col[(cell * K + slot) * 3 + 1] = rgb[1] * g;
          col[(cell * K + slot) * 3 + 2] = rgb[2] * g;
          if (c < K) c++;
        }
        count[cell] = c;
      }
    }

    // 2. Data cost per candidate.
    const data = new Float32Array(N * K);
    const tmp = [0, 0, 0, 0];
    for (let cell = 0; cell < N; cell++) {
      const c = count[cell];
      let med0 = 0, med1 = 0, med2 = 0;
      if (c >= 3) {
        const median = (ch: number) => {
          for (let s = 0; s < c; s++) tmp[s] = col[(cell * K + s) * 3 + ch];
          const v = tmp.slice(0, c).sort((p, q) => p - q);
          return c % 2 ? v[c >> 1] : (v[c / 2 - 1] + v[c / 2]) / 2;
        };
        med0 = median(0); med1 = median(1); med2 = median(2);
      }
      let maxSharp = 0;
      for (let s = 0; s < c; s++) maxSharp = Math.max(maxSharp, sharp[cand[cell * K + s]]);
      for (let s = 0; s < c; s++) {
        const i = cell * K + s;
        const f = cand[i];
        let cost = 0.4 * Math.max(0, 0.25 - edge[i]) / 0.25; // centre preference
        cost += 0.3 * (1 - (maxSharp > 0 ? sharp[f] / maxSharp : 1)); // prefer the sharper photo
        if (conf[f] < 0.5) cost += 0.5; // prefer frames confirmed by verified matches
        if (c >= 3) {
          cost += 4 * (Math.abs(col[i * 3] - med0) + Math.abs(col[i * 3 + 1] - med1) + Math.abs(col[i * 3 + 2] - med2));
        }
        data[i] = cost;
      }
    }

    // Colour of frame `f` at cell, or NaN when f does not cover it.
    const colorIdx = (cell: number, f: number): number => {
      for (let s = 0; s < count[cell]; s++) if (cand[cell * K + s] === f) return cell * K + s;
      return -1;
    };
    const LAMBDA = 6;
    const SEAM_LENGTH = 0.02;
    const pairCost = (p: number, q: number, fp: number, fq: number): number => {
      if (fp === fq) return 0;
      // Disagreement of the two frames on both sides of the cut.
      const ip = colorIdx(p, fq), iq = colorIdx(q, fp);
      const ap = colorIdx(p, fp), aq = colorIdx(q, fq);
      if (ip < 0 || iq < 0 || ap < 0 || aq < 0) return LAMBDA * 0.5 + SEAM_LENGTH; // seam at a frame border
      const dp = Math.abs(col[ap * 3] - col[ip * 3]) + Math.abs(col[ap * 3 + 1] - col[ip * 3 + 1]) + Math.abs(col[ap * 3 + 2] - col[ip * 3 + 2]);
      const dq = Math.abs(col[aq * 3] - col[iq * 3]) + Math.abs(col[aq * 3 + 1] - col[iq * 3 + 1]) + Math.abs(col[aq * 3 + 2] - col[iq * 3 + 2]);
      return LAMBDA * (dp + dq) + SEAM_LENGTH;
    };

    // 3. ICM from the minimum-data-cost start, alternating sweep directions.
    const labels = new Uint8Array(N).fill(SeamMap.NONE);
    const locked = new Uint8Array(N);
    for (let cell = 0; cell < N; cell++) {
      let best = -1, bestCost = Infinity;
      for (let s = 0; s < count[cell]; s++) {
        if (data[cell * K + s] < bestCost) {
          bestCost = data[cell * K + s];
          best = cand[cell * K + s];
        }
      }
      if (best >= 0) labels[cell] = best;
    }
    const neighbours = (cell: number, out: number[]): number => {
      const x = cell % W, y = (cell / W) | 0;
      let k = 0;
      out[k++] = y * W + ((x + 1) % W); // the 360° seam wraps
      out[k++] = y * W + ((x - 1 + W) % W);
      if (y > 0) out[k++] = cell - W;
      if (y < H - 1) out[k++] = cell + W;
      return k;
    };

    // 3a. Regions of difference (Uyttendaele et al., "Eliminating ghosting and exposure
    // artifacts in image mosaics"): connected blobs where overlapping frames disagree — a
    // passer-by, a near object seen with parallax, a misaligned structure. Each blob is given
    // to ONE frame as a whole, so the object appears once and complete and the seam runs
    // around it (where the frames agree) instead of cutting through it.
    // Cells where every overlapping frame is unconfirmed by verified matches: no hard seam
    // (the renderer keeps the soft edge-weighted blend there). Hard switching between possibly
    // misplaced photos is what regressed low-texture scenes.
    const lowConf = new Uint8Array(N);
    stats.gridCells = N;
    for (let cell = 0; cell < N; cell++) {
      const c = count[cell];
      if (c < 2) continue;
      stats.overlapCells++;
      let any = false;
      for (let s = 0; s < c; s++) if (conf[cand[cell * K + s]] >= 0.5) any = true;
      if (!any) {
        lowConf[cell] = 1;
        stats.lowConfidenceCells++;
      }
    }

    const disagree = new Uint8Array(N);
    for (let cell = 0; cell < N; cell++) {
      const c = count[cell];
      if (c < 2 || lowConf[cell]) continue;
      let maxDiff = 0;
      for (let s = 1; s < c; s++) {
        const i = cell * K, j = cell * K + s;
        const diff = Math.abs(col[i * 3] - col[j * 3]) + Math.abs(col[i * 3 + 1] - col[j * 3 + 1]) + Math.abs(col[i * 3 + 2] - col[j * 3 + 2]);
        if (diff > maxDiff) maxDiff = diff;
      }
      if (maxDiff > SeamMap.DIFFERENCE_THRESHOLD) disagree[cell] = 1;
    }
    // Grow by one cell so the blob's soft edge is included.
    const grown = disagree.slice();
    const nbGrow = [0, 0, 0, 0];
    for (let cell = 0; cell < N; cell++) {
      if (!disagree[cell]) continue;
      const nn = neighbours(cell, nbGrow);
      for (let k = 0; k < nn; k++) if (count[nbGrow[k]] >= 2) grown[nbGrow[k]] = 1;
    }
    const component = new Int32Array(N).fill(-1);
    const stack: number[] = [];
    const members: number[] = [];
    let regions = 0;
    for (let start = 0; start < N; start++) {
      if (!grown[start] || component[start] >= 0) continue;
      members.length = 0;
      stack.push(start);
      component[start] = regions;
      while (stack.length) {
        const cell = stack.pop()!;
        members.push(cell);
        const nn = neighbours(cell, nbGrow);
        for (let k = 0; k < nn; k++) {
          const q = nbGrow[k];
          if (grown[q] && component[q] < 0) {
            component[q] = regions;
            stack.push(q);
          }
        }
      }
      regions++;
      if (members.length > N * 0.05) {
        stats.skippedTooLarge++; // huge region = exposure/alignment problem, not an object
        continue;
      }
      // Frames covering (nearly) the whole region. Cost = data cost + how badly the frame's
      // content along the region border fails to continue the surroundings: a passer-by or a
      // displaced near object breaks continuity, the clean background continues it, so where
      // another photo shows the background the transient object is removed entirely.
      const cover = new Map<number, { n: number; cost: number; border: number; bn: number }>();
      const regionId = regions - 1;
      // Mean colour of the surroundings (cells just outside the region).
      let r0 = 0, r1 = 0, r2 = 0, rn = 0;
      for (const cell of members) {
        const nn = neighbours(cell, nbGrow);
        for (let k = 0; k < nn; k++) {
          const q = nbGrow[k];
          if (component[q] === regionId || labels[q] === SeamMap.NONE) continue;
          const qi = colorIdx(q, labels[q]);
          if (qi < 0) continue;
          r0 += col[qi * 3]; r1 += col[qi * 3 + 1]; r2 += col[qi * 3 + 2]; rn++;
        }
      }
      if (rn > 0) { r0 /= rn; r1 /= rn; r2 /= rn; }
      for (const cell of members) {
        for (let s = 0; s < count[cell]; s++) {
          const f = cand[cell * K + s];
          const e = cover.get(f) ?? { n: 0, cost: 0, border: 0, bn: 0 };
          e.n++;
          e.cost += data[cell * K + s];
          if (rn > 0) {
            const i = cell * K + s;
            e.border += Math.abs(col[i * 3] - r0) + Math.abs(col[i * 3 + 1] - r1) + Math.abs(col[i * 3 + 2] - r2);
            e.bn++;
          }
          cover.set(f, e);
        }
      }
      let bestFrame = -1, bestCost = Infinity;
      let sawLowConfidence = false;
      for (const [f, e] of cover) {
        if (e.n < members.length * 0.95) continue;
        if (conf[f] < 0.5) {
          sawLowConfidence = true;
          continue;
        }
        const avg = e.cost / e.n + (e.bn > 0 ? (4 * e.border) / e.bn : 0);
        if (avg < bestCost) {
          bestCost = avg;
          bestFrame = f;
        }
      }
      if (bestFrame < 0) {
        if (sawLowConfidence) stats.skippedLowConfidence++;
        else stats.skippedNoCoveringFrame++;
        continue;
      }
      stats.assigned++;
      for (const cell of members) {
        for (let s = 0; s < count[cell]; s++) {
          if (cand[cell * K + s] === bestFrame) {
            labels[cell] = bestFrame;
            locked[cell] = 1;
            break;
          }
        }
      }
    }
    SeamMap.lastRegions = regions;
    stats.detected = regions;

    // 3b. ICM refinement of the remaining seams (region cells stay locked).
    const nb = [0, 0, 0, 0];
    for (let sweep = 0; sweep < 8; sweep++) {
      let changed = 0;
      const forward = sweep % 2 === 0;
      for (let t = 0; t < N; t++) {
        const cell = forward ? t : N - 1 - t;
        const c = count[cell];
        if (c < 2 || locked[cell] || lowConf[cell]) continue;
        const nn = neighbours(cell, nb);
        let best = labels[cell], bestCost = Infinity;
        for (let s = 0; s < c; s++) {
          const f = cand[cell * K + s];
          let cost = data[cell * K + s];
          for (let k = 0; k < nn; k++) {
            const lq = labels[nb[k]];
            if (lq !== SeamMap.NONE) cost += pairCost(cell, nb[k], f, lq);
          }
          if (cost < bestCost - 1e-9) {
            bestCost = cost;
            best = f;
          }
        }
        if (best !== labels[cell]) {
          labels[cell] = best;
          changed++;
        }
      }
      if (changed === 0) break;
    }
    for (let cell = 0; cell < N; cell++) if (lowConf[cell]) labels[cell] = SeamMap.NONE;
    // Cells where the seam actually switches frame (for "remaining high-risk seams").
    for (let cell = 0; cell < N; cell++) {
      const l = labels[cell];
      if (l === SeamMap.NONE) continue;
      const x = cell % W;
      const r = labels[cell - x + ((x + 1) % W)];
      if (r !== SeamMap.NONE && r !== l) stats.seamCells++;
    }
    SeamMap.lastStats = stats;
    return new SeamMap(W, H, labels, locked);
  }

  /**
   * Detail weight of frame `f` at output pixel (x, y): bilinear over the 4 nearest cells, so
   * seams are feathered over about one cell instead of stepping.
   */
  weightAt(f: number, ox: number, oy: number, outW: number, outH: number): number {
    const gx = ((ox + 0.5) * this.width) / outW - 0.5;
    const gy = Math.min(this.height - 1, Math.max(0, ((oy + 0.5) * this.height) / outH - 0.5));
    const x0 = Math.floor(gx), y0 = Math.floor(gy);
    const fx = gx - x0, fy = gy - y0;
    const x0w = ((x0 % this.width) + this.width) % this.width, x1w = (x0w + 1) % this.width;
    const y1 = Math.min(this.height - 1, y0 + 1);
    const L = this.labels, W = this.width;
    let w = 0;
    if (L[y0 * W + x0w] === f) w += (1 - fx) * (1 - fy);
    if (L[y0 * W + x1w] === f) w += fx * (1 - fy);
    if (L[y1 * W + x0w] === f) w += (1 - fx) * fy;
    if (L[y1 * W + x1w] === f) w += fx * fy;
    return w;
  }

  /** Share of cells whose label differs from the plain centre-preference choice. */
  static changedFraction(a: SeamMap, b: SeamMap): number {
    let changed = 0, n = 0;
    for (let i = 0; i < a.labels.length; i++) {
      if (a.labels[i] === SeamMap.NONE) continue;
      n++;
      if (a.labels[i] !== b.labels[i]) changed++;
    }
    return n ? changed / n : 0;
  }
}
