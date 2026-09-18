import {createHash,randomUUID,timingSafeEqual} from 'node:crypto';

export const BOT_RETENTION_MS=30*24*60*60*1000;
export const BOT_SESSION_MS=30*60*1000;
export const BOT_MAX_STATE_BYTES=512*1024;
// Requests expire after 30 days, so appointments must leave a full day for care work.
export const BOT_MAX_APPOINTMENT_DELAY_MS=BOT_RETENTION_MS-24*60*60*1000;
export const BOT_CALLBACK_TTL_MS=15*1000;
// The webhook owns newly committed interactive work briefly before the worker
// may recover it. This prevents a concurrent worker invocation from stealing a
// current Telegram click while retaining a bounded recovery path.
export const BOT_INTERACTIVE_DISPATCH_GRACE_MS=30*1000;
const BACKGROUND_KINDS=new Set(['reminder','checkin','interface-cleanup']);
const clone=value=>value===undefined?undefined:structuredClone(value);
const freshState=()=>({schema:2,sessions:{},requests:{},requestSequence:0,tickets:{},ticketSequence:0,clients:{},updates:{},actions:{},outbox:{},recipientSequence:{},recipientBlockedUntil:{}});
const id=()=>randomUUID().replaceAll('-','');
const berlinHour=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',hour:'2-digit',hourCycle:'h23'});
const localHour=at=>Number(berlinHour.format(new Date(at)));
const berlinQuiet=at=>{const hour=localHour(at);return hour>=21||hour<8;};

/** Return the first Berlin 08:00-or-later instant before appointment, or null. */
export function nextAllowedReminderTime(candidate,appointment){
 if(!Number.isFinite(candidate)||!Number.isFinite(appointment)||candidate>=appointment)return null;
 if(!berlinQuiet(candidate))return candidate;
 // Work from an exact minute so quiet delivery resumes at 08:00, not at e.g. 08:00:37.
 let at=Math.floor(candidate/60000)*60000;
 for(let minutes=0;minutes<=1560&&at<appointment;minutes++,at+=60000)if(!berlinQuiet(at))return at;
 return null;
}

export function secureEqual(provided,expected,{minLength=32}={}){
 if(typeof provided!=='string'||typeof expected!=='string'||expected.length<minLength||provided.length!==expected.length)return false;
 const a=Buffer.from(provided),b=Buffer.from(expected);return a.length===b.length&&timingSafeEqual(a,b);
}
export function classifyTelegramResponse(response,body,method='sendMessage'){
 const booleanResultMethods=new Set(['answerCallbackQuery','deleteMessage']);
 if(response?.status===200&&body?.ok===true&&(booleanResultMethods.has(method)?body.result===true:Number.isInteger(body.result?.message_id)))return {state:'sent',messageId:body.result?.message_id};
 if(body?.ok===false&&body?.error_code===429&&Number.isFinite(Number(body.parameters?.retry_after)))return {state:'deferred',retryAfter:Math.max(1,Math.ceil(Number(body.parameters.retry_after)))};
 if(body?.ok===false&&Number.isInteger(body.error_code)&&body.error_code>=400&&body.error_code<500)return {state:'failed'};
 return {state:'uncertain'};
}

