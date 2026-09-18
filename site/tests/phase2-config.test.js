import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePublicOrigin} from '../server/site-config.js';
import {validPublicOrigin} from '../server/bot-config.js';
import {assessFormConfig} from '../server/form-config.js';
import {legal} from '../src/data.js';

const readyEnv=(extra={})=>({
 FORM_DELIVERY_ENABLED:'true',FORM_PUBLICATION_STATUS:'published',FORM_CONSENT_VERSION:legal.consentVersion,
 PUBLIC_ORIGIN:'https://Example.TEST/',TELEGRAM_BOT_TOKEN:'synthetic-bot-token',TELEGRAM_CHAT_ID_AK:'-10099',
 UPSTASH_REDIS_REST_URL:'https://redis.example.test',UPSTASH_REDIS_REST_TOKEN:'synthetic-upstash-token',...extra
});

test('shared public-origin normalization is strict and canonical',()=>{
 assert.equal(normalizePublicOrigin('https://Example.TEST/'),'https://example.test');
 assert.equal(normalizePublicOrigin('https://example.test'),'https://example.test');
 for(const unsafe of [undefined,' https://example.test','https://user:pass@example.test','https://example.test/path','https://example.test//','https://example.test/.','https://example.test?x=1','https://example.test/#x','https://example.test\\path','http://example.test','not a URL'])assert.equal(normalizePublicOrigin(unsafe),null,String(unsafe));
 assert.equal(normalizePublicOrigin('http://127.0.0.1:4173'),null);
 assert.equal(normalizePublicOrigin('http://127.0.0.1:4173',{allowLoopback:true}),'http://127.0.0.1:4173');
 assert.equal(normalizePublicOrigin('http://[::1]:4173',{allowLoopback:true}),'http://[::1]:4173');
 // Existing bot consumers retain explicitly opted-in development loopback support.
 assert.equal(validPublicOrigin('http://localhost:4173')?.origin,'http://localhost:4173');
});

test('form configuration defaults off and requires its own published legal/version declaration',()=>{
 const off=assessFormConfig({});
 assert.equal(off.enabled,false);assert.equal(off.ready,false);assert.equal(off.ok,false);
 assert.ok(off.errors.includes('FORM_DELIVERY_DISABLED'));
 const missingPublication=assessFormConfig(readyEnv({FORM_PUBLICATION_STATUS:'pending'}));
 assert.equal(missingPublication.ready,false);assert.ok(missingPublication.errors.includes('FORM_PUBLICATION_UNPUBLISHED'));
 const wrongVersion=assessFormConfig(readyEnv({FORM_CONSENT_VERSION:'other-version'}));
 assert.equal(wrongVersion.ready,false);assert.ok(wrongVersion.errors.includes('FORM_CONSENT_VERSION_MISMATCH'));
});

test('form assessment accepts the canonical trailing-slash origin but not unsafe configuration',()=>{
 const configured=assessFormConfig(readyEnv());
 assert.deepEqual(configured,{ok:true,errors:[],enabled:true,ready:true,origin:'https://example.test'});
 for(const change of [
  {PUBLIC_ORIGIN:'https://example.test/form'},
  {PUBLIC_ORIGIN:'http://localhost:4173'},
  {TELEGRAM_CHAT_ID_AK:'10099'},
  {TELEGRAM_BOT_TOKEN:' synthetic '}
 ]){
  const checked=assessFormConfig(readyEnv(change));
  assert.equal(checked.ready,false);assert.ok(checked.errors.every(code=>!code.includes('synthetic-bot-token')));
 }
});

test('Redis aliases must be complete, valid same-provider pairs',()=>{
 const wrongPair=assessFormConfig(readyEnv({UPSTASH_REDIS_REST_TOKEN:undefined,KV_REST_API_TOKEN:'kv-token'}));
 assert.equal(wrongPair.ready,false);assert.ok(wrongPair.errors.includes('FORM_REDIS_PAIR_INVALID'));
 const malformed=assessFormConfig(readyEnv({UPSTASH_REDIS_REST_URL:'http://redis.example.test'}));
 assert.equal(malformed.ready,false);assert.ok(malformed.errors.includes('FORM_REDIS_PAIR_INVALID'));
 const kvOnly=assessFormConfig(readyEnv({UPSTASH_REDIS_REST_URL:undefined,UPSTASH_REDIS_REST_TOKEN:undefined,KV_REST_API_URL:'https://kv.example.test',KV_REST_API_TOKEN:'kv-token'}));
 assert.equal(kvOnly.ready,true);
});

test('local form delivery requires the extra explicit opt-in before loopback can be ready',()=>{
 const local=readyEnv({PUBLIC_ORIGIN:'http://127.0.0.1:4173'});
 const withoutLocalFlag=assessFormConfig(local,{local:true});
 assert.equal(withoutLocalFlag.enabled,false);assert.equal(withoutLocalFlag.ready,false);assert.ok(withoutLocalFlag.errors.includes('FORM_LOCAL_DELIVERY_DISABLED'));
 const withLocalFlag=assessFormConfig({...local,LOCAL_FORM_DELIVERY_ENABLED:'true'},{local:true});
 assert.equal(withLocalFlag.ready,true);assert.equal(withLocalFlag.origin,'http://127.0.0.1:4173');
 assert.equal(assessFormConfig({...local,LOCAL_FORM_DELIVERY_ENABLED:'true'}).ready,false);
});
