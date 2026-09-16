import {render as renderBase} from './render.js';
import {translations} from './locales.js';
import {contacts,legal} from './data.js';
import {applyRelease4} from './release-4-patch.js';

const samboCopy={
 de:'Sambo bedeutet „Selbstverteidigung ohne Waffen“. Die Kampfkunst entstand in der Sowjetunion in den 1920er- und 1930er-Jahren und verbindet Einflüsse aus Judo, verschiedenen Ringstilen und Selbstverteidigungssystemen. Im Training üben wir Griffe, Würfe, Halte- und Bodentechniken; MMA-Elemente ergänzen diese Basis um Schlagtechniken und den Wechsel zwischen Distanzen.',
 ru:'Самбо — это «самооборона без оружия»: система единоборства, сформировавшаяся в СССР в 1920–1930-х годах и вобравшая техники дзюдо, различных видов борьбы и прикладной самообороны. На тренировках мы отрабатываем захваты, броски, удержания и работу в партере; элементы MMA дополняют эту базу ударной техникой и переходами между дистанциями.',
 uk:'Самбо означае «самооборона без зброї». Це єдиноборство сформувалося в СРСР у 1920–1930-х роках і поєднало техніки дзюдо, різних видів боротьби та прикладної самооборони. На тренуваннях ми відпрацюємо захвати, кидки, утримання й роботу в партері; елементи MMA доповнюють цю базу ударною технікою та переходами між дистанціями.',
 tr:'Sambo, “silahsız öz savunma” anlamına gelir. 1920’ler ve 1930’larda Sovyetler Birliği’nde gelişmiş; judo, farklı güreş stilleri ve öz savunma sistemlerinden teknikleri bir araya getirmiştir. Antrenmanlarda tutuşlar, atışlar, kontrol ve yer teknikleri çalışılır; MMA unsurları bu temeli vuruş teknikleri ve mesafeler arası geçişlerle tamamlar.'
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

export function render(locale='de',page='',live=false,origin=''){
 const active=translations[locale]||translations.de;
 let html=renderBase(locale,page,live,origin);
 html=html.replace(active.samboDesc,samboCopy[locale]||samboCopy.de);
 const akNeedle=`${active.akEntry}</p></div></div><a href="#kampfsport"`;
 html=html.replace(akNeedle,`${active.akEntry}</p></div><img src="/assets/ak-logo.png" alt="AK Löwen" width="112" height="112"></div><a href="#kampfsport"`);
 if(page==='impressum')html=html.replace(/<main id="main" class="legal-page wrap">[\s\S]*?<\/main>/,legalMain(locale));
 const css='<style>.entry-top img[src="/assets/ak-logo.png"]{object-fit:contain;background:#fff;padding:5px}.legal-facts{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin:32px 0}.legal-facts section{padding:24px;border:1px solid var(--line);background:var(--surface)}.legal-facts h2{font-size:20px;margin-bottom:12px}.legal-facts address{font-style:normal;color:var(--ink-2)}@media(max-width:700px){.legal-facts{grid-template-columns:1fr}}</style>';
 return applyRelease4(html.replace('</head>',`${css}</head>`),locale);
}
