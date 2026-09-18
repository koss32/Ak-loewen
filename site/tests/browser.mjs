import {launchChromium} from './helpers/browser.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import sharp from 'sharp';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:4173';
const out=process.env.TEST_OUTPUT||'test-results';await mkdir(out,{recursive:true});
const browser=await launchChromium({headless:true});
const issues=[],checks=[],shots=[];
async function context(options={}){const c=await browser.newContext(options);await c.addInitScript(()=>{Element.prototype.requestPointerLock=()=>{};Element.prototype.setPointerCapture=()=>{};Element.prototype.releasePointerCapture=()=>{};});return c;}
try{
 for(const profile of [{name:'desktop',width:1440,height:1000},{name:'phone',width:390,height:844},{name:'compact',width:360,height:640},{name:'reduced',width:1440,height:1000,reducedMotion:'reduce'}]){
  const c=await context({viewport:{width:profile.width,height:profile.height},reducedMotion:profile.reducedMotion||'no-preference'}),p=await c.newPage();
  p.on('pageerror',e=>issues.push(`${profile.name}: ${e.message}`));p.on('response',r=>{if(r.status()>=400)issues.push(`${r.status()} ${r.url()}`);});
  await p.goto(base+'/de/');await p.waitForTimeout(350);
  for(const [n,scroll] of [['hero',0],['hero-mid',350],['hero-exit',650]]){await p.evaluate(y=>scrollTo({top:y,behavior:'instant'}),scroll);await p.waitForTimeout(500);const f=`${out}/${profile.name}-${n}.png`;await p.screenshot({path:f});shots.push(f);}
  for(const id of ['kampfsport','trainer','stundenplan','preise','probetraining','kontakt','ak-loewen','valset','valset-groups']){await p.locator('#'+id).scrollIntoViewIfNeeded();await p.waitForTimeout(400);const f=`${out}/${profile.name}-${id}.png`;await p.screenshot({path:f});shots.push(f);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${profile.name} overflow ${id}`);}
  assert.deepEqual(await p.locator('img').evaluateAll(imgs=>imgs.filter(i=>!i.complete||i.naturalWidth===0).map(i=>i.src)),[]);
  await p.goto(base+'/de/#detail-sambo-mma');await p.waitForTimeout(500);assert.equal(await p.locator('#detail-sambo-mma').getAttribute('open'),'');assert.match(await p.locator('#detail-sambo-mma').innerText(),/16:30/);
  await p.locator('#detail-boxen summary').click();assert.equal(await p.locator('#detail-sambo-mma').getAttribute('open'),null);
  if(profile.width<1000){await p.locator('.menu-button').click();assert.equal(await p.locator('#mobile-menu').evaluate(d=>d.open),true);await p.keyboard.press('Escape');assert.equal(await p.locator('.menu-button').evaluate(b=>document.activeElement===b),true);}
  checks.push(profile.name+' layout, images, anchors, accordion, menu');await c.close();
 }
 const c=await context({viewport:{width:1280,height:900}}),p=await c.newPage();await p.goto(base+'/de/');
 assert.equal(await p.locator('#preise [data-direction="sambo-mma"]').getAttribute('href'),'#probetraining');await p.locator('#directionId').selectOption('sambo-mma');await p.locator('#groupId').selectOption('sambo-9-15');
 await p.locator('#name').fill('Test Person');await p.locator('#phone').fill('+49 (151) 123-4567');await p.locator('#age').fill('16');await p.locator('#consent').check();
 await p.locator('#submit-trial').click();assert.equal(await p.locator('#age').getAttribute('aria-invalid'),'true');await p.locator('#apply-group').click();assert.equal(await p.locator('#groupId').inputValue(),'sambo-16');
 let posts=0;p.on('request',r=>{if(r.method()==='POST')posts++;});
 for(const lang of ['ru','uk','tr','de']){await p.locator('.site-header [data-locale="'+lang+'"]').click();await p.waitForFunction(l=>document.documentElement.lang===l,lang);assert.equal(await p.locator('#name').inputValue(),'Test Person');assert.equal(await p.locator('#groupId').inputValue(),'sambo-16');assert.equal(await p.locator('#consent').isChecked(),true);await p.locator('#submit-trial').click();assert.equal(await p.locator('#form-status').getAttribute('role'),'status');assert.ok((await p.locator('#form-status').innerText()).length>40);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 assert.equal(posts,0);checks.push('4 locales preserve form fields/group/consent and demo never posts');
 await p.locator('#directionId').selectOption('valset');assert.equal(await p.locator('#instagram-optional').isVisible(),true);await p.locator('#groupId').selectOption('val-mama');assert.match(await p.locator('#instagram-optional a').getAttribute('href'),/instagram.com\/VALSET_SOLINGEN/);checks.push('VALSET exposes its optional Instagram contact while retaining the shared request form');
 await p.locator('.site-header [data-locale="ru"]').click();await p.waitForFunction(()=>document.documentElement.lang==='ru');assert.equal(await p.locator('#groupId').inputValue(),'val-mama');assert.equal(await p.locator('#instagram-optional').isVisible(),true);
 await c.close();
 const no=await context({javaScriptEnabled:false}),np=await no.newPage();await np.goto(base+'/de/');assert.equal(await np.locator('#submit-trial').isDisabled(),false);assert.equal(await np.locator('#trial-form').getAttribute('method'),'post');assert.equal(await np.locator('#trial-form').getAttribute('action'),'/api/trial-requests');await np.locator('#detail-boxen summary').click();assert.equal(await np.locator('#detail-boxen').getAttribute('open'),'');checks.push('no-JavaScript reading, details and progressively enhanced POST form');await no.close();
 const thumbs=await Promise.all(shots.map(async(f,i)=>({input:await sharp(f).resize(288,200,{fit:'contain',background:'#111113'}).png().toBuffer(),left:(i%6)*288,top:Math.floor(i/6)*200})));
 await sharp({create:{width:1728,height:Math.ceil(shots.length/6)*200,channels:3,background:'#111113'}}).composite(thumbs).png().toFile(`${out}/sheet.png`);
 await writeFile(`${out}/report.json`,JSON.stringify({checks,issues,shots},null,2));assert.deepEqual(issues,[]);console.log(JSON.stringify({checks,screenshots:shots.length,issues},null,2));
}finally{await browser.close();}
