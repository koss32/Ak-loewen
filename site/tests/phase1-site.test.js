import test from 'node:test';
import assert from 'node:assert/strict';
import {render} from '../src/render.js';
import {render as renderFinal} from '../src/render-final.js';
import {contacts,locales} from '../src/data.js';

test('Telegram CTAs open the plain bot main menu without obsolete start payloads',()=>{
 const html=render('de');
 assert.match(html,/href="https:\/\/t\.me\/ak_loewenbot"/);
 assert.doesNotMatch(html,/start=site_question/);
});

test('existing website trial form remains a web POST',()=>{
 const html=render('de');
 assert.match(html,/<form id="trial-form" method="post" action="\/api\/trial-requests"/);
 assert.match(html,/name="consent"/);
});

test('only the floating booking button deep-links to the Telegram booking flow',()=>{
 for(const locale of locales){
  const html=renderFinal(locale);
  assert.ok(html.includes(`<a class="telegram-booking tg-compact" href="${contacts.telegram}?start=site_booking" target="_blank" rel="noopener noreferrer"`));
  assert.match(html,/<form id="trial-form" method="post" action="\/api\/trial-requests"/);
  assert.match(html,/class="btn"[^>]*href="#probetraining"|href="#probetraining" class="btn"/);
  assert.equal((html.match(/start=site_booking/g)||[]).length,1);
 }
});
