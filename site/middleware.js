import {next} from '@vercel/functions';
import {assessIndexing,isIndexablePath,robotsText,NOINDEX,INDEX} from './server/indexing-config.js';

// No matcher exclusions: Preview and noncanonical hosts must always be noindex.
export function createIndexingMiddleware(env=process.env){
 return function middleware(request){
  const url=new URL(request.url),policy=assessIndexing(env);
  const canonical=policy.enabled&&url.origin===policy.origin;
  if(url.pathname==='/robots.txt')return new Response(robotsText({...policy,enabled:canonical}),{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'public, max-age=60, must-revalidate'}});
  if(url.pathname==='/sitemap.xml'){
   if(!canonical)return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}});
   return next();
  }
  const headers={'X-Robots-Tag':canonical&&isIndexablePath(url.pathname)?INDEX:NOINDEX};
  return next({headers});
 };
}

export default createIndexingMiddleware();
