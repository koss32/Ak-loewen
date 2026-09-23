import test from 'node:test';
import assert from 'node:assert/strict';
import {runCheck,runWebhook,runWorker,runTelegramOps} from '../server/telegram-ops.js';
import {spawnSync} from 'node:child_process';

const TOKEN='t'.repeat(40),WEBHOOK_SECRET='h'.repeat(40),WORKER_SECRET='w'.repeat(40),OPS_ORIGIN='https://release-7-preview.example';
const baseEnv=()=>({
 VERCEL:'1',VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'release-7',VERCEL_URL:'release-7-preview.example',
 TELEGRAM_OPS_PREVIEW_ORIGIN:OPS_ORIGIN,PUBLIC_ORIGIN:`${OPS_ORIGIN}/`,
 BOT_ENABLED:'true',BOT_WEBHOOK_ENABLED:'true',BOT_WORKER_ENABLED:'true',
 TELEGRAM_BOT_TOKEN:TOKEN,TELEGRAM_BOT_USERNAME:'ak_loewenbot',TELEGRAM_STAFF_USER_IDS:'55,56',TELEGRAM_STAFF_CHAT_ID:'-10099',
 TELEGRAM_WEBHOOK_SECRET:WEBHOOK_SECRET,TELEGRAM_WORKER_SECRET:WORKER_SECRET,
 UPSTASH_REDIS_REST_URL:'https://redis.example',UPSTASH_REDIS_REST_TOKEN:'redis-token',BOT_REDIS_PREFIX:'{akbot}:',
 PRIVACY_PUBLICATION_STATUS:'published',PRIVACY_CONSENT_VERSION:'telegram-2026-09-15-v1',PRIVACY_URL:`${OPS_ORIGIN}/telegram-privacy/`,FORM_DELIVERY_ENABLED:'false',TELEGRAM_OPS_MUTATIONS_ENABLED:'true'
});
function state(){return JSON.stringify({schema:2,sessions:{},requests:{},clients:{},updates:{},actions:{},outbox:{},recipientSequence:{},recipientBlockedUntil:{}});}
function fakeFetch({setResult=true,botUsername='ak_loewenbot',botIdentity,stateBody=state(),calls=[]}={}){return async(url,options={})=>{
 calls.push({url,options,body:options.body?JSON.parse(options.body):undefined});
 if(url.includes('/ping'))return {status:200,json:async()=>({result:'PONG'})};
 if(url.includes('/get/'))return {status:200,json:async()=>({result:stateBody})};
 if(url.includes('/getMe'))return {status:200,json:async()=>({ok:true,result:botIdentity||{id:999,username:botUsername,is_bot:true}})};
 if(url.includes('/getWebhookInfo'))return {status:200,json:async()=>({ok:true,result:{url:`${OPS_ORIGIN}/api/telegram-webhook/`,pending_update_count:0,last_error_message:''}})};
 if(url.includes('/getChatMember')){const body=JSON.parse(options.body);return {status:200,json:async()=>({ok:true,result:{status:Number(body.user_id)===999?'administrator':'member',user:{id:Number(body.user_id),is_bot:Number(body.user_id)===999}}})};}
 if(url.includes('/getChat'))return {status:200,json:async()=>({ok:true,result:{id:-10099,type:'supergroup'}})};
 if(url.includes('/setWebhook'))return {status:200,json:async()=>({ok:true,result:setResult})};
 throw new Error('unexpected request');
};}

 test('ops target defaults to deny and rejects the retired release-3 target',async()=>{
 for(const env of [
  {},
  {...baseEnv(),VERCEL_GIT_COMMIT_REF:'release-3'},
  {...baseEnv(),TELEGRAM_OPS_PREVIEW_ORIGIN:''},
  {...baseEnv(),TELEGRAM_OPS_PREVIEW_ORIGIN:'https://release-7-preview.example/'},
  {...baseEnv(),PUBLIC_ORIGIN:'https://other.example'},
  {...baseEnv(),TELEGRAM_OPS_PREVIEW_ORIGIN:'http://release-7-preview.example'},
  {...baseEnv(),VERCEL_URL:'other.example',VERCEL_BRANCH_URL:''},
  {...baseEnv(),VERCEL_URL:'',VERCEL_BRANCH_URL:''},
  {...baseEnv(),VERCEL_GIT_COMMIT_REF:''},
  {...baseEnv(),VERCEL_GIT_COMMIT_REF:'main'}
 ]){
  const calls=[],result=await runCheck({env,fetchImpl:fakeFetch({calls})});
  assert.equal(result.ok,false);assert.equal(result.booking_ready,false);assert.ok(result.errors.includes('CHECK_PRECONDITION_FAILED'));assert.equal(calls.length,0);
 }
});

