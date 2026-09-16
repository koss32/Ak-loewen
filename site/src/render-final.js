import {render as renderBase} from './render.js';
import {translations} from './locales.js';
import {contacts,legal} from './data.js';
import {brandUnionCopy} from './brand-union-copy.js';
import {brandUnionStyles} from './brand-union-styles.js';

// Sambo & MMA description: short, self-defense first, focused on why to join.
// No historical background and no invented facts (no prices, titles, guarantees).
const samboCopy={
 de:'Sambo & MMA ist bei uns vor allem angewandte Selbstverteidigung: Abstand halten, aus Griffen herauskommen, im Clinch und am Boden ruhig bleiben – und dabei Kraft, Kondition und Selbstvertrauen aufbauen. Wir starten bei null, trainieren kontrolliert mit Partner und Trainer und sprechen Deutsch, Russisch, Ukrainisch und Türkisch. Komm zum Probetraining – du brauchst nichts mitzubringen.',
 ru:'Sambo & MMA у нас — это прежде всего прикладная самооборона: держать дистанцию, выходить из захватов, спокойно чувствовать себя вблизи и в партере — и заодно получать силу, выносливость и уверенность в себе. Начинаем с нуля, работаем в паре под контролем тренера и говорим на немецком, русском, украинском и турецком. Приходи на пробное — ничего с собой нести не нужно.',
 uk:'Sambo & MMA у нас — це передусім прикладна самооборона: тримати дистанцію, виходити із захватів, спокійно почуватися зблизька та в партері — і водночас здобувати силу, витривалість і впевненість у собі. Починаємо з нуля, працюємо в парі під контролем тренера та говоримо німецькою, російською, українською й турецькою. Приходь на пробне — нічого з собою брати не потрібно.',
 tr:'Sambo & MMA bizde her şeyden önce uygulamalı öz savunmadır: mesafeyi korumak, tutuşlardan kurtulmak, yakın mesafede ve yerde sakin kalmak – aynı zamanda güç, kondisyon ve kendine güven kazanmak. Sıfırdan başlıyoruz, eşli ve antrenör kontrolünde çalışıyoruz; Almanca, Rusça, Ukraynaca ve Türkçe konuşuyoruz. Deneme dersine gel – yanında hiçbir şey getirmen gerekmiyor.'
};

const legalCopy={
 de:{title:'Impressum',heading:'Angaben gemäß § 5 DDG',represented:'Vertreten durch den Geschäftsführer',contact:'Kontakt',register:'Registereintrag',court:'Registergericht',number:'Handelsregister',back:'Zurück zur Website'},
 ru:{title:'Правовая информация',heading:'Сведения согласно § 5 DDG',represented:'В лице управляющего директора',contact:'Контакты',register:'Регистрационные данные',court:'Регистрационный суд',number:'Торговый реестр',back:'Вернуться на сайт'},
 uk:{title:'Правова інформація',heading:'Відомості відповідно до § 5 DDG',represented:'В особі керуючого директора',contact:'Контакти',register:'Реєстраційні дані',court:'Реєстраційний суд',number:'Торговий реєстр',back:'Повернутися на сайт'},
 tr:{title:'Yasal bilgiler',heading:'§ 5 DDG uyarınca bilgiler',represented:'Şirketi temsile yetkili müdür',contact:'İletişim',register:'Ticaret sicili',court:'Sicil mahkemesi',number:'Ticaret sicil numarası',back:'Siteye dön'}
};

const esc=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function legalMain(locale){
 const c=legalCopy[locale]||legalCopy.de;
 return `<main id="main" class="legal-page wrap"><span class="eyebrow">${c.title}</span><h1>${c.heading}</h1><div class="legal-facts"><section><h2>${esc(legal.entityName)}</h2><address>${esc(legal.registeredAddress)}<br>${esc(legal.country)}</address></section><section><h2>${c.represented}</h2><p>${esc(legal.manager)}</p></section><section><h2>${c.contact}</h2><p>Telefon: <a href="tel:+4915730447730">${esc(legal.phone)}</a><br>E-Mail: <a href="mailto:${esc(contacts.email)}">${esc(contacts.email)}</a></p></section><section><h2>${c.register}</h2><p>${c.court}: ${esc(legal.registerCourt)}<br>${c.number}: ${esc(legal.registerNumber)}</p></section></div><a href="/${locale}/" class="btn">${c.back} <span aria-hidden="true">↗</span></a></main>`;
}

// Anchored replacement. A missing or ambiguous anchor is a hard error so a markup
// change in render.js can never silently drop one of these adjustments.
function patch(html,needle,replacement,required=true){
 const start=html.indexOf(needle);
 if(start===-1){
  if(required)throw new Error(`render-final: anchor not found: ${needle.slice(0,70)}`);
  return html;
 }
 if(html.indexOf(needle,start+needle.length)!==-1)throw new Error(`render-final: anchor is not unique: ${needle.slice(0,70)}`);
 return `${html.slice(0,start)}${replacement}${html.slice(start+needle.length)}`;
}

