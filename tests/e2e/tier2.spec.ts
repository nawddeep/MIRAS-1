import { expect, test } from "@playwright/test";

const TRAIL = "/trails/sample-lake-palace";

test("trail page lists stops in order with visit durations", async ({ page }) => {
  await page.goto(TRAIL);
  const stops = page.getByTestId("trail-stops").locator("li");
  await expect(stops).toHaveCount(3);
  await expect(stops.nth(0)).toContainText("City Palace");
  await expect(stops.nth(1)).toContainText("Pichhola");
  await expect(stops.nth(2)).toContainText("Sajjangarh");
  await expect(stops.nth(0)).toContainText("60 min");
});

test("audio walk plays chapters without location permission", async ({ page }) => {
  await page.goto(`${TRAIL}/walk`);
  const chapter = page.getByTestId("walk-chapter");
  await expect(chapter).toContainText("Stop 1 of 3");
  await expect(chapter.getByText("Synthetic voice")).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(chapter).toContainText("Stop 2 of 3");
  await expect(chapter).toContainText("Pichhola");
  await page.getByRole("button", { name: "Previous" }).click();
  await expect(chapter).toContainText("Stop 1 of 3");
  await expect(page.getByRole("checkbox", { name: /Help me find/ })).not.toBeChecked();
});

test("audio walk handles a denied location and keeps manual navigation", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.geolocation.watchPosition = (_ok, err) => {
      setTimeout(() => err?.({ code: 1, message: "denied", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError), 50);
      return 1;
    };
  });
  await page.goto(`${TRAIL}/walk`);
  await page.getByRole("checkbox", { name: /Help me find/ }).check();
  await expect(page.getByRole("status")).toContainText("Location is blocked");
  await expect(page.getByRole("checkbox", { name: /Help me find/ })).not.toBeChecked();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByTestId("walk-chapter")).toContainText("Stop 2 of 3");
});

test("passport: reading a visible story earns that place's stamp on the device", async ({ page }) => {
  await page.goto("/passport");
  await expect(page.getByTestId("passport").locator("li")).toHaveCount(5);
  await expect(page.getByText("not location-verified")).toBeVisible();
  await expect(page.locator("[data-stamped=true]")).toHaveCount(0);

  await page.goto("/places/pichhola");
  await page.getByRole("button", { name: "Mark as read" }).first().click();
  await expect(page.getByRole("button", { name: "Passport stamp saved" }).first()).toBeVisible();

  await page.goto("/passport");
  await expect(page.locator("[data-stamped=true]")).toHaveCount(1);
  await expect(page.locator("[data-stamped=true]")).toContainText("Pichhola");
});

test("save for offline: a saved place and plan open without a connection", async ({ page, context }) => {
  await page.goto("/plan");
  await page.getByRole("checkbox", { name: /City Palace/ }).check();

  await page.goto("/places/city-palace");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.getByRole("button", { name: "Save for offline" }).click();
  await expect(page.getByTestId("save-offline")).toContainText("Offline copy saved on");

  await context.setOffline(true);
  await page.goto("/offline");
  const view = page.getByTestId("offline-view");
  await expect(view).toContainText("Your plan");
  await expect(view).toContainText("City Palace");
  await expect(view).toContainText("Offline copy saved on");
  await expect(view).toContainText("History");

  // Any other page falls back to the offline page instead of a stale copy.
  await page.goto("/places/sajjangarh");
  await expect(page.getByRole("heading", { name: "Offline copies" })).toBeVisible();
  await context.setOffline(false);
});

for (const path of ["/trails", TRAIL, `${TRAIL}/walk`, "/passport", "/offline"]) {
  test(`no horizontal scroll at 360px: ${path}`, async ({ page }) => {
    await page.goto(path);
    const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    expect(scroll).toBeLessThanOrEqual(client);
  });
}
