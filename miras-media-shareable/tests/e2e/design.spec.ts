import { expect, test, type Page } from "@playwright/test";
import { png } from "./png";

// "Pichhola Hours" design checks. The splash never shows in automated browsers, and ?nosplash is added anyway.
const SCREENS: [string, string][] = [
  ["home", "/?nosplash"],
  ["explore", "/places"],
  ["place", "/places/pichhola"],
  ["stories", "/stories"],
  ["story", "/stories/city-palace-sample-1"],
  ["artisan", "/artisans/sample-artisan-1"],
  ["camera", "/camera"],
  ["onboard", "/onboard"],
];

async function noHorizontalScroll(page: Page) {
  const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(scroll, `${scroll}px wide in a ${client}px viewport`).toBeLessThanOrEqual(client);
}

for (const [name, path] of SCREENS) {
  test(`no horizontal scroll at 360px: ${name}`, async ({ page }) => {
    await page.goto(path);
    await noHorizontalScroll(page);
  });
}

test("time of day: ?hour=7, 17 and 22 give dawn, golden and night", async ({ page }) => {
  for (const [hour, mode] of [
    ["7", "dawn"],
    ["17", "golden"],
    ["22", "night"],
  ]) {
    await page.goto(`/?nosplash&hour=${hour}`);
    await expect(page.getByTestId("home-shell")).toHaveAttribute("data-time", mode);
  }
});

test("truthfulness: no prices, ratings, review counts or 'verified artisan' on key screens", async ({ page }) => {
  for (const path of ["/?nosplash", "/places/pichhola", "/stories/city-palace-sample-1", "/artisans/sample-artisan-1"]) {
    await page.goto(path);
    const text = await page.locator("body").innerText();
    expect(text, path).not.toContain("₹");
    expect(text, path).not.toMatch(/★|\b\d\.\d\s*\(\d/);
    expect(text, path).not.toMatch(/\(\d+(\.\d+)?k\)|\d+\s+reviews?/i);
    expect(text, path).not.toMatch(/verified artisan/i);
  }
});

test("a sample story shows 'Sample content' and never 'Verified source'", async ({ page }) => {
  await page.goto("/stories/city-palace-sample-1");
  const story = page.getByTestId("story");
  await expect(story.getByText("Sample content").first()).toBeVisible();
  await expect(story.getByText("Verified source")).toHaveCount(0);
  await expect(story.getByText("Not yet verified")).toBeVisible();
});

test("camera: a low-confidence result renders I don't know", async ({ page }) => {
  await page.route("**/api/camera/match", (r) => r.fulfill({ json: { known: false, demo: false, reason: "low_confidence" } }));
  await page.goto("/camera");
  await page.locator("input[type=file]:not([capture])").setInputFiles({ name: "x.png", mimeType: "image/png", buffer: png(64, 64, [200, 180, 160]) });
  await expect(page.getByTestId("i-dont-know")).toContainText("I don't know this one yet");
});

test("camera: the result sheet labels uncalibrated suggestions without a confidence score", async ({ page }) => {
  await page.route("**/api/camera/match", (r) =>
    r.fulfill({ json: { known: true, demo: false, confidence: 0.97, place: { id: "pichhola", slug: "pichhola", name: "Pichhola", name_hi: "पिछोला" }, stories: [] } }),
  );
  await page.goto("/camera");
  await page.locator("input[type=file]:not([capture])").setInputFiles({ name: "x.png", mimeType: "image/png", buffer: png(64, 64, [200, 180, 160]) });
  const sheet = page.getByTestId("camera-match");
  await expect(sheet).toContainText("Suggested match");
  await expect(sheet).toContainText("Not yet verified");
  await expect(sheet).not.toContainText("Match confidence");
  expect(await sheet.innerText()).not.toMatch(/\d\s*%|0\.97/);
});

test.describe("screenshots for the team", () => {
  for (const width of [360, 390]) {
    test(`save screens at ${width}px into docs/ui`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      const shots: [string, string][] = [...SCREENS, ["home-golden", "/?nosplash&hour=17"], ["home-night", "/?nosplash&hour=22"]];
      for (const [name, path] of shots) {
        await page.goto(path);
        await page.waitForTimeout(400);
        await page.screenshot({ path: `docs/ui/${width}/${name}.png`, fullPage: true });
      }
    });
  }
});
