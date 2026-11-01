import { expect, test } from "@playwright/test";

test("PWA manifest is linked and served with correct attributes", async ({ page }) => {
  await page.goto("/");

  // Check manifest link tag in head
  const manifestLink = page.locator('head link[rel="manifest"]');
  await expect(manifestLink).toHaveCount(1);
  const href = await manifestLink.getAttribute("href");
  expect(href).toMatch(/\/manifest\.webmanifest/);

  // Fetch manifest and check contents
  const res = await page.request.get(href!);
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.name).toBe("MIRAS: Udaipur heritage and local makers");
  expect(json.short_name).toBe("MIRAS");
  expect(json.display).toBe("standalone");
  expect(json.theme_color).toBe("#131B31");
  expect(json.icons.length).toBeGreaterThanOrEqual(4);
});

test("PWA viewport and Apple meta tags are set", async ({ page }) => {
  await page.goto("/");

  const themeColor = page.locator('head meta[name="theme-color"]');
  await expect(themeColor).toHaveAttribute("content", "#131B31");

  const appCapable = page.locator('head meta[name="mobile-web-app-capable"]');
  await expect(appCapable).toHaveAttribute("content", "yes");

  const appleTitle = page.locator('head meta[name="apple-mobile-web-app-title"]');
  await expect(appleTitle).toHaveAttribute("content", "MIRAS");

  const appleIcon = page.locator('head link[rel="apple-touch-icon"]');
  await expect(appleIcon).toHaveAttribute("href", "/icons/apple-touch-icon.png");
});

test("no horizontal scroll at 360px viewport", async ({ page }) => {
  await page.goto("/");
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(scroll).toBeLessThanOrEqual(client);
});
