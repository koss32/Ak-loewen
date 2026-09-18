import test from 'node:test';
import assert from 'node:assert/strict';
import {createMemoryBotStore} from '../server/bot-store.js';
import {createTelegramBot} from '../server/telegram-bot.js';
import {assessBotConfig,parseStaffUserIds,validStaffChatId} from '../server/bot-config.js';
import {createBotRuntime} from '../server/bot-runtime.js';
import {legal} from '../src/data.js';

const config={deliveryReady:true,sourceLegalStatus:'published',privacyUrl:'https://example.test/privacy',privacyStatus:'published',consentVersion:legal.consentVersion,staffUserIds:['55','56'],staffChatId:'-10099'};
const message=(id,text,chat=10,user=chat,type='private')=>({update_id:id,message:{chat:{id:chat,type},from:{id:user},text}});
const callback=(id,data,chat=10,user=chat,type='private')=>({update_id:id,callback_query:{id:`q${id}`,from:{id:user},data,message:{chat:{id:chat,type}}}});
const recent=async(store,recipient)=>Object.values((await store.inspect()).outbox).filter(item=>item.method==='sendMessage'&&item.recipient===String(recipient)).at(-1);
const action=async(store,type)=>{const entry=Object.entries((await store.inspect()).actions).filter(([,value])=>value.type===type).at(-1);assert.ok(entry,`Missing action ${type}`);return `a:${entry[0]}`;};
async function fixture({confirmed=false,remindersEnabled=false}={}){
 let now=Date.parse('2026-09-14T10:00:00Z');
 const store=createMemoryBotStore({clock:()=>now});
 const bot=createTelegramBot({store,config:{...config,remindersEnabled},verifyStaffMembership:async()=>true});
 await store.transactUpdate('locale-ru-10',tx=>tx.putClient(10,{locale:'ru'}));
 const record=await store.createBooking({id:'review-request',clientUserId:'10',clientChatId:'10',locale:'ru',status:confirmed?'confirmed':'pending',appointment:confirmed?now+2*86400000:null,reminders:{enabled:false},personType:'adult',contactName:'Test Adult',participantName:'Test Adult',age:25,programId:'boxen',groupId:'box-15',scheduleId:'',comment:'',consentVersion:legal.consentVersion,consentedAt:now});
 return {store,bot,record,advance:ms=>{now+=ms;}};
}

test('status cancellation requires a second explicit confirmation',async()=>{
 const {store,bot,record}=await fixture();
 await bot.handle(message(1,'/status'));
 await bot.handle(callback(2,await action(store,'client-cancel-prompt')));
 assert.equal((await store.getRequest(record.id)).status,'pending');
 assert.match((await recent(store,10)).text,/Отменить эту заявку/);
 await bot.handle(callback(3,await action(store,'client-cancel')));
 assert.equal((await store.getRequest(record.id)).status,'cancelled');
});

// This case intentionally enables the retained FUTURE reminder capability only for reminder behavior.
test('/stop invalidates an earlier opt-in button even when reminders were already off',async()=>{
 const {store,bot,record}=await fixture({confirmed:true,remindersEnabled:true});
 await bot.handle(message(1,'/status'));
 const earlier=await action(store,'client-reminders');
 await bot.handle(message(2,'/stop'));
 await bot.handle(callback(3,earlier));
 assert.equal((await store.getRequest(record.id)).reminders.enabled,false);
 assert.match((await recent(store,10)).text,/устарела/);
});

// This case intentionally enables the retained FUTURE reminder capability only for reminder behavior.
test('ambiguous reminder delivery is not recreated by another opt-in command',async()=>{
 const {store,bot}=await fixture({confirmed:true,remindersEnabled:true});
 await bot.handle(message(1,'/reminders'));
 await store.transactUpdate(2,tx=>{for(const item of Object.values(tx.raw.outbox))if(item.kind==='reminder')item.state='uncertain';});
 const count=Object.values((await store.inspect()).outbox).filter(x=>x.kind==='reminder').length;
 await bot.handle(message(3,'/reminders'));
 const reminders=Object.values((await store.inspect()).outbox).filter(x=>x.kind==='reminder');
 assert.equal(reminders.length,count);
 assert.ok(reminders.every(x=>x.state==='uncertain'));
});

test('expired session still uses saved German language for menu callback',async()=>{
 const {store,bot,advance}=await fixture();
 await bot.handle(callback(1,'cmd:lang:de'));
 advance(31*60000);
 await bot.handle(callback(2,'cmd:help'));
 assert.match((await recent(store,10)).text,/So stellst du/);
});

test('staff prompts work with Telegram group privacy and previews can be edited safely',async()=>{
 const {store,bot,record}=await fixture();
 await bot.handle(message(1,`/staff ${record.id}`,-10099,55,'group'));
 await bot.handle(callback(2,await action(store,'staff-reply'),-10099,55,'group'));
 assert.equal((await recent(store,-10099)).meta.reply_markup.force_reply,true);
 await bot.handle(message(3,'First draft',-10099,55,'group'));
 const first=await action(store,'staff-reply-commit');
 await bot.handle(message(4,'Revised draft',-10099,55,'group'));
 const revised=await action(store,'staff-reply-commit');
 await bot.handle(callback(5,first,-10099,55,'group'));
 assert.match((await recent(store,-10099)).text,/veraltet/);
 await bot.handle(callback(6,revised,-10099,56,'group'));
 assert.ok((await store.inspect()).actions[revised.slice(2)]);
 await bot.handle(callback(7,revised,-10099,55,'group'));
 assert.match((await recent(store,10)).text,/Revised draft/);
});

test('private staff user can use client commands when no staff composition is active',async()=>{
 const store=createMemoryBotStore(),bot=createTelegramBot({store,config:{...config,staffChatId:'55'}});
 await bot.handle(message(1,'/start',55));
 assert.match((await recent(store,55)).text,/AK-LOEWEN/);
});

test('configuration assessment never returns a bot token and supports info-only workers without staff',()=>{
 const env={BOT_ENABLED:'true',BOT_WORKER_ENABLED:'true',TELEGRAM_WORKER_SECRET:'w'.repeat(32),TELEGRAM_BOT_TOKEN:'synthetic-test-token'};
 const assessment=assessBotConfig(env,{requireEnabled:true,requireRedis:false});
 assert.equal(assessment.ok,true);
 assert.equal(assessment.workerReady,true);
 assert.equal(JSON.stringify(assessment).includes(env.TELEGRAM_BOT_TOKEN),false);
 const runtime=createBotRuntime(env,{store:createMemoryBotStore()});
 assert.equal(runtime.infoOnly,true);
 for(const id of ['0','01','9007199254740992','55,no'])assert.equal(parseStaffUserIds(id).ok,false);
 for(const id of ['0','-0','01','9007199254740992'])assert.equal(validStaffChatId(id),false);
 const bad=assessBotConfig({...env,TELEGRAM_WORKER_SECRET:` ${'w'.repeat(32)} `},{requireRedis:false});
 assert.equal(bad.ok,false);
});
