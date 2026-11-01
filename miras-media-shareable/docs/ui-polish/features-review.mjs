import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const browser = await chromium.launch();
try {
 const page = await browser.newPage();
 const checks=[];
 for(const width of [390,1440,360]) {
  await page.setViewportSize({width,height:width===1440?900:844});
  for(const route of ['discover','discover/community','discover/badges','discover/hotels','discover/locals','discover/rentals','discover/hidden','discover/account','profile','?hour=7&nosplash']) {
   const response=await page.goto(`http://127.0.0.1:3210/${route}`);
   assert.equal(response.status(),200,route);
   await page.waitForTimeout(450);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow: ${route} ${width}`);
   if(width!==360) await page.screenshot({path:`docs/ui-polish/feature-${route.replaceAll('/','-').replaceAll('?','').replaceAll('&','-').replaceAll('=','-')}-${width}.png`,fullPage:true});
  }
  checks.push(`${width}px: all frontend routes respond 200 without horizontal overflow`);
 }
 await page.setViewportSize({width:390,height:844});
 await page.goto('http://127.0.0.1:3210/discover/community');
 await page.getByRole('button',{name:'♡ Like',exact:true}).click();
 await page.getByRole('button',{name:'♥ Liked · 1',exact:true}).waitFor();
 await page.getByRole('button',{name:'Follow',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'Following',exact:true}).getAttribute('aria-pressed'),'true');
 await page.getByLabel('Try a comment').fill('Love this lakeside morning!');
 await page.getByRole('button',{name:'Post',exact:true}).click();
 await page.getByText('Love this lakeside morning!',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Suggestions',exact:true}).click();
 await page.getByRole('heading',{name:'Leave time for the lakeside'}).waitFor();
 await page.getByRole('button',{name:'Share',exact:true}).click();
 await page.getByRole('status').waitFor();
 await page.screenshot({path:'docs/ui-polish/community-interactions.png',fullPage:true});
 await page.reload();
 await page.getByRole('button',{name:'♡ Like',exact:true}).waitFor();
 assert.equal(await page.locator('.preview-comments li').count(),0);
 await page.goto('http://127.0.0.1:3210/discover/account');
 await page.getByRole('button',{name:'Public',exact:true}).click();
 await page.getByText('Public preview: future posts would be visible to everyone.').waitFor();
 await page.goto('http://127.0.0.1:3210/discover/rentals');
 await page.getByRole('button',{name:'Car',exact:true}).click();
 await page.getByLabel('City or neighbourhood').fill('Fateh Sagar, Udaipur');
 const href=await page.getByRole('link',{name:'Search Google Maps'}).getAttribute('href');
 assert.equal(new URL(href).searchParams.get('query'),'car rental shops in Fateh Sagar, Udaipur');
 await page.goto('http://127.0.0.1:3210/discover/hotels');
 await page.getByLabel('City or neighbourhood').fill('Lake Pichhola');
 assert.equal(new URL(await page.getByRole('link',{name:'Search Google Maps'}).getAttribute('href')).searchParams.get('query'),'hotels in Lake Pichhola');
 assert.equal((await page.goto('http://127.0.0.1:3210/discover/does-not-exist')).status(),404);
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('http://127.0.0.1:3210/discover/community');
 await page.keyboard.press('Tab');
 assert.equal(await page.evaluate(()=>getComputedStyle(document.activeElement).outlineStyle),'solid');
 checks.push('Likes, follows, comments, tabs, share feedback and ephemeral reset pass; privacy preview changes; maps query encoding matches user input; unknown route returns 404; keyboard focus visible.');
 fs.writeFileSync('docs/ui-polish/feature-checks.json',JSON.stringify(checks,null,2));
 console.log(checks.join('\n'));
} finally {await browser.close();}
