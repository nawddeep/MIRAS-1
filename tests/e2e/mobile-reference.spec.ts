import { expect, test } from "@playwright/test";
import { png } from "./png";

test.use({ deviceScaleFactor: 1 });

const viewports = [{ width: 390, height: 844 }, { width: 393, height: 852 }, { width: 360, height: 800 }];
const screens: [string, string][] = [
  ["02-home-dawn", "/?nosplash&hour=7"], ["03-home-golden", "/?nosplash&hour=17"],
  ["04-explore", "/places"], ["05-place", "/places/city-palace"], ["06-stories", "/stories"],
  ["07-story", "/stories/city-palace-sample-1"], ["08-camera", "/camera"],
  ["10-artisan", "/artisans/sample-artisan-1"], ["11-home-night", "/?nosplash&hour=22"], ["12-profile", "/profile"], ["13-home-neutral", "/?nosplash&hour=12"],
];

for (const viewport of viewports) {
  test(`reference screens and usable layouts at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize(viewport);
    for (const [name, path] of screens) {
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
      await expect(page.locator('main h1').first()).toBeAttached();
      if (name.includes("home")) {
        await expect(page.getByTestId("home-shell")).toHaveAttribute("data-time", path.includes("22") ? "night" : path.includes("17") ? "golden" : path.includes("12") ? "day" : "dawn");
        await expect(page.locator('.hours-shortcuts a')).toHaveCount(4);
      }
      await page.screenshot({ path: `docs/ui-review/${viewport.width}x${viewport.height}/${name}.png`, animations: "disabled" });
    }
    await page.goto('/?splash&hour=7');
    await expect(page.getByTestId('splash')).toBeVisible();
    await page.screenshot({ path: `docs/ui-review/${viewport.width}x${viewport.height}/01-splash.png`, animations: 'disabled' });
    await page.getByRole('button', { name: 'Skip intro' }).click();
    await expect(page.getByTestId('splash')).toHaveCount(0);
    await page.goto('/camera');
    await page.getByRole('button', { name: 'Jagdish Temple', exact: true }).click();
    await expect(page.getByTestId('camera-match')).toContainText('Demo response');
    await page.screenshot({ path: `docs/ui-review/${viewport.width}x${viewport.height}/09-recognition.png`, animations: 'disabled' });
  });
}

test('gallery changes the hero; place and story bookmarks appear in Profile and can be removed', async ({ page }) => {
  await page.goto('/places/city-palace');
  const gallery = page.locator('.place-hero-wrap .photo-gallery');
  const first = await gallery.locator('.gallery-hero img').getAttribute('src');
  await gallery.getByRole('button', { name: 'Show image 2' }).click();
  await expect(gallery.locator('.gallery-hero img')).not.toHaveAttribute('src', first!);
  await expect(gallery.getByRole('button', { name: 'Show image 2' })).toHaveAttribute('aria-pressed', 'true');
  await gallery.getByRole('button', { name: 'Bookmark place' }).click();
  await page.goto('/stories/city-palace-sample-1');
  await page.getByRole('button', { name: 'Bookmark story' }).click();
  await page.getByRole('navigation', { name: 'Main', exact: true }).getByRole('link', { name: 'Profile' }).click();
  const collection = page.getByRole('region', { name: 'Saved collection' });
  await expect(collection.locator('li')).toHaveCount(2);
  await page.reload();
  await expect(collection.locator('li')).toHaveCount(2);
  await collection.getByRole('button', { name: 'Remove bookmark' }).first().click();
  await expect(collection.locator('li')).toHaveCount(1);
  await collection.getByRole('button', { name: 'Remove bookmark' }).click();
  await expect(collection).toContainText('Bookmark a place or story');
});

test('place section navigation selects the section and keeps it above the bottom bar', async ({ page }) => {
  await page.goto('/places/city-palace');
  const stories = page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: 'Stories' });
  await stories.click();
  await expect(stories).toHaveAttribute('aria-current', 'location');
  await expect(page.getByTestId('story').first()).toBeVisible();
});

test('home refreshes Udaipur time at the boundary and when the application resumes', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-28T13:29:59Z') });
  await page.goto('/?nosplash');
  await expect(page.getByTestId('home-shell')).toHaveAttribute('data-time', 'golden');
  await page.clock.fastForward(2000);
  await expect(page.getByTestId('home-shell')).toHaveAttribute('data-time', 'night');
  await page.clock.setSystemTime(new Date('2026-10-29T00:30:00Z'));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.getByTestId('home-shell')).toHaveAttribute('data-time', 'dawn');
});

test('camera upload shows preview and processing, then a retryable failure', async ({ page }) => {
  let finish!: () => void;
  const ready = new Promise<void>(resolve => { finish = resolve; });
  await page.route('**/api/camera/match', async route => { await ready; await route.fulfill({ status: 503, json: { error: 'Could not check that photo. Please try again.' } }); });
  await page.goto('/camera');
  await page.locator('input[type=file]:not([capture])').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: png(64, 64, [200, 170, 150]) });
  await expect(page.getByRole('status')).toContainText('Checking your photo');
  await expect(page.getByAltText('Your selected photograph')).toBeVisible();
  finish();
  await expect(page.locator('main [role=alert]')).toContainText('Please try again');
  await expect(page.getByRole('button', { name: 'Activate camera' })).toBeEnabled();
});

test('mobile controls, reduced motion, focus, and desktop shell remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?nosplash&hour=7');
  expect(await page.locator('.hours-hero-photo').evaluate(element => getComputedStyle(element).animationName)).toBe('none');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  for (const rect of await page.getByRole('navigation', { name: 'Main', exact: true }).getByRole('link').evaluateAll(elements => elements.map(element => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })))) {
    expect(rect.width).toBeGreaterThanOrEqual(44);
    expect(rect.height).toBeGreaterThanOrEqual(44);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);
  await page.screenshot({ path: 'docs/ui-review/1440x900/home.png', animations: 'disabled' });
});

test('story categories, empty search, artisan gallery and browser back navigation work', async ({ page }) => {
  await page.goto('/stories?type=oral_tradition');
  await expect(page.getByTestId('story-card')).toHaveCount(3);
  for (const card of await page.getByTestId('story-card').all()) await expect(card).toContainText('Oral tradition');
  await page.goto('/places?q=no-such-udaipur-place');
  await expect(page.getByText('Nothing matched your search.', { exact: true })).toBeVisible();
  await page.getByRole('main').getByRole('link', { name: 'All', exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'City Palace', exact: true })).toBeVisible();
  await page.goto('/artisans/sample-artisan-1');
  const gallery = page.locator('#artwork .photo-gallery');
  await gallery.getByRole('button', { name: 'Show image 2' }).click();
  await expect(gallery.locator('.gallery-hero img')).toHaveAttribute('src', '/media/pichhola/artwork.webp');
  await page.getByRole('navigation', { name: 'Main', exact: true }).getByRole('link', { name: 'Profile' }).click();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page).toHaveURL(/\/artisans\/sample-artisan-1/);
});

test('installation is delayed and dismissed without interrupting first use', async ({ page }) => {
  await page.clock.install();
  await page.goto('/?nosplash');
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt');
    Object.assign(event, { prompt: async () => {}, userChoice: Promise.resolve({ outcome: 'dismissed' }) });
    window.dispatchEvent(event);
  });
  await expect(page.getByTestId('pwa-install-prompt')).toHaveCount(0);
  await page.clock.fastForward(60_000);
  await expect(page.getByTestId('pwa-install-prompt')).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss install prompt' }).click();
  await expect(page.getByTestId('pwa-install-prompt')).toHaveCount(0);
});