// Telegram has no idempotency key for sendMessage. Uncertain sends are terminal,
// not automatically retried. Durable feedback makes this visible to the sender.
function trackDisposableUi(state,item,result,now){
 if(result.state!=='sent'||item.method!=='sendMessage'||!item.meta?.privateUi||!(item.meta?.disposableUi||item.meta?.supersedesDisposableUi))return;
 const messageId=result.messageId,recipient=String(item.recipient);
 // Only client private chats are tagged at enqueue time. Recheck the positive
 // numeric identity and an existing client record before any delete is queued.
 if(!Number.isSafeInteger(messageId)||messageId<1||!/^\d+$/.test(recipient)||!Number.isSafeInteger(Number(recipient))||Number(recipient)<1)return;
 const client=state.clients[recipient];if(!client)return;
 const previous=client.disposableUiMessageId;
 if(Number.isSafeInteger(previous)&&previous>0&&previous!==messageId){
  const tx=txFacade(state,{now,updateId:item.sourceUpdateId??null,nonce:'cleanup:'+item.id});
  tx.enqueue(recipient,'','interface-cleanup',now+1000,{privateUi:true,trackedDisposableCleanup:true},'deleteMessage',{chat_id:recipient,message_id:previous});
 }
 if(item.meta.disposableUi)client.disposableUiMessageId=messageId;
 else if(item.meta.supersedesDisposableUi)delete client.disposableUiMessageId;
}
function contactFeedback(state,item,result,now){
 const feedback=item.meta?.feedback;
 if(!feedback||item.feedbackQueued||!['sent','failed','uncertain'].includes(result.state))return;
 item.feedbackQueued=true;
 const text=result.state==='sent'?feedback.success:feedback[result.state];
 if(!text)return;
 const tx=txFacade(state,{now,updateId:item.sourceUpdateId??null,nonce:'feedback:'+item.id});
 tx.enqueue(feedback.recipient,text,'contact-feedback',now,{ticketId:item.meta.ticketId,requireOpen:true,link_preview_options:{is_disabled:true},...clone(feedback.meta||{})});
}
function pruneState(state,now){
 for(const key of ['sessions','actions','updates','clients'])for(const [k,v] of Object.entries(state[key]||{}))if(v.expiresAt<=now)delete state[key][k];
 for(const [k,v] of Object.entries(state.requests||{}))if(v.expiresAt<=now)delete state.requests[k];
 for(const [k,v] of Object.entries(state.tickets||{}))if(v.expiresAt<=now)delete state.tickets[k];
 for(const [k,v] of Object.entries(state.sessions||{}))if(v.value?.ticketId&&!state.tickets[v.value.ticketId])delete state.sessions[k];
 for(const [k,v] of Object.entries(state.outbox||{})){
  if(v.expiresAt<=now){delete state.outbox[k];continue;}
  if(v.state==='leased'&&v.lease?.until<=now){v.state='queued';v.lease=null;}
  else if(v.state==='sending'&&v.lease?.until<=now){v.state='uncertain';v.finishedAt=now;v.lease=null;contactFeedback(state,v,{state:'uncertain'},now);}
 }
 for(const [recipient,until] of Object.entries(state.recipientBlockedUntil||{}))if(until<=now)delete state.recipientBlockedUntil[recipient];
 // Sequence numbers are ordering metadata, not an unbounded per-recipient history.
 const referenced=new Set([...Object.values(state.outbox).map(item=>item.recipient),...Object.keys(state.recipientBlockedUntil)]);
 for(const recipient of Object.keys(state.recipientSequence||{}))if(!referenced.has(recipient))delete state.recipientSequence[recipient];
}
function txFacade(state,{now,updateId,nonce}){
 let counter=0;const token=(length=32)=>createHash('sha256').update(`${nonce}:${counter++}`).digest('hex').slice(0,length);
 const putSession=(key,value)=>{const revision=token(16);state.sessions[String(key)]={value:{...clone(value),revision},expiresAt:now+BOT_SESSION_MS};return clone(state.sessions[String(key)].value);};
 const enqueue=(recipient,text,kind='message',notBefore=now,meta={},method='sendMessage',payload)=>{
  const r=String(recipient),sequence=(state.recipientSequence[r]||0)+1;state.recipientSequence[r]=sequence;
  // schema:2 stores tolerate this additive field. It binds all work created by
  // a Telegram update to that update without changing existing item ordering.
  const item={id:token(32),recipient:r,text:String(text||''),kind,meta:clone(meta),method,payload:payload?clone(payload):undefined,sequence,state:'queued',notBefore:Number(notBefore)||now,attempts:0,lease:null,createdAt:now,expiresAt:now+(kind==='callback-answer'?BOT_CALLBACK_TTL_MS:BOT_RETENTION_MS),...(updateId===null?{}:{sourceUpdateId:String(updateId)})};state.outbox[item.id]=item;return clone(item);
 };
 const request=requestId=>{const value=state.requests[String(requestId)];return value&&value.expiresAt>now?clone(value):undefined;};
 return {
  now,updateId,newToken:(length=16)=>token(length),nextRequestId:()=>{let next=Number.isSafeInteger(state.requestSequence)&&state.requestSequence>=0?state.requestSequence:0;do{next++;}while(state.requests[String(next)]);state.requestSequence=next;return String(next);},
  getSession:key=>clone(state.sessions[String(key)]?.value),putSession,clearSession:key=>delete state.sessions[String(key)],
  getClient:userId=>clone(state.clients[String(userId)]),putClient:(userId,value)=>{const existing=state.clients[String(userId)]||{};state.clients[String(userId)]={...clone(existing),...clone(value),expiresAt:now+BOT_RETENTION_MS};},
  listClientRequests(userId){const clientUserId=String(userId);return Object.values(state.requests).filter(record=>record.expiresAt>now&&String(record.clientUserId)===clientUserId).sort((a,b)=>b.createdAt-a.createdAt||b.updatedAt-a.updatedAt||(String(a.id)<String(b.id)?1:String(a.id)>String(b.id)?-1:0)).map(clone);},
  getTicket:ticketId=>clone(state.tickets[String(ticketId)]),
  createTicket(record){let next=state.ticketSequence||0;do{next++;}while(state.tickets['C'+next]);state.ticketSequence=next;const saved={...clone(record),id:'C'+next,revision:token(16),createdAt:now,updatedAt:now,expiresAt:now+BOT_RETENTION_MS};state.tickets[saved.id]=saved;return clone(saved);},
  patchTicket(ticketId,change){const current=state.tickets[String(ticketId)];if(!current)throw new Error('ticket_missing');const saved={...current,...clone(change),revision:token(16),updatedAt:now,expiresAt:now+BOT_RETENTION_MS};state.tickets[String(ticketId)]=saved;return clone(saved);},
  getRequest:request,
  createRequest(record){if(state.requests[record.id])throw new Error('request_exists');const saved={...clone(record),revision:token(16),appointmentRevision:token(16),preferenceRevision:token(16),createdAt:now,updatedAt:now,expiresAt:now+BOT_RETENTION_MS};state.requests[saved.id]=saved;return clone(saved);},
  updateRequest(requestId,expectedRevision,change){return this.patchRequest(requestId,{revision:expectedRevision},change);},
  patchRequest(requestId,expected={},change={},bumps=[]){const current=state.requests[String(requestId)];if(!current)return {ok:false,code:'missing'};for(const [field,value] of Object.entries(expected))if(current[field]!==value)return {ok:false,code:'stale',record:clone(current)};const saved={...current,...clone(change),revision:token(16),updatedAt:now,expiresAt:now+BOT_RETENTION_MS};for(const field of bumps)saved[field]=token(16);state.requests[String(requestId)]=saved;return {ok:true,record:clone(saved)};},
  enqueue,
  answerCallback(callbackQueryId,text=''){return enqueue(`callback:${callbackQueryId}`,'','callback-answer',now,{},'answerCallbackQuery',{callback_query_id:String(callbackQueryId),...(text?{text:String(text).slice(0,200)}:{})});},
  addAction(spec,ttlMs=BOT_SESSION_MS){const actionToken=token(20);state.actions[actionToken]={...clone(spec),expiresAt:now+ttlMs};return `a:${actionToken}`;},
  getAction(actionValue){const key=String(actionValue).startsWith('a:')?String(actionValue).slice(2):String(actionValue),action=state.actions[key];return !action||action.expiresAt<=now?undefined:clone(action);},
  removeAction(actionValue){const key=String(actionValue).startsWith('a:')?String(actionValue).slice(2):String(actionValue);delete state.actions[key];},
  takeAction(actionValue){const action=this.getAction(actionValue);if(action)this.removeAction(actionValue);return action;},
  cancelCare(requestId){for(const item of Object.values(state.outbox))if(item.meta?.requestId===String(requestId)&&['reminder','checkin'].includes(item.kind)&&['queued','leased'].includes(item.state)){item.state='cancelled';item.lease=null;}},
  cancelAppointmentMessages(requestId,appointmentRevision){for(const item of Object.values(state.outbox))if(item.meta?.requestId===String(requestId)&&item.meta?.appointmentRevision!==appointmentRevision&&item.kind==='reminder'&&['queued','leased'].includes(item.state)){item.state='cancelled';item.lease=null;}},
  raw:state
 };
}
// The existing aggregate is deliberately small. Contact is not a transcript
// database: after delivery keep compact card references/outcomes, not raw text.
function compactContactHistory(state){
 const terminal=new Set(['sent','failed','uncertain','cancelled']);
 for(const item of Object.values(state.outbox)){
  if(!String(item.kind).startsWith('contact-')||!terminal.has(item.state))continue;
  const ticket=state.tickets[item.meta?.ticketId];
  if(item.state==='sent'&&item.meta?.contactCard&&ticket?.status==='OPEN'){
   item.text='';item.payload=undefined;item.meta={ticketId:ticket.id,contactCard:true,cardLocale:item.meta.cardLocale||'de'};
  }else if(item.kind==='contact-client-reply'&&ticket?.status==='OPEN'){
   // Retain the outcome (especially uncertain sends), never the reply text.
   item.text='';item.payload=undefined;item.meta={ticketId:ticket.id};
  }else delete state.outbox[item.id];
 }
 // Keep active delivery buttons and the most recent card's actions. Already
 // selected replies live independently in per-trainer sessions.
 const protectedTokens=new Set();
 for(const item of Object.values(state.outbox))if(!terminal.has(item.state))for(const row of item.meta?.reply_markup?.inline_keyboard||[])for(const button of row)if(button.callback_data)protectedTokens.add(button.callback_data.slice(2));
 const newest=new Map();
 for(const [token,action] of Object.entries(state.actions))if(action.scope==='contact-staff'&&['contact-reply','contact-close'].includes(action.type))newest.set(action.ticketId+':'+action.type,token);
 for(const [token,action] of Object.entries(state.actions))if(action.scope==='contact-staff'&&['contact-reply','contact-close'].includes(action.type)&&!protectedTokens.has(token)&&newest.get(action.ticketId+':'+action.type)!==token)delete state.actions[token];
 const closed=Object.values(state.tickets).filter(ticket=>ticket.status==='CLOSED').sort((a,b)=>b.updatedAt-a.updatedAt);
 for(const ticket of closed.slice(100))delete state.tickets[ticket.id];
}
function normalized(raw){
 if(!raw)return freshState();const parsed=typeof raw==='string'?JSON.parse(raw):clone(raw),base=freshState();
 return {...base,...parsed,sessions:parsed.sessions||{},requests:parsed.requests||{},tickets:parsed.tickets||{},ticketSequence:Number.isSafeInteger(parsed.ticketSequence)&&parsed.ticketSequence>=0?parsed.ticketSequence:0,requestSequence:Number.isSafeInteger(parsed.requestSequence)&&parsed.requestSequence>=0?parsed.requestSequence:0,clients:parsed.clients||{},updates:parsed.updates||{},actions:parsed.actions||{},outbox:parsed.outbox||{},recipientSequence:parsed.recipientSequence||{},recipientBlockedUntil:parsed.recipientBlockedUntil||{}};
}
function createStore({readSnapshot,commitSnapshot,clock,maxBytes=BOT_MAX_STATE_BYTES,kind}){
 const transact=async(updateId,reducer,{retries=64}={})=>{
  const nonce=id();
  for(let attempt=0;attempt<retries;attempt++){
   const snapshot=await readSnapshot(),state=normalized(snapshot.state),now=clock();pruneState(state,now);
   const updateKey=updateId===undefined?null:String(updateId);if(updateKey&&state.updates[updateKey]?.expiresAt>now)return {ok:true,dropped:true};
   const result=reducer(txFacade(state,{now,updateId:updateKey,nonce}));if(result&&typeof result.then==='function')throw new Error('bot transaction reducer must be synchronous');
   if(updateKey)state.updates[updateKey]={expiresAt:now+BOT_RETENTION_MS};
   let serialized=JSON.stringify(state);if(Buffer.byteLength(serialized)>maxBytes/2){compactContactHistory(state);serialized=JSON.stringify(state);}if(Buffer.byteLength(serialized)>maxBytes)throw new Error('BOT_STATE_CAPACITY_EXCEEDED');
   const generation=id();if(await commitSnapshot(snapshot.generation,generation,serialized))return {ok:true,result:clone(result)};
  }throw new Error('BOT_STORE_CONFLICT');
 };
 const mutate=reducer=>transact(undefined,reducer).then(x=>x.result);
 return {
  kind,transactUpdate:(updateId,reducer)=>transact(updateId,reducer),
  getSession:async key=>{const s=normalized((await readSnapshot()).state);pruneState(s,clock());return clone(s.sessions[String(key)]?.value);},
  setSession:(key,value,expected)=>mutate(tx=>{const old=tx.getSession(key);if(expected!==undefined&&old?.revision!==expected)return false;tx.putSession(key,value);return true;}),clearSession:key=>mutate(tx=>tx.clearSession(key)),
  getRequest:async key=>{const s=normalized((await readSnapshot()).state);pruneState(s,clock());return clone(s.requests[String(key)]);},
  createBooking:(record,staffRecipient,staffText)=>mutate(tx=>{const saved=tx.createRequest(record);if(staffRecipient&&staffText){const card=typeof staffText==='string'?{text:staffText}:staffText;tx.enqueue(staffRecipient,card.text,'staff-card',clock(),card.meta||{});}return saved;}),
  transition:(key,revision,change,notifications=[])=>mutate(tx=>{const result=tx.updateRequest(key,revision,change);if(result.ok)for(const n of notifications)tx.enqueue(n.recipient,n.text,n.kind||'message',n.notBefore||clock(),{requestId:key,...n.meta});return result;}),
  enqueue:(...args)=>mutate(tx=>tx.enqueue(...args)),cancelCare:key=>mutate(tx=>tx.cancelCare(key)),
  leaseNext:(workerId,leaseMs=30000,{sourceUpdateId,immediateOnly=false,allowCare=true}={})=>mutate(tx=>{
   const state=tx.raw,now=tx.now,selectedSource=sourceUpdateId===undefined?null:String(sourceUpdateId),items=Object.values(state.outbox),ceilings=new Map();
   // Include preceding immediate replies for these same recipients. Otherwise an
   // old conversation reply would block a new click until the background worker.
   if(selectedSource!==null)for(const item of items)if(item.sourceUpdateId===selectedSource&&!BACKGROUND_KINDS.has(item.kind))ceilings.set(item.recipient,Math.max(ceilings.get(item.recipient)||0,item.sequence));
   const eligible=item=>{
    if(!allowCare&&['reminder','checkin'].includes(item.kind))return false;
    if(item.state!=='queued'||item.notBefore>now||(state.recipientBlockedUntil[item.recipient]||0)>now)return false;
    if(selectedSource!==null){
     if(immediateOnly&&BACKGROUND_KINDS.has(item.kind))return false;
     return item.sourceUpdateId===selectedSource||(!BACKGROUND_KINDS.has(item.kind)&&item.sequence<=(ceilings.get(item.recipient)||0));
    }
    // Give fresh interaction work to its webhook; recover later only on failure.
    return !(item.sourceUpdateId!==undefined&&!BACKGROUND_KINDS.has(item.kind)&&item.createdAt+BOT_INTERACTIVE_DISPATCH_GRACE_MS>now);
   };
   const candidates=items.filter(eligible).sort((a,b)=>(a.kind==='callback-answer'?0:1)-(b.kind==='callback-answer'?0:1)||a.notBefore-b.notBefore||a.sequence-b.sequence||a.createdAt-b.createdAt);
   for(const item of candidates){
    const active=items.some(other=>other.recipient===item.recipient&&other.id!==item.id&&['leased','sending'].includes(other.state));
    // A queued reminder must not hold up an interactive reply. Active delivery
    // locks and Telegram rate-limit blocks still apply to the entire recipient.
    const olderDue=items.some(other=>other.recipient===item.recipient&&other.id!==item.id&&other.sequence<item.sequence&&other.state==='queued'&&other.notBefore<=now&&(allowCare||!['reminder','checkin'].includes(other.kind))&&!(selectedSource!==null&&immediateOnly&&BACKGROUND_KINDS.has(other.kind)));
    if(active||olderDue)continue;
    item.state='leased';item.attempts++;item.lease={workerId:String(workerId),fence:tx.newToken(20),until:now+leaseMs};return clone(item);
   }
   return undefined;
  }),
  hasPendingImmediateForUpdate:async updateId=>{const state=normalized((await readSnapshot()).state),source=String(updateId);pruneState(state,clock());return Object.values(state.outbox).some(item=>item.sourceUpdateId===source&&!BACKGROUND_KINDS.has(item.kind)&&['queued','leased','sending'].includes(item.state));},
  hasPendingCleanupForUpdate:async updateId=>{const state=normalized((await readSnapshot()).state),source=String(updateId);pruneState(state,clock());return Object.values(state.outbox).some(item=>item.sourceUpdateId===source&&item.kind==='interface-cleanup'&&['queued','leased','sending'].includes(item.state));},
  beginDelivery:(itemId,fence,leaseMs=30000)=>mutate(tx=>{const item=tx.raw.outbox[String(itemId)];if(!item||item.state!=='leased'||item.lease?.fence!==fence||item.lease.until<=tx.now)return undefined;const blockedUntil=tx.raw.recipientBlockedUntil[item.recipient]||0;if(blockedUntil>tx.now){item.state='queued';item.notBefore=Math.max(item.notBefore,blockedUntil);item.lease=null;return undefined;}if(item.meta?.safeAfterClose&&tx.getTicket(item.meta.ticketId)?.status!=='OPEN'){item.meta.reply_markup={inline_keyboard:[]};item.meta.contactCard=false;}if(item.meta?.requireOpen&&tx.getTicket(item.meta.ticketId)?.status!=='OPEN'){item.state='cancelled';item.lease=null;return undefined;}if(item.kind==='reminder'){const req=tx.getRequest(item.meta?.requestId),appointment=req?.appointment;if(!req||req.status!=='confirmed'||!req.reminders?.enabled||req.clientChatId!==item.recipient||req.appointmentRevision!==item.meta?.appointmentRevision||appointment!==item.meta?.appointment||!Number.isFinite(appointment)||tx.now>=appointment){item.state='cancelled';item.lease=null;return undefined;}const allowedAt=nextAllowedReminderTime(tx.now,appointment);if(allowedAt===null){item.state='cancelled';item.lease=null;return undefined;}if(allowedAt>tx.now){item.state='queued';item.notBefore=allowedAt;item.lease=null;return undefined;}}item.state='sending';item.lease.until=tx.now+leaseMs;return clone(item);}),
  finishDelivery:(itemId,fence,result)=>mutate(tx=>{const item=tx.raw.outbox[String(itemId)];if(!item||item.state!=='sending'||item.lease?.fence!==fence)return false;if(result.state==='deferred'){item.state='queued';item.notBefore=tx.now+result.retryAfter*1000;tx.raw.recipientBlockedUntil[item.recipient]=item.notBefore;item.lease=null;return true;}item.state=result.state;item.messageId=result.messageId;item.finishedAt=tx.now;item.lease=null;trackDisposableUi(tx.raw,item,result,tx.now);contactFeedback(tx.raw,item,result,tx.now);return true;}),
  inspect:async()=>normalized((await readSnapshot()).state)
 };
}
export function createMemoryBotStore({clock=()=>Date.now(),maxBytes}={}){
 let state=JSON.stringify(freshState()),generation='';let chain=Promise.resolve();
 const readSnapshot=async()=>({state,generation});
 const commitSnapshot=async(expected,nextGeneration,nextState)=>{let answer;chain=chain.then(()=>{if(generation!==expected){answer=false;return;}generation=nextGeneration;state=nextState;answer=true;});await chain;return answer;};
 const store=createStore({readSnapshot,commitSnapshot,clock,maxBytes,kind:'memory'});Object.defineProperty(store,'_data',{get(){return normalized(state);}});return store;
}
const readLua="local g=redis.call('GET',KEYS[1]); local s=redis.call('GET',KEYS[2]); return {g or '',s or ''}";
const commitLua="local g=redis.call('GET',KEYS[1]) or ''; if g~=ARGV[1] then return 0 end; redis.call('SET',KEYS[2],ARGV[3],'PX',ARGV[4]); redis.call('SET',KEYS[1],ARGV[2],'PX',ARGV[4]); return 1";
export function createUpstashBotStore(redis,{clock=()=>Date.now(),prefix='{akbot}:',maxBytes}={}){
 if(!redis||typeof redis.eval!=='function')throw new Error('Redis with EVAL is required');const keys=[prefix+'generation',prefix+'state'];
 const readSnapshot=async()=>{const value=await redis.eval(readLua,keys,[]);return {generation:String(value?.[0]||''),state:value?.[1]||''};};
 const commitSnapshot=async(expected,next,state)=>Number(await redis.eval(commitLua,keys,[String(expected||''),next,state,String(BOT_RETENTION_MS)]))===1;
 return createStore({readSnapshot,commitSnapshot,clock,maxBytes,kind:'redis'});
}
