import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatIST, getVisibleEvents, isEventVisible } from "@/lib/services/events";
import { withFixture } from "./helpers";

const now = new Date("2026-10-28T12:00:00.000Z");
const ev = (over: object = {}) => ({
  id: "e1",
  title: "T",
  organiser: "O",
  startsAt: "2026-11-01T10:00:00.000+05:30",
  language: "Hindi",
  durationMinutes: 60,
  cost: "Free",
  howToBook: "Call",
  confirmedByOrganiserAt: "2026-10-27T00:00:00.000Z",
  updatedAt: "2026-10-27T00:00:00.000Z",
  isSample: false,
  ...over,
});

describe("events", () => {
  it("shows only organiser-confirmed events", () => {
    expect(isEventVisible(ev(), "live", now)).toBe(true);
    expect(isEventVisible(ev({ confirmedByOrganiserAt: undefined }), "live", now)).toBe(false);
  });

  it("hides past events", () => {
    expect(isEventVisible(ev({ startsAt: "2026-10-01T10:00:00.000+05:30" }), "live", now)).toBe(false);
  });

  it("samples show only in demo mode", () => {
    expect(isEventVisible(ev({ isSample: true, confirmedByOrganiserAt: undefined }), "live", now)).toBe(false);
    expect(isEventVisible(ev({ isSample: true, confirmedByOrganiserAt: undefined }), "demo", now)).toBe(true);
  });

  it("lists upcoming events in start order", () => {
    const { contentDir } = withFixture({});
    fs.mkdirSync(path.join(contentDir, "events"), { recursive: true });
    fs.writeFileSync(
      path.join(contentDir, "events", "e.json"),
      JSON.stringify([ev({ id: "later", startsAt: "2026-12-01T10:00:00.000+05:30" }), ev({ id: "sooner" }), ev({ id: "past", startsAt: "2026-01-01T10:00:00.000+05:30" })]),
    );
    expect(getVisibleEvents("live", now).map((e) => e.id)).toEqual(["sooner", "later"]);
  });

  it("formats times in Indian Standard Time", () => {
    expect(formatIST("2026-11-01T04:30:00.000Z")).toMatch(/10:00\s?am IST/i);
  });
});
