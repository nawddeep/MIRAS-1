import { expect, test } from "@playwright/test";

// What a phone shows when the page is opened over plain http: the browser has no navigator.mediaDevices at all,
// so the camera and microphone cannot start. The visitor must still get a clear message and a way forward.
const removeMediaDevices = () => Object.defineProperty(navigator, "mediaDevices", { value: undefined, configurable: true });

test("camera without mediaDevices: clear message, manual place picker, photo upload still offered", async ({ page }) => {
  await page.addInitScript(removeMediaDevices);
  await page.goto("/camera");
  await page.getByRole("button", { name: "Open camera" }).click();

  await expect(page.locator("main [role=alert]")).toContainText("This browser cannot open the camera here");
  await expect(page.getByText("Pick the place you are at instead:")).toBeVisible();
  await expect(page.getByRole("link", { name: "Pichhola" })).toBeVisible();
  await expect(page.locator("input[type=file]:not([capture])")).toHaveCount(1);
});

test("camera on a page that is not https: the message says it needs a secure connection", async ({ page }) => {
  await page.addInitScript(removeMediaDevices);
  await page.addInitScript(() => Object.defineProperty(window, "isSecureContext", { value: false, configurable: true }));
  await page.goto("/camera");
  await page.getByRole("button", { name: "Open camera" }).click();
  await expect(page.locator("main [role=alert]")).toContainText("needs a secure (https) connection");
});

test("voice onboarding without mediaDevices: clear message, and the typed form still works", async ({ page }) => {
  await page.addInitScript(removeMediaDevices);
  await page.goto("/onboard");
  await page.getByRole("button", { name: /Start recording/ }).click();
  await expect(page.locator("main [role=alert]")).toContainText("cannot record audio here");

  await page.getByRole("button", { name: /Type instead/ }).click();
  await expect(page.getByTestId("onboard-review")).toBeVisible();
  await expect(page.locator("#name")).toBeVisible();
});
