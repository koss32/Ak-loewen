import {execFileSync} from 'node:child_process';
import {readFileSync,readdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {legal} from '../src/data.js';

// This is a static build fixture only: never inherit project credentials.
const safeEnv={PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR};
const liveFixture={...safeEnv,FORM_DELIVERY_ENABLED:'true',FORM_PUBLICATION_STATUS:'published',FORM_CONSENT_VERSION:legal.consentVersion,PUBLIC_ORIGIN:'https://build-fixture.invalid',TELEGRAM_BOT_TOKEN:'build-fixture-not-a-real-token',TELEGRAM_CHAT_ID_AK:'-123456',UPSTASH_REDIS_REST_URL:'https://redis-fixture.invalid',UPSTASH_REDIS_REST_TOKEN:'fixture-only'};
try {
 execFileSync(process.execPath,['build.js'],{env:liveFixture});
 assert.match(readFileSync('dist/de/index.html','utf8'),/data-live="true"/);
 const standalone=readdirSync('dist').find(name=>/^ak-loewen-valset-.*\.html$/.test(name));
 assert.ok(standalone,'standalone build artifact exists');
 const html=readFileSync(`dist/${standalone}`,'utf8');
 const metadata=html.match(/<script>(window\.__AK_PAGES__=[\s\S]*?)<\/script>/)[1];
 const context={window:{}};vm.runInNewContext(metadata,context);
 for(const pages of Object.values(context.window.__AK_PAGES__)){
  for(const page of Object.values(pages)){
   const data=JSON.parse(page.match(/id="page-data">([\s\S]*?)<\/script>/)[1]);
   assert.equal(data.live,false);
  }
 }
 for(const width of [480,960])for(const ext of ['avif','webp','jpg']){
  assert.match(context.window.__AK_ASSETS__[`/assets/namig-${width}.${ext}`],/^data:image\//);
 }
 const head=html.slice(0,html.indexOf('<script>window.__AK_PAGES__'));
 assert.doesNotMatch(head,/(?:src|srcset)="\/assets\//);
 console.log('PASS: standalone build embeds trainer assets and keeps every locale in demo mode.');
} finally {
 execFileSync(process.execPath,['build.js'],{env:{...safeEnv,FORM_DELIVERY_ENABLED:'false'}});
}
