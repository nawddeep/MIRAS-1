import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const browser = await chromium.launch({headless:true});
const report=[];
const screens=[['dawn','/?hour=7&nosplash'],['golden','/?hour=17&nosplash'],['night','/?hour=22&nosplash'],['explore','/places'],['place','/places/city-palace'],['stories','/stories'],['story','/stories/city-palace-sample-1'],['artisan','/artisans/sample-artisan-1'],['camera','/camera']];
for (const width of [390,393]) {
 const context=await browser.newContext({viewport:{width,height:width===390?844:852},deviceScaleFactor:1});
 const page=await context.newPage();
 for(const [name,path] of screens){
  await page.goto('http://localhost:3200'+path);await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(650);
  await fs.mkdir(`docs/pichhola/${width}`,{recursive:true});
  await page.screenshot({path:`docs/pichhola/${width}/${name}.png`});
  const info=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,broken:[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src)}));
  report.push({width,name,...info});
 }
 await page.goto('http://localhost:3200/camera');await page.getByRole('button',{name:'Jagdish Temple',exact:true}).click();await page.getByTestId('camera-match').waitFor();await page.getByTestId('camera-match').scrollIntoViewIfNeeded();await page.screenshot({path:`docs/pichhola/${width}/result.png`});
 await page.goto('http://localhost:3200/?splash&hour=7');await page.getByTestId('splash').waitFor();await page.waitForTimeout(650);await page.screenshot({path:`docs/pichhola/${width}/splash.png`});
 await context.close();
}
console.log(JSON.stringify(report,null,2));await browser.close();
