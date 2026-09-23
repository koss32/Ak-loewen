import test from 'node:test';
import assert from 'node:assert/strict';
import {createMemoryBotStore} from '../server/bot-store.js';
import {createTelegramBot,drainTelegramOutbox} from '../server/telegram-bot.js';
import {botCopy} from '../server/bot-copy.js';
import {contactCopy} from '../server/contact-copy.js';
import {translations} from '../src/locales.js';
import {legal} from '../src/data.js';
import {createWebhookHandler} from '../api/telegram-webhook.js';
import {createBotRuntime} from '../server/bot-runtime.js';

const GROUP='-10099';
const cfg={deliveryReady:true,sourceLegalStatus:'published',privacyUrl:'https://runtime.example/privacy-v2',privacyStatus:'published',consentVersion:legal.consentVersion,staffUserIds:['55'],staffChatId:GROUP};

function fixture(){
 let now=Date.parse('2026-09-19T10:00:00Z'),id=0,messageId=100,calls=[],failNext=false;
 const store=createMemoryBotStore({clock:()=>now});
 const transport=async(url,options)=>{
  const method=url.split('/').at(-1),body=JSON.parse(options.body);calls.push({method,body});
  if(method==='sendMessage'&&failNext){failNext=false;return {status:403,json:async()=>({ok:false,error_code:403})};}
  return {status:200,json:async()=>({ok:true,result:['deleteMessage','answerCallbackQuery'].includes(method)?true:{message_id:++messageId}})};
 };
 const bot=createTelegramBot({store,config:cfg,verifyStaffMembership:async()=>true});
 const message=(text,user={id:10,first_name:'  Alice\u0000 ',last_name:'\nSmith ',username:'not-a-name'},chat=user.id,type='private')=>({update_id:++id,message:{message_id:900+id,chat:{id:chat,type},from:user,text}});
 const callback=(data,user={id:10,first_name:'Alice',last_name:'Smith'},chat=user.id,type='private',message_id=777)=>({update_id:++id,callback_query:{id:`q${id}`,from:user,data,message:{message_id,chat:{id:chat,type}}}});
 const apply=async(update,onUiCleanup)=>{await bot.handle(update);await drainTelegramOutbox({store,token:'test',fetchImpl:transport,sourceUpdateId:update.update_id,limit:30,timeoutMs:250,maxDurationMs:5000,onUiCleanup});};
 const action=async type=>{const entry=Object.entries((await store.inspect()).actions).filter(([,value])=>value.type===type).at(-1);assert.ok(entry,`missing ${type}`);return `a:${entry[0]}`;};
 return {store,calls,message,callback,apply,action,advance:ms=>{now+=ms;},failNext:()=>{failNext=true;}};
}

const sendCalls=f=>f.calls.filter(call=>call.method==='sendMessage');

test('webhook waitUntil cleans the prior tracked UI without enabling worker or reminders',async()=>{
 let now=Date.now(),messageId=100;const calls=[],tasks=[],sleeps=[];
 const store=createMemoryBotStore({clock:()=>now});
 const env={BOT_ENABLED:'true',BOT_WEBHOOK_ENABLED:'true',BOT_WORKER_ENABLED:'false',BOT_REMINDERS_ENABLED:'false',PUBLIC_ORIGIN:'https://example.test',TELEGRAM_WEBHOOK_SECRET:'h'.repeat(32),TELEGRAM_BOT_TOKEN:'test-token',TELEGRAM_STAFF_USER_IDS:'55',TELEGRAM_STAFF_CHAT_ID:GROUP,TELEGRAM_SEND_TIMEOUT_MS:'250'};
 const transport=async(url,options)=>{
  const method=url.split('/').at(-1),body=JSON.parse(options.body);calls.push({method,body});
  return {status:200,json:async()=>({ok:true,result:method==='sendMessage'?{message_id:++messageId}:true})};
 };
 const handler=createWebhookHandler({env,sleep:async ms=>{sleeps.push(ms);now+=ms;},waitUntilTask:task=>tasks.push(task),fetchImpl:transport,createRuntime:runtimeEnv=>createBotRuntime(runtimeEnv,{store,fetchImpl:transport})});
 for(const updateId of [1,2]){
  const res={statusCode:0,body:null,setHeader(){},status(code){this.statusCode=code;return this;},json(body){this.body=body;}};
  await handler({method:'POST',headers:{host:'example.test','content-type':'application/json','x-telegram-bot-api-secret-token':env.TELEGRAM_WEBHOOK_SECRET},rawBody:Buffer.from(JSON.stringify({update_id:updateId,message:{message_id:900+updateId,chat:{id:10,type:'private'},from:{id:10,first_name:'TEST'},text:updateId===1?'/start':'/language'}}))},res);
  assert.equal(res.statusCode,200);
 }
 await Promise.all(tasks);
 assert.deepEqual(sleeps,[1000]);
 assert.deepEqual(calls.filter(call=>call.method==='deleteMessage').map(call=>call.body),[{chat_id:'10',message_id:101}]);
 assert.equal((await store.inspect()).clients['10'].disposableUiMessageId,102);
});

