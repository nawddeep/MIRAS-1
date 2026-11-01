/**
 * The single stitching pipeline. The Web Worker, the no-Worker fallback and
 * StitchService.stitch() all call runStitchPipeline(), so every execution path uses the same
 * geometry, settings, seams, gap handling and diagnostics. Only the blend kernel differs
 * (WebGL2 or CPU), and those two are checked against each other (StitchService.gpuCpuCheck).
 *
 * Stages: decode → align (+verify) → exposure & vignetting → [preview] → pre-filter →
 * seams → render → coverage → gaps → enhance → cap → diagnostics.
 */
import { Alignment } from '../geometry/Alignment';
import type { AlignmentReport } from '../geometry/Alignment';
import { Diagnostics } from '../geometry/Diagnostics';
import { LowPass, Projection, RasterFrame, RasterImage, Reprojection } from '../geometry/Reprojection';
import { SeamMap } from '../geometry/Seams';
import type { SeamStats } from '../geometry/Seams';
import { CaptureError } from '../models/CaptureModels';
import type { CaptureDocument } from '../models/CaptureModels';
import { ImageCodec } from './ImageCodec';
import { StitchService } from './StitchService';

export interface PipelineOptions {
  /** Force the CPU blend kernel (tests, or when WebGL2 must not be used). */
  cpuOnly?: boolean;
  cancelled?: () => boolean;
  progress?: (progress: number, stage: string) => void;
  /** Receives the 1024 px preview (same settings as the final, incl. gap handling). */
  preview?: (raster: RasterImage) => Promise<void> | void;
}

export interface PipelineResult {
  /** Final panorama (after gap handling, enhancement, nadir cap). Opaque. */
  raster: RasterImage;
  usedWebGL: boolean;
  alignment: AlignmentReport;
  /** Share of the required zone (pitch ≥ −70°) with real photo pixels, solid-angle weighted. */
  photographedCoverage: number;
  /** Share of the whole sphere with no photo (before any fill). */
  missingFraction: number;
  /** Share of the whole sphere synthesised by gap filling (0 when filling is off). */
  filledFraction: number;
  /** Frame px per radian ÷ output px per radian (< 1: output larger than captured detail). */
  detailRatio: number;
  decodeSize: number;
  seamStats: SeamStats;
  vignetting: { a: number; b: number; samples: number; applied: boolean; cornerLoss: number };
  ghostRiskAreas: Array<{ yaw: number; pitch: number; errorPx: number }>;
  timings: Record<string, number>;
  /** Estimated peak bytes of the large typed arrays alive at once (frames, low-pass, seams, output, diagnostics). */
  peakBytesEstimate: number;
  diagnostics: {
    overview: RasterImage;
    coverageMask: RasterImage;
    /** White where pixels were synthesised (null when nothing was filled). */
    fillMask: RasterImage | null;
    /** Verified matches coloured by residual (green < 1 px, yellow < 2 px, red ≥ 2 px). */
    matches: RasterImage;
  };
}

const LOWER_REQUIRED_PITCH = -70;

/** Decode size the output needs: never below 1280, never above 2048, never upscaled. */
export function decodeSizeFor(capture: CaptureDocument): number {
  const outPxPerRadian = capture.settings.width / (2 * Math.PI);
  const f0 = capture.frames[0];
  const fov = f0 ? 2 * Math.atan(Math.max(f0.width, f0.height) / 2 / f0.intrinsics[0]) : (63 * Math.PI) / 180;
  const needed = Math.ceil(outPxPerRadian * 1.15 * 2 * Math.tan(fov / 2));
  return Math.min(2048, Math.max(1280, needed));
}

export function validateStitchInput(capture: CaptureDocument): void {
  const width = capture.settings.width;
  if (!Number.isInteger(width) || width < 4 || width > 6144 || width % 2 !== 0) {
    throw new CaptureError('Panorama width must be an even number between 4 and 6144 pixels.');
  }
  if (capture.frames.length === 0) {
    throw new CaptureError('No captured frames. Capture the dots before stitching.');
  }
  if (!Number.isFinite(capture.referenceWorldYaw)) {
    throw new CaptureError('Invalid capture orientation. Capture this scene again.');
  }
  for (const frame of capture.frames) {
    if (
      frame.transform.length !== 16 ||
      frame.intrinsics.length !== 9 ||
      !frame.transform.every(Number.isFinite) ||
      !frame.intrinsics.every(Number.isFinite) ||
      frame.width <= 1 ||
      frame.height <= 1 ||
      frame.intrinsics[0] <= 0 ||
      frame.intrinsics[4] <= 0
    ) {
      throw new CaptureError(`Camera data for frame ${frame.index} is damaged. Retake this capture.`);
    }
  }
}

