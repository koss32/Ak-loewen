import test from 'node:test';
import assert from 'node:assert/strict';
import {createMemoryBotStore} from '../server/bot-store.js';
import {createTelegramBot,nextTrainingStart} from '../server/telegram-bot.js';
import {legal} from '../src/data.js';

// This file exercises the retained FUTURE reminder capability explicitly.
const cfg={deliveryReady:true,remindersEnabled:true,sourceLegalStatus:'published',privacyUrl:'https://example.test/privacy',privacyStatus:'published',consentVersion:legal.consentVersion,staffUserIds:['55'],staffChatId:'-10099'};
const msg=(id,chat,text,user=chat,type='private')=>({update_id:id,message:{chat:{id:chat,type},from:{id:user},text}});
const cb=(id,chat,data,user=chat,type='private')=>({update_id:id,callback_query:{id:`q${id}`,from:{id:user},data,message:{chat:{id:chat,type}}}});
const sent=state=>Object.values(state.outbox).filter(item=>item.method==='sendMessage');
async function button(store,text){const item=sent(await store.inspect()).filter(entry=>entry.meta?.reply_markup?.inline_keyboard?.flat().some(item=>item.text===text)).at(-1);assert.ok(item,`button ${text}`);return item.meta.reply_markup.inline_keyboard.flat().find(item=>item.text===text).callback_data;}
async function seed(store,id='request'){return store.transactUpdate(`seed-${id}`,tx=>tx.createRequest({id,clientChatId:'10',clientUserId:'10',locale:'ru',status:'pending',programId:'sambo-mma',groupId:'sambo-9-15',scheduleId:'sambo-young-sat',personType:'minor',contactName:'Parent Name',participantName:'Child Name',age:10,guardianRole:'parent',comment:'',consentVersion:cfg.consentVersion,consentedAt:tx.now,reminders:{enabled:true},appointment:null}));}

test('trainer selects a group training instead of entering a timestamp; client receives the nearest occurrence and reminder',async()=>{
 let now=Date.parse('2026-09-01T10:00:00Z');
 const store=createMemoryBotStore({clock:()=>now}),bot=createTelegramBot({store,config:cfg,verifyStaffMembership:async()=>true});
 await seed(store);
 await bot.handle(msg(1,-10099,'/staff request',55,'group'));
 await bot.handle(cb(2,-10099,await button(store,'Training bestätigen'),55,'group'));
 const choices=sent(await store.inspect()).at(-1).meta.reply_markup.inline_keyboard.flat().map(item=>item.text);
 assert.deepEqual(choices,['Dienstag, Donnerstag · 16:30–18:00 · Europe/Berlin','Samstag · 10:00–11:30 · Europe/Berlin']);
 await bot.handle(cb(3,-10099,await button(store,'Samstag · 10:00–11:30 · Europe/Berlin'),55,'group'));
 const request=await store.getRequest('request');
 assert.equal(request.status,'confirmed');
 assert.equal(request.scheduleId,'sambo-young-sat');
 assert.equal(request.appointment,Date.parse('2026-09-05T08:00:00Z'));
 const client=sent(await store.inspect()).filter(item=>item.recipient==='10').at(-1);
 assert.match(client.text,/Ближайшая тренировка/);
 assert.match(client.text,/5 сент\. 2026 г\., 10:00/);
 const reminder=Object.values((await store.inspect()).outbox).find(item=>item.kind==='reminder');
 assert.equal(reminder.notBefore,Date.parse('2026-09-05T06:00:00Z'));
});

test('trainer can reject with a personal explanation that the bot sends to the client',async()=>{
 const store=createMemoryBotStore(),bot=createTelegramBot({store,config:cfg,verifyStaffMembership:async()=>true});
 await seed(store,'rejection');
 await bot.handle(msg(1,-10099,'/staff rejection',55,'group'));
 await bot.handle(cb(2,-10099,await button(store,'Ablehnen'),55,'group'));
 await bot.handle(msg(3,-10099,'Leider ist diese Gruppe diese Woche voll.',55,'group'));
 await bot.handle(cb(4,-10099,await button(store,'Ablehnung senden'),55,'group'));
 assert.equal((await store.getRequest('rejection')).status,'cancelled');
 const client=sent(await store.inspect()).filter(item=>item.recipient==='10').at(-1);
 assert.match(client.text,/Leider ist diese Gruppe diese Woche voll/);
});

test('nearest recurring training is calculated in Berlin time across the DST offset change',()=>{
 assert.equal(nextTrainingStart('box-week',Date.parse('2026-10-23T17:00:00Z')),Date.parse('2026-10-26T17:30:00Z'));
});
