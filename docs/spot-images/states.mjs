import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const base=process.env.MIRAS_TEST_URL||'http://localhost:3000';
const b=await chromium.launch();const p=await b.newPage({viewport:{width:390,height:844}});
try{
 await p.route('**/media/spots/ambrai-ghat.webp',route=>route.abort());await p.goto(base+'/discover/hidden');const s=p.getByRole('region',{name:'More places to discover'});await s.getByLabel('Search places',{exact:true}).fill('Ambrai Ghat');await s.getByText('1 matching places',{exact:true}).waitFor();await s.locator('.spot-photo').scrollIntoViewIfNeeded();await s.getByRole('img',{name:'Image unavailable for Ambrai Ghat'}).waitFor();assert.equal(await s.getByRole('link',{name:'Search Google Maps'}).count(),1);await p.emulateMedia({reducedMotion:'reduce'});await p.goto(base+'/account');await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>getComputedStyle(document.activeElement).outlineStyle),'solid');console.log('Image failure recovery retains Maps and metadata; keyboard focus visible with reduced motion.');
}finally{await b.close();}
