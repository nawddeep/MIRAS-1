import { RasterFrame, RasterImage } from './Reprojection';
import type { SeamLabelGrid } from './Reprojection';

/**
 * Laplacian-pyramid multiband blending (Burt & Adelson) on the equirectangular output.
 *
 * Each output pixel is owned by one photo (the seam owner where a seam map says so, otherwise the
 * photo whose centre is nearest). Every photo contributes its Laplacian bands weighted by a
 * Gaussian pyramid of its ownership mask, so low frequencies (exposure, colour) blend over a wide
 * transition and high frequencies (carvings, edges) switch over a narrow one — no duplicated
 * fine detail, no halo. Photo pyramids use normalised convolution so pixels outside the photo
 * never leak black into a transition.
 *
 * Memory is O(output pixels × 4 float planes) per photo being processed, so this CPU path is
 * meant for outputs up to ~4096 px wide.
 */
interface Plane {
  w: number;
  h: number;
  v: Float32Array; // channels interleaved
  c: number;
}

const K = [1, 4, 6, 4, 1];

function blur(p: Plane): Plane {
  const { w, h, c } = p;
  const tmp = new Float32Array(p.v.length);
  const out = new Float32Array(p.v.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (let ch = 0; ch < c; ch++) {
        let s = 0;
        for (let k = -2; k <= 2; k++) s += K[k + 2] * p.v[(y * w + (((x + k) % w) + w) % w) * c + ch]; // periodic in longitude
        tmp[(y * w + x) * c + ch] = s / 16;
      }
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (let ch = 0; ch < c; ch++) {
        let s = 0;
        for (let k = -2; k <= 2; k++) s += K[k + 2] * tmp[(Math.min(h - 1, Math.max(0, y + k)) * w + x) * c + ch];
        out[(y * w + x) * c + ch] = s / 16;
      }
    }
  }
  return { w, h, c, v: out };
}

function down(p: Plane): Plane {
  const b = blur(p);
  const w = Math.max(1, p.w >> 1), h = Math.max(1, p.h >> 1);
  const v = new Float32Array(w * h * p.c);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let ch = 0; ch < p.c; ch++) v[(y * w + x) * p.c + ch] = b.v[((y * 2) * p.w + x * 2) * p.c + ch];
  return { w, h, c: p.c, v };
}

/** Bilinear upsample to (w, h), periodic in longitude. */
function up(p: Plane, w: number, h: number): Plane {
  const v = new Float32Array(w * h * p.c);
  for (let y = 0; y < h; y++) {
    const gy = Math.min(p.h - 1, Math.max(0, ((y + 0.5) * p.h) / h - 0.5));
    const y0 = Math.floor(gy), y1 = Math.min(p.h - 1, y0 + 1), fy = gy - y0;
    for (let x = 0; x < w; x++) {
      const gx = ((x + 0.5) * p.w) / w - 0.5;
      const x0f = Math.floor(gx), fx = gx - x0f;
      const x0 = ((x0f % p.w) + p.w) % p.w, x1 = (x0 + 1) % p.w;
      for (let ch = 0; ch < p.c; ch++) {
        const a = p.v[(y0 * p.w + x0) * p.c + ch] * (1 - fx) + p.v[(y0 * p.w + x1) * p.c + ch] * fx;
        const b = p.v[(y1 * p.w + x0) * p.c + ch] * (1 - fx) + p.v[(y1 * p.w + x1) * p.c + ch] * fx;
        v[(y * w + x) * p.c + ch] = a * (1 - fy) + b * fy;
      }
    }
  }
  return { w, h, c: p.c, v };
}

export class MultiBand {
  static levels = 5;

