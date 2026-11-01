// The visitor's plan lives on their device only (localStorage). Never sent to the server.

import type { TravelMode } from "@/lib/planner";

export type SavedPlan = { placeIds: string[]; startTime: string; dayHours: number; mode: TravelMode };

const KEY = "miras-plan-v1";
export const DEFAULT_PLAN: SavedPlan = { placeIds: [], startTime: "09:00", dayHours: 8, mode: "walk" };

export function loadPlan(): SavedPlan {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_PLAN, ...JSON.parse(raw) } : DEFAULT_PLAN;
  } catch {
    return DEFAULT_PLAN;
  }
}

export function savePlan(plan: SavedPlan) {
  try {
    localStorage.setItem(KEY, JSON.stringify(plan));
    return true;
  } catch {
    // Private mode or storage full: the plan still works for this visit.
    return false;
  }
}
