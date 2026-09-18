import {legal} from '../src/data.js';

const flag=(env,name)=>env[name]==='true';
const text=value=>typeof value==='string'?value.trim():'';
const safeSecret=value=>typeof value==='string'&&value===value.trim()&&/^[A-Za-z0-9_-]{32,256}$/.test(value);
const validTimeout=value=>Number.isInteger(Number(value))&&Number(value)>=250&&Number(value)<=10000;

/** Parse Telegram user IDs without silently dropping malformed allow-list entries. */
export function parseStaffUserIds(value){
 const raw=text(value);
 if(!raw)return {ok:true,ids:[]};
 const parts=raw.split(',').map(part=>part.trim());
 if(parts.some(part=>!/^\d+$/.test(part)||!Number.isSafeInteger(Number(part))||Number(part)<=0||String(Number(part))!==part))return {ok:false,ids:[]};
 return {ok:true,ids:[...new Set(parts)]};
}

/** Staff routing is group-only in both authorization modes; private IDs are unsafe. */
export function validStaffChatId(value){const raw=text(value),id=Number(raw);return /^-[1-9]\d*$/.test(raw)&&Number.isSafeInteger(id)&&id<0&&String(id)===raw;}

/** PUBLIC_ORIGIN is an origin, not a URL prefix. A single trailing slash is harmless. */
export function validPublicOrigin(value){
 try{
  const raw=text(value),url=new URL(raw);
  if(!raw||url.username||url.password||url.search||url.hash||url.pathname!=='/')return null;
  if(url.protocol==='https:')return url;
  return url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)?url:null;
 }catch{return null;}
}

export function validPrivacyUrl(value){
 try{const url=new URL(text(value));return url.protocol==='https:'&&!url.username&&!url.password?url:null;}catch{return null;}
}

/**
 * Pure, redacted configuration assessment shared by endpoint/runtime health checks.
 * It intentionally returns symbolic error codes only: callers must never echo env values.
 */
export function assessBotConfig(env=process.env,{requireEnabled=false,requireWebhook=false,requireWorker=false,requireRedis=true}={}){
 const errors=[];
 const enabled=flag(env,'BOT_ENABLED');
 const webhookEnabled=flag(env,'BOT_WEBHOOK_ENABLED');
 const workerEnabled=flag(env,'BOT_WORKER_ENABLED');
 const userIds=parseStaffUserIds(env.TELEGRAM_STAFF_USER_IDS);
 const staffChatId=text(env.TELEGRAM_STAFF_CHAT_ID);
 const staffAuthMode=text(env.TELEGRAM_STAFF_AUTH_MODE)||'allowlist';
 const redisUrl=text(env.UPSTASH_REDIS_REST_URL)||text(env.KV_REST_API_URL);
 const redisToken=text(env.UPSTASH_REDIS_REST_TOKEN)||text(env.KV_REST_API_TOKEN);
 const timeoutMs=Number(env.TELEGRAM_SEND_TIMEOUT_MS||8000);
 const privacyUrl=text(env.PRIVACY_URL);
 const webhookSecret=env.TELEGRAM_WEBHOOK_SECRET||'';
 const workerSecret=env.TELEGRAM_WORKER_SECRET||'';
 const botToken=text(env.TELEGRAM_BOT_TOKEN);
 const origin=validPublicOrigin(env.PUBLIC_ORIGIN);
 const privacy=privacyUrl?validPrivacyUrl(privacyUrl):null;

 if(requireEnabled&&!enabled)errors.push('BOT_DISABLED');
 if(requireRedis&&(!redisUrl||!redisToken))errors.push('BOT_REDIS_MISSING');
 if(requireRedis&&redisUrl&&validPublicOrigin(redisUrl)?.protocol!=='https:')errors.push('BOT_REDIS_URL_INVALID');
 if(env.BOT_REDIS_PREFIX&&(!/\{[^{}]+\}/.test(env.BOT_REDIS_PREFIX)||env.BOT_REDIS_PREFIX.length>128))errors.push('BOT_REDIS_PREFIX_INVALID');
 if(!['allowlist','group_members'].includes(staffAuthMode))errors.push('BOT_STAFF_AUTH_MODE_INVALID');
 if(!userIds.ok)errors.push('BOT_STAFF_USER_IDS_INVALID');
 if(staffAuthMode==='group_members'&&staffChatId&&(!validStaffChatId(staffChatId)||Number(staffChatId)>=0))errors.push('BOT_STAFF_GROUP_ID_INVALID');
 if(staffChatId&&!validStaffChatId(staffChatId))errors.push('BOT_STAFF_CHAT_ID_INVALID');
 if(!validTimeout(timeoutMs))errors.push('BOT_TIMEOUT_INVALID');
 if(privacyUrl&&!privacy)errors.push('BOT_PRIVACY_URL_INVALID');
 if(webhookEnabled&&(!safeSecret(webhookSecret)||!origin))errors.push(!safeSecret(webhookSecret)?'BOT_WEBHOOK_SECRET_INVALID':'BOT_PUBLIC_ORIGIN_INVALID');
 if(workerEnabled){
  if(!safeSecret(workerSecret))errors.push('BOT_WORKER_SECRET_INVALID');
  if(!botToken)errors.push('BOT_TOKEN_MISSING');
  // Staff routing is required for booking, not for info-only message delivery.
 }
 if(safeSecret(webhookSecret)&&safeSecret(workerSecret)&&webhookSecret===workerSecret)errors.push('BOT_SECRETS_NOT_INDEPENDENT');
 if(requireWebhook){
  if(!webhookEnabled)errors.push('BOT_WEBHOOK_DISABLED');
  if(!safeSecret(webhookSecret))errors.push('BOT_WEBHOOK_SECRET_INVALID');
  if(!origin)errors.push('BOT_PUBLIC_ORIGIN_INVALID');
 }
 if(requireWorker){
  if(!workerEnabled)errors.push('BOT_WORKER_DISABLED');
  if(!safeSecret(workerSecret))errors.push('BOT_WORKER_SECRET_INVALID');
  if(!botToken)errors.push('BOT_TOKEN_MISSING');
 }
 const workerReady=workerEnabled&&safeSecret(workerSecret)&&Boolean(botToken)&&validTimeout(timeoutMs)&&(!requireRedis||Boolean(redisUrl&&redisToken));
 const deliveryReady=Boolean(botToken)&&validTimeout(timeoutMs)&&(!requireRedis||Boolean(redisUrl&&redisToken));
 const remindersEnabled=flag(env,'BOT_REMINDERS_ENABLED')&&workerReady;
 const bookingReady=legal.publicationStatus==='published'&&text(env.PRIVACY_PUBLICATION_STATUS)==='published'&&text(env.PRIVACY_CONSENT_VERSION)===legal.consentVersion&&Boolean(privacy)&&deliveryReady&&userIds.ok&&validStaffChatId(staffChatId)&&(staffAuthMode==='group_members'?Number(staffChatId)<0:staffAuthMode==='allowlist'&&userIds.ids.length>0);
 return {ok:errors.length===0,errors:[...new Set(errors)],enabled,webhookEnabled,workerEnabled,origin,privacyUrl:privacy?.href||'',timeoutMs,userIds:userIds.ids,staffChatId,staffAuthMode,workerReady,deliveryReady,remindersEnabled,bookingReady};
}

export const isValidTelegramSecret=safeSecret;
export const isValidTelegramTimeout=validTimeout;
