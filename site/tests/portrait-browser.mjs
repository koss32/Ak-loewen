import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';

const base=process.env.TEST_BASE_URL||'http://127.0.0.1:4173';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'/de/');
  await page.locator('#trainer').scrollIntoViewIfNeeded();
  const portrait=page.locator('.trainer-card').filter({hasText:'Namih Aliyev'}).locator('img');
  await portrait.waitFor({state:'visible'});
  await portrait.evaluate(image=>image.decode());
  assert.equal(await portrait.getAttribute('alt'),'Namih Aliyev');
  assert.ok((await portrait.evaluate(image=>image.complete&&image.naturalWidth>0)));
  assert.match(await portrait.evaluate(image=>image.currentSrc),/namig-(480|960)\.(avif|webp|jpg)$/);
  assert.equal(await page.locator('.trainer-card').filter({hasText:'Namih Aliyev'}).locator('figcaption').count(),0);
  assert.deepEqual(errors,[]);
  await page.screenshot({path:`test-results/release-a/namig-${width}.png`,fullPage:false});
  await page.close();
 }
 console.log('PASS: Namig portrait loads from responsive approved assets at 390px and 1440px.');
}finally{await browser.close();}
