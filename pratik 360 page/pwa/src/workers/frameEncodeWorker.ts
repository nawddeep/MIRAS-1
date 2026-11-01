/**
 * Worker for encoding ImageBitmap frames to JPEG off the main thread (Phase 1.4).
 */
self.onmessage = async (e: MessageEvent<{ id: number; bitmap: ImageBitmap; quality: number }>) => {
  const { id, bitmap, quality } = e.data;
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      self.postMessage({ id, error: 'Cannot create OffscreenCanvas context in frame worker.' });
      return;
    }
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: quality ?? 0.92 });
    const buffer = await blob.arrayBuffer();
    (self as unknown as Worker).postMessage({ id, buffer }, [buffer]);
  } catch (err) {
    try {
      bitmap.close();
    } catch {
      // ignore
    }
    self.postMessage({
      id,
      error: err instanceof Error ? err.message : String(err)
    });
  }
};
