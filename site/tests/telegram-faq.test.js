import test from 'node:test';
import assert from 'node:assert/strict';
import {createMemoryBotStore} from '../server/bot-store.js';
import {createTelegramBot} from '../server/telegram-bot.js';
import {botCopy} from '../server/bot-copy.js';
import {firstVisitCopy} from '../src/first-visit-copy.js';
import {contacts,legal} from '../src/data.js';

const config={deliveryReady:true,sourceLegalStatus:'published',privacyUrl:'https://example.test/privacy',privacyStatus:'published',consentVersion:legal.consentVersion,staffUserIds:['55'],staffChatId:'-10099'};
const message=(id,text)=>({update_id:id,message:{chat:{id:10,type:'private'},from:{id:10,language_code:'ru'},text}});
const callback=(id,data,{chat=10,user=chat,type='private'}={})=>({update_id:id,callback_query:{id:`faq-${id}`,from:{id:user},data,message:{chat:{id:chat,type}}}});
const messages=state=>Object.values(state.outbox).filter(item=>item.method==='sendMessage');
const latest=async store=>messages(await store.inspect()).at(-1);
const buttons=item=>item.meta.reply_markup.inline_keyboard.flat();
const topics=[['trial','faqTrial'],['equipment','faqEquipment'],['first','faqFirst'],['location','faqLocation']];
const localeLabels={de:'Häufige Fragen',ru:'Частые вопросы',uk:'Часті запитання',tr:'Sık sorulan sorular'};
const fixedTime=Date.parse('2026-09-15T10:00:00Z');

async function fixture(locale='de',overrides={}){
 const store=createMemoryBotStore({clock:()=>fixedTime});
 await store.transactUpdate(`saved-${locale}`,tx=>tx.putClient(10,{locale}));
 return {store,bot:createTelegramBot({store,config:{...config,...overrides}})};
}

test('website booking start payload opens the booking choices',async()=>{
 const {store,bot}=await fixture('ru');
 await bot.handle(message(1,'/start site_booking'));
 const item=await latest(store);
 assert.equal(item.text,botCopy.ru.choose);
 assert.equal((await store.getSession(10)).stage,'program');
 assert.equal(buttons(item).length,3);
});

function assertQuestions(item,locale){
 assert.equal(item.text,botCopy[locale].faqTitle);
 assert.deepEqual(buttons(item).map(b=>b.callback_data),[...topics.map(([topic])=>`cmd:faq:${topic}`),'cmd:menu']);
 for(const [topic,key] of topics){
  assert.equal(typeof botCopy[locale][key],'string');
  assert.ok(botCopy[locale][key].length>0);
  if(locale!=='de')assert.notEqual(botCopy[locale][key],botCopy.de[key]);
  assert.equal(buttons(item).find(b=>b.callback_data===`cmd:faq:${topic}`).text,botCopy[locale][key]);
 }
}

function assertNoBookingEffects(state){
 assert.deepEqual(state.requests,{});
 assert.deepEqual(state.actions,{});
 assert.ok(messages(state).every(item=>item.recipient==='10'&&item.kind==='message'));
}

