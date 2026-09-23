import test from 'node:test';
import assert from 'node:assert/strict';
import {createMemoryBotStore,BOT_SESSION_MS,BOT_RETENTION_MS} from '../server/bot-store.js';
import {createBotRuntime} from '../server/bot-runtime.js';
import {createWebhookHandler} from '../api/telegram-webhook.js';
import {assessBotConfig} from '../server/bot-config.js';
import {legal} from '../src/data.js';
import {botCopy} from '../server/bot-copy.js';
import {contactCopy} from '../server/contact-copy.js';

const GROUP=-10099;
const runtimeEnv=()=>({BOT_ENABLED:'true',BOT_WEBHOOK_ENABLED:'true',BOT_WORKER_ENABLED:'false',BOT_REMINDERS_ENABLED:'false',PUBLIC_ORIGIN:'https://example.test',TELEGRAM_WEBHOOK_SECRET:'h'.repeat(32),TELEGRAM_BOT_TOKEN:'test-token',TELEGRAM_STAFF_AUTH_MODE:'group_members',TELEGRAM_STAFF_CHAT_ID:String(GROUP),TELEGRAM_SEND_TIMEOUT_MS:'250',PRIVACY_PUBLICATION_STATUS:'published',PRIVACY_CONSENT_VERSION:legal.consentVersion,PRIVACY_URL:'https://example.test/telegram-privacy/'});
function fixture({env=runtimeEnv(),store:providedStore}={}){
 let now=Date.parse('2026-09-18T10:00:00Z'),sequence=0,messageId=100;
 const store=providedStore||createMemoryBotStore({clock:()=>now}),calls=[],members=new Set([55,56]);
 let failure;
 const transport=async(url,options)=>{
  const method=url.split('/').at(-1),body=JSON.parse(options.body);calls.push({method,body});
  if(method==='getChatMember')return {status:200,json:async()=>({ok:true,result:{status:members.has(body.user_id)?'member':'left',user:{id:body.user_id,is_bot:false}}})};
  const result=failure?.(method,body);
  if(result instanceof Error)throw result;
  if(result)return result;
  return {status:200,json:async()=>({ok:true,result:['answerCallbackQuery','deleteMessage'].includes(method)?true:{message_id:body.message_id||++messageId}})};
 };
 const runtime=createBotRuntime(env,{store,fetchImpl:transport});
 const message=(user,text,chat=user,type='private')=>({update_id:++sequence,message:{message_id:++messageId,chat:{id:chat,type},from:{id:user,is_bot:false,first_name:`Person ${user}`,username:`user_${user}`},text}});
 const callback=(user,data,chat=user,type='private',extra={})=>({update_id:++sequence,callback_query:{id:`q${sequence}`,from:{id:user,is_bot:false,first_name:`Person ${user}`},data,message:{chat:{id:chat,type},...extra}}});
 const apply=async update=>{const result=await runtime.bot.handle(update);await runtime.drain({sourceUpdateId:update.update_id,limit:100});return result;};
 const say=(user,text)=>apply(message(user,text));
 const staff=(user,text)=>apply(message(user,text,GROUP,'supergroup'));
 const click=(user,data)=>apply(callback(user,data));
 const staffClick=(user,data,extra)=>apply(callback(user,data,GROUP,'supergroup',extra));
 const action=async(type,ticketId)=>{
  const entry=Object.entries((await store.inspect()).actions).filter(([,a])=>a.type===type&&(!ticketId||a.ticketId===ticketId)).at(-1);
  assert.ok(entry,`action ${type} ${ticketId||''}`);return `a:${entry[0]}`;
 };
 const open=async(user=10,locale='de',text='My question')=>{if(locale!=='de')await click(user,`cmd:lang:${locale}`);await click(user,'cmd:contact');await say(user,text);return Object.values((await store.inspect()).tickets).filter(t=>t.clientUserId===String(user)).at(-1);};
 const sends=recipient=>calls.filter(c=>c.method==='sendMessage'&&(recipient===undefined||c.body.chat_id===String(recipient)));
 return {env,store,runtime,calls,members,message,callback,apply,say,staff,click,staffClick,action,open,sends,setFailure:f=>{failure=f;},advance:ms=>{now+=ms;}};
}

