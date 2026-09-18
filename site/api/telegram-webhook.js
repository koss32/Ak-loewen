import {secureEqual} from '../server/bot-store.js';
import {createBotRuntime} from '../server/bot-runtime.js';
import {assessBotConfig,validPublicOrigin} from '../server/bot-config.js';
import {waitUntil} from '@vercel/functions';
export const config={api:{bodyParser:false}};
const LIMIT=128*1024;
const INTERFACE_CLEANUP_DELAY_MS=1000;
const json=(res,status,body)=>{res.setHeader('Cache-Control','no-store');res.status(status).json(body);};
const scalar=value=>typeof value==='string'?value:'';

export {validPublicOrigin};
export async function readJsonBody(req,limit=LIMIT){
 let buffer;
 if(Buffer.isBuffer(req.rawBody))buffer=req.rawBody;
 else if(Buffer.isBuffer(req.body))buffer=req.body;
 else if(typeof req.body==='string')buffer=Buffer.from(req.body);
 else if(req&&typeof req[Symbol.asyncIterator]==='function'){
  const chunks=[];let size=0;
  for await(const chunk of req){const part=Buffer.from(chunk);size+=part.length;if(size>limit)throw Object.assign(new Error('too_large'),{code:'too_large'});chunks.push(part);}
  buffer=Buffer.concat(chunks);
 }else throw Object.assign(new Error('raw_body_required'),{code:'invalid_json'});
 if(buffer.length>limit)throw Object.assign(new Error('too_large'),{code:'too_large'});
 let body;try{body=JSON.parse(buffer.toString('utf8'));}catch{throw Object.assign(new Error('invalid_json'),{code:'invalid_json'});}
 if(!body||typeof body!=='object'||Array.isArray(body))throw Object.assign(new Error('invalid_json'),{code:'invalid_json'});
 return body;
}

const integer=value=>Number.isSafeInteger(value);
/** A message without text can be an authentic Telegram photo/contact/sticker/service update. */
export function telegramUpdateKind(update){
 if(!Number.isInteger(update?.update_id)||Boolean(update.message)===Boolean(update.callback_query))return 'invalid';
 if(update.message){
  const message=update.message;
  if(!message||typeof message!=='object'||!integer(message.chat?.id)||typeof message.chat?.type!=='string')return 'invalid';
  // Service messages may have no `from`; if present, it must still be well formed.
  if(message.from!==undefined&&!integer(message.from?.id))return 'invalid';
  return typeof message.text==='string'&&integer(message.from?.id)?'message':'unsupported';
 }
 const query=update.callback_query;
 if(!query||typeof query!=='object'||typeof query.id!=='string'||!query.id||!integer(query.from?.id)||!integer(query.message?.chat?.id)||typeof query.message.chat?.type!=='string')return 'invalid';
 return typeof query.data==='string'&&query.data.length>0&&Buffer.byteLength(query.data)<=64?'callback':'unsupported';
}
export function validTelegramUpdate(update){return telegramUpdateKind(update)!=='invalid';}

export function createWebhookHandler({env=process.env,createRuntime=createBotRuntime,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),waitUntilTask=waitUntil}={}){
 return async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{ok:false,code:'method'});
  const checked=assessBotConfig(env,{requireEnabled:true,requireWebhook:true,requireRedis:false});
  if(!checked.ok)return json(res,503,{ok:false,code:'not_configured'});
  if(scalar(req.headers?.host).toLowerCase()!==checked.origin.host.toLowerCase())return json(res,403,{ok:false,code:'host'});
  if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(scalar(req.headers?.['content-type'])))return json(res,415,{ok:false,code:'content_type'});
  if(!secureEqual(scalar(req.headers?.['x-telegram-bot-api-secret-token']),scalar(env.TELEGRAM_WEBHOOK_SECRET)))return json(res,401,{ok:false,code:'secret'});
  let update;try{update=await readJsonBody(req);}catch(error){return json(res,error.code==='too_large'?413:400,{ok:false,code:error.code||'invalid_json'});}
  const kind=telegramUpdateKind(update);
  if(kind==='invalid')return json(res,400,{ok:false,code:'invalid_update'});
  // Ignore authentic non-text/service updates after authentication. No state, PII, or retry loop.
  if(kind==='unsupported')return json(res,200,{ok:true,dropped:true});
  try{
   const runtime=createRuntime(env);
   const result=await runtime.bot.handle(update);
   if(result?.ok===false)return json(res,400,result);
   // The durable reducer has tagged this update's output. Drain only that
   // immediate work now: callback ACK plus client/staff replies, never global
   // backlog or scheduled care. A 25s dispatch window leaves serverless
   // headroom under Vercel's 30s cap and permits more than one 2s request.
   try{
    await runtime.drain({limit:10,maxDurationMs:WEBHOOK_DRAIN_BUDGET_MS,sourceUpdateId:update.update_id});
    if(await runtime.hasPendingImmediateForUpdate(update.update_id))return json(res,503,{ok:false,code:'retry'});
    // Cleanup is deliberately delayed so Telegram users can see the transition.
    // Register it after the response so the callback itself stays fast; a failed
    // cleanup remains recoverable by the regular worker.
    if(typeof runtime.hasPendingCleanupForUpdate==='function'&&await runtime.hasPendingCleanupForUpdate(update.update_id)){
     const cleanup=async()=>{try{await sleep(INTERFACE_CLEANUP_DELAY_MS);await runtime.drain({limit:10,maxDurationMs:29000,sourceUpdateId:update.update_id,includeBackground:true});}catch{/* keep the cleanup queued for worker recovery */}};
     try{waitUntilTask(cleanup());}catch{/* Vercel waitUntil is unavailable in local adapters; worker recovery remains available. */}
    }
   }catch{return json(res,503,{ok:false,code:'retry'});}
   return json(res,200,{ok:true,dropped:Boolean(result?.dropped)});
  }catch{return json(res,503,{ok:false,code:'retry'});}
 };
}
export const WEBHOOK_DRAIN_BUDGET_MS=25000;
export default createWebhookHandler();
