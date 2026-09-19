import {Redis} from '@upstash/redis';
import {createMemoryBotStore,createUpstashBotStore} from './bot-store.js';
import {createTelegramBot,drainTelegramOutbox} from './telegram-bot.js';
import {assessBotConfig,isValidTelegramTimeout} from './bot-config.js';
import {botCopy} from './bot-copy.js';
import {legal} from '../src/data.js';
import {createStaffMembershipVerifier} from './telegram-staff.js';

const fail=code=>{throw new Error(code);};
const positiveInteger=(value,name,{min=1,max=1000}={})=>{
 const number=Number(value);
 if(!Number.isInteger(number)||number<min||number>max)fail(name);
 return number;
};

const cancelPrompts=new Set(Object.values(botCopy).map(copy=>copy.cancelAsk).filter(Boolean));
const russianReminderOn=`🔔 ${botCopy.ru.remindersToggleOn}`;
const russianReminderOnLabel='🔔 Напомнить за 2 часа до тренировки';

function telegramUiStore(store){
 return {
  transactUpdate(updateId,reducer){
   return store.transactUpdate(updateId,tx=>{
    const enqueue=tx.enqueue.bind(tx),view=Object.create(tx);
    view.enqueue=(recipient,text,kind='message',notBefore=tx.now,meta={},method='sendMessage',payload)=>{
     let nextText=text,nextNotBefore=notBefore,nextMeta=meta;
     if(kind==='message'&&typeof nextText==='string'){
      const prompt=[...cancelPrompts].find(value=>nextText===value||nextText.startsWith(`${value}\n`));
      if(prompt)nextText=prompt;
     }
     if(meta?.reply_markup?.inline_keyboard){
      const cloned=structuredClone(meta);
      for(const row of cloned.reply_markup.inline_keyboard)for(const button of row)if(button.text===russianReminderOn)button.text=russianReminderOnLabel;
      nextMeta=cloned;
     }
     return enqueue(recipient,nextText,kind,nextNotBefore,nextMeta,method,payload);
    };
    return reducer(view);
   });
  }
 };
}

/**
 * Construct a durable bot runtime. Memory storage is only injectable for tests;
 * production construction always requires Redis credentials.
 */
export function createBotRuntime(env=process.env,{store,fetchImpl=fetch}={}){
 const checked=assessBotConfig(env,{requireEnabled:true,requireRedis:!store});
 if(!checked.ok)fail(checked.errors[0]);
 let activeStore=store;
 if(!activeStore){
  const url=env.UPSTASH_REDIS_REST_URL||env.KV_REST_API_URL;
  const token=env.UPSTASH_REDIS_REST_TOKEN||env.KV_REST_API_TOKEN;
  activeStore=createUpstashBotStore(new Redis({url,token}),{prefix:env.BOT_REDIS_PREFIX||'{akbot}:'});
 }
 const config={
  sourceLegalStatus:legal.publicationStatus,
  privacyUrl:checked.privacyUrl,
  deliveryReady:checked.deliveryReady,
  remindersEnabled:checked.remindersEnabled,
  staffUserIds:checked.userIds,
  staffAuthMode:checked.staffAuthMode,
  staffChatId:checked.staffChatId,
  privacyStatus:env.PRIVACY_PUBLICATION_STATUS||'pending',
  consentVersion:env.PRIVACY_CONSENT_VERSION||legal.consentVersion
 };
 const verifyStaffMembership=createStaffMembershipVerifier({
  token:env.TELEGRAM_BOT_TOKEN,
  fetchImpl,
  timeoutMs:Math.min(2000,checked.timeoutMs)
 });
 const bot=createTelegramBot({store:telegramUiStore(activeStore),config,verifyStaffMembership});
 return {
  bot,
  store:activeStore,
  // createTelegramBot is the single booking-readiness authority.
  infoOnly:bot.infoOnly,
  drain(options={}){
   const direct=options.sourceUpdateId!==undefined;
   // Direct webhook delivery needs Telegram transport but must not depend on
   // whether the separately scheduled worker endpoint is enabled.
   if(!direct&&!checked.workerReady)fail('BOT_WORKER_NOT_READY');
   const token=String(env.TELEGRAM_BOT_TOKEN||'').trim();
   if(direct&&!token)fail('BOT_TOKEN_MISSING');
   const timeoutMs=options.timeoutMs===undefined?checked.timeoutMs:positiveInteger(options.timeoutMs,'BOT_TIMEOUT_INVALID',{min:250,max:10000});
   if(!isValidTelegramTimeout(timeoutMs))fail('BOT_TIMEOUT_INVALID');
   const limit=options.limit===undefined?50:positiveInteger(options.limit,'BOT_DRAIN_LIMIT_INVALID',{max:1000});
   const maxDurationMs=options.maxDurationMs===undefined?25000:positiveInteger(options.maxDurationMs,'BOT_DRAIN_BUDGET_INVALID',{min:250,max:29000});
   return drainTelegramOutbox({store:activeStore,token,fetchImpl,timeoutMs,limit,maxDurationMs,monotonicNow:options.monotonicNow,sourceUpdateId:options.sourceUpdateId,includeBackground:Boolean(options.includeBackground),allowCare:checked.remindersEnabled,onUiCleanup:options.onUiCleanup});
  },
  hasPendingImmediateForUpdate(updateId){
   if(typeof activeStore.hasPendingImmediateForUpdate!=='function')fail('BOT_STORE_CAPABILITY_MISSING');
   return activeStore.hasPendingImmediateForUpdate(updateId);
  }
 };
}
export {createMemoryBotStore};