/** Builds the stitcher's projection for a stored frame (world rotated so the reference is 0). */
export function projectionForFrame(
  capture: CaptureDocument,
  frameIdx: number,
  imageWidth: number,
  imageHeight: number
): Projection {
  const frame = capture.frames[frameIdx];
  const sx = imageWidth / frame.width;
  const sy = imageHeight / frame.height;
  const a = (-capture.referenceWorldYaw * Math.PI) / 180;
  const axis = (index: number, w: number) => {
    const x = frame.transform[index * 4];
    const y = frame.transform[index * 4 + 1];
    const z = frame.transform[index * 4 + 2];
    return { x: Math.cos(a) * x - Math.sin(a) * z, y, z: Math.sin(a) * x + Math.cos(a) * z, w };
  };
  return new Projection(axis(0, frame.intrinsics[0] * sx), axis(1, frame.intrinsics[4] * sy), axis(2, 1), {
    x: frame.intrinsics[6] * sx,
    y: frame.intrinsics[7] * sy,
    z: imageWidth,
    w: imageHeight
  });
}

/** Solid-angle-weighted coverage of an un-filled raster (alpha > 0 = photographed). */
export function measureCoverage(raster: RasterImage): { photographed: number; missing: number } {
  let reqArea = 0, reqCovered = 0, allArea = 0, allMissing = 0;
  for (let y = 0; y < raster.height; y++) {
    const pitch = 90 - ((y + 0.5) / raster.height) * 180;
    const w = Math.cos((pitch * Math.PI) / 180);
    let rowCovered = 0;
    const row = y * raster.width * 4;
    for (let x = 0; x < raster.width; x++) if (raster.rgba[row + x * 4 + 3] > 0) rowCovered++;
    allArea += w * raster.width;
    allMissing += w * (raster.width - rowCovered);
    if (pitch >= LOWER_REQUIRED_PITCH) {
      reqArea += w * raster.width;
      reqCovered += w * rowCovered;
    }
  }
  return { photographed: reqCovered / Math.max(1e-9, reqArea), missing: allMissing / Math.max(1e-9, allArea) };
}

/** Gap handling shared by preview and final: fill (and return a fill mask) or leave black. */
export function handleGaps(raster: RasterImage, fillGaps: boolean): RasterImage | null {
  let fillMask: RasterImage | null = null;
  let anyMissing = false;
  for (let i = 3; i < raster.rgba.length; i += 4) {
    if (raster.rgba[i] === 0) {
      anyMissing = true;
      break;
    }
  }
  if (fillGaps && anyMissing) {
    const m = new Uint8ClampedArray(raster.width * raster.height * 4);
    for (let p = 0; p < raster.width * raster.height; p++) {
      const v = raster.rgba[p * 4 + 3] === 0 ? 255 : 0;
      m[p * 4] = m[p * 4 + 1] = m[p * 4 + 2] = v;
      m[p * 4 + 3] = 255;
    }
    fillMask = new RasterImage(raster.width, raster.height, m);
    StitchService.fillHoles(raster);
  } else {
    // Honest gaps: unphotographed pixels stay black (opaque for JPEG).
    for (let i = 3; i < raster.rgba.length; i += 4) raster.rgba[i] = 255;
  }
  return fillMask;
}

