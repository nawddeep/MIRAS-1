/** Reading time from the real text length: ceil(words / 200) minutes, at least 1. */
export function readMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}
