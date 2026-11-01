/**
 * Mobile Device Capabilities & Safe Panorama Width Detection (Phase 0.3)
 */

export interface DeviceCapabilityContext {
  userAgent?: string;
  maxTouchPoints?: number;
  deviceMemory?: number;
  maxTextureSize?: number;
  canvasAreaSupported?: (width: number, height: number) => boolean;
}

export function isIOSDevice(ctx?: DeviceCapabilityContext): boolean {
  const ua = ctx?.userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  const touchPts =
    ctx?.maxTouchPoints ?? (typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0);
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  // iPadOS 13+ desktop-class UA reports MacIntel with touch points
  if (/Macintosh/i.test(ua) && touchPts > 1) return true;
  return false;
}

export function isMobileOrTablet(ctx?: DeviceCapabilityContext): boolean {
  if (isIOSDevice(ctx)) return true;
  const ua = ctx?.userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  if (/Android|webOS|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(ua)) return true;
  return false;
}

function probeMaxTextureSize(): number {
  if (typeof document === 'undefined') return 8192;
  try {
    const canvas = document.createElement('canvas');
    const gl =
      (canvas.getContext('webgl2') as WebGL2RenderingContext | null) ||
      (canvas.getContext('webgl') as WebGLRenderingContext | null);
    if (!gl) return 4096;
    const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    const loseExt = gl.getExtension('WEBGL_lose_context');
    loseExt?.loseContext();
    return typeof maxTex === 'number' && maxTex > 0 ? maxTex : 4096;
  } catch {
    return 4096;
  }
}

function probeCanvasArea(width: number, height: number): boolean {
  // iOS Safari strictly limits canvas area to 16,777,216 pixels (4096 x 4096)
  if (width * height > 16777216 && isIOSDevice()) {
    return false;
  }
  if (typeof document === 'undefined') return true;
  try {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    const ctx = c.getContext('2d');
    if (!ctx) return false;
    c.width = 1;
    c.height = 1;
    return true;
  } catch {
    return false;
  }
}

export function maxSafePanoramaWidth(ctx?: DeviceCapabilityContext): number {
  const ios = isIOSDevice(ctx);
  const mobile = isMobileOrTablet(ctx);
  const navMem =
    ctx?.deviceMemory ??
    (typeof navigator !== 'undefined'
      ? (navigator as unknown as { deviceMemory?: number }).deviceMemory
      : undefined);
  const maxTex = ctx?.maxTextureSize ?? probeMaxTextureSize();
  const areaOk = ctx?.canvasAreaSupported ?? probeCanvasArea;

  // Frames are decoded at 1280 px (~20 px/degree), so ~6144 px is the sharpest panorama the
  // data supports. Peak stitch memory is dominated by the 30 decoded frames (~150 MB), not the
  // output, so large outputs are affordable on current phones.
  let cap = 6144;
  if (ios) {
    // WebKit refuses canvases above 16.7 MP; 5760 x 2880 = 16.6 MP is the largest that encodes.
    cap = 5760;
  } else if (mobile) {
    // Chrome rounds deviceMemory down to a power of two, so most 4–7 GB phones report 4.
    // The old rule capped every such phone at 2048 px, which made Android output soft.
    if (navMem !== undefined && navMem <= 1) {
      cap = 2048;
    } else if (navMem !== undefined && navMem <= 2) {
      cap = 4096;
    }
  }

  // The GPU path needs the width as a texture size; the CPU fallback does not, so never
  // let an old GPU limit push quality below 4096.
  cap = Math.min(cap, Math.max(maxTex, 4096));

  const candidates = [6144, 5760, 4096, 3072, 2048];
  for (const w of candidates) {
    if (w <= cap && areaOk(w, Math.floor(w / 2))) {
      return w;
    }
  }
  return 2048;
}

export function defaultSafePanoramaWidth(ctx?: DeviceCapabilityContext): number {
  // Default to the highest quality the device can safely produce (the iOS app defaults to
  // 6144). The old 2048 default threw away ~70% of the captured detail.
  return maxSafePanoramaWidth(ctx);
}

export function allowedPanoramaWidths(ctx?: DeviceCapabilityContext): number[] {
  const maxSafe = maxSafePanoramaWidth(ctx);
  return [2048, 3072, 4096, 5760, 6144].filter((w) => w <= maxSafe);
}
