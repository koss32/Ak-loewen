import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,cp,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {assessIndexing,robotsText,sitemapXml,NOINDEX,INDEX} from '../server/indexing-config.js';
import {normalizePublicOrigin} from '../server/site-config.js';
import {createIndexingMiddleware} from '../middleware.js';
import {render} from '../src/render-final.js';
import {renderEntryPage} from '../src/entry.js';

const production={VERCEL:'1',VERCEL_ENV:'production',VERCEL_TARGET_ENV:'production',INDEXING_ENABLED:'true',PUBLIC_ORIGIN:'https://ak.example/'};
const root=fileURLToPath(new URL('..',import.meta.url));

test('indexing defaults OFF and is never enabled by a shared Preview/local/custom flag',()=>{
 for(const env of [{},{INDEXING_ENABLED:'true'},{...production,VERCEL:undefined},{...production,INDEXING_ENABLED:'false'},{...production,VERCEL_ENV:'preview'},{...production,VERCEL_ENV:'development'},{...production,VERCEL_TARGET_ENV:'staging'},{...production,PUBLIC_ORIGIN:'https://ak.example/path'}]){
  const policy=assessIndexing(env);assert.equal(policy.enabled,false);assert.equal(robotsText(policy),'User-agent: *\nDisallow: /\n');assert.equal(sitemapXml(policy),null);
 }
 assert.deepEqual(assessIndexing(production),{enabled:true,origin:'https://ak.example'});
});

test('origin validation rejects hidden control characters and normalizes one trailing slash',()=>{
 for(const origin of ['https://exa\nmple.test','https://exa\tmple.test','https://example.test\u0000','https://example.test/./','https://example.test//','https://user@example.test','https://example.test?','https://example.test#','https://example.test\\path'])assert.equal(normalizePublicOrigin(origin),null);
 assert.equal(normalizePublicOrigin('https://EXAMPLE.test:443/'),'https://example.test');
});

test('HTML robots, normalized canonicals and legal locale pages share explicit indexing policy',()=>{
 for(const locale of ['de','ru','uk','tr'])for(const page of ['','impressum','datenschutz']){
  const hidden=render(locale,page,false,production.PUBLIC_ORIGIN);assert.match(hidden,/<meta name="robots" content="noindex,nofollow">/);
  const html=render(locale,page,false,production.PUBLIC_ORIGIN,true);assert.match(html,/<meta name="robots" content="index,follow">/);assert.ok(html.includes(`href="https://ak.example/${locale}/${page?page+'/':''}"`));assert.ok(!html.includes('ak.example//'));assert.match(html,/data-live="false"|class="legal-page/);
 }
 assert.match(renderEntryPage(production.PUBLIC_ORIGIN,true),/content="index,follow"/);assert.match(renderEntryPage(),/content="noindex,nofollow"/);
 assert.match(render('de','',false,'https://ak.example/path',true),/content="noindex,nofollow"/);
});

test('runtime headers cannot index Preview, noncanonical hosts, APIs, privacy or standalone artifacts',()=>{
 for(const env of [{},{...production,VERCEL_ENV:'preview'},{...production,VERCEL_TARGET_ENV:'staging'}]){
  const middleware=createIndexingMiddleware(env);
  for(const path of ['/','/de/','/api/trial-requests','/telegram-privacy/','/ak-loewen-valset-release-6.html'])assert.equal(middleware(new Request(`https://ak.example${path}`)).headers.get('x-robots-tag'),NOINDEX);
 }
 const middleware=createIndexingMiddleware(production);
 for(const path of ['/','/ru/','/tr/impressum/','/uk/datenschutz/'])assert.equal(middleware(new Request(`https://ak.example${path}`)).headers.get('x-robots-tag'),INDEX);
 for(const path of ['/api/telegram-webhook/','/telegram-privacy/','/ak-loewen-valset-release-6.html','/unknown/'])assert.equal(middleware(new Request(`https://ak.example${path}`)).headers.get('x-robots-tag'),NOINDEX);
 assert.equal(middleware(new Request('https://deployment.vercel.app/de/')).headers.get('x-robots-tag'),NOINDEX);
});

test('request-time robots and sitemap stay closed on wrong host even for a production build',async()=>{
 const middleware=createIndexingMiddleware(production);
 assert.equal(await middleware(new Request('https://deployment.vercel.app/robots.txt')).text(),'User-agent: *\nDisallow: /\n');
 assert.equal(middleware(new Request('https://deployment.vercel.app/sitemap.xml')).status,404);
 assert.match(await middleware(new Request('https://ak.example/robots.txt')).text(),/Sitemap: https:\/\/ak\.example\/sitemap\.xml/);
 assert.equal(middleware(new Request('https://ak.example/sitemap.xml')).headers.get('x-middleware-next'),'1');
 const xml=sitemapXml(assessIndexing(production));assert.equal((xml.match(/<url>/g)||[]).length,13);assert.ok(!xml.includes('/api/'));assert.ok(!xml.includes('ak.example//'));
});

test('Vercel keeps exactly one conditional robots-header authority and never enables auto deployments',async()=>{
 const config=JSON.parse(await readFile(join(root,'vercel.json'),'utf8'));
 assert.equal(config.proxy.entrypoint,'middleware.js');assert.equal(config.git.deploymentEnabled,false);assert.equal(config.outputDirectory,'dist');
 assert.ok(!config.headers.some(rule=>rule.headers.some(header=>header.key.toLowerCase()==='x-robots-tag')));
});

test('fresh builds align robots, sitemap, HTML, review artifact and fail closed for incomplete live form env',{timeout:120000},async()=>{
 const fixture=await mkdtemp(join(tmpdir(),'ak-indexing-build-'));
 try{
  await cp(root,fixture,{recursive:true,filter:source=>!['node_modules','dist','.state','.git'].includes(basename(source))});
  await symlink(resolve(root,'node_modules'),join(fixture,'node_modules'),'dir');
  const env={PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR};
  const build=extra=>spawnSync(process.execPath,['build.js'],{cwd:fixture,env:{...env,...extra},encoding:'utf8',timeout:60000});
  let result=build({});assert.equal(result.status,0,result.stderr);assert.equal(await readFile(join(fixture,'dist/robots.txt'),'utf8'),'User-agent: *\nDisallow: /\n');await assert.rejects(readFile(join(fixture,'dist/sitemap.xml')));
  result=build(production);assert.equal(result.status,0,result.stderr);assert.match(await readFile(join(fixture,'dist/de/index.html'),'utf8'),/content="index,follow"/);assert.match(await readFile(join(fixture,'dist/sitemap.xml'),'utf8'),/<urlset/);assert.match(await readFile(join(fixture,'dist/ak-loewen-valset-release-6.html'),'utf8'),/content="noindex,nofollow"/);
  result=build({...production,VERCEL_ENV:'preview'});assert.equal(result.status,0,result.stderr);assert.match(await readFile(join(fixture,'dist/de/index.html'),'utf8'),/content="noindex,nofollow"/);await assert.rejects(readFile(join(fixture,'dist/sitemap.xml')));
  result=build({FORM_DELIVERY_ENABLED:'true'});assert.notEqual(result.status,0);assert.match(result.stderr,/Form delivery requested but not ready/);
 }finally{await rm(fixture,{recursive:true,force:true});}
});