for(const locale of ['de','ru','uk','tr']){
 test(`/start has two primary functions and localized secondary controls: ${locale}`,async()=>{
  const f=fixture();await f.click(10,`cmd:lang:${locale}`);await f.say(10,'/start site_question');
  const menu=f.sends(10).at(-1).body,rows=menu.reply_markup.inline_keyboard;
  assert.deepEqual(rows.slice(0,2),[[{text:contactCopy[locale].book,callback_data:'cmd:book'}],[{text:contactCopy[locale].contact,callback_data:'cmd:contact'}]]);
  assert.ok(rows.flat().some(b=>b.text===`🌐 ${contactCopy[locale].languageButton}`));
 });
 test(`contact relay, multiple messages, Reply, Close, new ticket: ${locale}`,async()=>{
  const f=fixture();await f.click(55,`cmd:lang:${locale}`);
  const first=await f.open(10,locale,'First <b>question</b>');
  assert.equal(first.status,'OPEN');assert.equal(Object.keys((await f.store.inspect()).requests).length,0);
  const card=f.sends(GROUP).find(c=>c.body.text.includes('First <b>question</b>')).body;
  assert.match(card.text,new RegExp(first.id));assert.match(card.text,/Person 10/);assert.match(card.text,new RegExp(locale.toUpperCase()));
  assert.equal(card.parse_mode,undefined);assert.ok(!card.text.includes('@user_10'));assert.ok(!card.text.includes('chat_id'));
  assert.equal(card.reply_markup.inline_keyboard.flat().length,2);
  const reply=await f.action('contact-reply',first.id);
  await f.staffClick(55,reply);await f.staff(55,'Our first reply');
  assert.ok(f.sends(10).some(c=>c.body.text===`${contactCopy[locale].replyHeading}:\n\nOur first reply`));
  assert.equal((await f.store.inspect()).tickets[first.id].status,'OPEN');
  assert.equal(await f.store.getSession(`staff:${GROUP}:55`),undefined);
  const before=f.sends(10).length;await f.staff(55,'unrelated group chatter');assert.equal(f.sends(10).length,before);
  await f.say(10,'Follow-up');assert.equal(Object.keys((await f.store.inspect()).tickets).length,1);
  assert.ok(f.sends(GROUP).some(c=>c.body.text.includes('Follow-up')));
  await f.staffClick(55,await f.action('contact-reply',first.id));await f.staff(55,'Second reply');
  await f.staffClick(55,await f.action('contact-close',first.id));
  const closed=await f.store.inspect();assert.equal(closed.tickets[first.id].status,'CLOSED');
  assert.ok(f.calls.some(c=>c.method==='editMessageText'&&c.body.reply_markup.inline_keyboard.length===0));
  assert.ok(f.sends(10).some(c=>c.body.text===contactCopy[locale].closedClient));
  const next=await f.open(10,locale,'New question');assert.notEqual(next.id,first.id);assert.equal(next.status,'OPEN');
 });
}

