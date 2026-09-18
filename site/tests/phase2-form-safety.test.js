import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createTrialRequestsHandler} from '../api/trial-requests.js';
import {assessFormConfig} from '../server/form-config.js';
import {createTrialService} from '../server/trial-requests.js';
import {legal} from '../src/data.js';

const payload=()=>({name:'Test Person',email:'test@example.test',age:18,directionId:'boxen',groupId:'box-15',locale:'de',consent:true,consentVersion:legal.consentVersion,requestId:randomUUID()});
const readyEnv=(extra={})=>({
 FORM_DELIVERY_ENABLED:'true',FORM_PUBLICATION_STATUS:'published',FORM_CONSENT_VERSION:legal.consentVersion,
 PUBLIC_ORIGIN:'https://example.test/',TELEGRAM_BOT_TOKEN:'synthetic-bot-token',TELEGRAM_CHAT_ID_AK:'-10099',
 UPSTASH_REDIS_REST_URL:'https://redis.example.test',UPSTASH_REDIS_REST_TOKEN:'synthetic-upstash-token',...extra
});
const response=()=>({headers:{},setHeader(name,value){this.headers[name]=value;},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}});
const request=({origin='https://example.test',body=payload()}={})=>({method:'POST',headers:{'content-type':'application/json','content-length':'100',...(origin===undefined?{}:{origin})},body,socket:{remoteAddress:'127.0.0.1'}});

test('hosted form uses canonical configured origin and never falls back to Host',async()=>{
 let redisConstructed=0,serviceConstructed=0;
 class RedisMock{constructor(options){redisConstructed++;this.options=options;}}
 const handler=createTrialRequestsHandler({env:readyEnv(),RedisClient:RedisMock,createService:options=>{serviceConstructed++;assert.equal(options.token,'synthetic-bot-token');assert.equal(options.chatId,'-10099');return {handle:async(raw,ip)=>({httpStatus:201,body:{ok:true,requestId:raw.requestId,ip}})};}});
 const accepted=response();await handler(request(),accepted);
 assert.equal(accepted.statusCode,201);assert.equal(redisConstructed,1);assert.equal(serviceConstructed,1);
 const noJs=response();await handler(request({origin:undefined}),noJs);assert.equal(noJs.statusCode,201);
 const mismatch=response();await handler(request({origin:'https://evil.test'}),mismatch);assert.equal(mismatch.statusCode,403);
 assert.equal(redisConstructed,2,'mismatched Origin must be rejected before Redis/service construction');
});

test('form handler fails closed before parsing or constructing delivery dependencies',async()=>{
 let redisConstructed=0,serviceConstructed=0;
 class RedisMock{constructor(){redisConstructed++;}}
 const handler=createTrialRequestsHandler({env:readyEnv({FORM_CONSENT_VERSION:'not-approved'}),RedisClient:RedisMock,createService:()=>{serviceConstructed++;throw new Error('must not create');}});
 const result=response();await handler(request(),result);
 assert.equal(result.statusCode,503);assert.deepEqual(result.body,{ok:false,code:'not_configured'});
 assert.equal(redisConstructed,0);assert.equal(serviceConstructed,0);
});

test('inherited local credentials cannot send unless both local gates and legal readiness are explicit',async()=>{
 const inherited=readyEnv({PUBLIC_ORIGIN:'http://127.0.0.1:4173'});
 const checked=assessFormConfig(inherited,{local:true});
 assert.equal(checked.ready,false);assert.ok(checked.errors.includes('FORM_LOCAL_DELIVERY_DISABLED'));
 let sends=0;
 const service=createTrialService({enabled:checked.ready,token:inherited.TELEGRAM_BOT_TOKEN,chatId:inherited.TELEGRAM_CHAT_ID_AK,fetchImpl:async()=>{sends++;throw new Error('must not send');}});
 const result=await service.handle(payload());service.close();
 assert.equal(result.httpStatus,503);assert.equal(result.body.code,'not_configured');assert.equal(sends,0);
});