  static render(frames: RasterFrame[], width: number, seams?: SeamLabelGrid | null, cancelled: () => boolean = () => false): RasterImage {
    const W = width, H = width >> 1, N = W * H;
    const levels = Math.max(2, Math.min(MultiBand.levels, Math.floor(Math.log2(Math.min(W, H) / 8))));
    const owner = new Int16Array(N).fill(-1);
    const best = new Float32Array(N).fill(-1);
    const seamOwner = new Int16Array(N).fill(-1);

    const dirs = (() => {
      const sinA = new Float32Array(W), cosA = new Float32Array(W);
      for (let x = 0; x < W; x++) { const a = ((x + 0.5) / W) * 2 * Math.PI - Math.PI; sinA[x] = Math.sin(a); cosA[x] = Math.cos(a); }
      return { sinA, cosA };
    })();

    /** Frame coordinates (px) and feather weight for output pixel (x, y); null if the photo does not see it. */
    const sample = (f: RasterFrame, x: number, y: number): { px: number; py: number; w: number } | null => {
      const p = f.projection;
      const pitch = Math.PI * 0.5 - ((y + 0.5) / H) * Math.PI;
      const cp = Math.cos(pitch);
      const dx = dirs.sinA[x] * cp, dy = Math.sin(pitch), dz = -dirs.cosA[x] * cp;
      const depth = -(p.z.x * dx + p.z.y * dy + p.z.z * dz);
      if (depth <= 0.05) return null;
      const inv = 1 / depth;
      const px = (p.x.x * dx + p.x.y * dy + p.x.z * dz) * inv * p.x.w + p.meta.x;
      const py = -(p.y.x * dx + p.y.y * dy + p.y.z * dz) * inv * p.y.w + p.meta.y;
      const ux = px / p.meta.z, uy = py / p.meta.w;
      if (ux <= 0.02 || ux >= 0.98 || uy <= 0.02 || uy >= 0.98) return null;
      return { px, py, w: Math.min(ux, 1 - ux, uy, 1 - uy) };
    };

    // Seam grid label → full-resolution preferred owner.
    if (seams) {
      for (let y = 0; y < H; y++) {
        const gy = Math.min(seams.height - 1, Math.floor(((y + 0.5) * seams.height) / H));
        for (let x = 0; x < W; x++) {
          const gx = Math.min(seams.width - 1, Math.floor(((x + 0.5) * seams.width) / W));
          const l = seams.labels[gy * seams.width + gx];
          seamOwner[y * W + x] = l === 255 ? -1 : l;
        }
      }
    }

    // Pass 1: ownership (seam label if that photo sees the pixel, otherwise the most central photo).
    frames.forEach((f, k) => {
      if (cancelled()) throw new Error('Cancelled');
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const s = sample(f, x, y);
        if (!s) continue;
        const i = y * W + x;
        if (seamOwner[i] === k) { owner[i] = k; best[i] = 1e9; continue; }
        if (s.w > best[i]) { best[i] = s.w; owner[i] = k; }
      }
    });

    // Pass 2: accumulate band-weighted contributions photo by photo.
    const acc: Plane[] = [];
    const wsum: Plane[] = [];
    for (let l = 0, w = W, h = H; l < levels; l++, w = Math.max(1, w >> 1), h = Math.max(1, h >> 1)) {
      acc.push({ w, h, c: 3, v: new Float32Array(w * h * 3) });
      wsum.push({ w, h, c: 1, v: new Float32Array(w * h) });
    }