test('booking, confirmation and status work with worker/reminders disabled',async()=>{
 const f=fixture();assert.equal(f.runtime.infoOnly,false);
 // Select actions by their domain values rather than translated labels.
 await f.say(10,'/book');
 const choose=async(type,value)=>{const state=await f.store.inspect(),found=Object.entries(state.actions).filter(([,a])=>a.type===type&&(value===undefined||a.value===value)).at(-1);assert.ok(found);await f.click(10,`a:${found[0]}`);};
 await choose('program','boxen');await choose('group','box-15');await choose('consent');
 await f.say(10,'+49 151 1234567');await choose('comment-skip');
 const preview=f.sends(10).at(-1).body.reply_markup.inline_keyboard.flat();assert.equal(preview.length,1);assert.equal(preview[0].text,botCopy.de.submit);
 await f.click(10,preview[0].callback_data);
 const request=Object.values((await f.store.inspect()).requests)[0];assert.ok(request);assert.equal(request.reminders.enabled,false);
 await f.staffClick(55,await f.action('staff-training'));await f.staffClick(55,await f.action('staff-training-commit'));
 assert.equal((await f.store.getRequest(request.id)).status,'confirmed');await f.say(10,'/status');
 assert.ok(f.sends(10).at(-1).body.text.includes(request.id));
 assert.ok(!f.sends(10).at(-1).body.reply_markup.inline_keyboard.flat().some(b=>/Erinner/.test(b.text)));
 await f.say(10,'/reminders');assert.equal(f.sends(10).at(-1).body.text,contactCopy.de.remindersUnavailable);
 assert.ok(!Object.values((await f.store.inspect()).outbox).some(item=>item.kind==='reminder'));
 assert.throws(()=>f.runtime.drain(),/BOT_WORKER_NOT_READY/);
});

test('multiple clients and trainers are isolated; another trainer cannot consume a selection',async()=>{
 const f=fixture();const [a,b]=await Promise.all([f.open(10,'de','Client A'),f.open(20,'ru','Client B')]);
 assert.notEqual(a.id,b.id);
 await Promise.all([f.staffClick(55,await f.action('contact-reply',a.id)),f.staffClick(56,await f.action('contact-reply',b.id))]);
 await f.staff(77,'unauthorized');await f.staff(55,'Answer A');await f.staff(56,'Answer B');
 assert.ok(f.sends(10).some(c=>c.body.text.endsWith('Answer A')));assert.ok(!f.sends(20).some(c=>c.body.text.endsWith('Answer A')));
 assert.ok(f.sends(20).some(c=>c.body.text.endsWith('Answer B')));assert.ok(!f.sends(10).some(c=>c.body.text.endsWith('Answer B')));
});

test('two authorized trainers can independently select the same card',async()=>{
 const f=fixture(),ticket=await f.open(),action=await f.action('contact-reply',ticket.id);
 await Promise.all([f.staffClick(55,action),f.staffClick(56,action)]);
 await f.staff(55,'First trainer');await f.staff(56,'Second trainer');
 assert.equal(f.sends(10).filter(c=>/First trainer|Second trainer/.test(c.body.text)).length,2);
});

test('unauthorized/wrong-group/private callbacks and lost membership cannot reply or close',async()=>{
 const f=fixture(),ticket=await f.open(),reply=await f.action('contact-reply',ticket.id),close=await f.action('contact-close',ticket.id);
 await f.staffClick(77,reply);await f.staff(77,'blocked');await f.staffClick(77,close);
 await f.apply(f.callback(55,reply,-10088,'supergroup'));await f.click(55,reply);
 assert.equal(await f.store.getSession(`staff:${GROUP}:77`),undefined);
 await f.staffClick(55,reply);f.members.delete(55);await f.staff(55,'membership removed');
 assert.equal(await f.store.getSession(`staff:${GROUP}:55`),undefined);
 await f.staffClick(55,close);assert.equal((await f.store.inspect()).tickets[ticket.id].status,'OPEN');
 assert.ok(!f.sends(10).some(c=>/blocked|membership removed/.test(c.body.text)));
 f.members.add(55);await f.staff(55,'old draft cannot revive');assert.ok(!f.sends(10).some(c=>c.body.text.includes('old draft')));
});

