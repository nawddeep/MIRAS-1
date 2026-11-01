import {chromium,request} from '@playwright/test';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomBytes,randomInt} from 'node:crypto';
import assert from 'node:assert/strict';
const dir=mkdtempSync(path.join(tmpdir(),'miras-prod-check-')),port=randomInt(33000,43000),base=`http://localhost:${port}`;
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','localhost','--port',String(port)],{cwd:process.cwd(),env:{...process.env,NODE_ENV:'production',MIRAS_DATA_DIR:dir,MIRAS_APP_ORIGIN:base},stdio:['ignore','pipe','pipe']});
let logs='',started=false;server.stdout.on('data',data=>{logs+=data.toString();if(/Ready/.test(logs))started=true;});server.stderr.on('data',data=>{logs+=data.toString();});
let browser,api;
try{
 for(let i=0;i<150&&!started;i++){if(server.exitCode!==null)throw new Error('Production server exited before becoming ready.');await new Promise(r=>setTimeout(r,100));}assert(started,'Production startup timed out');
 api=await request.newContext();browser=await chromium.launch();const page=await browser.newPage({viewport:{width:390,height:844}});
 for(const route of ['/account','/discover/hidden','/discover/community','/journeys']){assert.equal((await page.goto(base+route)).status(),200);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await page.goto(base+'/account');await page.screenshot({path:'docs/mvp/production-account-390.png',animations:'disabled'});
 const username=`prod_${randomBytes(4).toString('hex')}`,password=`unique-${randomBytes(16).toString('hex')}`;
 const registered=await api.post(base+'/api/account',{headers:{origin:base},data:{action:'register',username,name:'Production smoke fixture',password}});assert.equal(registered.status(),201);
 const cookie=registered.headers()['set-cookie'];assert(cookie.includes('__Host-miras_session='));assert(/; secure/i.test(cookie));assert(/; httponly/i.test(cookie));assert(/; samesite=lax/i.test(cookie));
 // Explicit Cookie header tests server authorization on local HTTP; real deployment requires HTTPS.
 const session=cookie.split(';')[0];const member=await api.get(base+'/api/account',{headers:{cookie:session}});assert.equal((await member.json()).user.username,username);assert.equal(member.headers()['cache-control'],'private, no-store');
 const rejected=await api.post(base+'/api/community',{headers:{cookie:session,origin:'https://unrelated.example'},data:{action:'like',postId:randomBytes(16).toString('hex'),liked:true}});assert.equal(rejected.status(),403);
 const removed=await api.post(base+'/api/account',{headers:{origin:base,cookie:session},data:{action:'delete',password}});assert.equal(removed.status(),200);assert.equal((await(await api.get(base+'/api/account',{headers:{cookie:session}})).json()).user,null);
 console.log('PASS: production startup, page rendering, compiled mobile CSS, account API, Secure/HttpOnly/__Host session flags, private no-store, CSRF and session revocation. Real public hosting/HTTPS is not configured.');
}finally{if(browser)await browser.close();if(api)await api.dispose();server.kill('SIGTERM');if(server.exitCode===null)await Promise.race([new Promise(r=>server.once('exit',r)),new Promise(r=>setTimeout(r,3000))]);if(server.exitCode===null)server.kill('SIGKILL');rmSync(dir,{recursive:true,force:true});}
