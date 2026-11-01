// Browser-only helpers for uploads on weak connections.

/** Downscales to maxDim and re-encodes as JPEG. Returns the blob plus its mean brightness (0..255). */
export async function compressImage(source: Blob | HTMLVideoElement, maxDim = 1280, quality = 0.75): Promise<{ blob: Blob; brightness: number }> {
  let el: CanvasImageSource;
  let w: number;
  let h: number;
  if (source instanceof Blob) {
    const bmp = await createImageBitmap(source);
    el = bmp;
    w = bmp.width;
    h = bmp.height;
  } else {
    el = source;
    w = source.videoWidth;
    h = source.videoHeight;
  }
  const scale = Math.min(1, maxDim / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");
  ctx.drawImage(el, 0, 0, canvas.width, canvas.height);

  // Brightness from a small sample so "too dark" can be caught before uploading.
  const sample = document.createElement("canvas");
  sample.width = 32;
  sample.height = 32;
  const sctx = sample.getContext("2d")!;
  sctx.drawImage(canvas, 0, 0, 32, 32);
  const px = sctx.getImageData(0, 0, 32, 32).data;
  let sum = 0;
  for (let i = 0; i < px.length; i += 4) sum += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
  const brightness = sum / (px.length / 4);

  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Encode failed"))), "image/jpeg", quality));
  return { blob, brightness };
}

export class TimeoutError extends Error {}

/** fetch that gives up after `ms`, so a slow connection gets a clear message instead of a spinner forever. */
export async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e) {
    if (ctrl.signal.aborted) throw new TimeoutError("timeout");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** Maps getUserMedia errors to a message an owner can act on. */
export function mediaErrorMessage(e: unknown, what: "microphone" | "camera"): string {
  const name = (e as { name?: string })?.name;
  if (name === "NotAllowedError" || name === "SecurityError")
    return `The ${what} is blocked. Allow it in your browser settings, or use the typed form below.`;
  if (name === "NotFoundError" || name === "OverconstrainedError") return `No ${what} found on this device. Please use the typed form below.`;
  if (name === "NotSupportedError") return `This browser cannot use the ${what} here. Please use the typed form below.`;
  return `Could not start the ${what}. Please use the typed form below.`;
}
