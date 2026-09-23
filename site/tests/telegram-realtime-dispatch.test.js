import test from 'node:test';
import assert from 'node:assert/strict';
import {createWebhookHandler,WEBHOOK_DRAIN_BUDGET_MS} from '../api/telegram-webhook.js';
import {createMemoryBotStore} from '../server/bot-store.js';
import {createBotRuntime} from '../server/bot-runtime.js';
import {createTelegramBot,drainTelegramOutbox} from '../server/telegram-bot.js';
import {legal} from '../src/data.js';

const secret=letter=>letter.repeat(32);
const env=()=>({BOT_ENABLED:'true',BOT_WEBHOOK_ENABLED:'true',BOT_WORKER_ENABLED:'true',PUBLIC_ORIGIN:'https://example.test',TELEGRAM_WEBHOOK_SECRET:secret('h'),TELEGRAM_WORKER_SECRET:secret('w'),TELEGRAM_BOT_TOKEN:'test-token',TELEGRAM_STAFF_USER_IDS:'55',TELEGRAM_STAFF_CHAT_ID:'-10099',TELEGRAM_SEND_TIMEOUT_MS:'2000'});
const headers=value=>({host:'example.test','content-type':'application/json','x-telegram-bot-api-secret-token':value.TELEGRAM_WEBHOOK_SECRET});
const invoke=async(handler,body,value)=>{const res={setHeader(){},status(code){this.statusCode=code;return this;},json(bodyValue){this.body=bodyValue;return this;}};await handler({method:'POST',headers:headers(value),rawBody:Buffer.from(JSON.stringify(body))},res);return res;};
const callback=(id,data,chat=11,user=chat,type='private')=>({update_id:id,callback_query:{id:`query-${id}`,from:{id:user},data,message:{chat:{id:chat,type}}}});

function directRuntime(value,store,transport,clock){
 const runtime=createBotRuntime(value,{store,fetchImpl:transport});
 return {...runtime,drain(options){return runtime.drain({...options,monotonicNow:clock});}};
}

test('webhook sends a slow callback ACK and its menu in one source-scoped dispatch, without stealing due queue work',async()=>{
 const now=Date.parse('2026-09-15T12:00:00Z'),value=env(),store=createMemoryBotStore({clock:()=>now}),deliveries=[];
 // These are already-due background/unrelated items. The webhook must not send
 // either while servicing update 44.
 await store.enqueue('333','old unrelated backlog');
 const care=await store.createBooking({id:'care',clientUserId:'444',clientChatId:'444',status:'confirmed',appointment:now+3600000,reminders:{enabled:true}});
 await store.enqueue('444','due care','reminder',now,{requestId:'care',appointment:care.appointment,appointmentRevision:care.appointmentRevision});
 let elapsed=0;
 const transport=async(url,options)=>{
  const method=url.split('/').at(-1),body=JSON.parse(options.body);
  deliveries.push({method,body});
  elapsed+=method==='answerCallbackQuery'?300:100; // callback delivery exceeds 250ms
  return {status:200,json:async()=>({ok:true,result:method==='answerCallbackQuery'?true:{message_id:deliveries.length}})};
 };
 const handler=createWebhookHandler({env:value,createRuntime:runtimeEnv=>directRuntime(runtimeEnv,store,transport,()=>elapsed)});
 assert.equal(WEBHOOK_DRAIN_BUDGET_MS,20000);
 const update=callback(44,'cmd:menu');
 const first=await invoke(handler,update,value);
 assert.equal(first.statusCode,200);
 assert.deepEqual(deliveries.map(item=>item.method),['answerCallbackQuery','sendMessage']);
 assert.equal(deliveries[1].body.chat_id,'11');
 assert.match(deliveries[1].body.text,/Bitte wähle eine Aktion/);
 const state=await store.inspect();
 assert.equal(Object.values(state.outbox).find(item=>item.text==='old unrelated backlog').state,'queued');
 assert.equal(Object.values(state.outbox).find(item=>item.text==='due care').state,'queued');
 assert.ok(Object.values(state.outbox).filter(item=>item.sourceUpdateId==='44').every(item=>item.state==='sent'));
 // Telegram redelivery reuses the committed update, but cannot resend terminal output.
 const duplicate=await invoke(handler,update,value);
 assert.equal(duplicate.statusCode,200);
 assert.equal(duplicate.body.dropped,true);
 assert.equal(deliveries.length,2);
 // Scheduled/unrelated work remains available to the worker, separately.
 await drainTelegramOutbox({store,token:'test-token',timeoutMs:2000,maxDurationMs:6000,fetchImpl:transport,monotonicNow:()=>elapsed});
 assert.ok(deliveries.some(item=>item.body.text==='old unrelated backlog'));
 assert.ok(deliveries.some(item=>item.body.text==='due care'));
});