export async function runStitchPipeline(
  capture: CaptureDocument,
  frameBytes: Map<number, Uint8Array>,
  options: PipelineOptions = {}
): Promise<PipelineResult> {
  const cancelled = options.cancelled ?? (() => false);
  const progress = options.progress ?? (() => {});
  const check = () => {
    if (cancelled()) throw new Error('Cancelled');
  };
  const timings: Record<string, number> = {};
  let t = Date.now();
  const lap = (name: string) => {
    const now = Date.now();
    timings[name] = now - t;
    t = now;
  };
  validateStitchInput(capture);
  const width = capture.settings.width;
  const outPxPerRadian = width / (2 * Math.PI);
  const decodeSize = decodeSizeFor(capture);

  // 1. Decode
  progress(0.02, 'Decoding photographs');
  let frames: RasterFrame[] = [];
  for (let i = 0; i < capture.frames.length; i++) {
    check();
    const frame = capture.frames[i];
    const bytes = frameBytes.get(frame.index);
    if (!bytes) throw new CaptureError(`Missing photograph data for frame ${frame.index}.`);
    const image = await ImageCodec.decode(bytes, decodeSize);
    if (image.width < 16 || image.height < 16) {
      throw new CaptureError(`Photograph ${frame.index} is damaged. Retake this capture.`);
    }
    frames.push(new RasterFrame(image, projectionForFrame(capture, i, image.width, image.height)));
    progress(((i + 1) / capture.frames.length) * 0.1, `Decoding photographs (${i + 1}/${capture.frames.length})`);
  }
  const detailRatio = Math.min(frames[0].projection.x.w, frames[0].projection.y.w) / outPxPerRadian;
  const framesBytes = frames.reduce((s, f) => s + f.image.rgba.byteLength, 0);
  lap('decode');

  // 2. Align (sensor prior → verified matches → global solve)
  check();
  progress(0.12, 'Aligning camera poses');
  const aligned = Alignment.align(frames, capture.settings.refinement ? 6 : 2.5);
  frames = aligned.frames;
  const alignment = aligned.report;
  lap('align');

  // 3. Exposure, white balance, vignetting (vignetting only when alignment is trustworthy)
  check();
  progress(0.18, 'Balancing exposure & colour');
  Reprojection.compensateInPlace(frames, { alignmentConfidence: alignment.confidence });
  const vig = Reprojection.lastVignetting;
  lap('photometric');

  // Frame confidence for seams: frames tied in by verified matches are trusted to switch.
  const frameConfidence = new Float32Array(frames.length);
  for (let k = 0; k < frames.length; k++) frameConfidence[k] = alignment.frameLinks[k] > 0 ? 1 : 0;
  const frameSharpness = new Float32Array(frames.length).fill(1);
  capture.frames.forEach((f, k) => {
    if (f.quality && Number.isFinite(f.quality.blurRatio)) frameSharpness[k] = f.quality.blurRatio;
  });

  // 4. Preview (same gap policy as the final output)
  if (width > 1024 && options.preview) {
    check();
    progress(0.22, 'Rendering quick preview');
    const pf = Reprojection.prefilterForOutput(frames, 1024);
    const plows = pf.map((f) => new LowPass(f.image));
    const pseams = SeamMap.compute(pf, plows, 1024, { frameConfidence, frameSharpness });
    const previewRaster = Reprojection.render(pf, 1024, plows, cancelled, () => {}, pseams);
    handleGaps(previewRaster, capture.settings.fillGaps !== false);
    await options.preview(previewRaster);
    lap('preview');
  }

  // 5. Pre-filter, seams, render
  check();
  frames = Reprojection.prefilterForOutput(frames, width);
  const lows = frames.map((f) => new LowPass(f.image));
  const lowsBytes = lows.reduce((s, l) => s + l.rgba.byteLength, 0);
  progress(0.27, 'Choosing seams');
  const seams = SeamMap.compute(frames, lows, width, { frameConfidence, frameSharpness });
  const seamStats = SeamMap.lastStats;
  const seamBytes = seams.labels.length * 2 + seams.labels.length * SeamMap.MAX_CANDIDATES * 21;
  lap('seams');

  progress(0.28, `Blending ${width} px panorama`);
  let raster: RasterImage | null = null;
  let usedWebGL = false;
  if (!options.cpuOnly) {
    raster = StitchService.tryWebGL2Render(frames, lows, width, seams);
    if (raster) usedWebGL = true;
  }
  if (!raster) {
    raster = Reprojection.render(frames, width, lows, cancelled, (p) => progress(0.28 + p * 0.52, `Blending ${width} px panorama`), seams);
  }
  const outBytes = raster.rgba.byteLength;
  // GPU path holds an extra output-sized drawing buffer while reading back.
  const peakRender = framesBytes + lowsBytes + seamBytes + outBytes * (usedWebGL ? 2 : 1) + (usedWebGL ? framesBytes : 0);
  frames = [];
  lows.length = 0;
  lap('render');

  // 6. Coverage (before any fill) and diagnostics from the un-filled panorama
  check();
  const cov = measureCoverage(raster);
  if (cov.photographed === 0) throw new CaptureError('No panorama coverage. Check the captured frames and retry.');
  const ghostSpots = alignment.ghostRisk.map((g) => ({
    yaw: (Math.atan2(g.x, -g.z) * 180) / Math.PI,
    pitch: (Math.asin(Math.max(-1, Math.min(1, g.y))) * 180) / Math.PI
  }));
  const diag = Diagnostics.build(raster, seams, ghostSpots);
  const matchesImage = Diagnostics.matchMap(raster, alignment.matchPoints);
  const diagBytes = (diag.overview.rgba.byteLength + diag.mask.rgba.byteLength) * 2;

  // 7. Gaps
  progress(0.82, capture.settings.fillGaps !== false ? 'Filling uncovered areas' : 'Marking uncovered areas');
  const fillMask = handleGaps(raster, capture.settings.fillGaps !== false);
  const filledFraction = fillMask ? cov.missing : 0;
  lap('coverage+gaps');

  // 8. Enhancement and cap
  if (capture.settings.enhance) {
    check();
    progress(0.88, 'Enhancing colour & local contrast');
    StitchService.enhanced(raster);
  }
  if (capture.settings.nadirCap) StitchService.applyCap(raster);
  lap('enhance');

  // Enhancement scratch: luma (1 B/px) + Uint16 blur (2 B/px) + local-contrast tiles.
  const enhanceBytes = capture.settings.enhance ? (raster.width * raster.height * 3) : 0;
  const peakBytesEstimate = Math.max(peakRender, outBytes * 2 + enhanceBytes + diagBytes + (fillMask ? outBytes : 0));

  return {
    raster,
    usedWebGL,
    alignment,
    photographedCoverage: cov.photographed,
    missingFraction: cov.missing,
    filledFraction,
    detailRatio,
    decodeSize,
    seamStats,
    vignetting: { a: vig.a, b: vig.b, samples: vig.samples, applied: vig.applied, cornerLoss: 1 - Math.exp(vig.a + vig.b) },
    ghostRiskAreas: alignment.ghostRisk.map((g) => ({
      yaw: +((Math.atan2(g.x, -g.z) * 180) / Math.PI).toFixed(1),
      pitch: +((Math.asin(Math.max(-1, Math.min(1, g.y))) * 180) / Math.PI).toFixed(1),
      errorPx: +g.errorPx.toFixed(1)
    })),
    timings,
    peakBytesEstimate,
    diagnostics: { overview: diag.overview, coverageMask: diag.mask, fillMask, matches: matchesImage }
  };
}