test('RU booking is group → consent → phone → optional comment → review with profile name and no removed questions',async()=>{
 const f=fixture();
 await f.store.transactUpdate('ru',tx=>tx.putClient(10,{locale:'ru'}));
 await f.apply(f.message('/book'));
 await f.apply(f.callback(await f.action('program')));
 await f.apply(f.callback(await f.action('group')));
 const consent=sendCalls(f).at(-1).body;
 assert.equal(consent.text,'Примите Datenschutz.');
 assert.ok(!consent.text.includes(cfg.privacyUrl)&&!consent.text.includes('Version'));
 assert.deepEqual(consent.link_preview_options,{is_disabled:true});
 assert.deepEqual(consent.reply_markup.inline_keyboard[0],[{text:'Datenschutz',url:cfg.privacyUrl}]);
 assert.deepEqual(consent.reply_markup.inline_keyboard[1].map(button=>button.text),['Согласиться','Отказаться']);
 await f.apply(f.callback(await f.action('consent')));
 assert.equal(sendCalls(f).at(-1).body.text,'Введите номер телефона.');
 await f.apply(f.message('@username'));
 assert.equal(sendCalls(f).at(-1).body.text,'Введите действительный номер телефона.');
 await f.apply(f.message('https://t.me/username'));
 assert.equal(sendCalls(f).at(-1).body.text,'Введите действительный номер телефона.');
 await f.apply(f.message('+49 151 1234567'));
 const comment=sendCalls(f).at(-1).body;
 assert.equal(comment.text,'Комментарий (необязательно).');
 assert.deepEqual(comment.reply_markup.inline_keyboard,[[{text:'Пропустить',callback_data:await f.action('comment-skip')}]]);
 await f.apply(f.callback(await f.action('comment-skip')));
 const review=sendCalls(f).at(-1).body;
 assert.match(review.text,/Участник: Alice Smith/);
 assert.doesNotMatch(review.text,/Возраст|Роль|undefined/);
 const reviewId=(await f.store.inspect()).clients['10'].disposableUiMessageId;
 await f.apply(f.callback(await f.action('submit')));
 const submitted=await f.store.inspect();
 assert.ok(reviewId>0);
 assert.ok(!Object.values(submitted.outbox).some(item=>item.kind==='interface-cleanup'));
 assert.equal(submitted.clients['10'].disposableUiMessageId,undefined,'final confirmation is not disposable');
 const finalIds=Object.values(submitted.outbox).filter(item=>item.state==='sent'&&!item.meta?.disposableUi).map(item=>item.messageId);
 await f.apply(f.message('/start'));
 assert.ok(Object.values((await f.store.inspect()).outbox).filter(item=>item.kind==='interface-cleanup').every(item=>!finalIds.includes(item.payload.message_id)));
 const request=Object.values((await f.store.inspect()).requests)[0];
 assert.equal(request.contactName,'+49 151 1234567');
 assert.equal(request.participantName,'Alice Smith');
 assert.equal('age' in request,false);
 assert.equal(request.scheduleId,'');
 const allTexts=sendCalls(f).map(call=>call.body.text).join('\n');
 for(const forbidden of [botCopy.ru.participantName,botCopy.ru.age,botCopy.ru.guardian,'/skip'])assert.ok(!allTexts.includes(forbidden),forbidden);
 const staff=sendCalls(f).find(call=>call.body.chat_id===GROUP&&call.body.text.includes(request.id)).body.text;
 assert.doesNotMatch(staff,/undefined|,\s*\d+\n/);
});

