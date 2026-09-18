import {Redis} from '@upstash/redis';
import {createHostedTrialService,createUpstashLedger} from '../server/hosted-trial.js';
import {assessFormConfig,createFormRedis} from '../server/form-config.js';

export const config={api:{bodyParser:{sizeLimit:'8kb'}}};

function json(res,status,body){res.setHeader('Cache-Control','no-store');res.status(status).json(body);}

/** Injectable factory keeps endpoint policy testable without a Redis/network call. */
export function createTrialRequestsHandler({env=process.env,RedisClient=Redis,createService=createHostedTrialService}={}){
 return async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{ok:false,code:'method'});
  const checked=assessFormConfig(env);
  if(!checked.ready)return json(res,503,{ok:false,code:'not_configured'});
  if(!req.headers['content-type']?.startsWith('application/json'))return json(res,415,{ok:false,code:'content_type'});
  // Origin is optional for non-browser/no-JS submissions, but when supplied it
  // must match the configured canonical HTTPS origin exactly. Never trust Host.
  if(req.headers.origin&&req.headers.origin!==checked.origin)return json(res,403,{ok:false,code:'origin'});
  if(Number(req.headers['content-length'])>8192)return json(res,413,{ok:false,code:'too_large'});
  try{
   const redis=createFormRedis(env,RedisClient);
   if(!redis)return json(res,503,{ok:false,code:'not_configured'});
   const service=createService({ledger:createUpstashLedger(redis),token:env.TELEGRAM_BOT_TOKEN,chatId:env.TELEGRAM_CHAT_ID_AK});
   const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
   const result=await service.handle(req.body,ip);return json(res,result.httpStatus,result.body);
  }catch{return json(res,503,{ok:false,code:'uncertain'});}
 };
}

export default createTrialRequestsHandler();
