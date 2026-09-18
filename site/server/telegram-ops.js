import {assessBotConfig,isValidTelegramSecret} from './bot-config.js';
import {normalizePublicOrigin} from './site-config.js';
import {legal} from '../src/data.js';

// Ops are deliberately bound to the current release branch and to an explicit
// Vercel Preview deployment. No origin is trusted merely because it is present
// in an arbitrary environment variable.
const PREVIEW_BRANCH='release-6';
const EXPECTED_BOT_USERNAME='ak_loewenbot';
const EXPECTED_PRIVACY={status:legal.publicationStatus,consentVersion:legal.consentVersion,path:'/telegram-privacy/'};
const WEBHOOK_PATH='/api/telegram-webhook/';
const OPS_ORIGIN_ENV='TELEGRAM_OPS_PREVIEW_ORIGIN';
const OPS_MUTATIONS_ENV='TELEGRAM_OPS_MUTATIONS_ENABLED';
const TELEGRAM_TIMEOUT_MS=2000;
const CHECK_BUDGET_MS=24500;
const STAFF_CONCURRENCY=4;
const OUTBOX_STATES=new Set(['queued','leased','sending','sent','uncertain','failed','cancelled']);
const ENV_NAMES=[
 'BOT_ENABLED','BOT_WEBHOOK_ENABLED','BOT_WORKER_ENABLED','TELEGRAM_BOT_TOKEN','TELEGRAM_CHAT_ID_AK','TELEGRAM_BOT_USERNAME',
 'TELEGRAM_STAFF_USER_IDS','TELEGRAM_STAFF_CHAT_ID','TELEGRAM_STAFF_AUTH_MODE','TELEGRAM_WEBHOOK_SECRET','TELEGRAM_WORKER_SECRET',
 'TELEGRAM_SEND_TIMEOUT_MS','PUBLIC_ORIGIN',OPS_ORIGIN_ENV,OPS_MUTATIONS_ENV,'VERCEL_URL','VERCEL_BRANCH_URL',
 'UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN',
 'KV_REST_API_URL','KV_REST_API_TOKEN','BOT_REDIS_PREFIX','PRIVACY_PUBLICATION_STATUS',
 'PRIVACY_CONSENT_VERSION','PRIVACY_URL','FORM_DELIVERY_ENABLED','WEB_TELEGRAM_BRIDGE_ENABLED','WEB_TELEGRAM_BRIDGE_SECRET'
];
const FIXED_ERRORS=new Set([
 'UNKNOWN_COMMAND','MUTATION_PRECONDITION_FAILED','MISSING_RUNTIME_CONFIGURATION','TRANSPORT_FAILED',
 'TELEGRAM_RESPONSE_INVALID','REDIS_RESPONSE_INVALID','RUNTIME_IMPORT_FAILED','DRAIN_FAILED',
 'CHECK_DEADLINE_EXCEEDED','CHECK_PRECONDITION_FAILED','WEBHOOK_NOT_CONFIRMED','WEBHOOK_DESTINATION_CONFLICT','WORKER_NOT_READY'
]);
const present=value=>typeof value==='string'&&value.trim().length>0;
const nonempty=value=>typeof value==='string'?value.trim():'';
const isObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const uniquePush=(list,value)=>{if(FIXED_ERRORS.has(value)&&!list.includes(value))list.push(value);};