test('a valid button click renders the replacement and deletes the prior Telegram card',async()=>{
 const value=env();let now=0,cleanupPromise;const store=createMemoryBotStore({clock:()=>now}),deliveries=[];
 const transport=async(url,options)=>{
  const method=url.split('/').at(-1),body=JSON.parse(options.body);deliveries.push({method,body});
  return {status:200,json:async()=>({ok:true,result:['answerCallbackQuery','deleteMessage'].includes(method)?true:{message_id:deliveries.length}})};
 };
 const handler=createWebhookHandler({env:value,sleep:async()=>{now=2500;},waitUntilTask:task=>{cleanupPromise=task;},fetchImpl:transport,createRuntime:runtimeEnv=>directRuntime(runtimeEnv,store,transport,()=>now)});
 const update={update_id:441,callback_query:{id:'query-441',from:{id:11},data:'cmd:menu',message:{message_id:73,chat:{id:11,type:'private'}}}};
 const result=await invoke(handler,update,value);
 assert.equal(result.statusCode,200);
 await cleanupPromise;
 assert.deepEqual(deliveries.map(item=>item.method),['answerCallbackQuery','sendMessage','deleteMessage']);
 assert.match(deliveries[1].body.text,/Bitte wähle eine Aktion/);
 assert.ok(!Object.values((await store.inspect()).outbox).some(item=>item.method==='deleteMessage'));
 assert.deepEqual(deliveries.at(-1).body,{chat_id:'11',message_id:73});
 assert.ok(Object.values((await store.inspect()).outbox).filter(item=>item.sourceUpdateId==='441').every(item=>item.state==='sent'));
});

test('direct reply drains preceding conversation output without waiting for cron, but not same-recipient reminders',async()=>{
 const value=env(),store=createMemoryBotStore({clock:()=>0}),deliveries=[];
 // Keep conversation order without depending on a worker to clear an older
 // reply. A due reminder for this same chat cannot block either interaction.
 await store.enqueue('11','older due reminder','reminder',0);
 await store.enqueue('11','older client backlog');
 let elapsed=0;
 const transport=async(url,options)=>{
  const method=url.split('/').at(-1),body=JSON.parse(options.body);
  deliveries.push({method,body});elapsed+=method==='answerCallbackQuery'?300:100;
  return {status:200,json:async()=>({ok:true,result:method==='answerCallbackQuery'?true:{message_id:deliveries.length}})};
 };
 const handler=createWebhookHandler({env:value,createRuntime:runtimeEnv=>directRuntime(runtimeEnv,store,transport,()=>elapsed)});
 const update=callback(45,'cmd:menu');
 const first=await invoke(handler,update,value);
 assert.equal(first.statusCode,200);
 assert.deepEqual(deliveries.map(item=>item.method),['answerCallbackQuery','sendMessage','sendMessage']);
 assert.equal(deliveries[1].body.text,'older client backlog');
 assert.match(deliveries[2].body.text,/Bitte wähle eine Aktion/);
 assert.equal(Object.values((await store.inspect()).outbox).find(item=>item.text==='older due reminder').state,'queued');
 // No scheduled worker pass was needed. Redelivery must not repeat output.
 const retry=await invoke(handler,update,value);
 assert.equal(retry.statusCode,200);
 assert.equal(retry.body.dropped,true);
 assert.equal(deliveries.filter(item=>item.method==='answerCallbackQuery').length,1);
 assert.equal(deliveries.filter(item=>item.body.text&&/Bitte wähle eine Aktion/.test(item.body.text)).length,1);
});

