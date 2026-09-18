import {legal} from '../src/data.js';
import {normalizePublicOrigin} from './site-config.js';

const flag=(env,name)=>env[name]==='true';
const strictText=value=>typeof value==='string'&&value===value.trim()?value:'';
const validNegativeChatId=value=>{
 const raw=strictText(value),number=Number(raw);
 return /^-[1-9]\d*$/.test(raw)&&Number.isSafeInteger(number)&&number<0&&String(number)===raw;
};
const validRedisUrl=value=>{
 const raw=strictText(value);
 if(!raw||raw.includes('\\'))return false;
 try{
  const url=new URL(raw);
  return url.protocol==='https:'&&!url.username&&!url.password&&!url.search&&!url.hash&&url.pathname==='/'&&Boolean(url.hostname);
 }catch{return false;}
};

/**
 * A Redis endpoint and token must come from the same provider pair.  The
 * function is private because its return value contains credentials; the
 * public assessment below intentionally never does.
 */
function selectedRedisPair(env){
 const upstash={url:strictText(env.UPSTASH_REDIS_REST_URL),token:strictText(env.UPSTASH_REDIS_REST_TOKEN)};
 const kv={url:strictText(env.KV_REST_API_URL),token:strictText(env.KV_REST_API_TOKEN)};
 const present=pair=>Boolean(pair.url||pair.token);
 const complete=pair=>Boolean(pair.url&&pair.token&&validRedisUrl(pair.url));
 // Reject an incomplete alias even when the other alias is complete. This
 // prevents a later fallback edit from silently crossing URL/token providers.
 if((present(upstash)&&!complete(upstash))||(present(kv)&&!complete(kv)))return null;
 if(complete(upstash))return upstash;
 if(complete(kv))return kv;
 return null;
}

/** Create a Redis client only from a fully validated, same-provider pair. */
export function createFormRedis(env,RedisClient){
 const pair=selectedRedisPair(env);
 return pair?new RedisClient(pair):null;
}

/**
 * Pure, redacted form-delivery configuration assessment.
 *
 * `enabled` is the explicit delivery opt-in (and, locally, the additional
 * LOCAL_FORM_DELIVERY_ENABLED opt-in). `ready`/`ok` additionally require the
 * published legal source and matching form publication/version, a canonical
 * origin, Telegram target and a complete same-provider Redis pair. No values
 * from env, including credentials, are returned.
 */
export function assessFormConfig(env=process.env,{requireRedis=true,local=false}={}){
 const errors=[];
 const deliveryEnabled=flag(env,'FORM_DELIVERY_ENABLED');
 const localEnabled=!local||flag(env,'LOCAL_FORM_DELIVERY_ENABLED');
 const enabled=deliveryEnabled&&localEnabled;
 const origin=normalizePublicOrigin(env.PUBLIC_ORIGIN,{allowLoopback:local});
 const token=strictText(env.TELEGRAM_BOT_TOKEN);
 const sourcePublished=legal.publicationStatus==='published';
 const formPublished=strictText(env.FORM_PUBLICATION_STATUS)==='published';
 const consentMatches=strictText(env.FORM_CONSENT_VERSION)===legal.consentVersion;
 const redis=selectedRedisPair(env);

 if(!deliveryEnabled)errors.push('FORM_DELIVERY_DISABLED');
 if(local&&!localEnabled)errors.push('FORM_LOCAL_DELIVERY_DISABLED');
 if(!sourcePublished)errors.push('FORM_LEGAL_SOURCE_UNPUBLISHED');
 if(!formPublished)errors.push('FORM_PUBLICATION_UNPUBLISHED');
 if(!consentMatches)errors.push('FORM_CONSENT_VERSION_MISMATCH');
 if(!origin)errors.push('FORM_PUBLIC_ORIGIN_INVALID');
 if(!token)errors.push('FORM_TOKEN_MISSING');
 if(!validNegativeChatId(env.TELEGRAM_CHAT_ID_AK))errors.push('FORM_CHAT_ID_INVALID');
 if(requireRedis&&!redis)errors.push('FORM_REDIS_PAIR_INVALID');
 const ready=enabled&&sourcePublished&&formPublished&&consentMatches&&Boolean(origin)&&Boolean(token)&&validNegativeChatId(env.TELEGRAM_CHAT_ID_AK)&&(!requireRedis||Boolean(redis));
 return {ok:ready,errors:[...new Set(errors)],enabled,ready,origin};
}
