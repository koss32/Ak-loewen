import test from 'node:test';
import assert from 'node:assert/strict';
import {createMemoryBotStore} from '../server/bot-store.js';
import {createBotRuntime} from '../server/bot-runtime.js';
import {legal} from '../src/data.js';

const env={
 BOT_ENABLED:'true',BOT_WEBHOOK_ENABLED:'true',BOT_WORKER_ENABLED:'true',
 // This UI test intentionally enables the retained FUTURE reminder capability.
 BOT_REMINDERS_ENABLED:'true',
 PUBLIC_ORIGIN:'https://example.test',TELEGRAM_WEBHOOK_SECRET:'h'.repeat(32),
 TELEGRAM_WORKER_SECRET:'w'.repeat(32),TELEGRAM_BOT_TOKEN:'test-token',
 TELEGRAM_STAFF_USER_IDS:'55',TELEGRAM_STAFF_CHAT_ID:'-10099',TELEGRAM_SEND_TIMEOUT_MS:'250',
 PRIVACY_URL:'https://example.test/privacy',PRIVACY_PUBLICATION_STATUS:'published',
 PRIVACY_CONSENT_VERSION:legal.consentVersion
};

const message=(updateId,text)=>({update_id:updateId,message:{chat:{id:10,type:'private'},from:{id:10},text}});
const callback=(updateId,data)=>({update_id:updateId,callback_query:{id:`q${updateId}`,from:{id:10},data,message:{message_id:77,chat:{id:10,type:'private'}}}});

test('runtime shows the new reminder label and opens the cancellation prompt immediately',async()=>{
 const now=Date.parse('2026-09-16T10:00:00Z');
 const store=createMemoryBotStore({clock:()=>now});
 await store.transactUpdate('seed-ui',tx=>{
  tx.putClient(10,{locale:'ru'});
  tx.createRequest({id:'1',clientChatId:'10',clientUserId:'10',locale:'ru',status:'confirmed',programId:'boxen',groupId:'box-15',scheduleId:'box-week',personType:'adult',contactName:'+49 151 1234567',participantName:'Adult Name',age:21,guardianRole:'',comment:'',consentVersion:legal.consentVersion,consentedAt:now,reminders:{enabled:false},appointment:now+24*60*60*1000});
 });
 const runtime=createBotRuntime(env,{store,fetchImpl:async()=>{throw new Error('network not expected');}});
 await runtime.bot.handle(message(1,'/status'));
 let state=await store.inspect();
 const status=Object.values(state.outbox).filter(item=>item.sourceUpdateId==='1'&&item.method==='sendMessage').at(-1);
 const buttons=status.meta.reply_markup.inline_keyboard.flat();
 assert.ok(buttons.some(button=>button.text==='🔔 Напомнить за 2 часа до тренировки'));
 const cancel=buttons.find(button=>button.text==='Отменить заявку');
 assert.ok(cancel);

 await runtime.bot.handle(callback(2,cancel.callback_data));
 state=await store.inspect();
 const prompt=Object.values(state.outbox).filter(item=>item.sourceUpdateId==='2'&&item.method==='sendMessage').at(-1);
 assert.equal(prompt.text,'Отменить эту заявку?');
 assert.ok(!Object.values(state.outbox).some(item=>item.kind==='interface-cleanup'));
 assert.equal(prompt.kind,'message');
});