test('release-7 target matches the verified platform host and check remains read-only',async()=>{
 const calls=[],result=await runCheck({env:baseEnv(),fetchImpl:fakeFetch({calls})});
 assert.equal(result.ok,true);assert.equal(result.preconditions.source_branch,true);assert.equal(result.preconditions.deployment_origin,true);
 assert.equal(calls.some(x=>x.url.includes('/setWebhook')||x.url.includes('/sendMessage')||x.url.includes('/del')),false);
});

test('check is read-only, aggregates safe schema state, and never returns secrets or identifiers',async()=>{
 const calls=[],result=await runCheck({env:baseEnv(),fetchImpl:fakeFetch({calls})});
 assert.equal(result.ok,true);
 assert.equal(result.booking_ready,true);
 assert.equal(result.redis.schema2_compatible,true);
 assert.equal(result.env_presence.FORM_DELIVERY_ENABLED,true);
 assert.equal(result.env_presence.TELEGRAM_STAFF_AUTH_MODE,false);
 assert.equal(result.env_presence.KV_REST_API_URL,false);
 assert.equal(calls.some(x=>x.url.includes('/set')||x.url.includes('/del')),false);
 const text=JSON.stringify(result);
 assert.equal(text.includes(TOKEN),false);assert.equal(text.includes(WEBHOOK_SECRET),false);assert.equal(text.includes(WORKER_SECRET),false);
 assert.equal(text.includes('-10099'),false);assert.equal(text.includes('999'),false);
});

test('absent configuration is a fixed safe result without transport attempts',async()=>{
 const calls=[],result=await runCheck({env:{},fetchImpl:fakeFetch({calls})});
 assert.equal(result.ok,false);assert.equal(result.config_ready,false);assert.equal(calls.length,0);
 assert.equal(JSON.stringify(result).includes('undefined'),false);
});

test('assessed invalid runtime settings cannot report readiness',async()=>{
 const result=await runCheck({env:{...baseEnv(),TELEGRAM_WORKER_SECRET:'unsafe secret'},fetchImpl:fakeFetch()});
 assert.equal(result.config_ready,false);assert.equal(result.booking_ready,false);assert.equal(result.ok,false);
 const text=JSON.stringify(result);assert.equal(text.includes('unsafe secret'),false);assert.equal(text.includes(TOKEN),false);
});

test('mismatched bot identity does not make readiness true or mutate webhook',async()=>{
 const result=await runCheck({env:baseEnv(),fetchImpl:fakeFetch({botUsername:'other_bot'})});
 assert.equal(result.telegram.identity_match,false);assert.equal(result.booking_ready,false);assert.equal(result.ok,false);
 const calls=[];const webhook=await runWebhook({env:baseEnv(),fetchImpl:fakeFetch({botUsername:'other_bot',calls})});
 assert.equal(webhook.mutated,false);assert.equal(webhook.code,'TELEGRAM_RESPONSE_INVALID');assert.equal(calls.some(x=>x.url.includes('/setWebhook')),false);
});

