import {chromium} from '@playwright/test';
import {readFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
const mapping=JSON.parse(readFileSync('content/spot-images.json','utf8'));
const media=JSON.parse(readFileSync('content/media.json','utf8'));
for(const photo of Object.values(mapping.photos)){assert(existsSync('public'+photo.src),photo.src);assert(media.some(asset=>asset.path===photo.src));}
const b=await chromium.launch();const p=await b.newPage({viewport:{width:390,height:844}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
const base=process.env.MIRAS_TEST_URL||'http://localhost:3000';
try{
 for(const photo of Object.values(mapping.photos)){assert.equal((await p.request.get(base+photo.src)).status(),200,photo.src);}
 for(const width of [390,1440,360]){await p.setViewportSize({width,height:width===1440?900:844});for(const route of ['/discover/hidden','/discover/hotels','/discover/rentals','/discover/locals','/account']){await p.goto(base+route);await p.waitForTimeout(300);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),route+width);if(width!==360)await p.screenshot({path:`docs/spot-images/${route.slice(1).replaceAll('/','-')}-${width}.png`,animations:'disabled'});}}
 await p.setViewportSize({width:390,height:844});await p.goto(base+'/discover/hidden');const section=p.getByRole('region',{name:'More places to discover'});await section.scrollIntoViewIfNeeded();await p.waitForTimeout(400);assert.equal(await section.locator('.spot-photo img').count(),20);await section.getByLabel('Search places',{exact:true}).fill('Ambrai Ghat');await section.getByText('1 matching places',{exact:true}).waitFor();await section.locator('.spot-photo img').first().scrollIntoViewIfNeeded();await p.waitForFunction(()=>[...document.querySelectorAll('.imported-spot img')].every(img=>img.complete&&img.naturalWidth>0));assert.equal(await section.locator('.spot-photo-kind').count(),0);await section.getByText('Photo credit',{exact:true}).click();await section.getByRole('link',{name:'Original photograph'}).waitFor();await section.screenshot({path:'docs/spot-images/ambrai-credit-390.png',animations:'disabled'});
 await section.getByLabel('Search places',{exact:true}).fill('Jamming');await section.getByText('1 matching places',{exact:true}).waitFor();await section.getByText('Category scenery',{exact:true}).waitFor();assert.match(await section.locator('.spot-photo img').getAttribute('alt'),/not a photo of/);
 await section.getByLabel('Search places',{exact:true}).fill('Company');await section.getByText('0 matching places',{exact:true}).waitFor();
 await section.getByRole('button',{name:'Clear filters'}).click();await section.getByText('201 matching places',{exact:true}).waitFor();await section.getByRole('button',{name:'Next',exact:true}).click();await section.getByText('Page 2 of 11',{exact:true}).waitFor();
 assert.equal(errors.length,0,errors.join('\n'));console.log('PASS: all mapped local photos return 200 with rights entries; real/fallback distinctions and credits; scrape-noise removal; search/pagination; five screens at 360/390/1440 without overflow or page errors.');
}finally{await b.close();}
