import type { RasterImage } from '../geometry/Reprojection';
import { RasterImage as RasterImageClass, Reprojection } from '../geometry/Reprojection';
import { CaptureError } from '../models/CaptureModels';

export type TestImageEncoder = (
  raster: RasterImage,
  heading?: number | null,
  quality?: number
) => Promise<Uint8Array>;

export type TestImageDecoder = (
  data: Uint8Array,
  maxSize: number
) => Promise<RasterImage>;

export class ImageCodec {
  private static customEncoder: TestImageEncoder | null = null;
  private static customDecoder: TestImageDecoder | null = null;

  static setTestAdapter(
    encoder: TestImageEncoder | null,
    decoder: TestImageDecoder | null
  ): void {
    ImageCodec.customEncoder = encoder;
    ImageCodec.customDecoder = decoder;
  }

  static buildGPanoXMP(width: number, height: number, heading?: number | null): string {
    const headingTag =
      heading !== null && heading !== undefined && Number.isFinite(heading)
        ? `\n      <GPano:PoseHeadingDegrees>${heading}</GPano:PoseHeadingDegrees>`
        : '';
    return (
      `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>` +
      `<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="MIRAS Capture PWA">` +
      `<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">` +
      `<rdf:Description rdf:about="" xmlns:GPano="http://ns.google.com/photos/1.0/panorama/">` +
      `<GPano:ProjectionType>equirectangular</GPano:ProjectionType>` +
      `<GPano:UsePanoramaViewer>True</GPano:UsePanoramaViewer>` +
      `<GPano:FullPanoWidthPixels>${width}</GPano:FullPanoWidthPixels>` +
      `<GPano:FullPanoHeightPixels>${height}</GPano:FullPanoHeightPixels>` +
      `<GPano:CroppedAreaImageWidthPixels>${width}</GPano:CroppedAreaImageWidthPixels>` +
      `<GPano:CroppedAreaImageHeightPixels>${height}</GPano:CroppedAreaImageHeightPixels>` +
      `<GPano:CroppedAreaLeftPixels>0</GPano:CroppedAreaLeftPixels>` +
      `<GPano:CroppedAreaTopPixels>0</GPano:CroppedAreaTopPixels>` +
      `${headingTag}` +
      `</rdf:Description>` +
      `</rdf:RDF>` +
      `</x:xmpmeta>` +
      `<?xpacket end="w"?>`
    );
  }

  /**
   * Injects GPano XMP APP1 segment into a valid JPEG.
   * If a JFIF APP0 segment (FF E0) is immediately after SOI (FF D8), inserts APP1 after APP0.
   */
  static injectGPanoIntoJPEG(
    jpegBytes: Uint8Array,
    width: number,
    height: number,
    heading?: number | null
  ): Uint8Array {
    if (jpegBytes.length < 4 || jpegBytes[0] !== 0xff || jpegBytes[1] !== 0xd8) {
      throw new CaptureError('Invalid JPEG stream: missing SOI marker.');
    }

    const ns = 'http://ns.google.com/xap/1.0/\0';
    const xmp = ImageCodec.buildGPanoXMP(width, height, heading);
    const encoder = new TextEncoder();
    const nsBytes = encoder.encode(ns);
    const xmpBytes = encoder.encode(xmp);
    const segmentLength = 2 + nsBytes.length + xmpBytes.length;

    const app1 = new Uint8Array(2 + segmentLength);
    app1[0] = 0xff;
    app1[1] = 0xe1; // APP1
    app1[2] = (segmentLength >> 8) & 0xff;
    app1[3] = segmentLength & 0xff;
    app1.set(nsBytes, 4);
    app1.set(xmpBytes, 4 + nsBytes.length);

    // Check if JFIF APP0 (0xFFE0) is immediately at offset 2
    let insertPos = 2;
    if (jpegBytes.length >= 6 && jpegBytes[2] === 0xff && jpegBytes[3] === 0xe0) {
      const app0Len = (jpegBytes[4] << 8) | jpegBytes[5];
      if (2 + 2 + app0Len <= jpegBytes.length) {
        insertPos = 2 + 2 + app0Len;
      }
    }

    const out = new Uint8Array(jpegBytes.length + app1.length);
    out.set(jpegBytes.subarray(0, insertPos), 0);
    out.set(app1, insertPos);
    out.set(jpegBytes.subarray(insertPos), insertPos + app1.length);
    return out;
  }

