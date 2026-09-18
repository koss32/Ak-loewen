import {normalizePublicOrigin} from '../server/site-config.js';

export function renderEntryPage(origin='',indexing=false){
 const canonical=normalizePublicOrigin(origin);
 const links=canonical?`<link rel="canonical" href="${canonical}/">${['de','ru','uk','tr'].map(locale=>`<link rel="alternate" hreflang="${locale}" href="${canonical}/${locale}/">`).join('')}<link rel="alternate" hreflang="x-default" href="${canonical}/">`:'';
 return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="${indexing&&canonical?'index,follow':'noindex,nofollow'}">${links}<title>AK-LOEWEN × VALSET</title><script src="/locale-entry.js" defer></script><noscript><meta http-equiv="refresh" content="0;url=/de/"></noscript></head><body><a href="/de/">AK-LOEWEN × VALSET</a></body></html>`;
}

export const entryPage=renderEntryPage();