const telegramGlyph='<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path fill="currentColor" d="M21.94 4.3 18.9 19.07a1.05 1.05 0 0 1-1.67.59l-4.08-3.04-2.2 2.11a1.02 1.02 0 0 1-1.72-.59l-.5-3.53 9.16-7.9-11.28 5.36-3.02-1.02a1.02 1.02 0 0 1-.03-1.93L20.5 2.95a1.05 1.05 0 0 1 1.44 1.35Z"/></svg>';

function contactMark(brand){
 if(brand==='valset')return '<img class="contact-mark" src="/assets/valset.jpg" alt="VALSET Circus Studio" width="64" height="64" loading="lazy">';
 return '<img class="contact-mark" src="/assets/ak-logo.png" alt="AK Löwen" width="64" height="64" loading="lazy">';
}

function brandUnion(u){
 return `<div class="brand-union" data-brand-union><div class="brand-union-stage"><span class="brand-union-mark is-ak"><img src="/assets/ak-logo.png" alt="AK Löwen" width="164" height="164" loading="lazy"></span><span class="brand-union-seam" aria-hidden="true"></span><span class="brand-union-mark is-valset"><img src="/assets/valset.jpg" alt="VALSET Circus Studio" width="164" height="164" loading="lazy"></span></div><p class="brand-union-caption">${esc(u.unionCaption)}</p></div>`;
}

function telegramCta(u){
 return `<a class="telegram-cta" href="#probetraining" aria-label="${esc(u.telegramCtaFull)}" title="${esc(u.telegramCtaFull)}"><span class="telegram-cta-icon">${telegramGlyph}</span><span class="telegram-cta-label">${esc(u.telegramCtaShort)}</span></a>`;
}

export function render(locale='de',page='',live=false,origin=''){
 const active=translations[locale]||translations.de;
 const union=brandUnionCopy[locale]||brandUnionCopy.de;
 const isLanding=page!=='impressum'&&page!=='datenschutz';
 let html=renderBase(locale,page,live,origin);
 html=html.replace(active.samboDesc,samboCopy[locale]||samboCopy.de);
 const akNeedle=`${active.akEntry}</p></div></div><a href="#kampfsport"`;
 html=html.replace(akNeedle,`${active.akEntry}</p></div><img src="/assets/ak-logo.png" alt="AK Löwen" width="112" height="112"></div><a href="#kampfsport"`);

 // 1) Standort block: factual training address and map action only. The full legal
 // identity stays on the Impressum page.
 html=patch(
  html,
  `<div><p>${active.manager}: ${legal.manager}</p><p class="micro">${legal.entityName}</p></div>`,
  `<div class="address-legal"><p class="micro">${esc(union.standortNote)}</p><a href="/${locale}/impressum/" class="tlink">${active.imprint} <span aria-hidden="true">↗</span></a></div>`,
  isLanding,
 );

 // 2) Brand mark in each contact card.
 html=patch(html,'<div class="contact-card"><h3>AK Löwen</h3>',`<div class="contact-card"><div class="contact-card-head">${contactMark('ak')}<h3>AK Löwen</h3></div>`,isLanding);
 html=patch(html,'<div id="valset-kontakt" class="contact-card b"><h3>VALSET</h3>',`<div id="valset-kontakt" class="contact-card b"><div class="contact-card-head">${contactMark('valset')}<h3>VALSET</h3></div>`,isLanding);

 // 3) Union of both brands next to the text about one organisation.
 html=patch(html,'<div class="about-mark"><img src="/assets/ak-logo.png" alt="AK Löwen" width="320" height="320" loading="lazy"></div>',brandUnion(union),isLanding);

 // 4) Original VALSET artwork without the top crop.
 html=patch(html,'<figure class="valset-art">','<figure class="valset-art is-full">',isLanding);

 // 5) Compact Telegram button instead of the wide booking card.
 html=patch(
  html,
  `<a class="telegram-booking" href="#probetraining" aria-label="${active.stickyTrial}"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M12 3 4 12h5v8h6v-8h5z"/></svg><span>${active.stickyTrial}</span></a>`,
  telegramCta(union),
 );

 if(page==='impressum')html=html.replace(/<main id="main" class="legal-page wrap">[\s\S]*?<\/main>/,legalMain(locale));
 const css=`<style>.entry-top img[src="/assets/ak-logo.png"]{object-fit:contain;background:#fff;padding:5px}.legal-facts{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin:32px 0}.legal-facts section{padding:24px;border:1px solid var(--line);background:var(--surface)}.legal-facts h2{font-size:20px;margin-bottom:12px}.legal-facts address{font-style:normal;color:var(--ink-2)}@media(max-width:700px){.legal-facts{grid-template-columns:1fr}}${brandUnionStyles}</style>`;
 return html.replace('</head>',`${css}</head>`);
}
