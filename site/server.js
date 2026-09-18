import http from 'node:http';
import {readFile,stat,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {render} from './src/render-final.js';
import {entryPage} from './src/entry.js';
import {createTrialService} from './server/trial-requests.js';
import {assessFormConfig} from './server/form-config.js';
const root=path.dirname(fileURLToPath(import.meta.url));
// Local delivery is opt-in twice. Inherited credentials alone cannot turn a
// development preview into a real Telegram sender.
const formConfig=assessFormConfig(process.env,{local:true,requireRedis:false});
const live=formConfig.ready;
const statePath=path.resolve(process.env.STATE_DIRECTORY||path.join(root,'.state'));
await mkdir(statePath,{recursive:true});
const trials=createTrialService({databasePath:path.join(statePath,'requests.sqlite'),token:process.env.TELEGRAM_BOT_TOKEN,chatId:process.env.TELEGRAM_CHAT_ID_AK,enabled:live});
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
 try{
 const url=new URL(req.url,'http://localhost');
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Robots-Tag','noindex, nofollow');res.setHeader('X-Frame-Options','DENY');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
 if(url.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return res.end(req.method==='HEAD'?'':entryPage);}
 if(url.pathname==='/api/trial-requests'){
  const json=(code,body)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
  if(req.method!=='POST')return json(405,{ok:false,code:'method'});
  if(!req.headers['content-type']?.startsWith('application/json'))return json(415,{ok:false,code:'content_type'});
  // As in the hosted API, do not derive a trusted origin from an untrusted Host.
  // Missing Origin remains supported for no-JS/non-browser submissions.
  if(req.headers.origin&&req.headers.origin!==formConfig.origin)return json(403,{ok:false,code:'origin'});
  if(Number(req.headers['content-length'])>8192)return json(413,{ok:false,code:'too_large'});
  if(!formConfig.ready)return json(503,{ok:false,code:'not_configured'});
  const parts=[];let size=0;for await(const part of req){size+=part.length;if(size>8192)return json(413,{ok:false,code:'too_large'});parts.push(part);}
  let data;try{data=JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{return json(400,{ok:false,code:'invalid_json'});}
  const result=await trials.handle(data,req.socket.remoteAddress);return json(result.httpStatus,result.body);
 }
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
 if(url.pathname==='/telegram-privacy'){res.writeHead(308,{'Location':'/telegram-privacy/'});return res.end();}
 if(url.pathname==='/telegram-privacy/'){
  const html=await readFile(path.join(root,'public','telegram-privacy','index.html'),'utf8');
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return res.end(req.method==='HEAD'?'':html);
 }
 const match=url.pathname.match(/^\/(de|ru|uk|tr)\/(?:((?:impressum|datenschutz))\/)?$/);
 if(match){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return res.end(req.method==='HEAD'?'':render(match[1],match[2],live,formConfig.origin||''));}
 const target=path.resolve(root,'public','.'+decodeURIComponent(url.pathname));
 if(!target.startsWith(path.join(root,'public')+path.sep)){res.writeHead(403);return res.end();}
 const info=await stat(target);if(!info.isFile())throw new Error('not-file');
 res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream'});res.end(req.method==='HEAD'?'':await readFile(target));
 }catch{res.writeHead(404);res.end('Not found');}
});
server.requestTimeout=20000;server.headersTimeout=10000;
server.listen(Number(process.env.PORT||4173),process.env.HOST||'127.0.0.1',()=>console.log('Local: http://127.0.0.1:'+(process.env.PORT||4173)+'/de/'));
