/**
 * Stitch worker: a thin wrapper around the shared pipeline (StitchPipeline.ts), so the
 * worker and the no-worker fallback run exactly the same stages and settings.
 */
import type { CaptureDocument } from '../models/CaptureModels';
import { ImageCodec } from '../services/ImageCodec';
import { encodeStitch, runStitchPipeline } from '../services/StitchPipeline';
import type { StitchOutcome } from '../services/StitchPipeline';

export interface StitchWorkerRequest {
  type: 'start';
  capture: CaptureDocument;
  frameBuffers: Array<{ index: number; buffer: ArrayBuffer }>;
  cpuOnly?: boolean;
}

export interface StitchWorkerProgress {
  type: 'progress';
  progress: number;
  stage: string;
}

export interface StitchWorkerPreview {
  type: 'preview';
  previewJpeg: ArrayBuffer;
  width: number;
  height: number;
}

export interface StitchWorkerComplete {
  type: 'complete';
  jpegBuffer: ArrayBuffer;
  thumbBuffer: ArrayBuffer;
  overviewPng: ArrayBuffer | null;
  coverageMaskPng: ArrayBuffer | null;
  fillMaskPng: ArrayBuffer | null;
  matchesPng: ArrayBuffer | null;
  outcome: StitchOutcome;
}

export interface StitchWorkerError {
  type: 'error';
  message: string;
}

export type StitchWorkerEvent =
  | StitchWorkerProgress
  | StitchWorkerPreview
  | StitchWorkerComplete
  | StitchWorkerError;

let cancelled = false;

const toBuffer = (b: Uint8Array | null): ArrayBuffer | null =>
  b ? (b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer) : null;

self.onmessage = async (e: MessageEvent<StitchWorkerRequest | { type: 'cancel' }>) => {
  if (e.data.type === 'cancel') {
    cancelled = true;
    return;
  }
  if (e.data.type !== 'start') return;
  cancelled = false;
  const { capture, frameBuffers, cpuOnly } = e.data;
  const post = (msg: StitchWorkerEvent, transfer: Transferable[] = []) => {
    (self as unknown as Worker).postMessage(msg, transfer);
  };
  try {
    const frameBytes = new Map<number, Uint8Array>();
    for (const item of frameBuffers) frameBytes.set(item.index, new Uint8Array(item.buffer));
    const result = await runStitchPipeline(capture, frameBytes, {
      cpuOnly,
      cancelled: () => cancelled,
      progress: (progress, stage) => post({ type: 'progress', progress, stage }),
      preview: async (raster) => {
        const jpeg = await ImageCodec.jpeg(raster, null, 0.82);
        const buf = toBuffer(jpeg)!;
        post({ type: 'preview', previewJpeg: buf, width: raster.width, height: raster.height }, [buf]);
      }
    });
    frameBytes.clear();
    if (cancelled) throw new Error('Cancelled');
    post({ type: 'progress', progress: 0.94, stage: 'Encoding 360° GPano JPEG' });
    const enc = await encodeStitch(result, capture);
    const jpegBuffer = toBuffer(enc.jpegBytes)!;
    const thumbBuffer = toBuffer(enc.thumbBytes)!;
    const overviewPng = toBuffer(enc.pngs.overview);
    const coverageMaskPng = toBuffer(enc.pngs.coverageMask);
    const fillMaskPng = toBuffer(enc.pngs.fillMask);
    const matchesPng = toBuffer(enc.pngs.matches);
    const transfer = [jpegBuffer, thumbBuffer, overviewPng, coverageMaskPng, fillMaskPng, matchesPng].filter(
      (b): b is ArrayBuffer => b !== null
    );
    post(
      { type: 'complete', jpegBuffer, thumbBuffer, overviewPng, coverageMaskPng, fillMaskPng, matchesPng, outcome: enc.outcome },
      transfer
    );
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
