import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { pipeline } from "node:stream/promises";
import { CommunityError } from "@/lib/community/store";
import { getConfig } from "@/lib/config";
import { detectMedia } from "@/lib/ar-stories/media";

export const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 80 * 1024 * 1024;

export const uploadDir = () => path.join(getConfig().dataDir, "uploads", "media-social");

/** The only file names this module ever writes; anything else in the URL is refused before the disk is touched. */
export const FILE_NAME = /^[a-z0-9]+-[a-f0-9]{16}\.(jpg|png|webp|mp4|webm|mov)$/;

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime" };
export const contentTypeFor = (name: string) => TYPES[name.split(".").pop() ?? ""] ?? "application/octet-stream";

export const fileUrl = (name: string) => `/api/media-social/file/${name}`;

/**
 * Stores an uploaded photo or video. The type comes from the file's own first bytes (never the browser's claim or
 * the file name), the size is capped per type, and the bytes are streamed to disk rather than held in memory.
 */
export async function saveUpload(file: File): Promise<{ name: string; url: string; mediaType: "image" | "video" }> {
  if (file.size === 0) throw new CommunityError("No file was sent.", 400);
  const detected = detectMedia(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
  if (!detected) throw new CommunityError("That file type isn’t supported. Use a JPG, PNG or WEBP photo, or an MP4, WEBM or MOV video.", 415);
  const limit = detected.mediaType === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (file.size > limit) throw new CommunityError(`That ${detected.mediaType === "image" ? "photo" : "video"} is larger than ${limit / 1024 / 1024} MB.`, 413);

  const name = `${Date.now().toString(36)}-${randomBytes(8).toString("hex")}.${detected.ext}`;
  await fs.mkdir(uploadDir(), { recursive: true });
  await pipeline(Readable.fromWeb(file.stream() as unknown as NodeReadableStream), createWriteStream(path.join(uploadDir(), name)));
  return { name, url: fileUrl(name), mediaType: detected.mediaType };
}

/** Deletes uploaded files by name; names that are not ours are ignored. */
export async function removeUploads(names: string[]): Promise<void> {
  for (const name of names) if (FILE_NAME.test(name)) await fs.unlink(path.join(uploadDir(), name)).catch(() => {});
}
