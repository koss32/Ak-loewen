import test from 'node:test';
import assert from 'node:assert/strict';
import {render} from '../src/render-final.js';
import {brandUnionCopy} from '../src/brand-union-copy.js';

const locales=['de','ru','uk','tr'];

test('standort block keeps only the training address and links the Impressum',()=>{
 for(const locale of locales){
  const html=render(locale);
  assert.match(html,/Werwolf 8, 42651 Solingen/);
  assert.match(html,new RegExp(`href="/${locale}/impressum/" class="tlink"`));
  assert.doesNotMatch(html,/Dietrich Schmelzer/);
  assert.doesNotMatch(html,/Parallelstraße 6/);
  assert.doesNotMatch(html,/Amtsgericht Wuppertal/);
  assert.doesNotMatch(html,/HRB 36478/);
 }
});

test('both contact cards carry their own brand mark',()=>{
 const html=render('de');
 assert.match(html,/<div class="contact-card"><div class="contact-card-head"><img class="contact-mark" src="\/assets\/ak-logo.png"/);
 assert.match(html,/<div id="valset-kontakt" class="contact-card b"><div class="contact-card-head"><img class="contact-mark" src="\/assets\/valset.jpg"/);
});

test('union composition shows both brands and has a reduced-motion fallback',()=>{
 const html=render('de');
 assert.match(html,/class="brand-union" data-brand-union/);
 assert.match(html,/brand-union-mark is-ak/);
 assert.match(html,/brand-union-mark is-valset/);
 assert.match(html,/prefers-reduced-motion:reduce\)\{\.brand-union-mark/);
 assert.doesNotMatch(html,/class="about-mark"/);
});

test('valset artwork uses the original asset without the top crop',()=>{
 const html=render('de');
 assert.match(html,/<figure class="valset-art is-full">/);
 assert.match(html,/\/assets\/valset.jpg/);
 assert.doesNotMatch(html,/\/assets\/valset-logo.svg/);
 assert.match(html,/\.valset-art\.is-full img\{[^}]*object-fit:contain/);
});

test('telegram cta is compact, localized and available on every page',()=>{
 for(const locale of locales){
  for(const page of ['','impressum','datenschutz']){
   const html=render(locale,page);
   assert.match(html,/class="telegram-cta"/);
   assert.doesNotMatch(html,/class="telegram-booking"/);
   assert.ok(html.includes(brandUnionCopy[locale].telegramCtaShort));
   assert.ok(html.includes(`aria-label="${brandUnionCopy[locale].telegramCtaFull}"`));
  }
 }
});

test('touch devices keep the telegram label visible',()=>{
 const html=render('de');
 assert.match(html,/@media\(hover:none\),\(pointer:coarse\)\{\.telegram-cta\{/);
});

test('sambo copy focuses on self-defense without the historical background',()=>{
 for(const locale of locales){
  const html=render(locale);
  assert.doesNotMatch(html,/1920/);
  assert.doesNotMatch(html,/Sowjetunion|СССР|СРСР|Sovyetler/);
 }
});