test('DE/RU/UK/TR use runtime privacy buttons, concise phone/comment prompts, and inline skip',async()=>{
 const expected={de:{privacy:'Bitte Datenschutz bestätigen.',phone:'Bitte Telefonnummer eingeben.',comment:'Kommentar (optional).'},ru:{privacy:'Примите Datenschutz.',phone:'Введите номер телефона.',comment:'Комментарий (необязательно).'},uk:{privacy:'Підтвердьте Datenschutz.',phone:'Введіть номер телефону.',comment:'Коментар (необов’язково).'},tr:{privacy:'Datenschutz’u kabul edin.',phone:'Telefon numaranızı girin.',comment:'Yorum (isteğe bağlı).'}};
 for(const [locale,copy] of Object.entries(expected)){
  const f=fixture();await f.store.transactUpdate(`locale-${locale}`,tx=>tx.putClient(10,{locale}));
  await f.apply(f.message('/book'));await f.apply(f.callback(await f.action('program')));await f.apply(f.callback(await f.action('group')));
  const consent=sendCalls(f).at(-1).body;
  assert.equal(consent.text,copy.privacy);assert.ok(!consent.text.includes(cfg.privacyUrl));
  assert.deepEqual(consent.reply_markup.inline_keyboard[0],[{text:'Datenschutz',url:cfg.privacyUrl}]);
  await f.apply(f.callback(await f.action('consent')));assert.equal(sendCalls(f).at(-1).body.text,copy.phone);
  await f.apply(f.message('+49 151 1234567'));const comment=sendCalls(f).at(-1).body;
  assert.equal(comment.text,copy.comment);assert.equal(comment.reply_markup.inline_keyboard.flat()[0].text,botCopy[locale].skip);
  await f.apply(f.message('/contact'));assert.equal(sendCalls(f).at(-1).body.text,contactCopy[locale].prompt);assert.ok(!sendCalls(f).at(-1).body.text.includes('http'));
 }
});

test('decline cancels cleanly and profile fallback never uses username',async()=>{
 const f=fixture();
 await f.store.transactUpdate('ru',tx=>tx.putClient(10,{locale:'ru'}));
 await f.apply(f.message('/book'));
 await f.apply(f.callback(await f.action('program')));
 await f.apply(f.callback(await f.action('group')));
 await f.apply(f.callback(await f.action('consent-decline')));
 assert.equal(await f.store.getSession(10),undefined);
 assert.equal(Object.keys((await f.store.inspect()).requests).length,0);
 assert.equal(sendCalls(f).at(-1).body.text,botCopy.ru.welcome);
 const anonymous={id:11,first_name:'A',last_name:' ',username:'real_username'};
 await f.store.transactUpdate('ru-11',tx=>tx.putClient(11,{locale:'ru'}));
 await f.apply(f.message('/book',anonymous));
 await f.apply(f.callback(await f.action('program'),anonymous));
 await f.apply(f.callback(await f.action('group'),anonymous));
 await f.apply(f.callback(await f.action('consent'),anonymous));
 await f.apply(f.message('+49 151 7654321',anonymous));
 await f.apply(f.callback(await f.action('comment-skip'),anonymous));
 await f.apply(f.callback(await f.action('submit'),anonymous));
 const request=Object.values((await f.store.inspect()).requests).find(record=>record.clientUserId==='11');
 assert.equal(request.participantName,'Пользователь Telegram');
 assert.ok(!request.participantName.includes('real_username'));
});

