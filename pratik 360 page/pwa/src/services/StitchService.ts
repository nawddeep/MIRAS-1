import type { AlignmentReport } from '../geometry/Alignment';
import { Enhancement } from '../geometry/Enhancement';
import { LowPass, RasterFrame, RasterImage, Reprojection } from '../geometry/Reprojection';
import type { SeamLabelGrid } from '../geometry/Reprojection';
import { SeamMap } from '../geometry/Seams';
import type { CaptureDocument } from '../models/CaptureModels';
import { CaptureError, frameFileName } from '../models/CaptureModels';
import { CaptureStore } from './CaptureStore';
import { encodeStitch, handleGaps, measureCoverage, runStitchPipeline, validateStitchInput } from './StitchPipeline';
import type { EncodedStitch } from './StitchPipeline';
import type { StitchWorkerEvent } from '../workers/stitchWorker';

export interface StitchResult {
  image: RasterImage;
  coverage: number;
  usedWebGL: boolean;
  alignment: AlignmentReport | null;
}

/** Output of a stitch from either the worker or the fallback (identical shape and content). */
export type WorkerStitchOutput = EncodedStitch;

export class StitchService {
  private store: CaptureStore;
  private activeWorker: Worker | null = null;
  // Rejects the in-flight stitch promise so callers' cleanup (wake lock, UI) always runs.
  private activeReject: ((err: Error) => void) | null = null;
  // Bumped on every cancel so a stitch still reading frames (no worker yet) can notice.
  private cancelGeneration = 0;

  constructor(store: CaptureStore = CaptureStore.shared) {
    this.store = store;
  }

  cancelActiveWorker(): void {
    this.cancelGeneration++;
    if (this.activeWorker) {
      this.activeWorker.terminate();
      this.activeWorker = null;
    }
    const reject = this.activeReject;
    this.activeReject = null;
    reject?.(new Error('Cancelled'));
  }

  private async readFrameBytes(capture: CaptureDocument, generation: number): Promise<Map<number, Uint8Array>> {
    const map = new Map<number, Uint8Array>();
    for (const frame of capture.frames) {
      const raw = await this.store.readFrame(capture.id, frame.file ?? frameFileName(frame.index));
      map.set(frame.index, raw);
      if (generation !== this.cancelGeneration) throw new Error('Cancelled');
    }
    return map;
  }

  /**
   * Runs the shared stitch pipeline in a module Web Worker (main thread stays responsive;
   * Cancel terminates the worker). Without Worker support the SAME pipeline runs inline.
   */
  async stitchInWorker(
    capture: CaptureDocument,
    callbacks: {
      onProgress?: (progress: number, stage: string) => void;
      onPreview?: (previewJpeg: Uint8Array, width: number, height: number) => void;
    } = {}
  ): Promise<WorkerStitchOutput> {
    const generation = this.cancelGeneration;
    validateStitchInput(capture);
    const frameBytes = await this.readFrameBytes(capture, generation);

    if (typeof Worker !== 'undefined') {
      const frameBuffers: Array<{ index: number; buffer: ArrayBuffer }> = [];
      const transferList: Transferable[] = [];
      for (const [index, raw] of frameBytes) {
        const buf = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer;
        frameBuffers.push({ index, buffer: buf });
        transferList.push(buf);
      }
      return new Promise<WorkerStitchOutput>((resolveOuter, rejectOuter) => {
        const settle = () => {
          if (this.activeReject === rejectOuter) this.activeReject = null;
        };
        const resolve = (v: WorkerStitchOutput) => {
          settle();
          resolveOuter(v);
        };
        const reject = (err: unknown) => {
          settle();
          rejectOuter(err);
        };
        this.activeReject = rejectOuter;
        try {
          const worker = new Worker(new URL('../workers/stitchWorker.ts', import.meta.url), { type: 'module' });
          this.activeWorker = worker;
          worker.onmessage = (e: MessageEvent<StitchWorkerEvent>) => {
            const msg = e.data;
            if (msg.type === 'progress') {
              callbacks.onProgress?.(msg.progress, msg.stage);
            } else if (msg.type === 'preview') {
              callbacks.onPreview?.(new Uint8Array(msg.previewJpeg), msg.width, msg.height);
            } else if (msg.type === 'complete') {
              this.activeWorker = null;
              worker.terminate();
              const u8 = (b: ArrayBuffer | null) => (b ? new Uint8Array(b) : null);
              resolve({
                jpegBytes: new Uint8Array(msg.jpegBuffer),
                thumbBytes: new Uint8Array(msg.thumbBuffer),
                pngs: {
                  overview: u8(msg.overviewPng),
                  coverageMask: u8(msg.coverageMaskPng),
                  fillMask: u8(msg.fillMaskPng),
                  matches: u8(msg.matchesPng)
                },
                outcome: msg.outcome
              });
            } else if (msg.type === 'error') {
              this.activeWorker = null;
              worker.terminate();
              reject(new CaptureError(msg.message));
            }
          };
          worker.onerror = (err) => {
            this.activeWorker = null;
            worker.terminate();
            reject(new CaptureError(err.message || 'Stitch worker failed'));
          };
          worker.postMessage({ type: 'start', capture, frameBuffers }, transferList);
        } catch (err) {
          reject(err);
        }
      });
    }

    // No Worker (tests, very old browsers): the same pipeline, inline.
    const result = await runStitchPipeline(capture, frameBytes, {
      cancelled: () => generation !== this.cancelGeneration,
      progress: (p, stage) => callbacks.onProgress?.(p, stage)
    });
    return encodeStitch(result, capture);
  }

