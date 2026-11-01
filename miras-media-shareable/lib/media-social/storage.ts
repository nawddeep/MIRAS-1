import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { getConfig } from "@/lib/config";

const ALLOWED_MIME_TYPES: Record<string, string> = {
  // Images
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  // Video
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  // Audio
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/ogg": "ogg",
};

export class MediaSocialStorage {
  private baseDir: string;

  constructor() {
    this.baseDir = path.join(getConfig().dataDir, "media_uploads");
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  saveUpload(buffer: Buffer, mimeType: string, originalName?: string): { url: string; filename: string; mimeType: string; size: number } {
    const ext = ALLOWED_MIME_TYPES[mimeType.toLowerCase()] || (originalName ? path.extname(originalName).replace(".", "") : "bin");
    const filename = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const filePath = path.join(this.baseDir, filename);

    fs.writeFileSync(filePath, buffer);

    return {
      url: `/api/media-social/file/${filename}`,
      filename,
      mimeType,
      size: buffer.length,
    };
  }

  getFilePath(filename: string): string | null {
    // Basic sanitization
    const safeName = path.basename(filename);
    const fullPath = path.join(this.baseDir, safeName);
    if (!fs.existsSync(fullPath)) return null;
    return fullPath;
  }

  getFileStream(filename: string) {
    const fullPath = this.getFilePath(filename);
    if (!fullPath) return null;

    const stat = fs.statSync(fullPath);
    const ext = path.extname(filename).replace(".", "").toLowerCase();

    let mime = "application/octet-stream";
    for (const [m, e] of Object.entries(ALLOWED_MIME_TYPES)) {
      if (e === ext) {
        mime = m;
        break;
      }
    }

    return {
      filePath: fullPath,
      size: stat.size,
      mimeType: mime,
    };
  }
}

let storageInstance: MediaSocialStorage | undefined;

export function getMediaSocialStorage(): MediaSocialStorage {
  return (storageInstance ??= new MediaSocialStorage());
}

