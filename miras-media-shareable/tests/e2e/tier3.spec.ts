import { expect, test } from "@playwright/test";
import { png } from "./png";

test("events: the sample event shows in IST with its update date", async ({ page }) => {
  await page.goto("/events");
  const list = page.getByTestId("events");
  await expect(list).toContainText("SAMPLE: event title goes here");
  await expect(list).toContainText("IST");
  await expect(list).toContainText("Updated");
  await expect(list.getByText("Sample content")).toBeVisible();
});

test("hidden Udaipur: a submitted pick waits for review and is not shown", async ({ page }) => {
  await page.goto("/picks");
  const name = `E2E pick ${Date.now()}`;
  await page.fill("#pick-name", name);
  await page.fill("#pick-description", "A quiet courtyard");
  await page.fill("#pick-why", "Neighbours meet here");
  await page.getByRole("checkbox", { name: /sensitive/ }).check();
  await page.getByRole("button", { name: "Send for review" }).click();
  await expect(page.getByRole("status")).toContainText("waiting for a moderator");
  await page.reload();
  await expect(page.getByText(name)).toHaveCount(0);
});

test("moderation is disabled without ADMIN_PASSCODE", async ({ page }) => {
  await page.goto("/admin/moderation");
  await expect(page.getByRole("status")).toContainText("Moderation is disabled");
});

test("360 replay opens the visitor's own panorama on the device", async ({ page }) => {
  let uploaded = false;
  page.on("request", (r) => r.method() === "POST" && (uploaded = true));
  await page.goto("/replay");
  await page.getByLabel("Your 360 photo").setInputFiles({ name: "pano.png", mimeType: "image/png", buffer: png(256, 128, [140, 160, 200]) });
  await page.getByTestId("pano360").getByRole("button", { name: /360/ }).click();
  await expect(page.getByTestId("pano360").locator("canvas")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Not built yet")).toBeVisible();
  expect(uploaded).toBe(false);
});

test("AR story view is clearly labelled as a concept", async ({ page }) => {
  await page.goto("/concept/ar");
  await expect(page.getByTestId("ar-concept")).toContainText("Concept. Not real AR.");
  await page.getByRole("button", { name: "Open camera" }).click();
  await expect(page.getByTestId("ar-concept").locator("video")).toBeVisible();
});

test("no screen claims real AR, VR or certification", async ({ page }) => {
  for (const path of ["/", "/replay", "/concept/ar", "/places/pichhola", "/passport"]) {
    await page.goto(path);
    const text = (await page.locator("main").innerText()).replace(/Not real AR/g, "");
    expect(text, path).not.toMatch(/\b(VR|virtual reality|augmented reality|certified)\b/i);
  }
});

for (const path of ["/events", "/picks", "/admin/moderation", "/replay", "/concept/ar"]) {
  test(`no horizontal scroll at 360px: ${path}`, async ({ page }) => {
    await page.goto(path);
    const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    expect(scroll).toBeLessThanOrEqual(client);
  });
}
