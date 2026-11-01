import { Geometry } from '../geometry/SphericalGeometry';
import {
  CaptureError,
  captureSlug,
  frameFileName
} from '../models/CaptureModels';
import type {
  CaptureDocument,
  HeadingRecord,
  Hotspot,
  LocationRecord,
  StitchReport,
  StitchSettings
} from '../models/CaptureModels';
import { DeviceInfo } from '../models/DeviceInfo';
import { CaptureStore } from './CaptureStore';
import { ImageCodec } from './ImageCodec';

export interface HotspotDefaults {
  triggerAngle: number;
  exitAngle: number;
  hoverAngle: number;
  hoverExitAngle: number;
  dwellTime: number;
  duration: number;
  cooldown: number;
}

export interface HotspotPackage {
  defaults: HotspotDefaults;
  hotspots: Hotspot[];
}

export interface CaptureManifest {
  appVersion: string;
  deviceModel: string;
  date: string;
  frameCount: number;
  outputSize: { width: number; height: number };
  yawReference: string;
  /** World yaw of the panorama's front (needed to re-stitch the exported frames exactly). */
  referenceWorldYaw?: number;
  /** Orientation source / camera lock / planner state, so field problems can be diagnosed offline. */
  orientationSource?: string | null;
  cameraLock?: unknown;
  plan?: unknown;
  heading?: HeadingRecord;
  location?: LocationRecord;
  stitchSettings: StitchSettings;
  coverage: number;
  warnings: string[];
  /** Stitch diagnostics: real coverage, filled share, verified matches, residual error. */
  stitchReport?: StitchReport;
}

export interface ExportArchive {
  slug: string;
  zipBytes: Uint8Array;
  files: Map<string, Uint8Array>;
}

const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let v = 0; v < 256; v++) {
    let c = v;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? (0xedb88320 ^ (c >>> 1)) >>> 0 : c >>> 1;
    }
    table[v] = c >>> 0;
  }
  return table;
})();

let activeExportObjectUrl: string | null = null;
let activeExportUrlTimer: ReturnType<typeof setTimeout> | null = null;