for(const locale of Object.keys(localeLabels))test(`FAQ buttons and approved answers are localized in ${locale}`,async()=>{
 const {store,bot}=await fixture(locale);
 const copy=botCopy[locale],first=firstVisitCopy[locale];
 assert.equal(copy.faqButton,localeLabels[locale]);
 assert.equal(typeof copy.faqTitle,'string');
 assert.ok(copy.faqTitle.length>0);
 if(locale!=='de')assert.notEqual(copy.faqTitle,botCopy.de.faqTitle);
 await bot.handle(message(1,'/start'));
 const main=await latest(store);
 assert.equal(main.text,copy.welcome);
 assert.deepEqual(buttons(main).find(b=>b.callback_data==='cmd:faq'),{text:`❓ ${copy.faqButton}`,callback_data:'cmd:faq'});
 await bot.handle(callback(2,buttons(main).find(b=>b.callback_data==='cmd:faq').callback_data));
 assertQuestions(await latest(store),locale);
 const answers={
  trial:first.firstVisitNote,
  equipment:first.firstVisitSteps[0].text,
  first:[first.firstVisitIntro,...first.firstVisitSteps.slice(1).map(step=>step.text)].join('\n\n'),
  location:copy.location.replace('{address}',contacts.trainingAddress).replace('{map}',contacts.map).replace('{email}',contacts.email)
 };
 let id=3;
 for(const [topic,key] of topics){
  const question=buttons(await latest(store)).find(b=>b.callback_data===`cmd:faq:${topic}`);
  await bot.handle(callback(id++,question.callback_data));
  const answer=await latest(store);
  assert.equal(answer.text,`${copy[key]}\n\n${answers[topic]}`);
  assert.doesNotMatch(answer.text,/<br\s*\/?\s*>|undefined/);
  assert.deepEqual(buttons(answer).filter(b=>b.callback_data).map(b=>b.callback_data),['cmd:faq','cmd:menu']);
  assert.equal(buttons(answer).find(b=>b.callback_data==='cmd:faq').text,`❓ ${copy.faqButton}`);
  assert.equal(buttons(answer).find(b=>b.callback_data==='cmd:menu').text,`↩️ ${copy.menuButton}`);
  if(topic==='location')assert.deepEqual(buttons(answer).find(b=>b.url),{text:`📍 ${copy.mapButton}`,url:contacts.map});
  await bot.handle(callback(id++,buttons(answer).find(b=>b.callback_data==='cmd:faq').callback_data));
  assertQuestions(await latest(store),locale);
 }
 await bot.handle(callback(id,'cmd:menu'));
 assert.equal((await latest(store)).text,copy.welcome);
 assert.equal(await store.getSession(10),undefined);
 assert.equal((await store.inspect()).clients['10'].locale,locale);
 assertNoBookingEffects(await store.inspect());
});

for(const [gate,overrides] of [
 ['source notice pending',{sourceLegalStatus:'pending'}],
 ['runtime notice pending',{privacyStatus:'pending'}],
 ['consent version mismatch',{consentVersion:'telegram-2026-09-14-v0'}]
])test(`FAQ stays available while booking is blocked by ${gate}`,async()=>{
 for(const locale of Object.keys(localeLabels)){
  const {store,bot}=await fixture(locale,overrides);
  assert.equal(bot.infoOnly,true);
  await bot.handle(message(1,'/start'));
  await bot.handle(callback(2,'cmd:book'));
  assert.equal((await latest(store)).text,botCopy[locale].blocked);
  assert.equal(await store.getSession(10),undefined);
  await bot.handle(callback(3,'cmd:faq'));
  assertQuestions(await latest(store),locale);
  let id=4;
  for(const [topic,key] of topics){
   await bot.handle(callback(id++,`cmd:faq:${topic}`));
   assert.ok((await latest(store)).text.startsWith(`${botCopy[locale][key]}\n\n`));
  }
  await bot.handle(callback(id++,'cmd:menu'));
  assert.equal((await latest(store)).text,botCopy[locale].welcome);
  await bot.handle(callback(id,'cmd:book'));
  assert.equal((await latest(store)).text,botCopy[locale].blocked);
  assert.equal(await store.getSession(10),undefined);
  assertNoBookingEffects(await store.inspect());
 }
});

test('unknown FAQ topics safely show the localized question list',async()=>{
 for(const locale of Object.keys(localeLabels)){
  const {store,bot}=await fixture(locale);
  let id=1;
  for(const topic of ['missing','__proto__','constructor','<script>','']){
   await bot.handle(callback(id++,`cmd:faq:${topic}`));
   assertQuestions(await latest(store),locale);
   assert.doesNotMatch((await latest(store)).text,/undefined|<script>/);
  }
  assert.equal(await store.getSession(10),undefined);
  assertNoBookingEffects(await store.inspect());
 }
});

