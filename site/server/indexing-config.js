import {normalizePublicOrigin} from './site-config.js';

export const NOINDEX='noindex, nofollow';
export const INDEX='index, follow';

/** One fail-closed policy for build output and request-time HTTP headers. */
export function assessIndexing(env=process.env){
 const origin=normalizePublicOrigin(env.PUBLIC_ORIGIN);
 const production=env.VERCEL==='1'&&env.VERCEL_ENV==='production'&&(!env.VERCEL_TARGET_ENV||env.VERCEL_TARGET_ENV==='production');
 return {enabled:env.INDEXING_ENABLED==='true'&&production&&Boolean(origin),origin};
}

/** Only canonical public pages can be indexed, never APIs or review artifacts. */
export function isIndexablePath(pathname){
 return pathname==='/'||/^\/(de|ru|uk|tr)\/(?:impressum\/|datenschutz\/)?$/.test(pathname);
}

export function robotsText({enabled,origin}){
 return enabled?`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /telegram-privacy/\nDisallow: /*.html$\nSitemap: ${origin}/sitemap.xml\n`:'User-agent: *\nDisallow: /\n';
}

export function sitemapXml({enabled,origin}){
 if(!enabled)return null;
 const paths=['/',...['de','ru','uk','tr'].flatMap(locale=>['','impressum/','datenschutz/'].map(page=>`/${locale}/${page}`))];
 return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+paths.map(path=>`  <url><loc>${origin}${path}</loc></url>`).join('\n')+'\n</urlset>\n';
}
