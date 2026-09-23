import test from 'node:test';
import assert from 'node:assert/strict';
import {createMemoryBotStore} from '../server/bot-store.js';
import {createTelegramBot} from '../server/telegram-bot.js';
import {botCopy} from '../server/bot-copy.js';
import {legal} from '../src/data.js';
const cfg={deliveryReady:true,sourceLegalStatus:'published',privacyUrl:'https://example.test/privacy',privacyStatus:'published',consentVersion:legal.consentVersion,staffUserIds:['55'],staffChatId:'-10099'};
const msg=(id,chat,text,user=chat,language_code)=>({update_id:id,message:{chat:{id:chat,type:'private'},from:{id:user,...(language_code===undefined?{}:{language_code})},text}});
const cb=(id,chat,data,language_code)=>({update_id:id,callback_query:{id:`q${id}`,from:{id:chat,...(language_code===undefined?{}:{language_code})},data,message:{chat:{id:chat,type:'private'}}}});
const last=async store=>Object.values((await store.inspect()).outbox).filter(x=>x.method==='sendMessage').at(-1);
const button=async(store,text)=>{const x=Object.values((await store.inspect()).outbox).filter(x=>x.meta?.reply_markup?.inline_keyboard?.flat().some(b=>b.text===text)).at(-1);return x.meta.reply_markup.inline_keyboard.flat().find(b=>b.text===text).callback_data;};
const languageCodes=[undefined,'','unknown','en-US','de','de-DE','ru','ru-RU','uk','uk-UA','ua','tr','tr-TR'];
const localeNames=[['de','Deutsch'],['ru','Русский'],['uk','Українська'],['tr','Türkçe']];

test('new users always start in German regardless of Telegram language_code',async()=>{
 for(const languageCode of languageCodes){
  const store=createMemoryBotStore(),bot=createTelegramBot({store,config:cfg});
  await bot.handle(msg(1,10,'/start',10,languageCode));
  assert.equal((await last(store)).text,'AK-LOEWEN × VALSET. Bitte wähle eine Aktion.',String(languageCode));
  assert.equal((await store.inspect()).clients['10'].locale,'de');
  const main=(await last(store)).meta.reply_markup.inline_keyboard.flat();
  assert.ok(main.some(b=>b.callback_data==='cmd:book'&&b.text===botCopy.de.book));
  assert.ok(main.some(b=>b.callback_data==='cmd:contact'&&b.text===botCopy.de.contactButton));
  assert.deepEqual(main.find(b=>b.callback_data==='cmd:language'),{text:'🌐 Sprache',callback_data:'cmd:language'});
  assert.equal(main.filter(b=>b.callback_data.startsWith('cmd:lang:')).length,0);
  await bot.handle(msg(2,10,'/help',10,languageCode));
  assert.match((await last(store)).text,/So stellst du/);
  assert.equal((await store.inspect()).clients['10'].locale,'de');
 }
});

test('first-contact callbacks and direct booking also ignore Telegram language_code',async()=>{
 for(const languageCode of languageCodes){
  const store=createMemoryBotStore(),bot=createTelegramBot({store,config:cfg});
  await bot.handle(cb(1,10,'cmd:menu',languageCode));
  assert.equal((await last(store)).text,botCopy.de.welcome);
  await bot.handle(cb(2,10,'cmd:language',languageCode));
  assert.equal((await last(store)).text,'Sprache');
  await bot.handle(cb(3,10,'cmd:book',languageCode));
  assert.equal((await store.getSession(10)).locale,'de');
  assert.equal((await last(store)).text,botCopy.de.choose);
  const directStore=createMemoryBotStore(),directBot=createTelegramBot({store:directStore,config:cfg});
  await directBot.handle(msg(1,10,'/book',10,languageCode));
  assert.equal((await directStore.getSession(10)).locale,'de');
  assert.equal((await directStore.inspect()).clients['10'].locale,'de');
 }
});

