import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";

const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const sources = ["components/trip", "lib/trip", "app/trip-planner"].flatMap((d) => walk(d)).filter((f) => /\.tsx?$/.test(f));
const read = (f: string) => fs.readFileSync(f, "utf8");

describe("trip planner port", () => {
  it("has the source files it expects", () => {
    expect(sources.length).toBeGreaterThanOrEqual(25);
  });

  it("sends every API call through the /api/trip namespace, never the PWA's own /api routes", () => {
    const bad = sources.flatMap((f) => [...read(f).matchAll(/["'`]\/api\/(?!trip\/)[^"'`]*/g)].map((m) => `${f}: ${m[0]}`));
    expect(bad).toEqual([]);
  });

  it("links only to /trip-planner routes, so no link falls through to the PWA's own pages", () => {
    const bad = sources.flatMap((f) => [...read(f).matchAll(/["'`]\/(plan|explore|trail|trip)(?=[/?"'`#])/g)].map((m) => `${f}: ${m[0]}`));
    expect(bad).toEqual([]);
    expect(read("components/trip/itinerary/ItineraryView.tsx")).toContain("/trip-planner/trip/${share}");
  });

  it("proxies /api/trip/* to the Python backend's /api/*", async () => {
    const rules = await nextConfig.rewrites!();
    const list = Array.isArray(rules) ? rules : rules.beforeFiles;
    expect(list).toContainEqual({ source: "/api/trip/:path*", destination: expect.stringMatching(/\/api\/:path\*$/) });
  });

  it("scopes every stylesheet rule under .trip-planner and never redefines the PWA's :root", () => {
    const css = read("app/trip-planner/trip-planner.css").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(css).not.toMatch(/@import|:root|(^|\n)\s*(html|body)\b/);
    const selectors = [...css.matchAll(/(?:^|\})\s*([^{}@]+)\{/g)].map((m) => m[1].trim()).filter((s) => !/^(from|to|\d+%)/.test(s));
    const unscoped = selectors.filter((s) => s.split(/,(?![^()]*\))/).some((part) => !part.trim().startsWith(".trip-planner")));
    expect(unscoped).toEqual([]);
  });
});