  /**
   * Scans only the first 64 KB of the JPEG for GPano XMP tags.
   */
  static readGPanoMetadata(data: Uint8Array): Record<string, string> {
    const scanSlice = data.byteLength > 65536 ? data.subarray(0, 65536) : data;
    const decoder = new TextDecoder();
    const text = decoder.decode(scanSlice);
    const result: Record<string, string> = {};
    const regex = /<GPano:([A-Za-z0-9_]+)>([^<]+)<\/GPano:\1>/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      result[match[1]] = match[2];
    }
    return result;
  }

  static readImageDimensions(data: Uint8Array): { width: number; height: number } | null {
    const gpano = ImageCodec.readGPanoMetadata(data);
    if (gpano.FullPanoWidthPixels && gpano.FullPanoHeightPixels) {
      const w = parseInt(gpano.FullPanoWidthPixels, 10);
      const h = parseInt(gpano.FullPanoHeightPixels, 10);
      if (w > 0 && h > 0) return { width: w, height: h };
    }

    if (data.length >= 4 && data[0] === 0xff && data[1] === 0xd8) {
      let offset = 2;
      while (offset + 9 < data.length) {
        if (data[offset] !== 0xff) {
          offset++;
          continue;
        }
        const marker = data[offset + 1];
        if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
          const height = (data[offset + 5] << 8) | data[offset + 6];
          const width = (data[offset + 7] << 8) | data[offset + 8];
          return { width, height };
        }
        if (marker === 0xd8 || marker === 0xd9) {
          offset += 2;
          continue;
        }
        const len = (data[offset + 2] << 8) | data[offset + 3];
        if (len < 2) break;
        offset += 2 + len;
      }
    }

    return null;
  }

  /**
   * Reads EXIF FocalLengthIn35mmFilm (tag 0xA405) from a JPEG buffer if present.
   */
  static readExifFocalLength35mm(data: Uint8Array): number | null {
    if (data.length < 16 || data[0] !== 0xff || data[1] !== 0xd8) return null;
    let offset = 2;
    const maxScan = Math.min(data.length - 12, 65536);
    while (offset < maxScan) {
      if (data[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = data[offset + 1];
      const len = (data[offset + 2] << 8) | data[offset + 3];
      if (marker === 0xe1 && len >= 14) {
        // Check 'Exif\0\0'
        if (
          data[offset + 4] === 0x45 &&
          data[offset + 5] === 0x78 &&
          data[offset + 6] === 0x69 &&
          data[offset + 7] === 0x66 &&
          data[offset + 8] === 0x00 &&
          data[offset + 9] === 0x00
        ) {
          const tiffStart = offset + 10;
          const littleEndian = data[tiffStart] === 0x49 && data[tiffStart + 1] === 0x49;
          const dv = new DataView(data.buffer, data.byteOffset + tiffStart, Math.min(len - 8, data.length - tiffStart));
          const readU16 = (pos: number) => (pos + 2 <= dv.byteLength ? dv.getUint16(pos, littleEndian) : 0);
          const readU32 = (pos: number) => (pos + 4 <= dv.byteLength ? dv.getUint32(pos, littleEndian) : 0);

          const ifd0Offset = readU32(4);
          if (ifd0Offset > 0 && ifd0Offset + 2 <= dv.byteLength) {
            const count0 = readU16(ifd0Offset);
            for (let i = 0; i < count0; i++) {
              const entry = ifd0Offset + 2 + i * 12;
              const tag = readU16(entry);
              if (tag === 0x8769) {
                // ExifIFDPointer
                const exifOffset = readU32(entry + 8);
                if (exifOffset > 0 && exifOffset + 2 <= dv.byteLength) {
                  const exifCount = readU16(exifOffset);
                  for (let j = 0; j < exifCount; j++) {
                    const eEntry = exifOffset + 2 + j * 12;
                    const eTag = readU16(eEntry);
                    if (eTag === 0xa405) {
                      const val = readU16(eEntry + 8);
                      if (val > 8 && val < 200) return val;
                    }
                  }
                }
              }
            }
          }
        }
      }
      if (len < 2) break;
      offset += 2 + len;
    }
    return null;
  }

  /** Lossless PNG (diagnostic images). Returns null where no canvas encoder exists (Node). */
  static async png(raster: RasterImage): Promise<Uint8Array | null> {
    if (typeof OffscreenCanvas === 'undefined') return null;
    try {
      const canvas = new OffscreenCanvas(raster.width, raster.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.putImageData(
        new ImageData(raster.rgba as unknown as Uint8ClampedArray<ArrayBuffer>, raster.width, raster.height),
        0,
        0
      );
      const blob = await canvas.convertToBlob({ type: 'image/png' });
      return new Uint8Array(await blob.arrayBuffer());
    } catch {
      return null;
    }
  }

  static async jpeg(
    raster: RasterImage,
    heading?: number | null,
    quality = 0.92
  ): Promise<Uint8Array> {
    if (ImageCodec.customEncoder) {
      const raw = await ImageCodec.customEncoder(raster, heading, quality);
      return ImageCodec.injectGPanoIntoJPEG(raw, raster.width, raster.height, heading);
    }

    if (typeof OffscreenCanvas !== 'undefined') {
      try {
        const canvas = new OffscreenCanvas(raster.width, raster.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new CaptureError('Image memory allocation failed. Choose a smaller output size.');
        }
        // Construct ImageData directly on raster.rgba without extra copy
        const imgData = new ImageData(
          raster.rgba as unknown as Uint8ClampedArray<ArrayBuffer>,
          raster.width,
          raster.height
        );
        ctx.putImageData(imgData, 0, 0);
        const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
        const buf = new Uint8Array(await blob.arrayBuffer());
        if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) {
          throw new CaptureError('Saving the panorama failed: invalid JPEG encoding.');
        }
        return ImageCodec.injectGPanoIntoJPEG(buf, raster.width, raster.height, heading);
      } catch (err) {
        if (err instanceof CaptureError) throw err;
        // Fall through to HTMLCanvasElement if OffscreenCanvas failed on older mobile browser
      }
    }

    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = raster.width;
      canvas.height = raster.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new CaptureError('Image memory allocation failed. Choose a smaller output size.');
      }
      const imgData = new ImageData(
        raster.rgba as unknown as Uint8ClampedArray<ArrayBuffer>,
        raster.width,
        raster.height
      );
      ctx.putImageData(imgData, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', quality)
      );
      // Release canvas backing store immediately
      canvas.width = 1;
      canvas.height = 1;
      if (!blob) {
        throw new CaptureError(
          'Saving the panorama failed. Choose a smaller output size or free device memory.'
        );
      }
      const buf = new Uint8Array(await blob.arrayBuffer());
      if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) {
        throw new CaptureError('Saving the panorama failed: invalid JPEG encoding.');
      }
      return ImageCodec.injectGPanoIntoJPEG(buf, raster.width, raster.height, heading);
    }

    throw new CaptureError('Cannot create panorama JPEG: no canvas encoder available.');
  }

  static async decode(data: Uint8Array, maxSize = 1280): Promise<RasterImage> {
    if (ImageCodec.customDecoder) {
      return ImageCodec.customDecoder(data, maxSize);
    }

    if (typeof createImageBitmap !== 'undefined') {
      const blob = new Blob([data as unknown as BlobPart], { type: 'image/jpeg' });
      const dims = ImageCodec.readImageDimensions(data);
      let bitmap: ImageBitmap;
      if (dims && dims.width > 0 && dims.height > 0) {
        const scale = Math.min(1, maxSize / Math.max(dims.width, dims.height));
        const targetW = Math.max(1, Math.round(dims.width * scale));
        const targetH = Math.max(1, Math.round(dims.height * scale));
        try {
          bitmap = await createImageBitmap(blob, {
            resizeWidth: targetW,
            resizeHeight: targetH,
            resizeQuality: 'high'
          });
        } catch {
          bitmap = await createImageBitmap(blob);
        }
      } else {
        bitmap = await createImageBitmap(blob);
      }

      const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));

      if (typeof OffscreenCanvas !== 'undefined') {
        const canvas = new OffscreenCanvas(w, h);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          bitmap.close();
          throw new CaptureError('Cannot allocate OffscreenCanvas context.');
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(bitmap, 0, 0, w, h);
        const imgData = ctx.getImageData(0, 0, w, h);
        bitmap.close();
        return new RasterImageClass(w, h, imgData.data);
      } else if (typeof document !== 'undefined') {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          bitmap.close();
          throw new CaptureError('Cannot allocate 2D canvas context.');
        }
        ctx.drawImage(bitmap, 0, 0, w, h);
        const imgData = ctx.getImageData(0, 0, w, h);
        bitmap.close();
        canvas.width = 1;
        canvas.height = 1;
        return new RasterImageClass(w, h, imgData.data);
      }
    }

    throw new CaptureError('Cannot decode image in current environment.');
  }

  static downsampleIfNeeded(image: RasterImage, maxSize: number): RasterImage {
    const maxDim = Math.max(image.width, image.height);
    if (maxDim <= maxSize) return image;
    const scale = maxSize / maxDim;
    const w = Math.max(1, Math.round(image.width * scale));
    const h = Math.max(1, Math.round(image.height * scale));
    // Area averaging: point-sampling a 6144 px panorama down to 320 px gave noisy thumbnails.
    return Reprojection.areaResize(image, w, h);
  }
}
