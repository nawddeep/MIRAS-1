// Time-of-day theme for the home screen and splash. Pure functions, used on the client after mount.

export type TimeMode = "dawn" | "day" | "golden" | "night";

/** dawn 05–10, day 10–16 (dawn look on paper), golden 16–19, night 19–05. */
export function timeOfDay(hour: number): TimeMode {
  if (hour >= 5 && hour < 10) return "dawn";
  if (hour >= 10 && hour < 16) return "day";
  if (hour >= 16 && hour < 19) return "golden";
  return "night";
}

/** Each time window has its own supplied photographic scene. */
export const sceneFor = (mode: TimeMode): TimeMode => mode;

/** Reads the ?hour=HH demo override (0–23). Anything else is ignored. */
export function parseHourParam(value: string | null): number | null {
  if (value === null || !/^\d{1,2}$/.test(value)) return null;
  const h = Number(value);
  return h >= 0 && h <= 23 ? h : null;
}
