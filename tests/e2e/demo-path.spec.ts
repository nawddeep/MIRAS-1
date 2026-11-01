import { expect, test, type Page } from "@playwright/test";

// The server for these tests is started with no .env values (see playwright.config.ts).

async function expectNoHorizontalScroll(page: Page) {
  const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(scroll, `page is ${scroll}px wide in a ${client}px viewport`).toBeLessThanOrEqual(client);
}

for (const path of ["/", "/places/pichhola", "/places/sajjangarh", "/artisans", "/artisans/sample-artisan-1", "/search?q=sample", "/camera", "/onboard", "/admin"]) {
  test(`no horizontal scroll at 360px: ${path}`, async ({ page }) => {
    await page.goto(path);
    expect(page.viewportSize()?.width).toBe(360);
    await expectNoHorizontalScroll(page);
  });
}

test("demo path: home → place → 360 preview → story → artisan → enquiry", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Pichhola", exact: true }).click();
  await expect(page).toHaveURL(/\/places\/pichhola/);

  // 360 preview loads only on tap and keeps its Illustrative label.
  const pano = page.getByTestId("pano360");
  await expect(pano.getByText("Illustrative")).toBeVisible();
  await pano.getByRole("button", { name: /360/ }).click();
  await expect(pano.locator("canvas")).toBeVisible({ timeout: 15_000 });

  // Stories carry a source-type label and a Sample badge; unchecked simple text is not offered.
  const stories = page.getByTestId("story");
  await expect(stories).toHaveCount(3);
  for (const label of ["History", "Oral tradition", "Legend"]) await expect(page.locator("article").getByText(label, { exact: true })).toBeVisible();
  await expect(stories.first().getByText("Sample content")).toBeVisible();
  await expect(page.getByRole("button", { name: "Simple version" })).toHaveCount(0);

  await page.getByRole("link", { name: /Rajasthan Miniature Painting/ }).click();
  await expect(page).toHaveURL(/\/artisans\/sample-artisan-1/);
  await page.fill("#message", `Demo path enquiry ${Date.now()}`);
  await page.fill("#contactBack", "visitor@example.invalid");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("status")).toContainText("Sent");
});

test("enquiry validation: empty and repeated messages", async ({ page }) => {
  await page.goto("/artisans/sample-artisan-2");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Please write a message.")).toBeVisible();

  const msg = `Repeat check ${Date.now()}`;
  const send = () =>
    page.request.post("/api/enquiries", {
      data: { artisanId: "sample-artisan-2", kind: "question", message: msg, contactBack: "v@example.invalid" },
      headers: { "x-forwarded-for": "203.0.113.7" },
    });
  expect((await send()).status()).toBe(201);
  expect((await send()).status()).toBe(429);
});

test("weak network: the demo path still loads on a slow connection", async ({ page, context }) => {
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  // Roughly "slow 3G": 400 ms latency, ~50 KB/s.
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 400, downloadThroughput: 50 * 1024, uploadThroughput: 25 * 1024 });
  await page.goto("/", { timeout: 25_000 });
  await page.getByRole("link", { name: /City Palace/ }).first().click();
  await expect(page.getByTestId("story").first()).toBeVisible({ timeout: 25_000 });
});

test("offline: sending an enquiry shows a clear message and keeps the text", async ({ page, context }) => {
  await page.goto("/artisans/sample-artisan-3");
  await page.fill("#message", "Written while offline");
  await page.fill("#contactBack", "v@example.invalid");
  await context.setOffline(true);
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.locator("main [role=alert]")).toContainText("No connection");
  await expect(page.locator("#message")).toHaveValue("Written while offline");
  await context.setOffline(false);
});

test("runs with no .env: admin says AI is not configured and nothing breaks", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByText("AI not configured")).toBeVisible();
  await expect(page.getByText("0 error(s)")).toBeVisible();
});

test("language switch shows Hindi UI strings", async ({ page }) => {
  await page.goto("/places/pichhola");
  await page.getByRole("button", { name: "हिं" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "पिछोला" })).toBeVisible();
  await expect(page.getByText("नमूना सामग्री").first()).toBeVisible();
  await page.getByRole("button", { name: "EN" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Pichhola" })).toBeVisible();
});
