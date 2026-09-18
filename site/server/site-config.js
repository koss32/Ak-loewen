const text=value=>typeof value==='string'?value:'';

/**
 * Return a canonical public origin, or null when value is not an origin.
 *
 * Only a root URL (with an optional single trailing slash) is accepted. HTTP is
 * deliberately limited to loopback callers that explicitly opt in, so callers
 * for hosted configuration cannot accidentally trust a development origin.
 */
export function normalizePublicOrigin(value,{allowLoopback=false}={}){
 const raw=text(value);
 if(!raw||raw!==raw.trim()||(/\s/u.test(raw)||[...raw].some(char=>char.charCodeAt(0)<32||char.charCodeAt(0)===127))||raw.includes('\\')||raw.includes('?')||raw.includes('#')||!/^https?:\/\//i.test(raw))return null;
 // Inspect the unnormalised suffix too: URL() would otherwise turn /./ into /.
 const authorityAndPath=raw.slice(raw.indexOf('://')+3);
 const slash=authorityAndPath.indexOf('/');
 if(slash!==-1&&authorityAndPath.slice(slash)!=='/')return null;
 try{
  const url=new URL(raw);
  if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||url.origin==='null')return null;
  if(url.protocol==='https:')return url.origin;
  const loopback=new Set(['localhost','127.0.0.1','[::1]']);
  return allowLoopback&&url.protocol==='http:'&&loopback.has(url.hostname)?url.origin:null;
 }catch{return null;}
}
