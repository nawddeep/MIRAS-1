import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

describe("PWA manifest", () => {
  const m = manifest();

  it("provides valid app identity and display mode", () => {
    expect(m.name).toBe("MIRAS: Udaipur heritage and local makers");
    expect(m.short_name).toBe("MIRAS");
    expect(m.start_url).toBe("/");
    expect(m.display).toBe("standalone");
    expect(m.theme_color).toBe("#131B31");
    expect(m.background_color).toBe("#F5EEE0");
  });

  it("references real icons that exist on disk in public/", () => {
    expect(m.icons).toBeDefined();
    expect(m.icons!.length).toBeGreaterThanOrEqual(4);

    const publicDir = path.resolve(process.cwd(), "public");

    for (const icon of m.icons!) {
      const filePath = path.join(publicDir, icon.src);
      expect(fs.existsSync(filePath), `Icon file ${icon.src} must exist`).toBe(true);
      const stat = fs.statSync(filePath);
      expect(stat.size).toBeGreaterThan(0);
    }
  });

  it("includes 192x192, 512x512, and maskable icons for PWA install criteria", () => {
    const sizes = m.icons!.map((i) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");

    const purposes = m.icons!.map((i) => i.purpose).filter(Boolean);
    expect(purposes).toContain("maskable");
    expect(purposes).toContain("any");
  });

  it("provides valid shortcuts to main features", () => {
    expect(m.shortcuts).toBeDefined();
    expect(m.shortcuts!.length).toBeGreaterThan(0);
    const urls = m.shortcuts!.map((s) => s.url);
    expect(urls).toContain("/");
    expect(urls).toContain("/artisans");
    expect(urls).toContain("/camera");
    expect(urls).toContain("/offline");
  });
});
