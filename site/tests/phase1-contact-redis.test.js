import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createUpstashBotStore} from '../server/bot-store.js';
import {createTelegramBot} from '../server/telegram-bot.js';
import {legal} from '../src/data.js';

const run=promisify(execFile),port=40000+(process.pid%10000),GROUP=-10099;
const config={deliveryReady:true,privacyStatus:'published',privacyUrl:'https://example.test/privacy',consentVersion:legal.consentVersion,staffAuthMode:'group_members',staffChatId:String(GROUP)};
const message=(update_id,user,text,chat=user,type='private')=>({update_id,message:{chat:{id:chat,type},from:{id:user,first_name:'Client'},text}});
const callback=(update_id,user,data)=>({update_id,callback_query:{id:`q${update_id}`,from:{id:user},data,message:{chat:{id:GROUP,type:'supergroup'}}}});

test('contact tickets use real Redis CAS across concurrent runtimes, restart, duplicate update and Close',async t=>{
 try{await run('redis-server',['--version']);}catch{t.skip('redis-server is not installed');return;}
 const server=spawn('redis-server',['--bind','127.0.0.1','--port',String(port),'--save','','--appendonly','no'],{stdio:'ignore'});t.after(()=>server.kill('SIGTERM'));
 const cli=async(...args)=>(await run('redis-cli',['-p',String(port),'--json',...args],{maxBuffer:2*1024*1024})).stdout.trim();
 let ready=false;for(let i=0;i<50;i++){try{if(await cli('PING')==='"PONG"'){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,20));}assert.ok(ready,'local Redis is ready');
 const redis={async eval(script,keys,args){return JSON.parse(await cli('EVAL',script,String(keys.length),...keys,...args.map(String)));}};
 let now=Date.parse('2026-09-18T10:00:00Z');
 const makeStore=()=>createUpstashBotStore(redis,{prefix:`{contact-${process.pid}}:`,clock:()=>now});
 const makeBot=store=>createTelegramBot({store,config,verifyStaffMembership:async()=>true});
 const first=makeStore(),second=makeStore(),bots=[makeBot(first),makeBot(second)];
 await Promise.all(Array.from({length:8},async(_,i)=>{const user=100+i,bot=bots[i%2];await bot.handle(message(i*10+1,user,'/contact'));await bot.handle(message(i*10+2,user,`Question ${i}`));}));
 const state=await first.inspect();assert.equal(Object.keys(state.tickets).length,8);assert.equal(new Set(Object.values(state.tickets).map(ticket=>ticket.id)).size,8);
 const duplicate=message(2,100,'Question 0');assert.equal((await bots[1].handle(duplicate)).dropped,true);
 assert.equal(Object.values((await second.inspect()).outbox).filter(item=>item.kind==='contact-staff-card').length,8);
 const ticket=Object.values(state.tickets).find(item=>item.clientUserId==='100');
 const action=type=>`a:${Object.entries(state.actions).find(([,value])=>value.type===type&&value.ticketId===ticket.id)[0]}`;
 await bots[0].handle(callback(1001,55,action('contact-reply')));await bots[1].handle(callback(1002,56,action('contact-reply')));
 const restartedStore=makeStore(),restarted=makeBot(restartedStore);
 assert.equal((await restartedStore.getSession(`staff:${GROUP}:55`)).ticketId,ticket.id);
 await restarted.handle(message(1003,55,'Reply after restart',GROUP,'supergroup'));
 assert.equal(Object.values((await restartedStore.inspect()).outbox).filter(item=>item.kind==='contact-client-reply').length,1);
 await restarted.handle(callback(1004,56,action('contact-close')));
 assert.equal((await first.inspect()).tickets[ticket.id].status,'CLOSED');assert.equal(await second.getSession(`staff:${GROUP}:56`),undefined);
 await bots[1].handle(message(1005,56,'stale text',GROUP,'supergroup'));
 const after=await first.inspect();assert.equal(Object.values(after.outbox).filter(item=>item.kind==='contact-client-reply').length,1);assert.equal(Object.values(after.outbox).find(item=>item.kind==='contact-client-reply').state,'cancelled');
 now+=3600000;await restarted.handle(message(1006,100,'/contact'));await restarted.handle(message(1007,100,'New question'));
 assert.notEqual((await first.inspect()).clients['100'].contactTicketId,ticket.id);
 assert.ok(Number(await cli('PTTL',`{contact-${process.pid}}:state`))>0);
});