test('duplicate update, concurrent redelivery and repeated Reply callbacks do not duplicate or re-arm',async()=>{
 const f=fixture();await f.click(10,'cmd:contact');const update=f.message(10,'Only once');
 await Promise.all([f.apply(update),f.apply(update)]);
 const state=await f.store.inspect(),ticket=Object.values(state.tickets)[0];assert.equal(Object.keys(state.tickets).length,1);
 assert.equal(f.sends(GROUP).filter(c=>c.body.text.includes('Only once')).length,1);
 const reply=await f.action('contact-reply',ticket.id);await f.staffClick(55,reply);const draft=await f.store.getSession(`staff:${GROUP}:55`);
 await f.staffClick(55,reply);assert.deepEqual(await f.store.getSession(`staff:${GROUP}:55`),draft);
 const answer=f.message(55,'One reply',GROUP,'supergroup');await f.apply(answer);await f.apply(answer);
 assert.equal(f.sends(10).filter(c=>c.body.text.endsWith('One reply')).length,1);
 await f.staffClick(55,reply);assert.equal(await f.store.getSession(`staff:${GROUP}:55`),undefined);
 await f.staff(55,'not a new reply');assert.ok(!f.sends(10).some(c=>c.body.text.endsWith('not a new reply')));
});

test('Close clears all trainer drafts and cancels queued or leased replies; stale callbacks cannot revive',async()=>{
 const f=fixture(),ticket=await f.open(),reply=await f.action('contact-reply',ticket.id),close=await f.action('contact-close',ticket.id);
 await f.staffClick(55,reply);await f.staffClick(56,reply);
 const update=f.message(55,'queued answer',GROUP,'supergroup');await f.runtime.bot.handle(update);
 const leased=await f.store.leaseNext('race',30000,{sourceUpdateId:update.update_id,immediateOnly:true});assert.equal(leased.kind,'contact-client-reply');
 await f.staffClick(56,close);
 assert.equal(await f.store.beginDelivery(leased.id,leased.lease.fence),undefined);
 assert.equal((await f.store.inspect()).tickets[ticket.id].status,'CLOSED');assert.equal(await f.store.getSession(`staff:${GROUP}:56`),undefined);
 await f.staff(56,'stale text');await f.staffClick(55,reply);await f.staffClick(56,close);await f.apply(update);
 assert.ok(!f.sends(10).some(c=>/queued answer|stale text/.test(c.body.text)));
});

test('Close does not falsely claim CLOSED while a delivery is already in flight',async()=>{
 const f=fixture(),ticket=await f.open();await f.staffClick(55,await f.action('contact-reply',ticket.id));
 const update=f.message(55,'in flight',GROUP,'supergroup');await f.runtime.bot.handle(update);
 const lease=await f.store.leaseNext('race',30000,{sourceUpdateId:update.update_id,immediateOnly:true});await f.store.beginDelivery(lease.id,lease.lease.fence);
 const close=await f.action('contact-close',ticket.id);await f.staffClick(56,close);assert.equal((await f.store.inspect()).tickets[ticket.id].status,'OPEN');
 assert.ok(f.sends(GROUP).some(c=>c.body.text===contactCopy.de.closeBusy));
 await f.store.finishDelivery(lease.id,lease.lease.fence,{state:'sent',messageId:999});await f.staffClick(56,close);assert.equal((await f.store.inspect()).tickets[ticket.id].status,'CLOSED');
});

test('blocked client and uncertain send produce staff feedback, not a false delivered claim or auto-resend',async()=>{
 for(const uncertain of [false,true]){
  const f=fixture(),ticket=await f.open();await f.staffClick(55,await f.action('contact-reply',ticket.id));
  f.setFailure((method,body)=>method==='sendMessage'&&body.chat_id==='10'?(uncertain?new Error('network'):{status:403,json:async()=>({ok:false,error_code:403})}):undefined);
  const update=f.message(55,'attempted reply',GROUP,'supergroup');await f.apply(update);
  assert.ok(f.sends(GROUP).some(c=>c.body.text.includes(contactCopy.de[uncertain?'replyUncertain':'replyFailed'])));
  assert.ok(!f.sends(GROUP).some(c=>c.body.text.includes(contactCopy.de.replyDelivered)));
  const count=f.sends(10).length;await f.apply(update);assert.equal(f.sends(10).length,count);
  assert.equal((await f.store.inspect()).tickets[ticket.id].status,'OPEN');
 }
});

