import { expect, test } from "@playwright/test";

test.describe("voice onboarding with a (fake) microphone", () => {
  test.use({ permissions: ["microphone"] });

  test("creates a draft without typing, highlights uncertain fields, and does not publish", async ({ page }) => {
    await page.goto("/onboard");
    await page.getByRole("button", { name: /Start recording/ }).click();
    await page.waitForTimeout(2500);
    await page.getByRole("button", { name: /Stop/ }).click();
    await expect(page.getByText("Recording ready")).toBeVisible();
    await page.getByRole("button", { name: "Make my draft" }).click();

    const review = page.getByTestId("onboard-review");
    await expect(review).toBeVisible();
    await expect(review.getByText("Demo response", { exact: true })).toBeVisible();
    await expect(page.locator("[data-uncertain]")).toHaveCount(2);
    await expect(page.locator("#craft")).not.toHaveValue("");
    // Publish stays disabled until consent is ticked.
    await expect(page.getByRole("button", { name: "Publish" })).toBeDisabled();

    await page.fill("#name", "E2E Owner");
    await page.fill("#languages", "Hindi");
    await page.fill("#contact", "e2e@example.invalid");
    await page.fill("#locationText", "Test area");
    await page.getByRole("button", { name: "Save as draft" }).click();
    await expect(page.getByTestId("onboard-done")).toContainText("saved as a draft");
  });
});

test("no microphone permission shows a clear message and the typed form still works", async ({ page }) => {
  // Same error a real browser raises when the user taps "Block".
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("Permission denied", "NotAllowedError"));
  });
  await page.goto("/onboard");
  await page.getByRole("button", { name: /Start recording/ }).click();
  await expect(page.locator("main [role=alert]")).toContainText("The microphone is blocked");

  await page.getByRole("button", { name: /Type instead/ }).click();
  await page.fill("#name", "Typed Owner");
  await page.fill("#craft", "Typed craft");
  await page.fill("#description", "Typed description");
  await page.fill("#languages", "Hindi, English");
  await page.fill("#contact", "typed@example.invalid");
  await page.fill("#locationText", "Typed area");
  await page.getByRole("checkbox", { name: /I agree/ }).check();
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByTestId("onboard-done")).toContainText("published");
});

test.describe("slow network", () => {
  test.use({ permissions: ["microphone"] });

  test("a stalled upload times out with a usable message and keeps the recording", async ({ page }) => {
    await page.route("**/api/onboard/draft", async (route) => {
      await new Promise((r) => setTimeout(r, 6000));
      await route.abort().catch(() => {});
    });
    await page.goto("/onboard");
    await page.getByRole("button", { name: /Start recording/ }).click();
    await page.waitForTimeout(2000);
    await page.getByRole("button", { name: /Stop/ }).click();
    await page.getByRole("button", { name: "Make my draft" }).click();
    await expect(page.locator("main [role=alert]")).toContainText("Slow connection", { timeout: 10_000 });
    await expect(page.getByText("Recording ready")).toBeVisible();
    await expect(page.getByRole("button", { name: /Type instead/ })).toBeVisible();
  });
});
