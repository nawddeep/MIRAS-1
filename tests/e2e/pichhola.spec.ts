import {expect,test} from '@playwright/test';

for(const width of [390,393]) {
  test(`supplied backgrounds load without overflow at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:width===390?844:852});
    for(const path of ['/?nosplash&hour=7','/?nosplash&hour=17','/?nosplash&hour=22','/places','/places/city-palace','/stories','/stories/city-palace-sample-1','/artisans/sample-artisan-1','/camera']) {
      await page.goto(path);
      const images=page.locator('main img');
      for(let i=0;i<await images.count();i++) {
        await images.nth(i).scrollIntoViewIfNeeded();
        await expect.poll(()=>images.nth(i).evaluate((img:HTMLImageElement)=>img.complete && img.naturalWidth>0)).toBe(true);
      }
      expect(await page.evaluate(()=>document.documentElement.scrollWidth),path).toBeLessThanOrEqual(width);
    }
  });
}

test('bookmarks persist through a page reload',async({page})=>{
  await page.goto('/places');
  const bookmark=page.getByRole('button',{name:'Bookmark place'}).first();
  await bookmark.click();
  await page.reload();
  await expect(page.getByRole('button',{name:'Remove bookmark'}).first()).toHaveAttribute('aria-pressed','true');
});

test('collection search and category filters work',async({page})=>{
  await page.goto('/places');
  await page.getByRole('button',{name:'Search this collection'}).click();
  await page.getByRole('searchbox').fill('Jagdish');
  await page.getByRole('searchbox').press('Enter');
  await expect(page.getByRole('heading',{name:'Jagdish Temple',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'City Palace',exact:true})).toHaveCount(0);
  await page.goto('/places?cat=Garden');
  await expect(page.getByRole('heading',{name:'Saheliyon Ki Bari',exact:true})).toBeVisible();
});

test('home follows Udaipur time even in an American browser timezone',async({browser})=>{
  const context=await browser.newContext({timezoneId:'America/Los_Angeles'});
  const page=await context.newPage();
  await page.clock.install({time:new Date('2026-10-28T01:30:00Z')});
  await page.goto('/?nosplash');
  await expect(page.getByTestId('home-shell')).toHaveAttribute('data-time','dawn');
  await context.close();
});

test('camera denial leaves an upload path and does not claim recognition',async({page})=>{
  await page.addInitScript(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Denied','NotAllowedError');};});
  await page.goto('/camera');
  await page.getByRole('button',{name:'Open camera',exact:true}).click();
  await expect(page.getByText('Pick the place you are at instead:')).toBeVisible();
  await expect(page.locator('input[type=file]:not([capture])')).toHaveCount(1);
  await expect(page.getByTestId('camera-match')).toHaveCount(0);
});