test('trainer-group send error informs client and preserves open ticket for retry',async()=>{
 const f=fixture();f.setFailure((method,body)=>method==='sendMessage'&&body.chat_id===String(GROUP)?{status:403,json:async()=>({ok:false,error_code:403})}:undefined);
 const ticket=await f.open();assert.ok(f.sends(10).some(c=>c.body.text===contactCopy.de.clientFailed));
 assert.ok(!f.sends(10).some(c=>c.body.text.includes(contactCopy.de.clientDelivered)));
 f.setFailure(undefined);await f.say(10,'Please retry my question');assert.equal(Object.keys((await f.store.inspect()).tickets).length,1);
 assert.equal((await f.store.inspect()).tickets[ticket.id].status,'OPEN');assert.ok(f.sends(10).some(c=>c.body.text.includes(contactCopy.de.clientDelivered)));
});

test('expired staff selection cannot relay, client follow-up survives session expiry, expired ticket requires new contact entry',async()=>{
 const f=fixture(),ticket=await f.open();await f.staffClick(55,await f.action('contact-reply',ticket.id));f.advance(BOT_SESSION_MS+1);
 await f.staff(55,'expired draft');assert.ok(!f.sends(10).some(c=>c.body.text.endsWith('expired draft')));
 await f.say(10,'after a break');assert.equal(Object.keys((await f.store.inspect()).tickets).length,1);
 f.advance(BOT_RETENTION_MS+1);await f.say(10,'expired ticket');assert.equal(Object.keys((await f.store.inspect()).tickets).length,0);
 const next=await f.open(10,'de','new contact');assert.notEqual(next.id,ticket.id);
});

test('blank and oversized contact/reply text are rejected, not truncated',async()=>{
 const f=fixture();await f.click(10,'cmd:contact');await f.say(10,' ');await f.say(10,'x'.repeat(3001));assert.equal(Object.keys((await f.store.inspect()).tickets).length,0);
 const ticket=await f.open();await f.staffClick(55,await f.action('contact-reply',ticket.id));const before=f.sends(10).length;await f.staff(55,'x'.repeat(3001));assert.equal(f.sends(10).length,before);
 await f.staff(55,'ok');assert.equal(f.sends(10).length,before+1);
});

test('switching to booking keeps contact text out of booking requests, and switching back resumes the ticket',async()=>{
 const f=fixture(),ticket=await f.open();await f.say(10,'/book');assert.equal((await f.store.getSession(10)).stage,'program');
 const before=f.sends(GROUP).length;await f.say(10,'not a contact follow-up');assert.equal(f.sends(GROUP).length,before);
 await f.click(10,'cmd:contact');await f.say(10,'back to contact');assert.equal(Object.keys((await f.store.inspect()).tickets).length,1);assert.equal((await f.store.inspect()).tickets[ticket.id].status,'OPEN');
});

