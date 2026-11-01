import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRepos, setRepos } from "@/lib/repos";
import { openDb } from "@/lib/repos/sqlite";
import type { Artisan, Place, StoryEntry, Workshop } from "@/lib/schemas";

const now = "2026-10-28T00:00:00.000Z";

export const place = (over: Partial<Place> = {}): Place => ({
  id: "p1",
  slug: "p1",
  name: "Test Place",
  category: "Test",
  lat: 24.5,
  lng: 73.7,
  summary: "Test summary",
  visitTips: ["tip"],
  openingHours: "test hours",
  typicalVisitMinutes: 30,
  photos: [],
  status: "published",
  isSample: false,
  ...over,
});

export const story = (over: Partial<StoryEntry> = {}): StoryEntry => ({
  id: "s1",
  placeId: "p1",
  title: "Verified title",
  text: "Verified text",
  simpleTextChecked: false,
  language: "en",
  sourceType: "oral_tradition",
  rights: { owner: "Test owner", permittedUse: "test" },
  updatedAt: now,
  isSample: false,
  verifiedBy: "Checker",
  verifiedAt: now,
  ...over,
});

export const artisan = (over: Partial<Artisan> = {}): Artisan => ({
  id: "a1",
  name: "Test Artisan",
  craft: "Test craft",
  description: "Test description",
  materials: [],
  languages: ["Hindi"],
  photos: [],
  contact: "test@example.invalid",
  locationText: "Test area",
  status: "draft",
  consent: { given: false },
  photoRights: "test",
  editToken: "test-edit-token-0123456789",
  isSample: false,
  ...over,
});

export const workshop = (over: Partial<Workshop> = {}): Workshop => ({
  id: "w1",
  artisanId: "a1",
  title: "Test workshop",
  description: "Test",
  language: "Hindi",
  durationMinutes: 60,
  cost: "test",
  howToBook: "test",
  status: "draft",
  updatedAt: now,
  isSample: false,
  ...over,
});

type Fixture = {
  places?: unknown[];
  stories?: unknown[];
  artisans?: unknown[];
  workshops?: unknown[];
  media?: unknown[];
  publicFiles?: string[];
};

/** Writes a throwaway content folder and installs repos backed by it and an in-memory DB. */
export function withFixture(f: Fixture) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "miras-test-"));
  const contentDir = path.join(root, "content");
  for (const key of ["places", "stories", "artisans", "workshops"] as const) {
    fs.mkdirSync(path.join(contentDir, key), { recursive: true });
    if (f[key]) fs.writeFileSync(path.join(contentDir, key, "fixture.json"), JSON.stringify(f[key]));
  }
  fs.writeFileSync(path.join(contentDir, "media.json"), JSON.stringify(f.media ?? []));
  const publicDir = path.join(root, "public");
  for (const file of f.publicFiles ?? []) {
    fs.mkdirSync(path.dirname(path.join(publicDir, file)), { recursive: true });
    fs.writeFileSync(path.join(publicDir, file), "x");
  }
  const repos = createRepos(contentDir, openDb(":memory:"));
  setRepos(repos);
  return { root, contentDir, publicDir, repos };
}