test('FAQ, language-menu and back buttons preserve each in-progress draft and its action tokens',async()=>{
 for(const stage of ['program','group','consent','personType','guardian','contactName','participantName','age','schedule','comment','preview']){
  const {store,bot}=await fixture('ru');
  await store.transactUpdate(`draft-${stage}`,tx=>{
   const session=tx.putSession(10,{locale:'ru',stage,programId:'valset',groupId:'val-junior',scheduleId:'val-junior-week',personType:'minor',guardianRole:'parent',contactName:'Existing Parent',participantName:'Existing Child',age:6,comment:'Keep this draft',consentedAt:tx.now,consentVersion:legal.consentVersion,consentNoticeVersion:legal.consentVersion});
   tx.addAction({scope:'client',type:'submit',stage,sessionRevision:session.revision,reminders:false});
  });
  const before=await store.inspect();
  let id=1;
  for(const command of ['cmd:faq',...topics.map(([topic])=>`cmd:faq:${topic}`),'cmd:faq:missing','cmd:faq','cmd:menu','cmd:language','cmd:menu']){
   await bot.handle(callback(id++,command));
   const after=await store.inspect();
   for(const key of ['sessions','clients','requests','actions'])assert.deepEqual(after[key],before[key],`${stage}: ${command} changed ${key}`);
   assert.ok(messages(after).every(item=>item.recipient==='10'&&item.kind==='message'));
   assert.ok(messages(after).every(item=>!item.text.includes('Existing Parent')&&!item.text.includes('Existing Child')&&!item.text.includes('Keep this draft')));
  }
 }
});

test('a genuine booking button remains usable after FAQ navigation without creating a request',async()=>{
 const {store,bot}=await fixture();
 await bot.handle(message(1,'/book'));
 const valset=buttons(await latest(store)).find(b=>b.text==='VALSET').callback_data;
 const before=await store.inspect();
 await bot.handle(callback(2,'cmd:faq'));
 await bot.handle(callback(3,'cmd:faq:first'));
 await bot.handle(callback(4,'cmd:menu'));
 const after=await store.inspect();
 assert.deepEqual(after.sessions,before.sessions);
 assert.deepEqual(after.actions,before.actions);
 await bot.handle(callback(5,valset));
 assert.equal((await store.getSession(10)).stage,'group');
 assert.equal((await store.getSession(10)).programId,'valset');
 assert.deepEqual((await store.inspect()).requests,{});
 assert.ok(messages(await store.inspect()).every(item=>item.recipient==='10'&&item.kind==='message'));
});

test('FAQ preserves a draft across a consent change but cannot bypass the renewed booking gate',async()=>{
 const {store,bot}=await fixture();
 await bot.handle(message(1,'/book'));
 const valset=buttons(await latest(store)).find(b=>b.text==='VALSET').callback_data;
 const before=await store.inspect();
 const changed=createTelegramBot({store,config:{...config,consentVersion:'telegram-2026-09-14-v0'}});
 await changed.handle(callback(2,'cmd:faq'));
 await changed.handle(callback(3,'cmd:faq:trial'));
 await changed.handle(callback(4,'cmd:menu'));
 const after=await store.inspect();
 for(const key of ['sessions','clients','requests','actions'])assert.deepEqual(after[key],before[key]);
 await changed.handle(callback(5,valset));
 assert.equal((await latest(store)).text,botCopy.de.blocked);
 assert.equal(await store.getSession(10),undefined);
 assert.deepEqual((await store.inspect()).requests,{});
 assert.ok(messages(await store.inspect()).every(item=>item.recipient==='10'&&item.kind==='message'));
});

test('FAQ callbacks reject groups and other users without messages, data changes or staff actions',async()=>{
 const {store,bot}=await fixture('ru');
 await store.transactUpdate('protected-draft',tx=>{
  tx.putSession(10,{locale:'ru',stage:'comment',contactName:'Private Parent',participantName:'Private Child'});
  tx.putSession('staff:-10099:55',{locale:'de',stage:'staff-reply',requestId:'private-request',reply:'Private staff draft'});
  tx.addAction({scope:'staff',type:'staff-reply',ownerUserId:'55',requestId:'private-request'});
 });
 const before=await store.inspect();
 let id=1;
 for(const identity of [{chat:-10099,user:55,type:'group'},{chat:-10099,user:55,type:'supergroup'},{chat:10,user:11},{chat:10,user:55}]){
  for(const command of ['cmd:faq',...topics.map(([topic])=>`cmd:faq:${topic}`),'cmd:faq:unknown']){
   await bot.handle(callback(id++,command,identity));
   const after=await store.inspect();
   for(const key of ['sessions','clients','requests','actions'])assert.deepEqual(after[key],before[key]);
   assert.deepEqual(messages(after),messages(before));
   assert.ok(Object.values(after.outbox).every(item=>item.method==='answerCallbackQuery'&&item.kind==='callback-answer'));
  }
 }
});