test('Telegram rate limit is retried through webhook redelivery without duplicating committed responses',async()=>{
 let now=0,elapsed=0,rateLimited=false,visibleSent=0;const value=env(),store=createMemoryBotStore({clock:()=>now});
 const transport=async(url)=>{
  elapsed+=100;
  if(url.endsWith('/answerCallbackQuery'))return {status:200,json:async()=>({ok:true,result:true})};
  if(!rateLimited){rateLimited=true;return {status:429,json:async()=>({ok:false,error_code:429,parameters:{retry_after:1}})};}
  visibleSent++;return {status:200,json:async()=>({ok:true,result:{message_id:visibleSent}})};
 };
 const handler=createWebhookHandler({env:value,createRuntime:runtimeEnv=>directRuntime(runtimeEnv,store,transport,()=>elapsed)}),update=callback(47,'cmd:menu');
 assert.equal((await invoke(handler,update,value)).statusCode,503);
 assert.equal(visibleSent,0);
 now=1100;
 const retry=await invoke(handler,update,value);
 assert.equal(retry.statusCode,200);assert.equal(retry.body.dropped,true);assert.equal(visibleSent,1);
 assert.equal((await invoke(handler,update,value)).statusCode,200);assert.equal(visibleSent,1);
});

test('a staff action dispatches its callback, client notification, and all staff outputs from one update while scheduled care stays queued',async()=>{
 const value=env(),store=createMemoryBotStore({clock:()=>0}),deliveries=[];
 let action;
 await store.transactUpdate('seed-request',tx=>{
  const request=tx.createRequest({id:'staff-request',clientChatId:'11',clientUserId:'11',locale:'de',status:'pending',programId:'boxen',groupId:'box-15',scheduleId:'box-week',personType:'adult',contactName:'Adult Name',participantName:'Adult Name',age:21,guardianRole:'',comment:'',consentVersion:legal.consentVersion,consentedAt:tx.now,reminders:{enabled:false},appointment:null});
  action=tx.addAction({scope:'staff',type:'staff-cancel',requestId:request.id,appointmentRevision:request.appointmentRevision});
  tx.enqueue('888','future care','reminder',1000,{requestId:'other-request'});
 });
 let elapsed=0;
 const transport=async(url,options)=>{
  const method=url.split('/').at(-1),body=JSON.parse(options.body);
  deliveries.push({method,body});elapsed+=100;
  return {status:200,json:async()=>({ok:true,result:method==='answerCallbackQuery'?true:{message_id:deliveries.length}})};
 };
 const bot=createTelegramBot({store,config:{deliveryReady:true,sourceLegalStatus:'published',privacyUrl:'https://example.test/privacy',privacyStatus:'published',consentVersion:legal.consentVersion,staffUserIds:['55'],staffChatId:'-10099'},verifyStaffMembership:async()=>true});
 const runtime={store,bot,drain:options=>drainTelegramOutbox({store,token:'test-token',fetchImpl:transport,timeoutMs:2000,maxDurationMs:options.maxDurationMs,limit:options.limit,sourceUpdateId:options.sourceUpdateId,monotonicNow:()=>elapsed}),hasPendingImmediateForUpdate:updateId=>store.hasPendingImmediateForUpdate(updateId)};
 const handler=createWebhookHandler({env:value,createRuntime:()=>runtime});
 const result=await invoke(handler,callback(46,action,-10099,55,'group'),value);
 assert.equal(result.statusCode,200);
 assert.equal(deliveries.filter(item=>item.method==='answerCallbackQuery').length,1);
 assert.ok(deliveries.some(item=>item.body.chat_id==='11'&&/storniert/.test(item.body.text)));
 assert.ok(deliveries.filter(item=>item.body.chat_id==='-10099').length>=2);
 const scheduled=Object.values((await store.inspect()).outbox).find(item=>item.text==='future care');
 assert.equal(scheduled.state,'queued');
 assert.equal(scheduled.sourceUpdateId,'seed-request');
});
