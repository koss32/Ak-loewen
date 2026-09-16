import test from 'node:test';
import assert from 'node:assert/strict';
import {render} from '../src/render-final.js';

test('approved website content and original VALSET artwork are rendered',()=>{
 const ru=render('ru');
 assert.match(ru,/Самбо — это «самооборона без оружия»/);
 assert.match(ru,/Ничего специального брать не нужно/);
 assert.doesNotMatch(ru,/Тренер будет рядом/);
 assert.match(ru,/\/assets\/valset\.jpg/);
 assert.match(ru,/<figure class="valset-art"><img src="\/assets\/valset\.jpg"/);
 assert.doesNotMatch(ru,/class="valset-art"><img src="\/assets\/valset-logo\.svg"/);
 assert.match(ru,/Namih Aliyev/);
 assert.match(ru,/AK Löwen[^]*\/assets\/ak-logo\.png/);
});

test('impressum uses verified registered company data, not the training address',()=>{
 const html=render('de','impressum');
 assert.match(html,/Parallelstraße 6, 42719 Solingen/);
 assert.match(html,/Dietrich Schmelzer/);
 assert.match(html,/Amtsgericht Wuppertal/);
 assert.match(html,/HRB 36478/);
 assert.match(html,/\+49 157 30447730/);
 assert.doesNotMatch(html,/Werwolf 8/);
 assert.doesNotMatch(html,/Rechtliche Informationen werden ergänzt/);
});