    frames.forEach((f, k) => {
      if (cancelled()) throw new Error('Cancelled');
      const mask: Plane = { w: W, h: H, c: 1, v: new Float32Array(N) };
      let any = false;
      for (let i = 0; i < N; i++) if (owner[i] === k) { mask.v[i] = 1; any = true; }
      if (!any) return;
      const img: Plane = { w: W, h: H, c: 3, v: new Float32Array(N * 3) }; // premultiplied by validity
      const valid: Plane = { w: W, h: H, c: 1, v: new Float32Array(N) };
      const im = f.image;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const s = sample(f, x, y);
        if (!s) continue;
        const fx = Math.min(im.width - 1.001, Math.max(0, s.px - 0.5)), fy = Math.min(im.height - 1.001, Math.max(0, s.py - 0.5));
        const x0 = Math.floor(fx), y0 = Math.floor(fy), ax = fx - x0, ay = fy - y0;
        const o = (y * W + x) * 3;
        for (let ch = 0; ch < 3; ch++) {
          const a = im.rgba[(y0 * im.width + x0) * 4 + ch] * (1 - ax) + im.rgba[(y0 * im.width + x0 + 1) * 4 + ch] * ax;
          const b = im.rgba[((y0 + 1) * im.width + x0) * 4 + ch] * (1 - ax) + im.rgba[((y0 + 1) * im.width + x0 + 1) * 4 + ch] * ax;
          img.v[o + ch] = (a * (1 - ay) + b * ay) / 255;
        }
        valid.v[y * W + x] = 1;
      }
      // Gaussian pyramids: normalised colour, validity, ownership mask.
      const gColor: Plane[] = [], gMask: Plane[] = [];
      let pi = img, pv = valid, pm = mask;
      for (let l = 0; l < levels; l++) {
        const col = new Float32Array(pi.v.length);
        for (let i = 0; i < pv.v.length; i++) {
          const vv = pv.v[i];
          for (let ch = 0; ch < 3; ch++) col[i * 3 + ch] = vv > 1e-3 ? pi.v[i * 3 + ch] / vv : NaN;
        }
        gColor.push({ w: pi.w, h: pi.h, c: 3, v: col });
        gMask.push(pm);
        if (l < levels - 1) { pi = down(pi); pv = down(pv); pm = down(pm); }
      }
      // Fill NaN (no valid photo data) from the next coarser level so Laplacians stay finite.
      for (let l = levels - 1; l >= 0; l--) {
        const g = gColor[l];
        const coarse = l < levels - 1 ? up(gColor[l + 1], g.w, g.h) : null;
        for (let i = 0; i < g.v.length; i++) if (Number.isNaN(g.v[i])) g.v[i] = coarse && !Number.isNaN(coarse.v[i]) ? coarse.v[i] : 0.5;
      }
      for (let l = 0; l < levels; l++) {
        const g = gColor[l];
        const lap = l < levels - 1 ? up(gColor[l + 1], g.w, g.h) : null;
        const m = gMask[l], a = acc[l], ws = wsum[l];
        for (let i = 0; i < m.v.length; i++) {
          const mv = m.v[i];
          if (mv <= 0) continue;
          ws.v[i] += mv;
          for (let ch = 0; ch < 3; ch++) a.v[i * 3 + ch] += mv * (lap ? g.v[i * 3 + ch] - lap.v[i * 3 + ch] : g.v[i * 3 + ch]);
        }
      }
    });

    // Normalise each band by its accumulated weight, then collapse coarse → fine.
    let recon: Plane | null = null;
    for (let l = levels - 1; l >= 0; l--) {
      const a = acc[l], ws = wsum[l];
      const band = new Float32Array(a.v.length);
      for (let i = 0; i < ws.v.length; i++) if (ws.v[i] > 1e-4) for (let ch = 0; ch < 3; ch++) band[i * 3 + ch] = a.v[i * 3 + ch] / ws.v[i];
      if (recon) {
        const u = up(recon, a.w, a.h);
        for (let i = 0; i < band.length; i++) band[i] += u.v[i];
      }
      recon = { w: a.w, h: a.h, c: 3, v: band };
    }
    const out = new Uint8ClampedArray(N * 4);
    const final = recon as Plane;
    for (let i = 0; i < N; i++) {
      if (owner[i] < 0) continue; // not photographed: alpha 0, never filled here
      out[i * 4] = final.v[i * 3] * 255;
      out[i * 4 + 1] = final.v[i * 3 + 1] * 255;
      out[i * 4 + 2] = final.v[i * 3 + 2] * 255;
      out[i * 4 + 3] = 255;
    }
    return new RasterImage(W, H, out);
  }
}
