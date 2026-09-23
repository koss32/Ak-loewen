import test from 'node:test';
import assert from 'node:assert/strict';
import {createOpsHandler} from '../api/telegram-ops.js';
import {runCheck,runRemoteCheck} from '../server/telegram-ops.js';

const SECRET='w'.repeat(40),OPS_ORIGIN='https://release-7-preview.example';
const env=()=>({VERCEL:'1',VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'release-7',VERCEL_URL:'release-7-preview.example',TELEGRAM_OPS_PREVIEW_ORIGIN:OPS_ORIGIN,PUBLIC_ORIGIN:`${OPS_ORIGIN}/`,BOT_ENABLED:'true',BOT_WEBHOOK_ENABLED:'true',PRIVACY_PUBLICATION_STATUS:'published',PRIVACY_CONSENT_VERSION:'telegram-2026-09-15-v1',PRIVACY_URL:`${OPS_ORIGIN}/telegram-privacy/`,TELEGRAM_WORKER_SECRET:SECRET});
const req=()=>({method:'POST',headers:{authorization:`Bearer ${SECRET}`}});
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};}

test('remote diagnostics require authentication before any read-only check',async()=>{
 for(const request of [{...req(),method:'GET'},{...req(),headers:{}},{...req(),headers:{authorization:'Bearer wrong'}}]){
  let calls=0;const res=response();await createOpsHandler({env:env(),check:async()=>{calls++;return {ok:true};}})(request,res);
  assert.ok([401,405].includes(res.statusCode));assert.equal(calls,0);assert.equal(res.headers['Cache-Control'],'no-store');
 }
});

test('remote diagnostics refuse non-Preview deployments and never expose env',async()=>{
 for(const change of [{VERCEL:'0'},{VERCEL_ENV:'production'},{VERCEL_GIT_COMMIT_REF:'release-3'},{PUBLIC_ORIGIN:'https://other.example'},{VERCEL_URL:'other.example'},{TELEGRAM_OPS_PREVIEW_ORIGIN:''},{BOT_ENABLED:'false'}]){
  let calls=0;const res=response();await createOpsHandler({env:{...env(),...change},check:async()=>{calls++;return {ok:true};}})(req(),res);
  assert.equal(res.statusCode,403);assert.equal(calls,0);assert.equal(JSON.stringify(res.body).includes(SECRET),false);
 }
});

test('authenticated Preview diagnostic delegates only a check and redacts failures',async()=>{
 const source=env(),res=response();let calls=0;
 await createOpsHandler({env:source,check:async({env:passed})=>{assert.equal(passed,source);calls++;return {ok:true,command:'check'};}})(req(),res);
 assert.equal(calls,1);assert.equal(res.statusCode,200);assert.deepEqual(res.body,{ok:true,command:'check'});
 const failed=response();await createOpsHandler({env:source,check:async()=>{throw new Error(SECRET);}})(req(),failed);
 assert.equal(failed.statusCode,503);assert.deepEqual(failed.body,{ok:false,code:'check_failed'});
});

test('remote CLI uses only the fixed Preview endpoint and copies a redacted schema',async()=>{
 const result=await runCheck({env:{},fetchImpl:async()=>{throw new Error('must not fetch');}});
 result.extraSecret=SECRET;
 const calls=[],checked=await runRemoteCheck({env:{TELEGRAM_WORKER_SECRET:SECRET,TELEGRAM_OPS_PREVIEW_ORIGIN:OPS_ORIGIN},fetchImpl:async(url,options)=>{calls.push({url,options});return {status:503,json:async()=>result};}});
 assert.equal(calls.length,1);assert.equal(calls[0].url,`${OPS_ORIGIN}/api/telegram-ops/`);assert.equal(calls[0].options.redirect,'error');assert.equal(calls[0].options.headers.authorization,`Bearer ${SECRET}`);
 assert.equal(checked.ok,false);assert.equal(checked.remote,true);assert.equal(checked.redis.ping_ok,false);assert.equal(JSON.stringify(checked).includes(SECRET),false);assert.equal(Object.hasOwn(checked,'extraSecret'),false);
});

test('remote CLI never prints secret-bearing error bodies or malformed result fields',async()=>{
 const base=await runCheck({env:{},fetchImpl:async()=>{throw new Error('must not fetch');}});
 for(const body of [{ok:false,error:SECRET},{...base,errors:[SECRET]},{...base,telegram:{...base.telegram,pending_count:SECRET}},{...base,staff:{...base.staff,mode:SECRET}}]){
  const result=await runRemoteCheck({env:{TELEGRAM_WORKER_SECRET:SECRET,TELEGRAM_OPS_PREVIEW_ORIGIN:OPS_ORIGIN},fetchImpl:async()=>({status:503,json:async()=>body})});
  assert.equal(result.ok,false);assert.equal(result.code,'TRANSPORT_FAILED');assert.equal(JSON.stringify(result).includes(SECRET),false);
 }
});
