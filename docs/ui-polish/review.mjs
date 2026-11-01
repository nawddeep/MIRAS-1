import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
(async () => {
 const browser = await chromium.launch();
 const page = await browser.newPage();
 const observations = [];
 for (const [width,height] of [[390,844],[1440,900],[360,800]]) {
  await page.setViewportSize({width,height});
  await page.goto('http://localhost:3000/?hour=7&nosplash');
  await page.waitForTimeout(900);
  await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.locator('.hours-feature-card').evaluate(e=>Math.round(e.getBoundingClientRect().height)),228);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:`docs/ui-polish/home-${width}.png`,fullPage:true});
  observations.push(`${width}x${height}: no page overflow, feature frame 228px`);
  assert.equal(await page.locator('.hours-shortcuts small').first().evaluate(e=>getComputedStyle(e).fontSize),'16px');
 }
 for (const width of [390,1440]) {
  await page.setViewportSize({width,height:900});
  for (const route of ['places','stories','profile']) {
   await page.goto(`http://localhost:3000/${route}`);
   await page.waitForTimeout(700);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.screenshot({path:`docs/ui-polish/${route}-${width}.png`,fullPage:true});
  }
 }
 await page.setViewportSize({width:390,height:844});
 await page.goto('http://localhost:3000/?hour=22&nosplash');
 await page.waitForTimeout(800);
 await page.getByRole('button',{name:'Notifications'}).click();
 await page.getByRole('status').waitFor();
 await page.screenshot({path:'docs/ui-polish/night.png',fullPage:true});
 await page.goto('http://localhost:3000/places/city-palace');
 await page.getByRole('button',{name:'Show image 2',exact:true}).first().click();
 await page.waitForTimeout(500);
 assert.equal(await page.getByRole('button',{name:'Show image 2',exact:true}).first().getAttribute('aria-pressed'),'true');
 await page.getByRole('button',{name:'Bookmark place',exact:true}).click();
 await page.getByRole('button',{name:'Remove bookmark',exact:true}).waitFor();
 await page.screenshot({path:'docs/ui-polish/gallery-saved.png',fullPage:true});
 await page.goto('http://localhost:3000/profile');
 await page.getByRole('link',{name:/City Palace/}).waitFor();
 await page.screenshot({path:'docs/ui-polish/collection-success.png',fullPage:true});
 await page.evaluate(()=>{localStorage.clear();});
 await page.reload();
 await page.getByText('A little Udaipur, kept for later.').waitFor();
 await page.screenshot({path:'docs/ui-polish/collection-empty.png',fullPage:true});
 await page.goto('http://localhost:3000/places/city-palace');
 await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw new Error('Storage denied')};});
 await page.getByRole('button',{name:'Bookmark place',exact:true}).click();
 await page.getByText('Device storage is unavailable.').waitFor();
 await page.screenshot({path:'docs/ui-polish/storage-error.png',fullPage:true});
 await page.route('**/media/**',async route=>{if(route.request().resourceType()==='image') {await new Promise(r=>setTimeout(r,1500)); await route.abort();} else await route.continue();});
 await page.goto('http://localhost:3000/places/city-palace',{waitUntil:'domcontentloaded'});
 await page.locator('.photo-gallery').first().getByText('Loading image…').waitFor();
 await page.screenshot({path:'docs/ui-polish/gallery-loading.png'});
 await page.locator('.photo-gallery').first().getByText('This image couldn’t load. Choose another view below.').waitFor();
 await page.screenshot({path:'docs/ui-polish/gallery-partial.png'});
 await page.unroute('**/media/**');
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('http://localhost:3000/?hour=7&nosplash');
 await page.waitForTimeout(300);
 assert.equal(await page.locator('.hours-feature').evaluate(e=>getComputedStyle(e).animationName),'none');
 assert.equal(await page.locator('html').evaluate(e=>getComputedStyle(e).scrollBehavior),'auto');
 await page.keyboard.press('Tab');
 const focus = await page.evaluate(()=>({tag:document.activeElement.tagName,outline:getComputedStyle(document.activeElement).outlineStyle}));
 assert.equal(focus.outline,'solid');
 await page.screenshot({path:'docs/ui-polish/reduced-motion-focus.png',fullPage:true});
 fs.writeFileSync('docs/ui-polish/checks.json',JSON.stringify({observations,focus,reducedMotion:'pass',gallery:'pass',bookmark:'pass',storageError:'pass'},null,2));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