/** Everything about a stitch except the pixels (structured-clone safe). */
export type StitchOutcome = Omit<PipelineResult, 'raster' | 'diagnostics' | 'alignment'> & {
  alignment: Omit<AlignmentReport, 'description'>;
};

export interface EncodedStitch {
  jpegBytes: Uint8Array;
  thumbBytes: Uint8Array;
  pngs: {
    overview: Uint8Array | null;
    coverageMask: Uint8Array | null;
    fillMask: Uint8Array | null;
    matches: Uint8Array | null;
  };
  outcome: StitchOutcome;
}

/** Shared encoder: identical outputs from the worker and the fallback path. */
export async function encodeStitch(res: PipelineResult, capture: CaptureDocument): Promise<EncodedStitch> {
  const poseHeading = capture.yawReference === 'trueNorth' ? 0 : null;
  const jpegBytes = await ImageCodec.jpeg(res.raster, poseHeading, 0.92);
  const thumbBytes = await ImageCodec.jpeg(ImageCodec.downsampleIfNeeded(res.raster, 320), null, 0.8);
  const fillMaskSmall = res.diagnostics.fillMask
    ? ImageCodec.downsampleIfNeeded(res.diagnostics.fillMask, 1024)
    : null;
  const pngs = {
    overview: await ImageCodec.png(res.diagnostics.overview),
    coverageMask: await ImageCodec.png(res.diagnostics.coverageMask),
    fillMask: fillMaskSmall ? await ImageCodec.png(fillMaskSmall) : null,
    matches: await ImageCodec.png(res.diagnostics.matches)
  };
  // Plain-data copy of the alignment report (drop the getter, keep every field).
  const { description: _d, ...alignment } = res.alignment;
  void _d;
  const { raster: _r, diagnostics: _g, alignment: _a, ...rest } = res;
  void _r;
  void _g;
  void _a;
  return { jpegBytes, thumbBytes, pngs, outcome: { ...rest, alignment } };
}
