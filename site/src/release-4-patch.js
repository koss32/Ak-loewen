/* Release 4 — markup layer on top of the approved Release 3 render.
 * Same override pattern as render-final.js: the approved Release 3 markup stays
 * untouched in render.js, and only the requested points are rewritten here.
 *
 * 1 Standort block keeps the training address only, legal facts move to Impressum
 * 2 brand logos inside the two contact cards
 * 3 AK-LOEWEN × VALSET union composition
 * 5 compact Telegram CTA
 * (4, 6, 7 are pure styling and live in public/release-4.css)
 */
import {translations} from './locales.js';
import {contacts,legal} from './data.js';

const escRe=value=>String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

const TELEGRAM_ICON='<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M21.73 4.3 2.9 11.53c-1.03.4-1.02 1.86.03 2.23l4.67 1.65 1.8 5.16c.3.87 1.42 1.1 2.05.43l2.43-2.6 4.46 3.28c.75.55 1.82.15 2.02-.77l3.2-14.8c.2-.94-.7-1.72-1.6-1.37Zm-4.5 3.9-7.5 6.45a1 1 0 0 0-.32.58l-.4 2.46-1.2-3.44 9.42-6.05Z"/></svg>';

const UNION_MARKUP='<div class="about-mark brand-union" data-brand-union><div class="brand-union-stage"><span class="union-glow" aria-hidden="true"></span><span class="union-ring r1" aria-hidden="true"></span><span class="union-ring r2" aria-hidden="true"></span><span class="union-ring r3" aria-hidden="true"></span><span class="union-spark" aria-hidden="true"></span><span class="union-sparks" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span><img class="union-mark union-valset" src="/assets/valset-logo.svg" alt="VALSET" width="320" height="320" loading="lazy"><img class="union-mark union-ak" src="/assets/ak-logo.png" alt="AK-LOEWEN" width="320" height="320" loading="lazy"><span class="union-flash" aria-hidden="true"></span><span class="union-x" aria-hidden="true">\u00d7</span></div></div>';

export function applyRelease4(html,locale='de'){
 const t=translations[locale]||translations.de;

 // assets of this release
 html=html.replace('<link rel="stylesheet" href="/style.css">','<link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/release-4.css">');
 html=html.replace('<script src="/scroll-motion.js" defer></script>','<script src="/scroll-motion.js" defer></script><script src="/release-4.js" defer></script>');

 // 2 — logos in the contact cards
 html=html.replace('<div class="contact-card polish-card" data-polish="signal"><span class="polish-fx" aria-hidden="true"><i class="polish-sheen"></i><i class="polish-ring"></i><i class="polish-trace"></i></span><h3>AK-LOEWEN</h3>','<div class="contact-card polish-card" data-polish="signal"><span class="polish-fx" aria-hidden="true"><i class="polish-sheen"></i><i class="polish-ring"></i><i class="polish-trace"></i></span><div class="contact-head"><img class="contact-logo" src="/assets/ak-logo.png" alt="AK-LOEWEN" width="54" height="54" loading="lazy"><h3>AK-LOEWEN</h3></div>');
 html=html.replace('<div id="valset-kontakt" class="contact-card b polish-card" data-polish="signal"><span class="polish-fx" aria-hidden="true"><i class="polish-sheen"></i><i class="polish-ring"></i><i class="polish-trace"></i></span><h3>VALSET</h3>','<div id="valset-kontakt" class="contact-card b polish-card" data-polish="signal"><span class="polish-fx" aria-hidden="true"><i class="polish-sheen"></i><i class="polish-ring"></i><i class="polish-trace"></i></span><div class="contact-head"><img class="contact-logo" src="/assets/valset-logo.svg" alt="VALSET" width="54" height="54" loading="lazy"><h3>VALSET</h3></div>');

 // 1 — training address stays, legal facts only on the Impressum page
 html=html.replace(new RegExp(`<div><p>[^<]*: ${escRe(legal.manager)}</p><p class="micro">[^<]*</p></div>`),`<div class="address-legal"><a href="/${locale}/impressum/" class="tlink">${t.imprint} <span aria-hidden="true">\u2197</span></a></div>`);

 // 3 — union of the two brands
 html=html.replace('<div class="about-mark"><img src="/assets/ak-logo.png" alt="AK-LOEWEN" width="320" height="320" loading="lazy"></div>',UNION_MARKUP);

 // 5 — compact Telegram CTA
 html=html.replace(/<a class="telegram-booking" href="#probetraining" aria-label="([^"]*)">[\s\S]*?<\/a>/,(m,label)=>`<a class="telegram-booking tg-compact" href="${contacts.telegram}?start=site_booking" target="_blank" rel="noopener noreferrer" aria-label="${label}" title="${label}"><span class="tg-icon">${TELEGRAM_ICON}</span><span class="tg-label">${label}</span></a>`);

 return html;
}