  /** Stitch to a raster through the shared pipeline (same stages as the worker). */
  async stitch(
    capture: CaptureDocument,
    options?: { cpu?: boolean; cancelled?: () => boolean; progress?: (p: number) => void }
  ): Promise<StitchResult> {
    if (options?.cancelled?.()) throw new Error('Cancelled');
    validateStitchInput(capture);
    const frameBytes = await this.readFrameBytes(capture, this.cancelGeneration);
    const res = await runStitchPipeline(capture, frameBytes, {
      cpuOnly: options?.cpu ?? false,
      cancelled: options?.cancelled,
      progress: (p) => options?.progress?.(p)
    });
    return { image: res.raster, coverage: res.photographedCoverage, usedWebGL: res.usedWebGL, alignment: res.alignment };
  }

  /**
   * Render already-aligned frames with the shared later stages (pre-filter, seams, render,
   * coverage, gap policy, enhancement). Used by the synthetic self-test and unit tests.
   */
  async render(
    frames: RasterFrame[],
    width: number,
    options?: {
      cpu?: boolean;
      nadirCap?: boolean;
      enhance?: boolean;
      fillGaps?: boolean;
      cancelled?: () => boolean;
      progress?: (p: number) => void;
    }
  ): Promise<StitchResult> {
    const cancelled = options?.cancelled ?? (() => false);
    const progress = options?.progress ?? (() => {});
    if (cancelled()) throw new Error('Cancelled');
    this.validateWidth(width);
    if (frames.length === 0) {
      throw new CaptureError('No captured frames. Capture the dots before stitching.');
    }
    for (const frame of frames) {
      const image = frame.image;
      const p = frame.projection;
      const validVec = (v: { x: number; y: number; z: number; w: number }) =>
        Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z) && Number.isFinite(v.w);
      if (
        image.width < 2 || image.width > 16384 || image.height < 2 || image.height > 16384 ||
        image.rgba.length !== image.width * image.height * 4 ||
        !validVec(p.x) || !validVec(p.y) || !validVec(p.z) || !validVec(p.meta) ||
        p.x.w <= 0 || p.y.w <= 0 || p.z.w <= 0 ||
        p.meta.z !== image.width || p.meta.w !== image.height
      ) {
        throw new CaptureError('Invalid image or camera projection. Retake this capture.');
      }
    }
    const ready = Reprojection.prefilterForOutput(frames, width);
    const lows = ready.map((f) => new LowPass(f.image));
    const seams = SeamMap.compute(ready, lows, width);
    let raster: RasterImage | null = null;
    let usedWebGL = false;
    if (!options?.cpu) {
      raster = StitchService.tryWebGL2Render(ready, lows, width, seams);
      if (raster) usedWebGL = true;
    }
    if (!raster) {
      raster = Reprojection.render(ready, width, lows, cancelled, (p) => progress(0.12 + p * 0.8), seams);
    }
    if (cancelled()) throw new Error('Cancelled');
    const cov = measureCoverage(raster);
    if (cov.photographed === 0) {
      throw new CaptureError('No panorama coverage. Check the captured frames and retry.');
    }
    handleGaps(raster, options?.fillGaps ?? true);
    if (options?.enhance) StitchService.enhanced(raster);
    if (options?.nadirCap) StitchService.applyCap(raster);
    progress(1);
    return { image: raster, coverage: cov.photographed, usedWebGL, alignment: null };
  }

  /**
   * Renders identical synthetic frames (with identical seams) through the WebGL2 and the CPU
   * kernels and compares them. Returns null when WebGL2 is unavailable. Used by the debug
   * self-test and the browser consistency check.
   */
  static async gpuCpuCheck(width = 1024): Promise<{
    width: number;
    meanAbsDiff: number;
    p99AbsDiff: number;
    maxAbsDiff: number;
    coverageMismatchPixels: number;
    gpuMs: number;
    cpuMs: number;
  } | null> {
    const { SyntheticFixture } = await import('../geometry/SyntheticFixture');
    const frames = Reprojection.prefilterForOutput(SyntheticFixture.frames({ width: 480, height: 360, noise: 0.3 }), width);
    const lows = frames.map((f) => new LowPass(f.image));
    const seams = SeamMap.compute(frames, lows, width);
    let t = performance.now();
    const gpu = StitchService.tryWebGL2Render(frames, lows, width, seams);
    const gpuMs = performance.now() - t;
    if (!gpu) return null;
    t = performance.now();
    const cpu = Reprojection.render(frames, width, lows, () => false, () => {}, seams);
    const cpuMs = performance.now() - t;
    const diffs: number[] = [];
    let coverageMismatchPixels = 0;
    for (let i = 0; i < cpu.rgba.length; i += 4) {
      const ga = gpu.rgba[i + 3] > 0, ca = cpu.rgba[i + 3] > 0;
      if (ga !== ca) { coverageMismatchPixels++; continue; }
      if (!ga) continue;
      for (let c = 0; c < 3; c++) diffs.push(Math.abs(gpu.rgba[i + c] - cpu.rgba[i + c]));
    }
    diffs.sort((a, b) => a - b);
    const mean = diffs.reduce((s, v) => s + v, 0) / Math.max(1, diffs.length);
    return {
      width,
      meanAbsDiff: +mean.toFixed(3),
      p99AbsDiff: diffs[Math.floor(diffs.length * 0.99)] ?? 0,
      maxAbsDiff: diffs[diffs.length - 1] ?? 0,
      coverageMismatchPixels,
      gpuMs: Math.round(gpuMs),
      cpuMs: Math.round(cpuMs)
    };
  }

  /**
   * Optional WebGL2 hardware-accelerated reprojection & two-band softmax blender.
   * Returns null if WebGL2 or float color buffers are unavailable, falling back cleanly to CPU.
   */
  static tryWebGL2Render(
    frames: RasterFrame[],
    lows: LowPass[],
    width: number,
    seams?: SeamLabelGrid | null
  ): RasterImage | null {
    if (typeof OffscreenCanvas === 'undefined' && typeof document === 'undefined') {
      return null;
    }
    const height = Math.floor(width / 2);
    try {
      const canvas =
        typeof OffscreenCanvas !== 'undefined'
          ? new OffscreenCanvas(width, height)
          : document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const gl = canvas.getContext('webgl2', {
        antialias: false,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: true
      }) as WebGL2RenderingContext | null;
      if (!gl) return null;

      const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
      const maxLayers = gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS) as number;
      const maxRenderbuffer = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number;
      const maxViewport = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array;
      // Each frame needs 4 vec4 uniforms. Snapdragon (Adreno) GPUs expose only 256 fragment
      // uniform vectors, so the old fixed 64-frame arrays (256 + extras) failed to link there
      // and every Android stitch silently fell back to the slow CPU path.
      const maxUniformVectors = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS) as number;
      if (
        width > maxTex ||
        width > maxRenderbuffer ||
        width > maxViewport[0] ||
        frames.length > maxLayers ||
        frames.length === 0 ||
        frames.length * 4 + 8 > maxUniformVectors
      ) {
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return null;
      }

      const fw = frames[0].image.width;
      const fh = frames[0].image.height;
      const lw = lows[0].width;
      const lh = lows[0].height;
      // All frames must share dimensions to pack into a 2D texture array
      if (
        !frames.every((f) => f.image.width === fw && f.image.height === fh) ||
        !lows.every((l) => l.width === lw && l.height === lh)
      ) {
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return null;
      }

      const vsSrc = `#version 300 es
        in vec2 aPos;
        out vec2 vUV;
        void main() {
          vUV = aPos * 0.5 + 0.5;
          gl_Position = vec4(aPos, 0.0, 1.0);
        }
      `;

      const fsSrc = `#version 300 es
        #define MAX_FRAMES ${frames.length}
        precision highp float;
        precision highp sampler2DArray;
        precision highp usampler2D;
        in vec2 vUV;
        out vec4 outColor;

        uniform sampler2DArray uFrames;
        uniform sampler2DArray uLows;
        uniform int uCount;
        uniform vec4 uX[MAX_FRAMES];
        uniform vec4 uY[MAX_FRAMES];
        uniform vec4 uZ[MAX_FRAMES];
        uniform vec4 uMeta[MAX_FRAMES];
        uniform vec2 uLowSize;
        uniform highp usampler2D uSeam;
        uniform vec2 uSeamSize;
        uniform int uHasSeam;

        const float PI = 3.141592653589793;
        const float SEAM_SHARPNESS = 400.0;
        const float LOW_SHARPNESS = 60.0;

        void main() {
          float yaw = vUV.x * 2.0 * PI - PI;
          float pitch = PI * 0.5 - (1.0 - vUV.y) * PI;
          vec3 d = vec3(sin(yaw) * cos(pitch), sin(pitch), -cos(yaw) * cos(pitch));

          vec3 low = vec3(0.0);
          vec3 detail = vec3(0.0);
          float lowTotal = 0.0;
          float detailTotal = 0.0;
          float best = -1.0;

          // Seam grid (same logic as Reprojection.render): detail comes from the selected
          // frame, feathered bilinearly over one cell; inside regions of difference the low
          // band follows too.
          vec3 seamDetail = vec3(0.0);
          float seamTotal = 0.0;
          vec3 regionLow = vec3(0.0);
          float regionTotal = 0.0;
          uint L0 = 255u, L1 = 255u, L2 = 255u, L3 = 255u;
          float W0 = 0.0, W1 = 0.0, W2 = 0.0, W3 = 0.0, hardW = 0.0;
          if (uHasSeam == 1) {
            int sw = int(uSeamSize.x), sh = int(uSeamSize.y);
            float gx = vUV.x * uSeamSize.x - 0.5;
            float gy = clamp((1.0 - vUV.y) * uSeamSize.y - 0.5, 0.0, uSeamSize.y - 1.0);
            float fgx = floor(gx), fgy = floor(gy);
            float tx = gx - fgx, ty = gy - fgy;
            int x0 = ((int(fgx) % sw) + sw) % sw;
            int x1 = (x0 + 1) % sw;
            int y0 = int(fgy);
            int y1 = min(sh - 1, y0 + 1);
            uvec4 s00 = texelFetch(uSeam, ivec2(x0, y0), 0);
            uvec4 s10 = texelFetch(uSeam, ivec2(x1, y0), 0);
            uvec4 s01 = texelFetch(uSeam, ivec2(x0, y1), 0);
            uvec4 s11 = texelFetch(uSeam, ivec2(x1, y1), 0);
            L0 = s00.r; L1 = s10.r; L2 = s01.r; L3 = s11.r;
            W0 = (1.0 - tx) * (1.0 - ty); W1 = tx * (1.0 - ty); W2 = (1.0 - tx) * ty; W3 = tx * ty;
            hardW = float(s00.g) * W0 + float(s10.g) * W1 + float(s01.g) * W2 + float(s11.g) * W3;
          }

          for (int i = 0; i < MAX_FRAMES; i++) {
            if (i >= uCount) break;
            vec4 fx = uX[i];
            vec4 fy = uY[i];
            vec4 fz = uZ[i];
            vec4 fm = uMeta[i];

            float depth = -dot(fz.xyz, d);
            if (depth <= 0.0) continue;
            float px = dot(fx.xyz, d) / depth * fx.w + fm.x;
            float py = -dot(fy.xyz, d) / depth * fy.w + fm.y;
            vec2 u = vec2(px / fm.z, py / fm.w);
            vec2 edge2 = min(u, 1.0 - u);
            float e = min(edge2.x, edge2.y);
            if (e <= 0.04) continue;

            vec2 texUV = (vec2(px, py) + 0.5) / fm.zw;
            vec3 c = texture(uFrames, vec3(texUV, float(i))).rgb;
            vec2 lowCoord = clamp((vec2(px, py) + 0.5) / 8.0, vec2(0.5), uLowSize - 0.5) / uLowSize;
            vec3 base = texture(uLows, vec3(lowCoord, float(i))).rgb;

            if (e > best) {
              float s = exp(SEAM_SHARPNESS * (best - e));
              float sl = exp(LOW_SHARPNESS * (best - e));
              detail *= s; detailTotal *= s;
              low *= sl; lowTotal *= sl;
              best = e;
            }
            float ramp = min(1.0, (e - 0.04) * 25.0);
            float w = exp(SEAM_SHARPNESS * (e - best)) * ramp;
            float wl = exp(LOW_SHARPNESS * (e - best)) * ramp;

            low += base * fz.w * wl;
            lowTotal += wl;
            detail += (c - base) * fz.w * w;
            detailTotal += w;

            if (uHasSeam == 1) {
              uint ui = uint(i);
              float sw = ((L0 == ui ? W0 : 0.0) + (L1 == ui ? W1 : 0.0) + (L2 == ui ? W2 : 0.0) + (L3 == ui ? W3 : 0.0)) * ramp;
              if (sw > 0.0) {
                seamDetail += (c - base) * fz.w * sw;
                seamTotal += sw;
                regionLow += base * fz.w * sw;
                regionTotal += sw;
              }
            }
          }

          if (seamTotal > 1e-3) {
            detail = seamDetail;
            detailTotal = seamTotal;
          }
          if (hardW > 0.0 && regionTotal > 1e-3 && lowTotal > 0.0) {
            low = mix(low / lowTotal, regionLow / regionTotal, hardW);
            lowTotal = 1.0;
          }

          if (lowTotal > 0.0) {
            outColor = vec4(clamp(low / lowTotal + detail / detailTotal, 0.0, 1.0), 1.0);
          } else {
            outColor = vec4(0.0);
          }
        }
      `;


      const compile = (type: number, src: string) => {
        const s = gl.createShader(type)!;
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) return null;
        return s;
      };

      const vs = compile(gl.VERTEX_SHADER, vsSrc);
      const fs = compile(gl.FRAGMENT_SHADER, fsSrc);
      if (!vs || !fs) {
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return null;
      }

      const prog = gl.createProgram()!;
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return null;
      }
      gl.useProgram(prog);

      // Upload frame array texture
      const frameTex = gl.createTexture()!;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, frameTex);
      gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA8, fw, fh, frames.length);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      for (let i = 0; i < frames.length; i++) {
        gl.texSubImage3D(
          gl.TEXTURE_2D_ARRAY,
          0,
          0,
          0,
          i,
          fw,
          fh,
          1,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          frames[i].image.rgba
        );
      }

      // Upload low-pass array texture as 16-bit float (filterable in WebGL2). 8-bit storage
      // quantised the smooth base layer and showed as banding in skies and walls.
      const lowTex = gl.createTexture()!;
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, lowTex);
      gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA16F, lw, lh, lows.length);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      for (let i = 0; i < lows.length; i++) {
        gl.texSubImage3D(
          gl.TEXTURE_2D_ARRAY,
          0,
          0,
          0,
          i,
          lw,
          lh,
          1,
          gl.RGBA,
          gl.FLOAT,
          lows[i].rgba
        );
      }

      const uX = new Float32Array(frames.length * 4);
      const uY = new Float32Array(frames.length * 4);
      const uZ = new Float32Array(frames.length * 4);
      const uM = new Float32Array(frames.length * 4);
      for (let i = 0; i < frames.length; i++) {
        const p = frames[i].projection;
        uX.set([p.x.x, p.x.y, p.x.z, p.x.w], i * 4);
        uY.set([p.y.x, p.y.y, p.y.z, p.y.w], i * 4);
        uZ.set([p.z.x, p.z.y, p.z.z, p.z.w], i * 4);
        uM.set([p.meta.x, p.meta.y, p.meta.z, p.meta.w], i * 4);
      }

      gl.uniform1i(gl.getUniformLocation(prog, 'uFrames'), 0);
      gl.uniform1i(gl.getUniformLocation(prog, 'uLows'), 1);
      gl.uniform1i(gl.getUniformLocation(prog, 'uCount'), frames.length);
      gl.uniform4fv(gl.getUniformLocation(prog, 'uX'), uX);
      gl.uniform4fv(gl.getUniformLocation(prog, 'uY'), uY);
      gl.uniform4fv(gl.getUniformLocation(prog, 'uZ'), uZ);
      gl.uniform4fv(gl.getUniformLocation(prog, 'uMeta'), uM);
      gl.uniform2f(gl.getUniformLocation(prog, 'uLowSize'), lw, lh);

      // Seam grid as an RG8UI texture: R = frame label (255 = none), G = region-of-difference flag.
      let seamTex: WebGLTexture | null = null;
      if (seams && seams.labels.length === seams.width * seams.height) {
        const packed = new Uint8Array(seams.width * seams.height * 2);
        for (let k = 0; k < seams.labels.length; k++) {
          packed[2 * k] = seams.labels[k];
          packed[2 * k + 1] = seams.hard && seams.hard.length === seams.labels.length ? seams.hard[k] : 0;
        }
        seamTex = gl.createTexture();
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, seamTex);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG8UI, seams.width, seams.height, 0, gl.RG_INTEGER, gl.UNSIGNED_BYTE, packed);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.uniform1i(gl.getUniformLocation(prog, 'uSeam'), 2);
        gl.uniform2f(gl.getUniformLocation(prog, 'uSeamSize'), seams.width, seams.height);
        gl.uniform1i(gl.getUniformLocation(prog, 'uHasSeam'), 1);
      } else {
        // Still bind a valid 1x1 integer texture so the sampler is complete.
        seamTex = gl.createTexture();
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, seamTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG8UI, 1, 1, 0, gl.RG_INTEGER, gl.UNSIGNED_BYTE, new Uint8Array([255, 0]));
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.uniform1i(gl.getUniformLocation(prog, 'uSeam'), 2);
        gl.uniform1i(gl.getUniformLocation(prog, 'uHasSeam'), 0);
      }

      const quad = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
      const posLoc = gl.getAttribLocation(prog, 'aPos');
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

      gl.viewport(0, 0, width, height);
      // Draw in horizontal strips and wait for each. One full-size draw at 6144 px runs
      // ~19 M fragments x 30 frames in a single GPU job, which can exceed the mobile GPU
      // watchdog (≈2 s on Android) and lose the context — giving a black or failed stitch.
      // The iOS app batches its Metal work by rows for the same reason.
      gl.enable(gl.SCISSOR_TEST);
      const stripRows = 128;
      for (let row = 0; row < height; row += stripRows) {
        gl.scissor(0, row, width, Math.min(stripRows, height - row));
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.finish();
        if (gl.isContextLost()) return null;
      }
      gl.disable(gl.SCISSOR_TEST);

      // Single buffer, flipped in place (readPixels is bottom-up): saves a full-size copy.
      const out = new Uint8ClampedArray(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(out.buffer));
      if (gl.isContextLost()) return null;
      const rowBytes = width * 4;
      const tmpRow = new Uint8ClampedArray(rowBytes);
      for (let y = 0; y < height >> 1; y++) {
        const top = y * rowBytes;
        const bottom = (height - 1 - y) * rowBytes;
        tmpRow.set(out.subarray(top, top + rowBytes));
        out.copyWithin(top, bottom, bottom + rowBytes);
        out.set(tmpRow, bottom);
      }

      gl.deleteTexture(frameTex);
      gl.deleteTexture(lowTex);
      if (seamTex) gl.deleteTexture(seamTex);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.getExtension('WEBGL_lose_context')?.loseContext();

      // A lost or failed GPU job can return an all-empty image without throwing; let the
      // CPU path handle it instead of reporting "no coverage".
      let anyCovered = false;
      for (let i = 3; i < out.length; i += 4 * 97) {
        if (out[i] > 0) {
          anyCovered = true;
          break;
        }
      }
      if (!anyCovered) return null;

      return new RasterImage(width, height, out);
    } catch {
      return null;
    }
  }

  private validateWidth(width: number): void {
    if (!Number.isInteger(width) || width < 4 || width > 6144 || width % 2 !== 0) {
      throw new CaptureError('Panorama width must be an even number between 4 and 6144 pixels.');
    }
  }

  static enhanced(image: RasterImage): RasterImage {
    Enhancement.levels(image);
    Enhancement.localContrast(image, 16, 8, 2, 0.6);
    Enhancement.finish(image, 0.15, 0.35);
    return image;
  }

  static fillHoles(image: RasterImage): void {
    const w = image.width;
    const h = image.height;
    const total = w * h;
    const mask = new Uint8Array(total);
    const frontier = new Int32Array(total);
    let head = 0;
    let tail = 0;

    for (let i = 0; i < total; i++) {
      if (image.rgba[i * 4 + 3] === 0) {
        mask[i] = 1;
      }
    }

    for (let i = 0; i < total; i++) {
      if (mask[i] === 0) {
        const x = i % w;
        const y = Math.floor(i / w);
        if (
          mask[y * w + ((x + 1) % w)] === 1 ||
          mask[y * w + ((x + w - 1) % w)] === 1 ||
          (y > 0 && mask[i - w] === 1) ||
          (y + 1 < h && mask[i + w] === 1)
        ) {
          frontier[tail++] = i;
        }
      }
    }

    while (head < tail) {
      const i = frontier[head++];
      const x = i % w;
      const y = Math.floor(i / w);
      const adjacent = [
        y * w + ((x + 1) % w),
        y * w + ((x + w - 1) % w),
        Math.max(0, y - 1) * w + x,
        Math.min(h - 1, y + 1) * w + x
      ];
      for (const j of adjacent) {
        if (image.rgba[j * 4 + 3] === 0) {
          image.rgba[j * 4] = image.rgba[i * 4];
          image.rgba[j * 4 + 1] = image.rgba[i * 4 + 1];
          image.rgba[j * 4 + 2] = image.rgba[i * 4 + 2];
          image.rgba[j * 4 + 3] = 255;
          frontier[tail++] = j;
        }
      }
    }

    // Separable 31x31 box blur inside uncovered regions reusing a single intermediate buffer
    const radius = 15;
    const win = 2 * radius + 1;
    const temp = new Uint8ClampedArray(image.rgba.length);

    // Horizontal pass: image.rgba -> temp
    for (let y = 0; y < h; y++) {
      let rSum = 0, gSum = 0, bSum = 0;
      for (let k = -radius; k <= radius; k++) {
        const xx = Math.min(w - 1, Math.max(0, k));
        const idx = (y * w + xx) * 4;
        rSum += image.rgba[idx];
        gSum += image.rgba[idx + 1];
        bSum += image.rgba[idx + 2];
      }
      for (let x = 0; x < w; x++) {
        const outIdx = (y * w + x) * 4;
        temp[outIdx] = Math.round(rSum / win);
        temp[outIdx + 1] = Math.round(gSum / win);
        temp[outIdx + 2] = Math.round(bSum / win);
        temp[outIdx + 3] = 255;

        const subX = Math.max(0, x - radius);
        const addX = Math.min(w - 1, x + radius + 1);
        const subIdx = (y * w + subX) * 4;
        const addIdx = (y * w + addX) * 4;
        rSum += image.rgba[addIdx] - image.rgba[subIdx];
        gSum += image.rgba[addIdx + 1] - image.rgba[subIdx + 1];
        bSum += image.rgba[addIdx + 2] - image.rgba[subIdx + 2];
      }
    }

    // Vertical pass: temp -> image.rgba (only writing where mask[i] === 1)
    for (let x = 0; x < w; x++) {
      let rSum = 0, gSum = 0, bSum = 0;
      for (let k = -radius; k <= radius; k++) {
        const yy = Math.min(h - 1, Math.max(0, k));
        const idx = (yy * w + x) * 4;
        rSum += temp[idx];
        gSum += temp[idx + 1];
        bSum += temp[idx + 2];
      }
      for (let y = 0; y < h; y++) {
        const pIdx = y * w + x;
        if (mask[pIdx] === 1) {
          const outIdx = pIdx * 4;
          image.rgba[outIdx] = Math.round(rSum / win);
          image.rgba[outIdx + 1] = Math.round(gSum / win);
          image.rgba[outIdx + 2] = Math.round(bSum / win);
          image.rgba[outIdx + 3] = 255;
        }

        const subY = Math.max(0, y - radius);
        const addY = Math.min(h - 1, y + radius + 1);
        const subIdx = (subY * w + x) * 4;
        const addIdx = (addY * w + x) * 4;
        rSum += temp[addIdx] - temp[subIdx];
        gSum += temp[addIdx + 1] - temp[subIdx + 1];
        bSum += temp[addIdx + 2] - temp[subIdx + 2];
      }
    }
  }

  static applyCap(image: RasterImage): void {
    const size = 512;
    const bytes = new Uint8ClampedArray(size * size * 4);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const dx = x - 256;
        const dy = y - 256;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (Math.abs(dist - 222) <= 2.5) {
          bytes[i] = 31;
          bytes[i + 1] = 31;
          bytes[i + 2] = 31;
          bytes[i + 3] = 255;
        } else {
          bytes[i] = 224;
          bytes[i + 1] = 137;
          bytes[i + 2] = 58;
          bytes[i + 3] = 255;
        }
      }
    }

    const glyphs: Record<string, string[]> = {
      M: ['10001', '11011', '10101', '10001', '10001', '10001', '10001'],
      I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
      R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
      A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
      S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110']
    };
    const word = ['M', 'I', 'R', 'A', 'S'];
    const scale = 7;
    const totalW = word.length * 5 * scale + (word.length - 1) * 2 * scale;
    const startX = Math.floor((size - totalW) / 2);
    const startY = Math.floor((size - 7 * scale) / 2);

    word.forEach((ch, idx) => {
      const pattern = glyphs[ch];
      const gx = startX + idx * 7 * scale;
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 5; c++) {
          if (pattern[r][c] === '1') {
            for (let sy = 0; sy < scale; sy++) {
              for (let sx = 0; sx < scale; sx++) {
                const px = gx + c * scale + sx;
                const py = startY + r * scale + sy;
                const ii = (py * size + px) * 4;
                bytes[ii] = 18;
                bytes[ii + 1] = 18;
                bytes[ii + 2] = 18;
              }
            }
          }
        }
      }
    });

    const logo = new RasterImage(size, size, bytes);
    const startRow = Math.floor(image.height * 0.9444);
    for (let y = startRow; y < image.height; y++) {
      for (let x = 0; x < image.width; x++) {
        const yaw = (x / image.width) * 2 * Math.PI - Math.PI;
        const r = ((image.height - y) / image.height) * 18;
        const color = logo.sample(256 + Math.sin(yaw) * r * 250, 256 + Math.cos(yaw) * r * 250);
        const i = (y * image.width + x) * 4;
        image.rgba[i] = Math.min(255, Math.max(0, Math.floor(color[0] * 255)));
        image.rgba[i + 1] = Math.min(255, Math.max(0, Math.floor(color[1] * 255)));
        image.rgba[i + 2] = Math.min(255, Math.max(0, Math.floor(color[2] * 255)));
        image.rgba[i + 3] = 255;
      }
    }
  }
}