function fixedError(error){
 if(error&&error.code&&FIXED_ERRORS.has(error.code))return error.code;
 return 'TRANSPORT_FAILED';
}
function remaining(deadline){return Math.max(1,Math.min(TELEGRAM_TIMEOUT_MS,deadline-Date.now()));}
function deadlineError(){const error=new Error('deadline');error.code='CHECK_DEADLINE_EXCEEDED';return error;}
function within(deadline){if(Date.now()>=deadline)throw deadlineError();}
function configuredOpsOrigin(env){
 const raw=nonempty(env[OPS_ORIGIN_ENV]);
 const normalized=normalizePublicOrigin(raw);
 // The explicit target itself must already be canonical (no trailing slash).
 return normalized&&raw===normalized?normalized:null;
}
function platformDeploymentOrigin(value){
 const raw=nonempty(value);
 // Vercel supplies a hostname, not a URL. Reject schemes, paths, credentials,
 // query/fragment data and ports instead of treating arbitrary input as a host.
 if(!raw||raw!==String(value)||/[\\\\/?#@:\s]/.test(raw))return null;
 try{
  const url=new URL(`https://${raw}`);
  if(url.protocol!=='https:'||url.username||url.password||url.port||url.pathname!=='/'||url.search||url.hash)return null;
  return url.origin;
 }catch{return null;}
}
function deploymentOriginMatch(env,target){
 if(!target)return false;
 return [platformDeploymentOrigin(env.VERCEL_URL),platformDeploymentOrigin(env.VERCEL_BRANCH_URL)].some(origin=>origin===target);
}
function publicOriginIsTarget(env,target){
 const publicOrigin=normalizePublicOrigin(nonempty(env.PUBLIC_ORIGIN));
 return Boolean(target&&publicOrigin===target);
}
function branchIsExact(env){return nonempty(env.VERCEL_GIT_COMMIT_REF)===PREVIEW_BRANCH;}
function envPresence(env){const out={};for(const name of ENV_NAMES)out[name]=present(env[name]);return out;}
function privacyExact(env,target){
 if(!target||nonempty(env.PRIVACY_PUBLICATION_STATUS)!==EXPECTED_PRIVACY.status||nonempty(env.PRIVACY_CONSENT_VERSION)!==EXPECTED_PRIVACY.consentVersion)return false;
 try{
  const url=new URL(nonempty(env.PRIVACY_URL));
  return url.protocol==='https:'&&!url.username&&!url.password&&!url.search&&!url.hash&&url.origin===target&&url.pathname===EXPECTED_PRIVACY.path;
 }catch{return false;}
}
function preconditions(env,flag){
 const target=configuredOpsOrigin(env);
 return {
  vercel:env.VERCEL==='1',
  preview:env.VERCEL_ENV==='preview',
  source_branch:branchIsExact(env),
  ops_origin_configured:Boolean(target),
  public_origin:publicOriginIsTarget(env,target),
  deployment_origin:deploymentOriginMatch(env,target),
  privacy_exact:privacyExact(env,target),
  bot_enabled:env.BOT_ENABLED==='true',
  requested_feature:env[flag]==='true'
 };
}
function runtimeAssessment(env,flag){
 try{return assessBotConfig(env,{requireEnabled:true,requireWebhook:flag==='BOT_WEBHOOK_ENABLED',requireWorker:flag==='BOT_WORKER_ENABLED',requireRedis:true});}
 catch{return {ok:false,bookingReady:false,staffAuthMode:'allowlist',userIds:[],staffChatId:''};}
}
function mutationAllowed(env,flag){
 const p=preconditions(env,flag),checked=runtimeAssessment(env,flag);
 return env[OPS_MUTATIONS_ENV]==='true'&&env.VERCEL_ENV!=='production'&&Object.values(p).every(Boolean)&&checked.ok;
}
function safeStaffIds(value){
 const raw=nonempty(value);if(!raw)return [];
 const parts=raw.split(',').map(x=>x.trim());
 if(parts.some(x=>!/^[1-9]\d*$/.test(x)||!Number.isSafeInteger(Number(x))||String(Number(x))!==x))return [];
 return [...new Set(parts)];
}
function validNegativeChatId(value){const raw=nonempty(value);return /^-[1-9]\d*$/.test(raw)&&Number.isSafeInteger(Number(raw))&&String(Number(raw))===raw;}
function emptyTelegram(){return {identity_match:false,webhook_url_match:false,pending_count:0,last_error_present:false};}
function emptyStaff(mode='allowlist'){return {mode,configured:false,group_valid:false,chat_group_or_supergroup:false,bot_admin:false,allowlisted_humans_current:false,membership_ready:false};}
function emptyAggregates(){return {
 sessions:{total:0,active:0},
 requests:{total:0,pending:0,confirmed:0,cancelled:0},
 dedup:{total:0,updates:0},
 outbox:{total:0,queued:0,leased:0,sending:0,sent:0,uncertain:0,failed:0,cancelled:0},
 reminders:{enabled:0,queued:0,sent:0,cancelled:0}
};}
function baseCheck(env){
 const presence=envPresence(env),target=configuredOpsOrigin(env),privacy=privacyExact(env,target),assessment=runtimeAssessment(env,'BOT_WEBHOOK_ENABLED'),ids=safeStaffIds(env.TELEGRAM_STAFF_USER_IDS);
 const mode=assessment.staffAuthMode==='group_members'?'group_members':assessment.staffAuthMode==='allowlist'?'allowlist':'invalid';
 const groupValid=validNegativeChatId(assessment.staffChatId);
 const staffConfigured=groupValid&&(mode==='group_members'||(mode==='allowlist'&&ids.length>0));
 const configReady=assessment.ok;
 const bookingReady=Object.values(preconditions(env,'BOT_WEBHOOK_ENABLED')).every(Boolean)&&assessment.ok===true&&assessment.bookingReady===true&&privacy;
 return {presence,privacy,source_branch_match:branchIsExact(env),config_ready:configReady,booking_ready:bookingReady,staffConfigured,groupValid,mode,ids,assessment};
}

async function telegramRequest({env,method,body,fetchImpl,deadline}){
 within(deadline);
 const token=nonempty(env.TELEGRAM_BOT_TOKEN);
 if(!token)throw Object.assign(new Error('missing'),{code:'MISSING_RUNTIME_CONFIGURATION'});
 const url=`https://api.telegram.org/bot${token}/${method}`;
 const options={method:'POST',headers:{'content-type':'application/json'},redirect:'error',signal:AbortSignal.timeout(remaining(deadline))};
 if(body!==undefined)options.body=JSON.stringify(body);
 try{
  const response=await fetchImpl(url,options);
  if(!response||response.status!==200||response.redirected===true)throw Object.assign(new Error('response'),{code:'TELEGRAM_RESPONSE_INVALID'});
  const parsed=await response.json();
  if(!isObject(parsed)||parsed.ok!==true)return null;
  return parsed.result;
 }catch(error){throw Object.assign(new Error('transport'),{code:fixedError(error)});}
}
function inspectMe(result){return isObject(result)&&result.username===EXPECTED_BOT_USERNAME&&result.is_bot===true&&Number.isSafeInteger(result.id)&&result.id>0;}
function inspectWebhook(result,target){
 const info=isObject(result)?result:{};
 const pending=Number.isInteger(info.pending_update_count)&&info.pending_update_count>=0?info.pending_update_count:0;
 return {webhook_url_match:Boolean(target)&&info.url===`${target}${WEBHOOK_PATH}`,pending_count:pending,last_error_present:present(info.last_error_message)};
}
async function getChat({env,fetchImpl,deadline}){return telegramRequest({env,method:'getChat',body:{chat_id:nonempty(env.TELEGRAM_STAFF_CHAT_ID)},fetchImpl,deadline});}
async function getMember({env,chatId,userId,fetchImpl,deadline}){return telegramRequest({env,method:'getChatMember',body:{chat_id:chatId,user_id:Number(userId)},fetchImpl,deadline});}
async function loadStaff({env,fetchImpl,deadline,botId,base}){
 const result={...emptyStaff(base.mode),configured:base.staffConfigured};
 if(!base.staffConfigured||!present(env.TELEGRAM_BOT_TOKEN))return result;
 let chat;
 try{chat=await getChat({env,fetchImpl,deadline});}catch{return result;}
 result.group_valid=isObject(chat)&&['group','supergroup'].includes(chat.type)&&validNegativeChatId(env.TELEGRAM_STAFF_CHAT_ID)&&String(chat.id)===nonempty(env.TELEGRAM_STAFF_CHAT_ID);
 result.chat_group_or_supergroup=result.group_valid;
 if(!result.group_valid)return result;
 let botMember;
 try{botMember=await getMember({env,chatId:env.TELEGRAM_STAFF_CHAT_ID,userId:botId,fetchImpl,deadline});}catch{return result;}
 result.bot_admin=isObject(botMember)&&['creator','administrator'].includes(botMember.status)&&isObject(botMember.user)&&botMember.user.id===Number(botId)&&botMember.user.is_bot===true;
 if(!result.bot_admin)return result;
 // Group-members mode deliberately does not enumerate humans: every current member
 // is authorized at action time by telegram-bot.js's fresh verifier.
 if(base.mode==='group_members'){
  result.membership_ready=true;
  return result;
 }
 let verifier;
 try{
  const module=await import('./telegram-staff.js');
  verifier=module.createStaffMembershipVerifier({token:env.TELEGRAM_BOT_TOKEN,fetchImpl,timeoutMs:Math.min(TELEGRAM_TIMEOUT_MS,remaining(deadline))});
 }catch{return result;}
 let next=0,success=true;
 async function worker(){while(true){const index=next++;if(index>=base.ids.length)return;try{within(deadline);if(await verifier(env.TELEGRAM_STAFF_CHAT_ID,base.ids[index])!==true)success=false;}catch(error){success=false;if(error?.code==='CHECK_DEADLINE_EXCEEDED')return;}}}
 await Promise.all(Array.from({length:Math.min(STAFF_CONCURRENCY,base.ids.length)},()=>worker()));
 result.allowlisted_humans_current=success;
 result.membership_ready=result.group_valid&&result.bot_admin&&success;
 return result;
}
function aggregatesFromState(raw){
 const aggregates=emptyAggregates();
 if(!isObject(raw)||raw.schema!==2)return {existing:isObject(raw),schema2_compatible:false,aggregates};
 const maps=['sessions','requests','clients','updates','actions','outbox','recipientSequence','recipientBlockedUntil'];
 if(maps.some(key=>!isObject(raw[key])))return {existing:true,schema2_compatible:false,aggregates};
 const sessions=Object.values(raw.sessions),requests=Object.values(raw.requests),updates=Object.values(raw.updates),outbox=Object.values(raw.outbox);
 aggregates.sessions.total=sessions.length;aggregates.sessions.active=sessions.filter(x=>isObject(x)&&Number(x.expiresAt)>Date.now()).length;
 aggregates.requests.total=requests.length;
 for(const item of requests)if(isObject(item)&&['pending','confirmed','cancelled'].includes(item.status))aggregates.requests[item.status]++;
 aggregates.dedup.total=updates.length;aggregates.dedup.updates=updates.length;
 aggregates.outbox.total=outbox.length;
 for(const item of outbox){if(!isObject(item))continue;if(OUTBOX_STATES.has(item.state))aggregates.outbox[item.state]++;if(item.kind==='reminder'){if(item.state==='queued')aggregates.reminders.queued++;if(item.state==='sent')aggregates.reminders.sent++;if(item.state==='cancelled')aggregates.reminders.cancelled++;}}
 aggregates.reminders.enabled=requests.filter(x=>isObject(x)&&x.reminders?.enabled===true).length;
 return {existing:true,schema2_compatible:true,aggregates};
}
// Never attach a Redis credential to a URL rejected by runtime validation.
// Use the canonical HTTPS origin; paths, credentials, queries and fragments fail closed.
function redisOrigin(env){
 return normalizePublicOrigin(nonempty(env.UPSTASH_REDIS_REST_URL)||nonempty(env.KV_REST_API_URL));
}
async function redisGet({env,key,fetchImpl,deadline}){
 const endpoint=redisOrigin(env),token=nonempty(env.UPSTASH_REDIS_REST_TOKEN)||nonempty(env.KV_REST_API_TOKEN);
 if(!endpoint||!token)throw Object.assign(new Error('missing'),{code:'MISSING_RUNTIME_CONFIGURATION'});
 within(deadline);
 try{
  const response=await fetchImpl(`${endpoint.replace(/\/$/,'')}/get/${encodeURIComponent(key)}`,{method:'GET',headers:{authorization:`Bearer ${token}`},redirect:'error',signal:AbortSignal.timeout(remaining(deadline))});
  if(!response||response.status!==200||response.redirected===true)throw new Error('response');
  const body=await response.json();if(!isObject(body)||!Object.prototype.hasOwnProperty.call(body,'result'))throw new Error('body');return body.result;
 }catch(error){throw Object.assign(new Error('redis'),{code:fixedError(error)==='CHECK_DEADLINE_EXCEEDED'?'CHECK_DEADLINE_EXCEEDED':'REDIS_RESPONSE_INVALID'});}
}
async function redisCheck({env,fetchImpl,deadline}){
 const empty={ping_ok:false,state_exists:false,schema2_compatible:false,existing:false,aggregates:emptyAggregates()};
 const endpoint=redisOrigin(env),token=nonempty(env.UPSTASH_REDIS_REST_TOKEN)||nonempty(env.KV_REST_API_TOKEN);
 if(!endpoint||!token)return empty;
 try{
  const response=await fetchImpl(`${endpoint.replace(/\/$/,'')}/ping`,{method:'GET',headers:{authorization:`Bearer ${token}`},redirect:'error',signal:AbortSignal.timeout(remaining(deadline))});
  const body=await response.json();
  if(!response||response.status!==200||response.redirected===true||!isObject(body)||body.result!=='PONG')return {...empty,failure:'REDIS_RESPONSE_INVALID'};
  const prefix=present(env.BOT_REDIS_PREFIX)?env.BOT_REDIS_PREFIX:'{akbot}:';
  const state=await redisGet({env,key:`${prefix}state`,fetchImpl,deadline});
  if(state===null||state===undefined)return {...empty,ping_ok:true,state_exists:false};
  let parsed;try{parsed=typeof state==='string'?JSON.parse(state):state;}catch{return {...empty,ping_ok:true,state_exists:true};}
  const inspected=aggregatesFromState(parsed);
  return {ping_ok:true,state_exists:true,...inspected};
 }catch{return {...empty,failure:'REDIS_RESPONSE_INVALID'};}
}
function readinessFrom({base,telegram,staff,redis}){return base.booking_ready&&telegram.identity_match&&telegram.webhook_url_match&&staff.membership_ready&&redis.ping_ok&&(!redis.state_exists||redis.schema2_compatible);}

export async function runCheck({env=process.env,fetchImpl=fetch,now=Date.now}={}){
 const started=now(),deadline=started+CHECK_BUDGET_MS,base=baseCheck(env),errors=[];
 const output={ok:false,command:'check',source_branch_match:base.source_branch_match,env_presence:base.presence,config_ready:base.config_ready,booking_ready:false,privacy_exact:base.privacy,preconditions:preconditions(env,'BOT_WEBHOOK_ENABLED'),telegram:emptyTelegram(),staff:emptyStaff(base.mode),redis:{ping_ok:false,state_exists:false,schema2_compatible:false,existing:false,aggregates:emptyAggregates()}};
 if(!Object.values(output.preconditions).every(Boolean))uniquePush(errors,'CHECK_PRECONDITION_FAILED');
 if(!present(env.TELEGRAM_BOT_TOKEN))uniquePush(errors,'MISSING_RUNTIME_CONFIGURATION');
 // A failed target gate is a safe, local diagnostic result. Do not contact
 // Telegram/Redis when the request is not for this release's verified Preview.
 if(errors.length){output.errors=errors;return output;}
 let me,webhook,redis,staff;
 try{me=await telegramRequest({env,method:'getMe',fetchImpl,deadline});}catch(error){uniquePush(errors,fixedError(error));}
 output.telegram.identity_match=inspectMe(me);
 const results=await Promise.allSettled([
  telegramRequest({env,method:'getWebhookInfo',fetchImpl,deadline}),
  redisCheck({env,fetchImpl,deadline})
 ]);
 if(results[0].status==='fulfilled')webhook=results[0].value;else uniquePush(errors,fixedError(results[0].reason));
 if(results[1].status==='fulfilled')redis=results[1].value;else uniquePush(errors,fixedError(results[1].reason));
 if(webhook)Object.assign(output.telegram,inspectWebhook(webhook,configuredOpsOrigin(env)));
 if(redis){if(redis.failure)uniquePush(errors,redis.failure);const safeRedis={...redis};delete safeRedis.failure;output.redis=safeRedis;}
 try{staff=await loadStaff({env,fetchImpl,deadline,botId:isObject(me)?me.id:0,base});}catch(error){uniquePush(errors,fixedError(error));staff=emptyStaff(base.mode);}
 output.staff=staff;
 output.booking_ready=readinessFrom({base,telegram:output.telegram,staff,redis:output.redis});
 if(!output.telegram.identity_match)uniquePush(errors,'TELEGRAM_RESPONSE_INVALID');
 if(base.config_ready&&!output.telegram.webhook_url_match)uniquePush(errors,'WEBHOOK_NOT_CONFIRMED');
 if(output.redis.state_exists&&!output.redis.schema2_compatible)uniquePush(errors,'REDIS_RESPONSE_INVALID');
 if(output.booking_ready===false&&base.config_ready&&staff.membership_ready&&output.telegram.identity_match&&output.redis.ping_ok===false)uniquePush(errors,'REDIS_RESPONSE_INVALID');
 output.ok=errors.length===0&&output.booking_ready;
 if(Date.now()>=deadline)uniquePush(errors,'CHECK_DEADLINE_EXCEEDED');
 output.ok=output.ok&&errors.length===0;
 if(errors.length)output.errors=errors;else output.errors=[];
 return output;
}

export async function runWebhook({env=process.env,fetchImpl=fetch}={}){
 const p=preconditions(env,'BOT_WEBHOOK_ENABLED'),target=configuredOpsOrigin(env);
 const output={ok:false,command:'webhook',mutated:false,preconditions:p,webhook_url_match:false,pending_count:0,last_error_present:false};
 if(!mutationAllowed(env,'BOT_WEBHOOK_ENABLED')){output.code='MUTATION_PRECONDITION_FAILED';return output;}
 if(!present(env.TELEGRAM_BOT_TOKEN)||!present(env.TELEGRAM_WEBHOOK_SECRET)){output.code='MISSING_RUNTIME_CONFIGURATION';return output;}
 const deadline=Date.now()+CHECK_BUDGET_MS;let setResult;
 try{
  const me=await telegramRequest({env,method:'getMe',fetchImpl,deadline});
  if(!inspectMe(me)){output.code='TELEGRAM_RESPONSE_INVALID';return output;}
  const current=await telegramRequest({env,method:'getWebhookInfo',fetchImpl,deadline});
  if(!isObject(current)||typeof current.url!=='string'){output.code='TELEGRAM_RESPONSE_INVALID';return output;}
  // A Preview operation must never take over another environment's webhook.
  if(current.url&&current.url!==`${target}${WEBHOOK_PATH}`){output.code='WEBHOOK_DESTINATION_CONFLICT';return output;}
 }catch(error){output.code=fixedError(error);return output;}
 try{setResult=await telegramRequest({env,method:'setWebhook',body:{url:`${target}${WEBHOOK_PATH}`,secret_token:env.TELEGRAM_WEBHOOK_SECRET,allowed_updates:['message','callback_query'],max_connections:2,drop_pending_updates:false},fetchImpl,deadline});output.mutated=setResult===true;}catch(error){output.code=fixedError(error);}
 try{const info=await telegramRequest({env,method:'getWebhookInfo',fetchImpl,deadline});if(info)Object.assign(output,inspectWebhook(info,target));}catch(error){if(!output.code)output.code=fixedError(error);}
 output.ok=output.mutated&&output.webhook_url_match;
 if(!output.ok&&!output.code)output.code='WEBHOOK_NOT_CONFIRMED';
 return output;
}

export async function runWorker({env=process.env,fetchImpl=fetch,createRuntime}={}){
 const p=preconditions(env,'BOT_WORKER_ENABLED');
 const output={ok:false,command:'worker',mutated:false,preconditions:p,processed:0};
 if(!mutationAllowed(env,'BOT_WORKER_ENABLED')){output.code='MUTATION_PRECONDITION_FAILED';return output;}
 if(!present(env.TELEGRAM_BOT_TOKEN)||!present(env.TELEGRAM_WORKER_SECRET)){output.code='MISSING_RUNTIME_CONFIGURATION';return output;}
 try{
  // Confirm the intended bot before reading/draining potentially sensitive work.
  const me=await telegramRequest({env,method:'getMe',fetchImpl,deadline:Date.now()+TELEGRAM_TIMEOUT_MS});
  if(!inspectMe(me)){output.code='TELEGRAM_RESPONSE_INVALID';return output;}
  let factory=createRuntime;
  if(!factory){try{const module=await import('./bot-runtime.js');factory=module.createBotRuntime;}catch{throw Object.assign(new Error('runtime'),{code:'RUNTIME_IMPORT_FAILED'});}}
  if(typeof factory!=='function')throw Object.assign(new Error('runtime'),{code:'RUNTIME_IMPORT_FAILED'});
  const runtime=factory(env);if(!runtime||typeof runtime.drain!=='function')throw Object.assign(new Error('runtime'),{code:'WORKER_NOT_READY'});
  const processed=await runtime.drain({limit:50,maxDurationMs:25000});
  if(!Number.isInteger(processed)||processed<0||processed>50)throw Object.assign(new Error('drain'),{code:'DRAIN_FAILED'});
  output.processed=processed;output.mutated=true;output.ok=true;return output;
 }catch(error){output.code=fixedError(error);return output;}
}

export async function runTelegramOps({command='check',env=process.env,fetchImpl=fetch,createRuntime}={}){
 try{
  if(command==='check')return await runCheck({env,fetchImpl});
  if(command==='webhook')return await runWebhook({env,fetchImpl});
  if(command==='worker')return await runWorker({env,fetchImpl,createRuntime});
  return {ok:false,command:'unknown',code:'UNKNOWN_COMMAND'};
 }catch(error){return {ok:false,command:['check','webhook','worker'].includes(command)?command:'unknown',code:fixedError(error)};}
}

// A remote check reuses managed Vercel KV without exporting its credentials.
// Only a fixed schema is copied to stdout: never echo an arbitrary HTTP body.
function safeCheckValue(value,template){
 if(typeof template==='boolean'){if(typeof value!=='boolean')throw new Error('shape');return value;}
 if(typeof template==='number'){if(!Number.isSafeInteger(value)||value<0)throw new Error('shape');return value;}
 if(typeof template==='string'){if(!['allowlist','group_members','invalid'].includes(value))throw new Error('shape');return value;}
 if(!isObject(value))throw new Error('shape');
 return Object.fromEntries(Object.entries(template).map(([key,shape])=>[key,safeCheckValue(value[key],shape)]));
}
export async function runRemoteCheck({env=process.env,fetchImpl=fetch}={}){
 const failed={ok:false,command:'check',remote:true,code:'TRANSPORT_FAILED'},target=configuredOpsOrigin(env);
 if(!isValidTelegramSecret(env.TELEGRAM_WORKER_SECRET)||!target)return {...failed,code:'MISSING_RUNTIME_CONFIGURATION'};
 try{
  const response=await fetchImpl(`${target}/api/telegram-ops/`,{method:'POST',headers:{authorization:`Bearer ${env.TELEGRAM_WORKER_SECRET}`},redirect:'error',signal:AbortSignal.timeout(29000)});
  if(![200,503].includes(response.status)||response.redirected===true)return failed;
  const raw=await response.json();
  if(!isObject(raw)||raw.command!=='check'||typeof raw.ok!=='boolean'||!Array.isArray(raw.errors)||raw.errors.some(code=>!FIXED_ERRORS.has(code)))return failed;
  const template={source_branch_match:false,config_ready:false,booking_ready:false,privacy_exact:false,preconditions:preconditions({},'BOT_WEBHOOK_ENABLED'),env_presence:envPresence({}),telegram:emptyTelegram(),staff:emptyStaff(),redis:{ping_ok:false,state_exists:false,schema2_compatible:false,existing:false,aggregates:emptyAggregates()}};
  const checked=safeCheckValue(raw,template);
  return {...checked,ok:response.status===200&&raw.ok&&checked.booking_ready&&checked.config_ready&&checked.source_branch_match&&Object.values(checked.preconditions).every(Boolean),command:'check',remote:true,errors:[...new Set(raw.errors)]};
 }catch{return failed;}
}

export function serializeResult(result){
 // Every caller receives a JSON object assembled by the routines above; this
 // final serialization also prevents accidental Error objects from reaching stdout.
 return JSON.stringify(result);
}

async function main(){
 const command=process.argv[2]||'check';
 const result=command==='check'&&process.argv[3]==='--remote'?await runRemoteCheck():await runTelegramOps({command});
 process.stdout.write(`${serializeResult(result)}\n`);
 process.exitCode=result.ok?0:1;
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/telegram-ops.js'))main().catch(()=>{process.exitCode=1;process.stdout.write('{"ok":false,"command":"check","code":"TRANSPORT_FAILED"}\n');});

export {EXPECTED_PRIVACY,PREVIEW_BRANCH,ENV_NAMES,aggregatesFromState,inspectWebhook,mutationAllowed,preconditions};
