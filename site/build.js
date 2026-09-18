import {mkdir,cp,writeFile,readFile,readdir,rm} from 'node:fs/promises';
import {render} from './src/render-final.js';
import {renderEntryPage} from './src/entry.js';
import {assessFormConfig} from './server/form-config.js';
import {assessIndexing,robotsText,sitemapXml} from './server/indexing-config.js';
import {locales} from './src/data.js';
await rm('dist',{recursive:true,force:true});
await mkdir('dist',{recursive:true});await cp('public','dist',{recursive:true});
const form=assessFormConfig(process.env);
const live=form.ready;
const indexing=assessIndexing(process.env);
if(process.env.FORM_DELIVERY_ENABLED==='true'&&!live)throw new Error(`Form delivery requested but not ready: ${form.errors.join(', ')}`);
if(process.env.VERCEL_ENV==='production'&&process.env.INDEXING_ENABLED==='true'&&!indexing.enabled)throw new Error('Production indexing requires verified Vercel production metadata and a valid HTTPS PUBLIC_ORIGIN');
const pages={};
for(const l of locales){pages[l]={};for(const p of ['','impressum','datenschutz']){const html=render(l,p,live,indexing.origin||'',indexing.enabled);await mkdir(`dist/${l}/${p}`,{recursive:true});await writeFile(`dist/${l}/${p?p+'/':''}index.html`,html);pages[l][p||'home']=render(l,p,false);}}
await writeFile('dist/index.html',renderEntryPage(indexing.origin||'',indexing.enabled));
await writeFile('dist/robots.txt',robotsText(indexing));
const sitemap=sitemapXml(indexing);
if(sitemap)await writeFile('dist/sitemap.xml',sitemap);
let standalone=render('de','',false);
const css=(await readFile('public/vendor/scrollcraft.css','utf8'))+'\n'+await readFile('public/style.css','utf8')+'\n'+await readFile('public/release-4.css','utf8')+'\n'+await readFile('public/section-polish.css','utf8')+'\n'+await readFile('public/pride.css','utf8');
const js=(await readFile('public/vendor/scrollcraft.js','utf8'))+'\n'+await readFile('public/client.js','utf8')+'\n'+await readFile('public/scroll-motion.js','utf8')+'\n'+await readFile('public/release-4.js','utf8')+'\n'+await readFile('public/section-polish.js','utf8')+'\n'+await readFile('public/pride-points.js','utf8')+'\n'+await readFile('public/pride-engine.js','utf8');
const assets={};for(const name of (await readdir('public/assets')).filter(name=>/\.(png|jpe?g|webp|avif|svg)$/i.test(name))){const ext=name.split('.').at(-1).toLowerCase(),type=ext==='jpg'||ext==='jpeg'?'jpeg':ext==='svg'?'svg+xml':ext;assets['/assets/'+name]=`data:image/${type};base64,${(await readFile('public/assets/'+name)).toString('base64')}`;}
function inline(html){for(const [src,data] of Object.entries(assets))html=html.replaceAll(src,data);return html;}
standalone=inline(standalone).replace(/<link rel="stylesheet"[^>]+>/g,'').replace(/<script src="[^"]+" defer><\/script>/g,'').replace('</head>',()=>`<style>${css}</style></head>`);
standalone=standalone.replace('</body>',()=>`<script>window.__AK_PAGES__=${JSON.stringify(pages).replaceAll('<','\\u003c')};window.__AK_ASSETS__=${JSON.stringify(assets)};</script><script>${js.replaceAll('</script','<\\/script')}</script></body>`);
await writeFile('dist/ak-loewen-valset-release-6.html',standalone);
console.log('Built Release 6 output: 4 localized pages, legal pages and one standalone file.');
