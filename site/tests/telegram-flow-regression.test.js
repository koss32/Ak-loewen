import test from 'node:test';
import assert from 'node:assert/strict';
import {createMemoryBotStore} from '../server/bot-store.js';
import {createTelegramBot} from '../server/telegram-bot.js';
import {legal} from '../src/data.js';

const cfg={deliveryReady:true,sourceLegalStatus:'published',privacyUrl:'https://example.test/privacy',privacyStatus:'published',consentVersion:legal.consentVersion,staffUserIds:['55','56'],staffChatId:'-10099'};
const msg=(id,chat,text,user=chat,type='private')=>({update_id:id,message:{chat:{id:chat,type},from:{id:user},text}});
const cb=(id,chat,data,user=chat,type='private')=>({update_id:id,callback_query:{id:`q${id}`,from:{id:user},data,message:{chat:{id:chat,type}}}});
const messages=state=>Object.values(state.outbox).filter(x=>x.method==='sendMessage');
async function last(store,predicate=()=>true){return messages(await store.inspect()).filter(predicate).at(-1);}
async function button(store,text){const item=await last(store,x=>x.meta?.reply_markup?.inline_keyboard?.flat().some(b=>b.text===text));return item.meta.reply_markup.inline_keyboard.flat().find(b=>b.text===text).callback_data;}
const saveRussian=(store,user=10)=>store.transactUpdate(`locale-ru-${user}`,tx=>tx.putClient(user,{locale:'ru'}));

async function createRecord(store,{id,user=10,status='pending',reminders=false}={}){
 await saveRussian(store,user);
 return store.transactUpdate(`seed-${id}`,tx=>tx.createRequest({id,clientChatId:String(user),clientUserId:String(user),locale:'ru',status,programId:'valset',groupId:'val-junior',scheduleId:'val-junior-week',personType:'minor',contactName:'Parent Name',participantName:'Child Name',age:6,guardianRole:'parent',comment:'line one\nline two',consentVersion:cfg.consentVersion,consentedAt:tx.now,reminders:{enabled:reminders},appointment:status==='confirmed'?tx.now+3*24*60*60*1000:null}));
}

test('/stop disables care for every retained client request and clears personal-data session',async()=>{
 const store=createMemoryBotStore();
 await createRecord(store,{id:'older',status:'confirmed',reminders:true});
 await createRecord(store,{id:'newer',status:'pending',reminders:true});
 await store.enqueue('10','care','reminder',Date.now(),{requestId:'older'});
 await store.enqueue('10','care','reminder',Date.now(),{requestId:'newer'});
 await store.setSession('10',{locale:'ru',stage:'contactName',contactName:'Sensitive Name'});
 const bot=createTelegramBot({store,config:cfg});
 await bot.handle(msg(1,10,'/stop'));
 const state=await store.inspect();
 assert.equal(await store.getSession('10'),undefined);
 for(const id of ['older','newer'])assert.equal((await store.getRequest(id)).reminders.enabled,false);
 for(const item of Object.values(state.outbox).filter(x=>x.kind==='reminder'))assert.equal(item.state,'cancelled');
});

test('status exposes all sibling requests, protects IDs, and preserves comment line breaks in staff evidence',async()=>{
 const store=createMemoryBotStore(),bot=createTelegramBot({store,config:cfg,verifyStaffMembership:async()=>true});
 await createRecord(store,{id:'first',status:'confirmed'});
 await createRecord(store,{id:'second',status:'pending'});
 await saveRussian(store,11);
 await bot.handle(msg(1,10,'/status'));
 const own=messages(await store.inspect()).filter(x=>x.recipient==='10');
 assert.ok(own.some(x=>x.text.includes('first'))&&own.some(x=>x.text.includes('second')));
 await bot.handle(msg(2,11,'/cancel first'));
 assert.match((await last(store,x=>x.recipient==='11')).text,/не найдено/);
 await bot.handle(msg(3,-10099,'/staff first',55,'group'));
 assert.match((await last(store,x=>x.recipient==='-10099'&&x.kind==='staff-card')).text,/line one\nline two/);
});

test('staff preview can only be committed by the composing staff user and expires after a newer composition',async()=>{
 const store=createMemoryBotStore(),bot=createTelegramBot({store,config:cfg,verifyStaffMembership:async()=>true});
 await createRecord(store,{id:'staff-request'});
 await bot.handle(msg(1,-10099,'/staff staff-request',55,'group'));
 const reply=await button(store,'Antwort verfassen');
 await bot.handle(cb(2,-10099,reply,55,'group'));
 await bot.handle(msg(3,-10099,'first draft',55,'group'));
 const firstCommit=await button(store,'Antwort bestätigen');
 // Open a new compose session and make a new preview, invalidating the old action revision.
 await bot.handle(msg(4,-10099,'/staff staff-request',55,'group'));
 const newerReply=await button(store,'Antwort verfassen');
 await bot.handle(cb(5,-10099,newerReply,55,'group'));
 await bot.handle(msg(6,-10099,'second draft',55,'group'));
 const secondCommit=await button(store,'Antwort bestätigen');
 await bot.handle(cb(7,-10099,firstCommit,56,'group'));
 assert.ok(!messages(await store.inspect()).some(x=>x.recipient==='10'&&/first draft/.test(x.text)));
 await bot.handle(cb(8,-10099,firstCommit,55,'group'));
 assert.ok(!messages(await store.inspect()).some(x=>x.recipient==='10'&&/first draft/.test(x.text)));
 await bot.handle(cb(9,-10099,secondCommit,55,'group'));
 assert.ok(messages(await store.inspect()).some(x=>x.recipient==='10'&&/second draft/.test(x.text)));
});

test('a changed consent configuration stops the flow before contact collection and commands are not treated as names',async()=>{
 const store=createMemoryBotStore();
 await saveRussian(store);
 const ready=createTelegramBot({store,config:cfg});
 await ready.handle(msg(1,10,'/book'));
 await ready.handle(cb(2,10,await button(store,'VALSET')));
 await ready.handle(cb(3,10,await button(store,'Junior · 5–8 лет')));
 const changed=createTelegramBot({store,config:{...cfg,consentVersion:'changed'}});
 await changed.handle(cb(4,10,await button(store,'Согласиться')));
 assert.equal(await store.getSession('10'),undefined);
 assert.equal(Object.keys((await store.inspect()).requests).length,0);
 await ready.handle(msg(5,10,'/book'));
 await ready.handle(cb(6,10,await button(store,'VALSET')));
 await ready.handle(cb(7,10,await button(store,'Junior · 5–8 лет')));
 await ready.handle(cb(8,10,await button(store,'Согласиться')));
 await ready.handle(msg(11,10,'/nonsense'));
 assert.equal((await store.getSession('10')).stage,'phone');
 assert.match((await last(store)).text,/Неизвестная команда/);
});