test('webhook refuses production and wrong-branch mutation preconditions',async()=>{
 for(const change of [{VERCEL_ENV:'production'},{VERCEL_GIT_COMMIT_REF:'main'},{PUBLIC_ORIGIN:'https://other.example'}]){
  const calls=[],result=await runWebhook({env:{...baseEnv(),...change},fetchImpl:fakeFetch({calls})});
  assert.equal(result.ok,false);assert.equal(result.mutated,false);assert.equal(result.code,'MUTATION_PRECONDITION_FAILED');assert.equal(calls.length,0);
 }
});

test('mutations require the separate explicit ops gate and stay denied by default',async()=>{
 for(const command of ['webhook','worker']){
  let invoked=false;const calls=[],env={...baseEnv()};delete env.TELEGRAM_OPS_MUTATIONS_ENABLED;
  const result=command==='webhook'?await runWebhook({env,fetchImpl:fakeFetch({calls})}):await runWorker({env,fetchImpl:fakeFetch({calls}),createRuntime:()=>{invoked=true;return {drain:async()=>1};}});
  assert.equal(result.ok,false);assert.equal(result.mutated,false);assert.equal(result.code,'MUTATION_PRECONDITION_FAILED');assert.equal(invoked,false);assert.equal(calls.length,0);
 }
});

test('webhook transmits secret internally, preserves drop_pending_updates false, and reports only sanitized follow-up',async()=>{
 const calls=[],result=await runWebhook({env:baseEnv(),fetchImpl:fakeFetch({calls})});
 const set=calls.find(x=>x.url.includes('/setWebhook'));
 assert.ok(set);assert.equal(set.body.secret_token,WEBHOOK_SECRET);assert.equal(set.body.drop_pending_updates,false);assert.deepEqual(set.body.allowed_updates,['message','callback_query']);
 assert.equal(result.ok,true);assert.equal(result.webhook_url_match,true);assert.equal(result.pending_count,0);assert.equal(result.last_error_present,false);
 assert.equal(JSON.stringify(result).includes(WEBHOOK_SECRET),false);
});

test('worker delegates a bounded drain and exposes only status/count',async()=>{
 let call;
 const result=await runWorker({env:baseEnv(),fetchImpl:fakeFetch(),createRuntime:env=>({drain:async(options)=>{call={env,options};return 3;}})});
 assert.equal(result.ok,true);assert.equal(result.mutated,true);assert.equal(result.processed,3);assert.deepEqual(call.options,{limit:50,maxDurationMs:25000});
 assert.equal(JSON.stringify(result).includes(TOKEN),false);
});

test('worker refuses production without invoking runtime',async()=>{
 let invoked=false;
 const result=await runWorker({env:{...baseEnv(),VERCEL_ENV:'production'},createRuntime:()=>{invoked=true;return {drain:async()=>1};}});
 assert.equal(result.code,'MUTATION_PRECONDITION_FAILED');assert.equal(result.mutated,false);assert.equal(invoked,false);
});

test('incompatible namespace state remains visibly incompatible and is not normalized',async()=>{
 const result=await runCheck({env:baseEnv(),fetchImpl:fakeFetch({stateBody:JSON.stringify({schema:1,sessions:[],requests:[]})})});
 assert.equal(result.redis.state_exists,true);assert.equal(result.redis.schema2_compatible,false);assert.equal(result.redis.aggregates.sessions.total,0);assert.equal(result.booking_ready,false);assert.equal(result.ok,false);
});

test('setWebhook result must be literal true before mutation is reported',async()=>{
 const result=await runWebhook({env:baseEnv(),fetchImpl:fakeFetch({setResult:{ok:true}})});
 assert.equal(result.mutated,false);assert.equal(result.ok,false);assert.equal(result.code,'WEBHOOK_NOT_CONFIRMED');
});