test('saved DE/RU/UK/TR locale wins over conflicting Telegram language codes',async()=>{
 for(const [locale] of localeNames){
  const store=createMemoryBotStore(),bot=createTelegramBot({store,config:cfg});
  await store.transactUpdate(`saved-${locale}`,tx=>tx.putClient(10,{locale}));
  const languageCode=locale==='de'?'ru-RU':'de-DE';
  await bot.handle(msg(1,10,'/start',10,languageCode));
  assert.equal((await last(store)).text,botCopy[locale].welcome);
  await bot.handle(cb(2,10,'cmd:menu',languageCode));
  assert.equal((await last(store)).text,botCopy[locale].welcome);
  assert.equal((await store.inspect()).clients['10'].locale,locale);
 }
});

test('four self-named choices in the separate Sprache menu persist after session expiry',async()=>{
 for(const [locale,name] of localeNames){
  let now=Date.parse('2026-09-15T10:00:00Z');
  const store=createMemoryBotStore({clock:()=>now}),bot=createTelegramBot({store,config:cfg});
  await bot.handle(msg(1,10,'/start'));
  await bot.handle(cb(2,10,await button(store,'🌐 Sprache')));
  const selector=(await last(store)).meta.reply_markup.inline_keyboard.flat();
  assert.deepEqual(selector.filter(b=>b.callback_data.startsWith('cmd:lang:')).map(b=>[b.callback_data,b.text]),localeNames.map(([code,label])=>[`cmd:lang:${code}`,label]));
  await bot.handle(cb(3,10,await button(store,name)));
  assert.equal((await store.inspect()).clients['10'].locale,locale);
  assert.equal((await last(store)).text,botCopy[locale].welcome);
  now+=31*60000;
  assert.equal(await store.getSession(10),undefined);
  await bot.handle(msg(4,10,'/help',10,locale==='de'?'ru':'de'));
  assert.match((await last(store)).text,new RegExp(locale==='de'?'So stellst':locale==='ru'?'Как записаться':locale==='uk'?'Як надіслати':'Talep nasıl'));
  assert.equal((await store.inspect()).clients['10'].locale,locale);
  await bot.handle(cb(5,10,'cmd:menu'));
  assert.equal((await last(store)).text,botCopy[locale].welcome);
 }
});

test('Ukrainian and Turkish bookings localize preview, status and controls',async()=>{for(const [locale,program,group,consent,status,comment] of [['uk','Бокс','15+ років','Погодитися','Статус','Коментар'],['tr','Boks','15+ yaş','Kabul et','Durum','Yorum']]){const store=createMemoryBotStore(),bot=createTelegramBot({store,config:cfg});let i=1;await bot.handle(msg(i++,20,'/language'));await bot.handle(cb(i++,20,await button(store,locale==='uk'?'Українська':'Türkçe')));await bot.handle(msg(i++,20,'/help'));assert.match((await last(store)).text,new RegExp(locale==='uk'?'Як надіслати':'Talep nasıl'));await bot.handle(msg(i++,20,'/book'));await bot.handle(cb(i++,20,await button(store,program)));await bot.handle(cb(i++,20,await button(store,group)));await bot.handle(cb(i++,20,await button(store,consent)));await bot.handle(msg(i++,20,'+49 151 1234567'));assert.match((await last(store)).text,new RegExp(comment));await bot.handle(cb(i++,20,await button(store,botCopy[locale].skip)));const choices=(await last(store)).meta.reply_markup.inline_keyboard.flat();assert.deepEqual(choices.map(b=>b.text),[botCopy[locale].submit]);assert.equal(Object.keys((await store.inspect()).requests).length,0);await bot.handle(cb(i++,20,await button(store,botCopy[locale].submit)));const records=Object.values((await store.inspect()).requests);assert.equal(records.length,1);assert.equal(records[0].locale,locale);assert.equal(records[0].contactName,'+49 151 1234567');assert.equal(records[0].reminders.enabled,false);assert.equal(records[0].consentVersion,legal.consentVersion);await bot.handle(msg(i,20,'/status'));assert.match((await last(store)).text,new RegExp(status));}});
