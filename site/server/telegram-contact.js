import {BOT_RETENTION_MS} from './bot-store.js';
import {contactCopy} from './contact-copy.js';

const copy=locale=>contactCopy[locale]||contactCopy.de;
const clean=value=>String(value??'').replace(/\r\n?/g,'\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g,' ').trim();
const displayName=user=>clean(user?.first_name).replace(/\s+/g,' ').slice(0,80);
const staffKey=(chatId,userId)=>`staff:${chatId}:${userId}`;
const inline=rows=>({inline_keyboard:rows});
const send=(tx,recipient,text,meta={},kind='contact-notice')=>tx.enqueue(recipient,text,kind,tx.now,{link_preview_options:{is_disabled:true},...meta});
const entry=locale=>inline([[{text:copy(locale).contact,callback_data:'cmd:contact'}]]);
const ticketFor=(tx,userId)=>tx.getTicket(tx.getClient(userId)?.contactTicketId);

function controls(tx,ticket,locale='de'){
 const c=copy(locale),action={scope:'contact-staff',ticketId:ticket.id};
 return inline([[{text:c.reply,callback_data:tx.addAction({...action,type:'contact-reply'},BOT_RETENTION_MS)},{text:c.close,callback_data:tx.addAction({...action,type:'contact-close'},BOT_RETENTION_MS)}]]);
}

export function pauseContact(tx,chatId,user,locale){
 const session=tx.getSession(chatId);
 if(session?.stage==='contact'||tx.getClient(user.id)?.contactTicketId)tx.putClient(user.id,{contactPaused:true});
 // Preserve the approved booking/FAQ navigation behavior.
 if(session?.stage==='contact')tx.putSession(chatId,{locale,stage:'idle'});
}
export function startContact(tx,chatId,user,locale,{ready,privacyUrl}){
 if(!ready){send(tx,chatId,copy(locale).unavailable);return;}
 tx.putClient(user.id,{locale,contactPaused:false});
 tx.putSession(chatId,{locale,stage:'contact'});
 send(tx,chatId,`${copy(locale).prompt}${privacyUrl?`\n\n${privacyUrl}`:''}`,{reply_markup:inline([[{text:'↩️',callback_data:'cmd:menu'}]])});
}

/** Booking stages have priority; no booking fields or phone numbers enter tickets. */
export function contactText(tx,message,locale,{ready,staffChatId},session){
 const user=message.from,chat=message.chat,existing=ticketFor(tx,user.id);
 const selected=session.stage==='contact';
 if(!selected&&(tx.getClient(user.id)?.contactPaused||!['idle','submitted'].includes(session.stage)))return false;
 if(!selected&&!tx.getClient(user.id)?.contactTicketId)return false;
 if(!ready){send(tx,chat.id,copy(locale).unavailable);return true;}
 if(!selected&&existing?.status!=='OPEN'){send(tx,chat.id,copy(locale).closedClient,{reply_markup:entry(locale)});return true;}
 const text=clean(message.text);
 if(!text||text.length>3000){send(tx,chat.id,copy(locale).invalidText);return true;}
 // Bound undelivered contact payloads so a failed trainer-group transport
 // cannot fill the shared Redis aggregate and take booking down with it.
 const pending=Object.values(tx.raw.outbox).filter(item=>item.kind==='contact-staff-card'&&['queued','leased','sending'].includes(item.state));
 const openTickets=Object.values(tx.raw.tickets).filter(ticket=>ticket.status==='OPEN');
 if(pending.length>=20||pending.filter(item=>item.meta.ticketId===existing?.id).length>=5||existing?.status!=='OPEN'&&openTickets.length>=100){send(tx,chat.id,copy(locale).unavailable);return true;}
 const ticket=existing?.status==='OPEN'
  ?tx.patchTicket(existing.id,{locale,clientName:displayName(user)||existing.clientName})
  :tx.createTicket({clientChatId:String(chat.id),clientUserId:String(user.id),clientName:displayName(user),locale,status:'OPEN'});
 tx.putClient(user.id,{contactTicketId:ticket.id,locale});
 tx.putSession(chat.id,{locale,stage:'contact',ticketId:ticket.id});
 const c=copy('de'),keyboard=controls(tx,ticket);
 const header=`${c.newMessage}\nTicket ${ticket.id} · ${c.open}\n${c.clientLabel}: ${ticket.clientName||'—'}\n${c.languageLabel}: ${locale.toUpperCase()}`;
 send(tx,staffChatId,`${header}\n\n${text}`,{
  ticketId:ticket.id,contactCard:true,cardLocale:'de',requireOpen:true,reply_markup:keyboard,
  feedback:{recipient:String(chat.id),success:`${copy(locale).clientDelivered}\n${copy(locale).followup}`,failed:copy(locale).clientFailed,uncertain:copy(locale).clientUncertain}
 },'contact-staff-card');
 return true;
}

/** Only called after the existing fresh membership verification succeeds. */
export function contactStaffAction(tx,q,action,{staffChatId},locale){
 const c=copy(locale),ticket=tx.getTicket(action.ticketId),key=staffKey(q.message.chat.id,q.from.id);
 if(action.ownerUserId&&action.ownerUserId!==String(q.from.id))return;
 if(action.type==='contact-discard'){
  const draft=tx.getSession(key);
  if(draft?.revision===action.compositionRevision&&draft.ticketId===action.ticketId){tx.clearSession(key);send(tx,staffChatId,c.replyCancelled);}
  tx.removeAction(q.data);return;
 }
 if(!ticket||ticket.status!=='OPEN'){
  if(tx.getSession(key)?.ticketId===action.ticketId)tx.clearSession(key);
  send(tx,staffChatId,c.stale);return;
 }
 if(action.type==='contact-close'){
  // A network send already in flight cannot be retracted. Do not claim CLOSED
  // until it finishes; queued/leased sends can be atomically cancelled below.
  if(Object.values(tx.raw.outbox).some(item=>item.meta?.ticketId===ticket.id&&item.state==='sending')){send(tx,staffChatId,c.closeBusy);return;}
  const unresolved=Object.values(tx.raw.outbox).filter(item=>item.meta?.ticketId===ticket.id&&item.kind==='contact-client-reply'&&item.state==='uncertain').map(item=>item.id);
  if(unresolved.some(id=>!action.acknowledgedUncertain?.includes(id))){
   const confirm=tx.addAction({scope:'contact-staff',type:'contact-close',ticketId:ticket.id,acknowledgedUncertain:unresolved});
   send(tx,staffChatId,c.closeUncertain,{reply_markup:inline([[{text:c.closeAnyway,callback_data:confirm}]])});return;
  }
  tx.patchTicket(ticket.id,{status:'CLOSED',closedAt:tx.now});
  for(const [sessionKey,value] of Object.entries(tx.raw.sessions))if(value.value?.ticketId===ticket.id)tx.clearSession(sessionKey);
  for(const [token,value] of Object.entries(tx.raw.actions))if(value.ticketId===ticket.id)tx.removeAction(token);
  const cards=new Map();
  for(const item of Object.values(tx.raw.outbox)){
   if(item.meta?.ticketId!==ticket.id)continue;
   if(['queued','leased'].includes(item.state)&&!item.meta.safeAfterClose){item.state='cancelled';item.lease=null;}
   if(item.meta.safeAfterClose){item.meta.reply_markup=inline([]);item.meta.contactCard=false;}
   if(item.meta.contactCard&&item.state==='sent'&&Number.isSafeInteger(item.messageId))cards.set(item.messageId,{text:item.text,locale:item.meta.cardLocale||'de'});
  }
  if(Number.isSafeInteger(q.message.message_id)&&!cards.has(q.message.message_id))cards.set(q.message.message_id,{text:q.message.text||`Ticket ${ticket.id}`,locale});
  // Announce closure before editing potentially many historical cards.
  send(tx,staffChatId,`Ticket ${ticket.id} · 🔒 ${c.closedStaff}`);
  send(tx,ticket.clientChatId,copy(ticket.locale).closedClient,{reply_markup:entry(ticket.locale)});
  for(const [messageId,card] of cards){
   // Plain text only: arbitrary client text must never become Telegram markup.
   const payload={chat_id:String(staffChatId),message_id:messageId,reply_markup:inline([])};
   if(card.text){payload.text=`${card.text.slice(0,3900)}\n\n🔒 ${copy(card.locale).closedStaff}`;payload.link_preview_options={is_disabled:true};}
   tx.enqueue(staffChatId,'','contact-card-close',tx.now,{ticketId:ticket.id},card.text?'editMessageText':'editMessageReplyMarkup',payload);
  }
  return;
 }
 if(action.type!=='contact-reply')return;
 // Each trainer may select a given card once. A duplicate callback cannot
 // re-arm a draft after sending; delivery feedback supplies fresh controls.
 const stored=tx.raw.actions[String(q.data).replace(/^a:/,'')];
 if(!stored||stored.usedBy?.[q.from.id])return;
 stored.usedBy={...stored.usedBy,[q.from.id]:true};
 const existing=tx.getSession(key);
 if(existing?.stage==='contact-reply'&&existing.ticketId===ticket.id)return;
 const draft=tx.putSession(key,{stage:'contact-reply',ticketId:ticket.id,ownerUserId:String(q.from.id),locale});
 const cancel=tx.addAction({scope:'contact-staff',type:'contact-discard',ticketId:ticket.id,ownerUserId:String(q.from.id),compositionRevision:draft.revision});
 const trainerName=displayName(q.from);
 send(tx,staffChatId,`${trainerName?`${trainerName}: `:''}${c.replyPrompt.replace('{id}',ticket.id)}`,{reply_markup:inline([[{text:c.stopReply,callback_data:cancel}]])});
}

export function contactStaffText(tx,message,{staffChatId},locale){
 const key=staffKey(message.chat.id,message.from.id),draft=tx.getSession(key);
 if(draft?.stage!=='contact-reply')return false;
 const c=copy(locale),text=clean(message.text);
 if(text==='/cancel'){tx.clearSession(key);send(tx,staffChatId,c.replyCancelled);return true;}
 // Explicit booking commands supersede, never accidentally relay technical data.
 if(text.startsWith('/staff ')){tx.clearSession(key);return false;}
 if(text.startsWith('/')){send(tx,staffChatId,c.replyPrompt.replace('{id}',draft.ticketId));return true;}
 const ticket=tx.getTicket(draft.ticketId);
 if(!ticket||ticket.status!=='OPEN'||draft.ownerUserId!==String(message.from.id)){
  tx.clearSession(key);send(tx,staffChatId,c.stale);return true;
 }
 if(!text||text.length>3000){send(tx,staffChatId,c.invalidText);return true;}
 tx.patchTicket(ticket.id,{});
 // One selection sends exactly one text. The conversation stays OPEN but later
 // group chatter is not relayed until this trainer presses Reply again.
 tx.clearSession(key);
 const keyboard=controls(tx,ticket,locale);
 send(tx,ticket.clientChatId,`${copy(ticket.locale).replyHeading}:\n\n${text}`,{
  ticketId:ticket.id,requireOpen:true,reply_markup:entry(ticket.locale),
  feedback:{recipient:String(staffChatId),success:`Ticket ${ticket.id} · ${c.replyDelivered}`,failed:`Ticket ${ticket.id} · ${c.replyFailed}`,uncertain:`Ticket ${ticket.id} · ${c.replyUncertain}`,meta:{ticketId:ticket.id,contactCard:true,cardLocale:locale,requireOpen:false,safeAfterClose:true,reply_markup:keyboard}}
 },'contact-client-reply');
 return true;
}
