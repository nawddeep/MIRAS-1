export const MAX_BYTES = 150 * 1024 * 1024;
export const MAX_SECONDS = 60;

export type DetectedMedia = { ext: "jpg" | "png" | "webp" | "mp4" | "mov" | "webm"; mediaType: "image" | "video" };

const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.slice(from, to));

/**
 * Identifies an upload from its first bytes, not from the type the browser claims.
 * Returns null for anything that is not a JPEG, PNG, WEBP, MP4, MOV or WEBM file.
 */
export function detectMedia(b: Uint8Array): DetectedMedia | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", mediaType: "image" };
  if (b.length >= 8 && b[0] === 0x89 && ascii(b, 1, 4) === "PNG" && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return { ext: "png", mediaType: "image" };
  if (b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") return { ext: "webp", mediaType: "image" };
  if (b.length >= 12 && ascii(b, 4, 8) === "ftyp") return { ext: ascii(b, 8, 12) === "qt  " ? "mov" : "mp4", mediaType: "video" };
  if (b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { ext: "webm", mediaType: "video" };
  return null;
}