test('webhook retry drains a rate-limited contact message once, without a worker',async()=>{
 const f=fixture();await f.click(10,'cmd:contact');let first=true;
 f.setFailure((method,body)=>{if(first&&method==='sendMessage'&&body.chat_id===String(GROUP)){first=false;return {status:429,json:async()=>({ok:false,error_code:429,parameters:{retry_after:1}})};}});
 const handler=createWebhookHandler({env:f.env,createRuntime:()=>f.runtime});
 const update=f.message(10,'webhook retry');
 const invoke=async()=>{const res={setHeader(){},status(code){this.statusCode=code;return this;},json(body){this.body=body;}};await handler({method:'POST',headers:{host:'example.test','content-type':'application/json','x-telegram-bot-api-secret-token':f.env.TELEGRAM_WEBHOOK_SECRET},rawBody:Buffer.from(JSON.stringify(update))},res);return res;};
 assert.equal((await invoke()).statusCode,503);f.advance(1100);assert.equal((await invoke()).statusCode,200);
 assert.equal(Object.keys((await f.store.inspect()).tickets).length,1);const before=f.calls.length;assert.equal((await invoke()).statusCode,200);assert.equal(f.calls.length,before);
 assert.equal(f.sends(GROUP).filter(c=>c.body.text.includes('webhook retry')).length,2,'one explicit 429 rejection, one successful delivery');
 assert.equal(f.sends(10).filter(c=>c.body.text.includes(contactCopy.de.clientDelivered)).length,1);
});

test('disabled worker is not a readiness requirement and stale reminder actions cannot enable reminders',async()=>{
 const f=fixture(),checked=assessBotConfig(f.env,{requireRedis:false});assert.equal(checked.bookingReady,true);assert.equal(checked.workerReady,false);assert.equal(checked.remindersEnabled,false);
 let action;await f.store.transactUpdate('seed-stale-reminder',tx=>{const r=tx.createRequest({id:'old',clientUserId:'10',clientChatId:'10',locale:'de',status:'confirmed',appointment:tx.now+3600000,reminders:{enabled:false}});action=tx.addAction({scope:'client-owner',type:'client-reminders',requestId:r.id,userId:'10',appointmentRevision:r.appointmentRevision,preferenceRevision:r.preferenceRevision,enabled:true});});
 await f.click(10,action);assert.equal((await f.store.getRequest('old')).reminders.enabled,false);assert.equal(f.sends(10).at(-1).body.text,contactCopy.de.remindersUnavailable);
});

test('explicit main-menu exit pauses contact durably without discarding booking drafts',async()=>{
 const f=fixture();await f.click(10,'cmd:contact');await f.click(10,'cmd:menu');await f.say(10,'not submitted');
 assert.equal(Object.keys((await f.store.inspect()).tickets).length,0);
 const ticket=await f.open();await f.say(10,'/start');const before=f.sends(GROUP).length;
 await f.say(10,'still not submitted');f.advance(BOT_SESSION_MS+1);await f.say(10,'paused after expiry');assert.equal(f.sends(GROUP).length,before);
 await f.click(10,'cmd:contact');await f.say(10,'intentionally resumed');assert.equal((await f.store.inspect()).clients['10'].contactTicketId,ticket.id);
});

test('long delivered contact history is compacted within the shared Redis budget; booking remains usable',async()=>{
 const f=fixture(),ticket=await f.open();
 for(let i=0;i<130;i++)await f.say(10,`${i}:`+'x'.repeat(2990));
 const state=await f.store.inspect();assert.ok(Buffer.byteLength(JSON.stringify(state))<512*1024);
 assert.equal(f.sends(GROUP).filter(c=>c.body.text.includes('x'.repeat(100))).length,130);
 assert.ok(Object.values(state.outbox).some(item=>item.kind==='contact-staff-card'&&item.text===''),'delivered text was compacted, card references preserved');
 await f.say(20,'/book');assert.equal((await f.store.getSession(20)).stage,'program');
 await f.staffClick(55,await f.action('contact-close',ticket.id));assert.equal((await f.store.inspect()).tickets[ticket.id].status,'CLOSED');
 assert.ok(f.calls.some(c=>c.method==='editMessageReplyMarkup'));
});

test('pending contact backlog is bounded without failing unrelated booking transactions',async()=>{
 const f=fixture();await f.click(10,'cmd:contact');
 for(let i=0;i<10;i++)await f.runtime.bot.handle(f.message(10,'x'.repeat(3000)));
 const state=await f.store.inspect();assert.equal(Object.values(state.outbox).filter(item=>item.kind==='contact-staff-card').length,5);
 assert.ok(Object.values(state.outbox).some(item=>item.text===contactCopy.de.unavailable));
 await f.say(20,'/book');assert.equal((await f.store.getSession(20)).stage,'program');
});

