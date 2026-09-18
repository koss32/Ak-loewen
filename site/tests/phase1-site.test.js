import test from 'node:test';
import assert from 'node:assert/strict';
import {render} from '../src/render.js';

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
