const base=process.env.TEST_BASE_URL||"http://127.0.0.1:4173";
import {launchChromium} from './helpers/browser.mjs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {readdir} from 'node:fs/promises';
const b=await launchChromium({headless:true});
async function ctx(){const c=await b.newContext({viewport:{width:1280,height:900}});await c.addInitScript(()=>{Element.prototype.requestPointerLock=()=>{};Element.prototype.setPointerCapture=()=>{};Element.prototype.releasePointerCapture=()=>{};});return c;}
async function waitForRequests(requests,count){for(let i=0;i<100;i++){if(requests.length>=count)return;await new Promise(resolve=>setTimeout(resolve,25));}assert.fail(`expected ${count} intercepted request(s), received ${requests.length}`);}
try{
 const c=await ctx(),p=await c.newPage();let hold,requests=[];
 await p.route('**/de/',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replace('"live":false','"live":true')});});
 await p.route('**/api/trial-requests',r=>{requests.push(r.request().postDataJSON());hold=r;});
 await p.goto(base+'/de/');
 await p.locator('#name').fill('Test');await p.locator('#phone').fill('+491511234567');await p.locator('#age').fill('18');await p.locator('#consent').check();
 await p.locator('#submit-trial').click();assert.equal(await p.locator('#submit-trial').isDisabled(),true);
 await p.locator('.site-header [data-locale="ru"]').click();await p.waitForFunction(()=>document.documentElement.lang==='ru');assert.equal(await p.locator('#submit-trial').isDisabled(),true);assert.equal(requests.length,1);
 await hold.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,code:'delivered'})});await p.waitForFunction(()=>document.querySelector('#form-status').textContent.includes('успешно'));assert.equal(await p.locator('#name').inputValue(),'Test');
 // Explicitly mocked UI outcomes; no Telegram traffic is sent.
 await p.goto(base+'/de/');await p.locator('#name').fill('Test');await p.locator('#phone').fill('+491511234567');await p.locator('#age').fill('18');await p.locator('#consent').check();await p.locator('#submit-trial').click();await waitForRequests(requests,2);
 // Wait for each intercepted browser request before resolving it; this avoids a race with navigation.
 await hold.fulfill({status:409,contentType:'application/json',body:JSON.stringify({ok:false,code:'uncertain'})});await p.waitForFunction(()=>!document.querySelector('#submit-trial').disabled);const first=requests.at(-1);await p.locator('#submit-trial').click();await waitForRequests(requests,3);assert.equal(requests.at(-1).requestId,first.requestId);await hold.fulfill({status:502,contentType:'application/json',body:JSON.stringify({ok:false,code:'delivery_failed'})});await p.waitForFunction(()=>document.querySelector('#form-status').getAttribute('role')==='alert');assert.equal(await p.locator('#name').inputValue(),'Test');await c.close();
 const standalone=(await readdir('dist')).find(name=>/^ak-loewen-valset-.*\.html$/.test(name));assert.ok(standalone,'standalone build artifact exists');
 const f=await ctx(),fp=await f.newPage(),errors=[];fp.on('pageerror',e=>errors.push(e.message));await fp.goto(pathToFileURL(path.resolve('dist',standalone)).href);await fp.locator('.site-header [data-locale="uk"]').click();await fp.waitForFunction(()=>document.documentElement.lang==='uk');assert.deepEqual(await fp.locator('img').evaluateAll(xs=>xs.filter(x=>!x.src.startsWith('data:image/')).map(x=>x.src.slice(0,100))),[]);await fp.locator('footer a[href="/uk/datenschutz/"]').click();assert.equal(await fp.locator('.legal-dialog').isVisible(),true);await fp.keyboard.press('Escape');await fp.locator('.legal-dialog').waitFor({state:'detached'});assert.equal(await fp.locator('.legal-dialog').count(),0);assert.deepEqual(errors,[]);await f.close();
 const bad=await fetch(base+'/api/trial-requests',{method:'POST',headers:{'content-type':'application/json'},body:'x'.repeat(9000)});assert.equal(bad.status,413);
 const origin=await fetch(base+'/api/trial-requests',{method:'POST',headers:{'content-type':'application/json',origin:'https://example.org'},body:'{}'});assert.equal(origin.status,403);
 console.log('PASS: mocked success, pending language switch, uncertainty retry, error data retention, standalone locales/assets/legal dialogs, HTTP size/origin guards. No real delivery attempted.');
}finally{await b.close();}
