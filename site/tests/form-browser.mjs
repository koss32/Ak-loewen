import {launchChromium} from './helpers/browser.mjs';
import assert from 'node:assert/strict';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:4173';
const b=await launchChromium({headless:true});
try{
 const c=await b.newContext({locale:'ru-RU',viewport:{width:390,height:844}}),p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base+'/');await p.waitForURL('**/ru/');
 await p.evaluate(()=>localStorage.setItem('ak-locale','tr'));await p.goto(base+'/');await p.waitForURL('**/tr/');
 await p.goto(base+'/de/');assert.equal(await p.locator('html').getAttribute('lang'),'de');
 const activeLanguage=p.locator('.site-header .languages a[aria-current]');assert.equal(await activeLanguage.evaluate(element=>getComputedStyle(element).textDecorationLine),'none');assert.notEqual(await activeLanguage.evaluate(element=>getComputedStyle(element).boxShadow),'none');
 await p.fill('#name','Test Person');await p.fill('#age','18');await p.check('#consent');await p.locator('#submit-trial').click();assert.equal(await p.locator('#phone').getAttribute('aria-invalid'),'true');
 await p.selectOption('#contactMethod','telegram');await p.fill('#telegram','@test_person');await p.locator('details.optional-fields summary').click();await p.selectOption('#preferredTime','box-week');await p.fill('#comment','Test comment');let posts=0;p.on('request',r=>{if(r.method()==='POST')posts++;});
 for(const lang of ['ru','uk','tr','de']){await p.locator(`.site-header [data-locale="${lang}"]`).click();await p.waitForFunction(l=>document.documentElement.lang===l,lang);assert.equal(await p.inputValue('#telegram'),'@test_person');assert.equal(await p.inputValue('#preferredTime'),'box-week');assert.equal(await p.inputValue('#comment'),'Test comment');await p.locator('#submit-trial').click();assert.equal(await p.locator('#form-status').getAttribute('role'),'status');}
 assert.equal(posts,0);await p.selectOption('#directionId','sambo-mma');assert.equal(await p.inputValue('#preferredTime'),'');await p.selectOption('#groupId','sambo-16');assert.equal(await p.locator('#preferredTime option').count(),3);
 assert.deepEqual(errors,[]);await c.close();console.log('PASS: root language selection, explicit locale priority, one-contact form, added fields preserved, confirmed time selection, zero demo POSTs.');
}finally{await b.close();}