test('check recognizes explicit group-members mode without enumerating humans',async()=>{
 const calls=[];
 const result=await runCheck({env:{...baseEnv(),TELEGRAM_STAFF_AUTH_MODE:'group_members',TELEGRAM_STAFF_USER_IDS:''},fetchImpl:fakeFetch({calls})});
 assert.equal(result.ok,true);assert.equal(result.booking_ready,true);
 assert.deepEqual(result.staff,{mode:'group_members',configured:true,group_valid:true,chat_group_or_supergroup:true,bot_admin:true,allowlisted_humans_current:false,membership_ready:true});
 assert.equal(calls.filter(call=>call.url.includes('/getChatMember')).length,1);
});

test('Preview readiness fails outside the exact deployment boundary',async()=>{
 for(const change of [{VERCEL:'0'},{VERCEL_ENV:'production'},{VERCEL_GIT_COMMIT_REF:'other'},{PUBLIC_ORIGIN:'https://other.example'}]){
  const result=await runCheck({env:{...baseEnv(),...change},fetchImpl:fakeFetch()});
  assert.equal(result.booking_ready,false);assert.equal(result.ok,false);
  assert.ok(result.errors.includes('CHECK_PRECONDITION_FAILED'));
 }
});

test('invalid Redis URLs receive no authenticated requests, including the KV fallback',async()=>{
 for(const url of ['http://redis.example','https://redis.example/path','https://redis.example?token=x','https://user:password@redis.example','https://redis.example/#fragment','not-a-url']){
  for(const kv of [false,true]){
   const calls=[],env=baseEnv();
   if(kv){delete env.UPSTASH_REDIS_REST_URL;delete env.UPSTASH_REDIS_REST_TOKEN;env.KV_REST_API_URL=url;env.KV_REST_API_TOKEN='private-redis';}
   else env.UPSTASH_REDIS_REST_URL=url;
   const result=await runCheck({env,fetchImpl:fakeFetch({calls})});
   assert.equal(result.ok,false);assert.equal(result.redis.ping_ok,false);
   assert.ok(calls.every(call=>new URL(call.url).origin==='https://api.telegram.org'));
  }
 }
});

test('worker checks bot identity before runtime and redacts identity transport failures',async()=>{
 for(const fetchImpl of [fakeFetch({botUsername:'other_bot'}),async()=>{throw new Error(`private URL ${TOKEN}`);}]){
  let invoked=false;
  const result=await runTelegramOps({command:'worker',env:baseEnv(),fetchImpl,createRuntime:()=>{invoked=true;return {drain:async()=>0};}});
  assert.equal(invoked,false);assert.equal(result.ok,false);assert.equal(result.mutated,false);
  assert.equal(JSON.stringify(result).includes(TOKEN),false);
 }
});

test('webhook never takes over a different existing destination',async()=>{
 const calls=[],healthy=fakeFetch({calls});
 const fetchImpl=async(url,options)=>url.endsWith('/getWebhookInfo')?{status:200,json:async()=>({ok:true,result:{url:'https://production.example/api/webhook/'}})}:healthy(url,options);
 const result=await runWebhook({env:baseEnv(),fetchImpl});
 assert.equal(result.ok,false);assert.equal(result.mutated,false);assert.equal(result.code,'WEBHOOK_DESTINATION_CONFLICT');
 assert.equal(calls.some(call=>call.url.endsWith('/setWebhook')),false);
});

test('CLI returns a nonzero exit code for a failed redacted check',()=>{
 const result=spawnSync(process.execPath,['server/telegram-ops.js','check'],{cwd:new URL('..',import.meta.url),env:{},encoding:'utf8'});
 assert.equal(result.status,1);assert.equal(result.stderr,'');assert.equal(JSON.parse(result.stdout).ok,false);
});

test('bot identity requires exact username, bot marker, and safe positive id',async()=>{
 for(const identity of [
  {id:0,username:'ak_loewenbot',is_bot:true},
  {id:999,username:'ak_loewenbot',is_bot:false},
  {id:999,username:'ak_loewenbot'},
  {id:999,username:'other_bot',is_bot:true}
 ]){
  const result=await runCheck({env:baseEnv(),fetchImpl:fakeFetch({calls:[],botIdentity:identity})});
  assert.equal(result.telegram.identity_match,false);
 }
});
