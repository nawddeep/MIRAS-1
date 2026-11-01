import { expect, test } from "@playwright/test";
import { png } from "./png";

const photos = [
  { name: "a.png", mimeType: "image/png", buffer: png(64, 48, [200, 160, 120]) },
  { name: "b.png", mimeType: "image/png", buffer: png(64, 48, [120, 160, 200]) },
];

test("place page shows 'Not yet verified' for unverified accessibility", async ({ page }) => {
  await page.goto("/places/pichhola");
  const info = page.getByTestId("responsible-info");
  await expect(info).toContainText("Accessibility");
  await expect(info).toContainText("Not yet verified");
  await expect(info).not.toContainText("Step-free access");
});

test("trip planner refuses sample places with 'Needs real coordinates'", async ({ page }) => {
  await page.goto("/plan");
  await page.getByRole("checkbox", { name: /Pichhola/ }).check();
  await page.getByRole("button", { name: "Make my plan" }).click();
  const problems = page.getByTestId("plan-problems");
  await expect(problems).toContainText("Needs real coordinates");
  await expect(problems).toContainText("Missing opening times");
  // The choice is kept on the device.
  await page.reload();
  await expect(page.getByRole("checkbox", { name: /Pichhola/ })).toBeChecked();
});

test("memories with the mock provider: reel, save on device, delete", async ({ page }) => {
  await page.goto("/memories");
  await page.getByLabel("Photos or clips").setInputFiles(photos);
  await page.getByLabel("Place for moment 1").selectOption({ label: "Pichhola" });
  await page.getByRole("button", { name: "Make my reel" }).click();

  const moments = page.getByTestId("moment");
  await expect(moments).toHaveCount(2);
  await expect(page.getByTestId("moments").getByText("Demo response", { exact: true })).toBeVisible();
  await expect(moments.first()).toContainText("(from your file)");
  // Pichhola's visible (sample) story is attached with its source-type label.
  await expect(moments.first()).toContainText("History");

  await page.getByRole("button", { name: "Play reel" }).click();
  await expect(page.getByTestId("reel")).toContainText("not an exported video");
  await expect(page.getByTestId("reel")).toContainText("Synthetic voice");
  await page.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: "Save on this device" }).click();
  const saved = page.getByTestId("saved-memories").locator("li");
  await expect(saved).toHaveCount(1);
  await saved.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Nothing saved yet.")).toBeVisible();
});

test("memories: a moment with a face must be cut, blurred or kept before playing", async ({ page }) => {
  await page.route("**/api/memories/moments", (route) =>
    route.fulfill({
      json: {
        ok: true,
        demo: true,
        moments: [
          { frameIndex: 0, caption: "Demo response: a person by the water", faceVisible: true, uncertain: true, placeId: null, placeFrom: null, story: null },
          { frameIndex: 1, caption: "Demo response: evening light", faceVisible: false, uncertain: true, placeId: null, placeFrom: null, story: null },
        ],
      },
    }),
  );
  await page.goto("/memories");
  await page.getByLabel("Photos or clips").setInputFiles(photos);
  await page.getByRole("button", { name: "Make my reel" }).click();

  const choice = page.getByTestId("face-choice");
  await expect(choice).toContainText("Blurring covers the whole frame, not just the face.");
  await expect(page.getByRole("button", { name: "Play reel" })).toBeDisabled();

  await choice.getByRole("button", { name: "Cut this moment" }).click();
  await expect(page.getByRole("button", { name: "Play reel" })).toBeEnabled();
  await page.getByRole("button", { name: "Play reel" }).click();
  await expect(page.getByTestId("reel")).toContainText("Moment 1 of 1");
  await expect(page.getByTestId("reel")).toContainText("evening light");
});

test("memories: invalid model output shows a message and no moments", async ({ page }) => {
  await page.route("**/api/memories/moments", (route) => route.fulfill({ json: { ok: false, demo: false, reason: "invalid_model_output" } }));
  await page.goto("/memories");
  await page.getByLabel("Photos or clips").setInputFiles(photos.slice(0, 1));
  await page.getByRole("button", { name: "Make my reel" }).click();
  await expect(page.locator("main [role=alert]")).toContainText("could not check");
  await expect(page.getByTestId("moment")).toHaveCount(0);
});

for (const path of ["/plan", "/memories"]) {
  test(`no horizontal scroll at 360px: ${path}`, async ({ page }) => {
    await page.goto(path);
    const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    expect(scroll).toBeLessThanOrEqual(client);
  });
}
