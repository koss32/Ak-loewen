import assert from 'node:assert/strict';
import {launchChromium} from './helpers/browser.mjs';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:4173';
const browser=await launchChromium({headless:true});
const checks=[];
try{
 for(const locale of ['de','ru','uk','tr']){
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`${base}/${locale}/`);await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('html').getAttribute('lang'),locale);
  assert.equal(await page.locator('#main').count(),1);assert.equal(await page.locator('h1').count(),1);
  await page.keyboard.press('Tab');assert.equal(await page.locator('.skip-link').evaluate(el=>el===document.activeElement),true);
  await page.keyboard.press('Enter');assert.equal(new URL(page.url()).hash,'#main');
  const inputs=await page.locator('input:not([type="hidden"]), select, textarea').evaluateAll(nodes=>nodes.filter(node=>!node.labels?.length&&!node.getAttribute('aria-label')&&!node.getAttribute('aria-labelledby')).map(node=>node.id));assert.deepEqual(inputs,[]);
  const emptyButtons=await page.locator('button').evaluateAll(nodes=>nodes.filter(node=>!node.textContent.trim()&&!node.getAttribute('aria-label')&&!node.getAttribute('aria-labelledby')).map(node=>node.outerHTML.slice(0,100)));assert.deepEqual(emptyButtons,[]);
  const pride=page.locator('#pride-scene');assert.equal(await pride.getAttribute('aria-hidden'),'true');assert.equal(await pride.evaluate(el=>getComputedStyle(el).pointerEvents),'none');
  assert.equal(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),true);
  await page.locator('.menu-button').click();assert.equal(await page.locator('#mobile-menu').isVisible(),true);await page.keyboard.press('Escape');assert.equal(await page.locator('#mobile-menu').isVisible(),false);
  for(const legal of ['impressum','datenschutz']){
   const response=await page.request.get(`${base}/${locale}/${legal}/`);assert.equal(response.status(),200);assert.match(await response.text(),/<main id="main"/);assert.equal(response.headers()['x-robots-tag'],'noindex, nofollow');
  }
  const privacy=await page.request.get(`${base}/telegram-privacy/`);assert.equal(privacy.status(),200);
  assert.deepEqual(errors,[]);checks.push(`${locale}: skip link, labels, buttons, menu Escape, reduced motion, decorative PRIDE, legal routes and noindex`);await context.close();
 }
 console.log(JSON.stringify({checks,scope:'Focused accessibility basics, not a complete WCAG audit; local only, no real delivery.'},null,2));
}finally{await browser.close();}