export class StoredZIP {
  static crc32(payload: Uint8Array): number {
    let crc = 0xffffffff;
    for (let i = 0; i < payload.length; i++) {
      crc = (CRC_TABLE[(crc ^ payload[i]) & 0xff] ^ (crc >>> 8)) >>> 0;
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  static write(
    slug: string,
    entries: Map<string, Uint8Array>,
    cancelled: () => boolean = () => false
  ): Uint8Array {
    const encoder = new TextEncoder();
    const sortedKeys = Array.from(entries.keys()).sort();

    if (sortedKeys.length >= 0xffff) {
      throw new CaptureError('Package exceeds ZIP size limits. Export without raw frames.');
    }

    // First pass: encode entry names and compute exact byte offsets so we allocate once
    const encodedNames: Uint8Array[] = new Array(sortedKeys.length);
    let dataSectionSize = 0;
    let centralDirSize = 0;

    for (let i = 0; i < sortedKeys.length; i++) {
      const relative = sortedKeys[i];
      const payload = entries.get(relative)!;
      if (payload.length >= 0xffffffff) {
        throw new CaptureError('Package exceeds ZIP size limits. Export without raw frames.');
      }
      const nameBytes = encoder.encode(`${slug}/${relative}`);
      encodedNames[i] = nameBytes;
      dataSectionSize += 30 + nameBytes.length + payload.length;
      centralDirSize += 46 + nameBytes.length;
      if (dataSectionSize >= 0xffffffff) {
        throw new CaptureError('Package exceeds ZIP size limits. Export without raw frames.');
      }
    }

    const totalLength = dataSectionSize + centralDirSize + 22;
    const result = new Uint8Array(totalLength);
    const view = new DataView(result.buffer);

    let localPos = 0;
    let centralPos = dataSectionSize;

    for (let i = 0; i < sortedKeys.length; i++) {
      if (cancelled()) throw new Error('Cancelled');
      const relative = sortedKeys[i];
      const payload = entries.get(relative)!;
      const nameBytes = encodedNames[i];
      const crc = StoredZIP.crc32(payload);
      const size = payload.length >>> 0;
      const offset = localPos >>> 0;

      // Local file header (30 bytes + name)
      view.setUint32(localPos + 0, 0x04034b50, true);
      view.setUint16(localPos + 4, 20, true);
      view.setUint16(localPos + 6, 0x800, true);
      view.setUint16(localPos + 8, 0, true);
      view.setUint16(localPos + 10, 0, true);
      view.setUint16(localPos + 12, 0x21, true);
      view.setUint32(localPos + 14, crc, true);
      view.setUint32(localPos + 18, size, true);
      view.setUint32(localPos + 22, size, true);
      view.setUint16(localPos + 26, nameBytes.length, true);
      view.setUint16(localPos + 28, 0, true);
      result.set(nameBytes, localPos + 30);
      localPos += 30 + nameBytes.length;

      // File payload written directly into result buffer
      result.set(payload, localPos);
      localPos += size;

      // Central directory header (46 bytes + name)
      view.setUint32(centralPos + 0, 0x02014b50, true);
      view.setUint16(centralPos + 4, 20, true);
      view.setUint16(centralPos + 6, 20, true);
      view.setUint16(centralPos + 8, 0x800, true);
      view.setUint16(centralPos + 10, 0, true);
      view.setUint16(centralPos + 12, 0, true);
      view.setUint16(centralPos + 14, 0x21, true);
      view.setUint32(centralPos + 16, crc, true);
      view.setUint32(centralPos + 20, size, true);
      view.setUint32(centralPos + 24, size, true);
      view.setUint16(centralPos + 28, nameBytes.length, true);
      view.setUint16(centralPos + 30, 0, true);
      view.setUint16(centralPos + 32, 0, true);
      view.setUint16(centralPos + 34, 0, true);
      view.setUint16(centralPos + 36, 0, true);
      view.setUint32(centralPos + 38, 0, true);
      view.setUint32(centralPos + 42, offset, true);
      result.set(nameBytes, centralPos + 46);
      centralPos += 46 + nameBytes.length;
    }

    // End of central directory record (22 bytes)
    const count = sortedKeys.length;
    view.setUint32(centralPos + 0, 0x06054b50, true);
    view.setUint16(centralPos + 4, 0, true);
    view.setUint16(centralPos + 6, 0, true);
    view.setUint16(centralPos + 8, count, true);
    view.setUint16(centralPos + 10, count, true);
    view.setUint32(centralPos + 12, centralDirSize >>> 0, true);
    view.setUint32(centralPos + 16, dataSectionSize >>> 0, true);
    view.setUint16(centralPos + 20, 0, true);

    return result;
  }

  static listEntries(zipBytes: Uint8Array): Map<string, Uint8Array> {
    const entries = new Map<string, Uint8Array>();
    const dv = new DataView(zipBytes.buffer, zipBytes.byteOffset, zipBytes.byteLength);
    const decoder = new TextDecoder();
    let pos = 0;
    while (pos + 30 <= zipBytes.length) {
      const sig = dv.getUint32(pos, true);
      if (sig !== 0x04034b50) break;
      const expectedCrc = dv.getUint32(pos + 14, true);
      const size = dv.getUint32(pos + 18, true);
      const nameLen = dv.getUint16(pos + 26, true);
      const extraLen = dv.getUint16(pos + 28, true);
      const nameStart = pos + 30;
      const dataStart = nameStart + nameLen + extraLen;
      const name = decoder.decode(zipBytes.subarray(nameStart, nameStart + nameLen));
      const payload = zipBytes.subarray(dataStart, dataStart + size);
      const actualCrc = StoredZIP.crc32(payload);
      if (actualCrc !== expectedCrc) {
        throw new CaptureError(`ZIP CRC mismatch for entry ${name}`);
      }
      entries.set(name, new Uint8Array(payload));
      pos = dataStart + size;
    }
    return entries;
  }
}

/** Stored next to the frames; written by each stitch. */
export const DIAGNOSTIC_OVERVIEW_FILE = 'diagnostics-overview.png';
export const DIAGNOSTIC_MASK_FILE = 'diagnostics-coverage-mask.png';
export const DIAGNOSTIC_FILL_FILE = 'diagnostics-fill-mask.png';
export const DIAGNOSTIC_MATCHES_FILE = 'diagnostics-matches.png';

export class ExportService {
  private store: CaptureStore;

  constructor(store: CaptureStore = CaptureStore.shared) {
    this.store = store;
  }

  static isValidSourceURL(raw: string): boolean {
    try {
      const url = new URL(raw);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  async estimateRawFramesBytes(capture: CaptureDocument): Promise<number> {
    if (!capture.settings.includeFrames || capture.frames.length === 0) return 0;
    let total = 0;
    for (const frame of capture.frames) {
      const fname = frame.file ?? frameFileName(frame.index);
      try {
        const bytes = await this.store.readFrame(capture.id, fname);
        total += bytes.byteLength;
      } catch {
        // ignore missing frame
      }
    }
    return total;
  }

  async export(
    capture: CaptureDocument,
    options?: {
      deviceModel?: string;
      cancelled?: () => boolean;
    }
  ): Promise<ExportArchive> {
    const cancelled = options?.cancelled ?? (() => false);
    const deviceModel = options?.deviceModel ?? DeviceInfo.model;

    if (cancelled()) throw new Error('Cancelled');
    if (!capture.stitched) {
      throw new CaptureError('Stitch the capture before exporting.');
    }

    for (const dot of capture.hotspots) {
      const titleOk = dot.title.trim().length > 0;
      const captionOk = dot.caption.trim().length > 0 && dot.caption.length <= 300;
      const sourcesOk = dot.sources.every((s) => ExportService.isValidSourceURL(s));
      if (!titleOk || !captionOk || !sourcesOk) {
        throw new CaptureError(
          'Each hotspot needs a title, a caption up to 300 characters, and valid HTTP or HTTPS source URLs.'
        );
      }
    }

    const slug = captureSlug(capture);
    const files = new Map<string, Uint8Array>();

    const panoBytes = await this.store.readPanorama(capture.id);
    files.set('panorama.jpg', panoBytes);

    const dims = ImageCodec.readImageDimensions(panoBytes);
    if (!dims || dims.width <= 0 || dims.height <= 0) {
      throw new CaptureError('Cannot read panorama dimensions. Re-stitch and retry.');
    }

    const spots: Hotspot[] = capture.hotspots.map((dot) => ({
      id: dot.id,
      view: slug,
      title: dot.title,
      yaw: Geometry.wrap(Math.round(Geometry.wrap(dot.yaw) * 10) / 10),
      pitch: Math.round(Math.min(90, Math.max(-90, dot.pitch)) * 10) / 10,
      caption: dot.caption,
      sources: [...dot.sources]
    }));

    const hotspotPackage: HotspotPackage = {
      defaults: {
        triggerAngle: 8.0,
        exitAngle: 11.0,
        hoverAngle: 3.0,
        hoverExitAngle: 4.5,
        dwellTime: 700,
        duration: 8000,
        cooldown: 4000
      },
      hotspots: spots
    };

    const encoder = new TextEncoder();
    files.set('hotspots.json', encoder.encode(JSON.stringify(hotspotPackage, null, 2)));

    const heading = capture.yawReference === 'trueNorth' ? capture.heading ?? undefined : undefined;
    const manifest: CaptureManifest = {
      appVersion: '1.0',
      deviceModel,
      date: capture.date,
      frameCount: capture.frames.length,
      outputSize: { width: dims.width, height: dims.height },
      yawReference: capture.yawReference,
      referenceWorldYaw: capture.referenceWorldYaw,
      orientationSource: capture.orientationSource ?? null,
      cameraLock: capture.cameraLock ?? null,
      plan: capture.plan ?? null,
      ...(heading ? { heading } : {}),
      ...(capture.location ? { location: capture.location } : {}),
      stitchSettings: capture.stitchedSettings ?? capture.settings,
      coverage: capture.coverage,
      warnings: capture.warnings,
      ...(capture.stitchReport ? { stitchReport: capture.stitchReport } : {})
    };
    files.set('capture.json', encoder.encode(JSON.stringify(manifest, null, 2)));

    // Stitch diagnostics, when the last stitch produced them.
    for (const [file, name] of [
      [DIAGNOSTIC_OVERVIEW_FILE, 'diagnostics/overview.png'],
      [DIAGNOSTIC_MASK_FILE, 'diagnostics/coverage_mask.png'],
      [DIAGNOSTIC_FILL_FILE, 'diagnostics/synthetic_fill_mask.png'],
      [DIAGNOSTIC_MATCHES_FILE, 'diagnostics/verified_matches_residuals.png']
    ] as const) {
      try {
        const bytes = await this.store.readFrame(capture.id, file);
        if (bytes && bytes.byteLength > 0) files.set(name, bytes);
      } catch {
        // not stitched with diagnostics yet
      }
    }

    if (capture.settings.includeFrames) {
      for (const frame of capture.frames) {
        if (cancelled()) throw new Error('Cancelled');
        const fname = frame.file ?? frameFileName(frame.index);
        const frameBytes = await this.store.readFrame(capture.id, fname);
        files.set(`frames/${fname}`, frameBytes);
      }
      files.set('frames.json', encoder.encode(JSON.stringify(capture.frames, null, 2)));
    }

    const zipBytes = StoredZIP.write(slug, files, cancelled);
    return { slug, zipBytes, files };
  }

  async downloadPanoramaJPEG(capture: CaptureDocument): Promise<void> {
    const panoBytes = await this.store.readPanorama(capture.id);
    const slug = captureSlug(capture);
    await ExportService.shareOrDownload(panoBytes, `${slug}-panorama.jpg`, 'image/jpeg');
  }

  static async shareOrDownload(
    bytes: Uint8Array,
    filename: string,
    mimeType: string
  ): Promise<void> {
    if (typeof navigator !== 'undefined' && typeof File !== 'undefined') {
      try {
        const file = new File([bytes as unknown as BlobPart], filename, { type: mimeType });
        const nav = navigator as Navigator & {
          canShare?: (data?: ShareData) => boolean;
          share?: (data?: ShareData) => Promise<void>;
        };
        if (typeof nav.canShare === 'function' && typeof nav.share === 'function') {
          if (nav.canShare({ files: [file] })) {
            await nav.share({
              files: [file],
              title: filename
            });
            return;
          }
        }
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') {
          return;
        }
        // Fall through to standard anchor download if Web Share fails
      }
    }
    ExportService.triggerBrowserDownload(bytes, filename, mimeType);
  }

  static triggerBrowserDownload(bytes: Uint8Array, filename: string, mimeType: string): void {
    if (typeof document === 'undefined') return;
    if (activeExportUrlTimer !== null) {
      clearTimeout(activeExportUrlTimer);
      activeExportUrlTimer = null;
    }
    if (activeExportObjectUrl !== null) {
      URL.revokeObjectURL(activeExportObjectUrl);
      activeExportObjectUrl = null;
    }

    const blob = new Blob([bytes as unknown as BlobPart], { type: mimeType });
    const url = URL.createObjectURL(blob);
    activeExportObjectUrl = url;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Keep object URL alive for at least 60 seconds so mobile download managers finish reading
    activeExportUrlTimer = setTimeout(() => {
      if (activeExportObjectUrl === url) {
        URL.revokeObjectURL(url);
        activeExportObjectUrl = null;
      }
      activeExportUrlTimer = null;
    }, 65_000);
  }
}