test('expired delivery lease requires an explicit uncertain-close decision, never silent closure',async()=>{
 const f=fixture(),ticket=await f.open();await f.staffClick(55,await f.action('contact-reply',ticket.id));
 const update=f.message(55,'uncertain in flight',GROUP,'supergroup');await f.runtime.bot.handle(update);
 const lease=await f.store.leaseNext('race',30000,{sourceUpdateId:update.update_id,immediateOnly:true});await f.store.beginDelivery(lease.id,lease.lease.fence);f.advance(30001);
 await f.staffClick(56,await f.action('contact-close',ticket.id));assert.equal((await f.store.inspect()).tickets[ticket.id].status,'OPEN');
 assert.ok(f.sends(GROUP).some(c=>c.body.text===contactCopy.de.closeUncertain));
 await f.staffClick(56,await f.action('contact-close',ticket.id));assert.equal((await f.store.inspect()).tickets[ticket.id].status,'CLOSED');
 assert.equal((await f.store.inspect()).outbox[lease.id].state,'uncertain');
});

test('staff delivery feedback survives Close, but carries no live reply controls',async()=>{
 const f=fixture(),ticket=await f.open();await f.staffClick(55,await f.action('contact-reply',ticket.id));
 const update=f.message(55,'known delivered',GROUP,'supergroup');await f.runtime.bot.handle(update);
 const lease=await f.store.leaseNext('race',30000,{sourceUpdateId:update.update_id,immediateOnly:true});await f.store.beginDelivery(lease.id,lease.lease.fence);await f.store.finishDelivery(lease.id,lease.lease.fence,{state:'sent',messageId:999});
 await f.staffClick(56,await f.action('contact-close',ticket.id));
 const feedback=f.sends(GROUP).find(c=>c.body.text.includes(contactCopy.de.replyDelivered));assert.ok(feedback);assert.deepEqual(feedback.body.reply_markup.inline_keyboard,[]);
});

test('private positive staff routing fails closed in both authorization modes',()=>{
 for(const mode of ['group_members','allowlist']){
  const env={...runtimeEnv(),TELEGRAM_STAFF_AUTH_MODE:mode,TELEGRAM_STAFF_USER_IDS:'55',TELEGRAM_STAFF_CHAT_ID:'55'};
  const checked=assessBotConfig(env,{requireRedis:false});assert.equal(checked.ok,false);assert.equal(checked.bookingReady,false);
  assert.throws(()=>createBotRuntime(env,{store:createMemoryBotStore()}),/BOT_STAFF/);
 }
});

test('retained worker cannot dispatch old reminder entries while reminders are disabled',async()=>{
 const env={...runtimeEnv(),BOT_WORKER_ENABLED:'true',TELEGRAM_WORKER_SECRET:'w'.repeat(32)},f=fixture({env});
 await f.store.transactUpdate('old-care',tx=>{const r=tx.createRequest({id:'care',clientUserId:'10',clientChatId:'10',status:'confirmed',appointment:tx.now+3600000,reminders:{enabled:true}});tx.enqueue('10','old reminder','reminder',tx.now,{requestId:r.id,appointment:r.appointment,appointmentRevision:r.appointmentRevision});});
 await f.runtime.drain();assert.ok(!f.sends(10).some(c=>c.body.text==='old reminder'));
});

test('all contact copy keys are present in DE/RU/UK/TR',()=>{
 const keys=Object.keys(contactCopy.de).sort();for(const locale of ['de','ru','uk','tr']){assert.deepEqual(Object.keys(contactCopy[locale]).sort(),keys);assert.ok(Object.values(contactCopy[locale]).every(value=>typeof value==='string'&&value.trim()));}
});