test('old removed wizard stages advance safely without reviving name or age collection',async()=>{
 const f=fixture();
 await f.store.transactUpdate('old',tx=>{tx.putClient(10,{locale:'ru'});tx.putSession(10,{locale:'ru',stage:'age',programId:'valset',groupId:'val-junior',contactName:'+49 151 1234567',consentedAt:tx.now,consentVersion:legal.consentVersion,consentNoticeVersion:legal.consentVersion});});
 await f.apply(f.message('7'));
 assert.equal((await f.store.getSession(10)).stage,'comment');
 assert.equal(sendCalls(f).at(-1).body.text,'Комментарий (необязательно).');
 await f.store.transactUpdate('old-no-phone',tx=>tx.putSession(10,{locale:'ru',stage:'participantName',programId:'valset',groupId:'val-junior',contactName:'@legacy_name',consentedAt:tx.now,consentVersion:legal.consentVersion,consentNoticeVersion:legal.consentVersion}));
 await f.apply(f.message('ignored old field'));
 assert.equal((await f.store.getSession(10)).stage,'phone');
 assert.equal(sendCalls(f).at(-1).body.text,'Введите номер телефона.');
});

test('localized senior labels are corrected without changing group IDs',()=>{
 assert.equal(translations.ru.seniorGroup,'Старшая группа · 9–16 лет');
 assert.equal(translations.de.seniorGroup,'Ältere Gruppe · 9–16 Jahre');
 assert.equal(translations.uk.seniorGroup,'Старша група · 9–16 років');
 assert.equal(translations.tr.seniorGroup,'Büyük yaş grubu · 9–16 yaş');
});

test('only successfully delivered private UI exposes the prior card for cleanup',async()=>{
 const f=fixture();
 await f.apply(f.message('/start'));
 const first=sendCalls(f).at(-1).body;
 const targets=[];const update=f.callback('cmd:language',undefined,10,'private',9999);
 await f.apply(update,target=>targets.push(target));
 const state=await f.store.inspect();
 assert.equal(state.clients['10'].disposableUiMessageId,102);
 assert.ok(!Object.values(state.outbox).some(item=>item.kind==='interface-cleanup'));
 assert.ok(!f.calls.some(call=>call.method==='deleteMessage'));
 assert.deepEqual(targets,[{chatId:'10',messageId:101}]);
 assert.equal(first.chat_id,'10');
 const failed=fixture();
 await failed.apply(failed.message('/start'));
 failed.failNext();
 await failed.apply(failed.callback('cmd:language'));
 assert.equal((await failed.store.inspect()).clients['10'].disposableUiMessageId,101);
});

test('contact prompt is concise and Reply/Close preserve contact and staff history from cleanup',async()=>{
 const f=fixture();
 await f.store.transactUpdate('ru',tx=>tx.putClient(10,{locale:'ru'}));
 await f.apply(f.message('/contact'));
 assert.equal(sendCalls(f).at(-1).body.text,'Напишите сообщение.');
 await f.apply(f.message('Contact question'));
 const ticket=Object.values((await f.store.inspect()).tickets)[0];
 const reply=await f.action('contact-reply');
 await f.apply(f.callback(reply,{id:55,first_name:'Trainer'},Number(GROUP),'group'));
 await f.apply(f.message('Staff reply',{id:55,first_name:'Trainer'},Number(GROUP),'group'));
 assert.ok(sendCalls(f).some(call=>call.body.chat_id==='10'&&call.body.text.includes('Staff reply')));
 await f.apply(f.callback(await f.action('contact-close'),{id:55,first_name:'Trainer'},Number(GROUP),'group'));
 assert.equal((await f.store.inspect()).tickets[ticket.id].status,'CLOSED');
 const deletes=f.calls.filter(call=>call.method==='deleteMessage');
 assert.ok(deletes.every(call=>call.body.chat_id==='10'));
 assert.ok(!deletes.some(call=>call.body.message_id===777));
});
