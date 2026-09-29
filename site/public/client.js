(() => {
 'use strict';
 let config=JSON.parse(document.getElementById('page-data').textContent);
 let pending=false,completed=false,statusKey='',suggested='',requestId='',submittedPayload=null,languageSerial=0,completedRequestId='';
 const errorKeys={};
 const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 let selectedTheme='';try{selectedTheme=localStorage.getItem('ak-theme')||'';}catch{}
 function applyTheme(){const light=selectedTheme==='light';document.documentElement.dataset.theme=light?'light':'dark';document.querySelector('meta[name="theme-color"]').content=light?'#f5f5f3':'#0F0F11';$$('[data-theme-toggle]').forEach(button=>button.setAttribute('aria-pressed',String(light)));}
 applyTheme();
 document.addEventListener('click',event=>{if(!event.target.closest('[data-theme-toggle]'))return;selectedTheme=document.documentElement.dataset.theme==='light'?'dark':'light';try{localStorage.setItem('ak-theme',selectedTheme);}catch{}applyTheme();});
 const value=id=>document.getElementById(id)?.value||'';
 const groupById=id=>config.groups.find(g=>g.id===id);
 function status(key,error=false){statusKey=key;const el=$('#form-status');if(el){el.textContent=(config.t[key]||'')+(key==='success'&&completedRequestId?' '+config.t.requestNumber+': '+completedRequestId:'');el.setAttribute('role',error?'alert':'status');}}
 function error(id,key){errorKeys[id]=key;const el=document.getElementById(id),note=document.getElementById('error-'+id);if(el)el.setAttribute('aria-invalid',String(!!key));if(note)note.textContent=key?config.t[key]:'';}
 function currentData(){const method=value('contactMethod')||'phone';return {name:value('name').trim(),email:method==='email'?value('email').trim():'',phone:method==='phone'?value('phone').trim():'',telegram:method==='telegram'?value('telegram').trim():'',preferredTime:value('preferredTime'),comment:value('comment').trim(),age:value('age')===''?NaN:Number(value('age')),directionId:value('directionId'),groupId:value('groupId'),consent:!!$('#consent')?.checked};}
 function syncContactMethod(){const method=value('contactMethod')||'phone';$$('[data-contact-input]').forEach(el=>{const active=el.dataset.contactInput===method;el.hidden=!active;const input=el.querySelector('input');if(input)input.setAttribute('aria-required',String(active));});}
 function groupOptions(){
  if(!$('#directionId'))return;
  const direction=value('directionId'),selected=groupById(value('groupId'));
  $$('#groupId option[data-program]').forEach(o=>{o.hidden=o.disabled=o.dataset.program!==direction;});
  if(selected&&selected.programId!==direction)$('#groupId').value='';
  const valset=direction==='valset';$('#instagram-optional').hidden=!valset;syncContactMethod();
  if(!value('groupId')&&direction==='boxen')$('#groupId').value='box-15';
  const g=groupById(value('groupId'));
  const selectedTime=value('preferredTime'),timeSelect=$('#preferredTime');
  if(timeSelect){timeSelect.replaceChildren(new Option(config.t.choose,''));for(const id of g?.scheduleIds||[]){const s=config.schedules.find(s=>s.id===id);timeSelect.add(new Option(s.weekdayIds.map(d=>config.t.weekdays[d]).join(' · ')+' '+s.startTime+'–'+s.endTime+(s.byArrangement?' · '+config.t.arrangement:''),s.id));}timeSelect.value=(g?.scheduleIds||[]).includes(selectedTime)?selectedTime:'';}
  ageSuggestion();
 }
 function ageSuggestion(){
  const el=$('#age-suggestion');if(!el)return;
  const d=currentData(),g=groupById(d.groupId);suggested='';el.hidden=true;
  if(!Number.isInteger(d.age)||!g)return;
  if(d.age>=g.minAge&&(g.maxAge===null||d.age<=g.maxAge))return;
  const appropriate=config.groups.find(x=>x.programId===d.directionId&&d.age>=x.minAge&&(x.maxAge===null||d.age<=x.maxAge));
  el.hidden=false;el.querySelector('span').textContent=appropriate?config.t.ageMismatch+' '+config.t[appropriate.labelKey]:config.t.noGroup;
  $('#apply-group').hidden=!appropriate;if(appropriate)suggested=appropriate.id;
 }
 function validate(){
  const d=currentData();let ok=true;
  const checks={name:d.name.length<2||d.name.length>80||/[\u0000-\u001f]/.test(d.name)?'nameBounds':'',email:d.email&&(!/^\S+@[^\s@]+\.[^\s@]+$/.test(d.email)||d.email.length>254)?'emailError':'',phone:d.phone&&(!/^[+\d][\d\s()-]{5,39}$/.test(d.phone)||/[\r\n]/.test(d.phone)||d.phone.replace(/\D/g,'').length<6||d.phone.replace(/\D/g,'').length>20)?'phoneError':'',telegram:d.telegram&&!/^@?[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(d.telegram)?'telegramError':'',comment:d.comment.length>1000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(d.comment)?'commentError':'',preferredTime:'',age:!Number.isInteger(d.age)||d.age<1||d.age>120?'ageError':'',groupId:'',consent:!d.consent?'consentError':''};
  const method=value('contactMethod')||'phone';if(!d.email&&!d.phone&&!d.telegram)checks[method]='contactRequired';
  const g=groupById(d.groupId);if(!g||g.programId!==d.directionId)checks.groupId='groupError';else if(!checks.age&&(d.age<g.minAge||(g.maxAge!==null&&d.age>g.maxAge)))checks.age='ageMismatch';
  if(d.preferredTime&&(!g||!g.scheduleIds.includes(d.preferredTime)))checks.preferredTime='timeError';
  for(const [id,key] of Object.entries(checks)){error(id,key);if(key)ok=false;}
  ageSuggestion();if(!ok){status('invalid',true);const visible=$$('#trial-form [aria-invalid="true"]').find(el=>!el.hidden&&el.offsetParent!==null);visible?.focus();}return ok;
 }
 function syncSubmit(){const b=$('#submit-trial');if(!b)return;const locked=pending||completed||!!submittedPayload;$$('#trial-form input,#trial-form select,#trial-form textarea').forEach(el=>el.disabled=locked);$('#apply-group').disabled=locked;b.disabled=pending||completed;b.textContent=pending?config.t.sending:config.live?config.t.book:config.t.check;$('#trial-form')?.setAttribute('aria-busy',String(pending));}
 async function submit(e){
  e.preventDefault();if(pending||completed)return;if(!validate())return;
  if(!config.live){status('demoValid');return;}
  // An uncertain delivery keeps its original payload and id for status-safe retry.
  if(!submittedPayload){requestId=crypto.randomUUID();submittedPayload={...currentData(),locale:config.locale,consentVersion:config.consentVersion,requestId};}
  pending=true;syncSubmit();status('sending');
  try{
   const response=await fetch('/api/trial-requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(submittedPayload),signal:AbortSignal.timeout(18000)});
   const result=await response.json();
   if(result.ok===true){completedRequestId=result.requestId||requestId;status('success');submittedPayload=null;requestId='';completed=true;}
   else if(['uncertain','pending'].includes(result.code)){status(result.code,true);}
   else {status(result.code==='rate_limited'?'rate':result.code==='not_configured'?'demo':'failed',true);if(result.code!=='rate_limited'){submittedPayload=null;requestId='';}}
  }catch{status('uncertain',true);}finally{pending=false;syncSubmit();}
 }
 const dialog=$('#mobile-menu');let menuOpener=null,menuScroll=null;
 function closeMenu(){
  if(!dialog?.open)return;
  dialog.close();
  const saved=menuScroll;menuScroll=null;
  if(saved){const style=document.documentElement.style;if(saved.overflow)style.setProperty('overflow',saved.overflow,saved.priority);else style.removeProperty('overflow');}
  $('.menu-button')?.setAttribute('aria-expanded','false');menuOpener?.focus({preventScroll:true});
  if(saved)window.scrollTo({left:saved.x,top:saved.y,behavior:'instant'});
 }
 function openMenu(){
  if(!dialog||dialog.open)return;
  menuOpener=$('.menu-button');const style=document.documentElement.style;
  menuScroll={x:scrollX,y:scrollY,overflow:style.getPropertyValue('overflow'),priority:style.getPropertyPriority('overflow')};
  // Lock the root scroller without making body a new sticky scroll container.
  style.setProperty('overflow','hidden');dialog.showModal();menuOpener.setAttribute('aria-expanded','true');
  dialog.querySelector('[data-close-menu]').focus({preventScroll:true});
  window.scrollTo({left:menuScroll.x,top:menuScroll.y,behavior:'instant'});
 }
 dialog?.addEventListener('cancel',e=>{e.preventDefault();closeMenu();});
 dialog?.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right)closeMenu();}});
 dialog?.addEventListener('keydown',e=>{if(e.key!=='Tab')return;const items=Array.from(dialog.querySelectorAll('a,button')).filter(x=>!x.hidden),first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}});
 function openHash(scroll=false){const hash=location.hash.slice(1);if(!hash)return;const el=document.getElementById(hash);if(!el)return;if(el.matches('details')){$$('details.discipline').forEach(d=>d.open=d===el);}if(scroll)requestAnimationFrame(()=>el.scrollIntoView({behavior:reduce.matches?'instant':'smooth',block:'start'}));}
 $$('details.discipline').forEach(d=>d.addEventListener('toggle',()=>{if(d.open)$$('details.discipline').filter(x=>x!==d).forEach(x=>x.open=false);const s=d.querySelector('summary');s.setAttribute('aria-expanded',String(d.open));d.querySelector('.details-label').textContent=d.open?config.t.hideDetails:config.t.details;window.ScrollCraft?.instances[0]?.layout();}));
 // Morph translated markup without replacing controls or section nodes. This preserves
 // field values, focus, open details, in-flight requests and ScrollCraft references.
 function morph(oldNode,newNode){
  if(oldNode.nodeType!==newNode.nodeType||oldNode.nodeName!==newNode.nodeName){oldNode.replaceWith(newNode.cloneNode(true));return;}
  if(oldNode.nodeType===3){if(oldNode.nodeValue!==newNode.nodeValue)oldNode.nodeValue=newNode.nodeValue;return;}
  if(oldNode.nodeType!==1)return;
  if(oldNode.matches('script,#form-status,#age-suggestion,.field-error'))return;
  const preserve=new Set(['style','open','hidden','disabled','aria-invalid','aria-expanded','aria-busy']);
  for(const a of Array.from(newNode.attributes)){if(!preserve.has(a.name))oldNode.setAttribute(a.name,a.value);}
  if(oldNode.matches('[data-locale]')&&!newNode.hasAttribute('aria-current'))oldNode.removeAttribute('aria-current');
  if(oldNode.matches('input,textarea'))return;
  for(let i=0;i<newNode.childNodes.length;i++){if(!oldNode.childNodes[i])oldNode.append(newNode.childNodes[i].cloneNode(true));else morph(oldNode.childNodes[i],newNode.childNodes[i]);}
  while(oldNode.childNodes.length>newNode.childNodes.length)oldNode.lastChild.remove();
 }
 async function changeLanguage(locale,fromHistory=false){
  if(locale===config.locale)return;const seq=++languageSerial;const previous={group:value('groupId'),direction:value('directionId'),preferredTime:value('preferredTime'),contactMethod:value('contactMethod'),filters:$$('[data-schedule-filter]').map(el=>[el.id,el.value])};closeMenu();
  try{
   const route=`/${locale}/${config.page?config.page+'/':''}`;
   let text;
   if(window.__AK_PAGES__){text=window.__AK_PAGES__[locale][config.page||'home'];for(const [src,data] of Object.entries(window.__AK_ASSETS__||{}))text=text.replaceAll(src,data);}
   else {const response=await fetch(route,{headers:{Accept:'text/html'}});if(!response.ok)throw new Error('locale');text=await response.text();}
   if(seq!==languageSerial)return;
   const parsed=new DOMParser().parseFromString(text,'text/html');const next=JSON.parse(parsed.getElementById('page-data').textContent);
   morph(document.body,parsed.body);config=next;document.documentElement.lang=locale;document.title=parsed.title;applyTheme();
   document.querySelector('meta[name="description"]').content=parsed.querySelector('meta[name="description"]').content;
   document.querySelectorAll('link[rel="canonical"],link[rel="alternate"]').forEach(e=>e.remove());parsed.querySelectorAll('link[rel="canonical"],link[rel="alternate"]').forEach(e=>document.head.append(e.cloneNode(true)));
   if($('#directionId')){$('#directionId').value=previous.direction;groupOptions();$('#groupId').value=previous.group;groupOptions();$('#preferredTime').value=previous.preferredTime;$('#contactMethod').value=previous.contactMethod||'phone';syncContactMethod();}
   $$('details.discipline').forEach(d=>{d.querySelector('.details-label').textContent=config.t[d.open?'hideDetails':'details'];d.querySelector('summary').setAttribute('aria-expanded',String(d.open));});
   for(const [id,v] of previous.filters)if(document.getElementById(id))document.getElementById(id).value=v;filterSchedule();
   for(const [id,key] of Object.entries(errorKeys))error(id,key);if(statusKey)status(statusKey,['failed','uncertain','rate','invalid'].includes(statusKey));syncSubmit();
   if(!fromHistory&&location.protocol!=='file:')history.pushState({},'',route+location.hash);
   try{localStorage.setItem('ak-locale',locale);}catch{}
   window.ScrollCraft?.instances[0]?.layout();scheduleMotion();
  }catch{$('#language-status').textContent=config.t.switchFailed;}
 }
 document.addEventListener('click',async e=>{
  const lang=e.target.closest('[data-locale]');if(lang){e.preventDefault();await changeLanguage(lang.dataset.locale);return;}
  if(e.target.closest('.menu-button')){openMenu();return;}if(e.target.closest('[data-close-menu]')){closeMenu();return;}
  if(e.target.closest('#apply-group')&&suggested){$('#groupId').value=suggested;error('age','');groupOptions();return;}
  const a=e.target.closest('a');if(!a)return;
  if(window.__AK_PAGES__){
   const legalMatch=a.getAttribute('href')?.match(/^\/(de|ru|uk|tr)\/(impressum|datenschutz)\/$/);
   if(legalMatch){e.preventDefault();const parsed=new DOMParser().parseFromString(window.__AK_PAGES__[legalMatch[1]][legalMatch[2]],'text/html');const modal=document.createElement('dialog');modal.className='legal-dialog';const close=document.createElement('button');close.className='btn';close.textContent=config.t.close;close.onclick=()=>modal.close();modal.append(close,parsed.querySelector('main'));modal.addEventListener('close',()=>modal.remove());document.body.append(modal);modal.showModal();return;}
   if(a.classList.contains('brand')){e.preventDefault();history.replaceState({},'','#start');openHash(true);return;}
  }
  if(a.dataset.direction&&!pending&&!completed&&!submittedPayload){$('#directionId').value=a.dataset.direction;groupOptions();if(a.dataset.group)$('#groupId').value=a.dataset.group;groupOptions();if(a.dataset.time)$('#preferredTime').value=a.dataset.time;status('');}
  const href=a.getAttribute('href');if(href.startsWith('#')){e.preventDefault();closeMenu();if(location.hash!==href)history.pushState({},'',href);openHash(true);}
 });
 document.addEventListener('change',e=>{if(e.target.id==='directionId'||e.target.id==='groupId'){groupOptions();if(!pending)status('');}if(e.target.id==='contactMethod'){syncContactMethod();error('phone','');error('email','');error('telegram','');}if(e.target.id==='age')ageSuggestion();});
 document.addEventListener('input',e=>{if(e.target.id==='age')ageSuggestion();if(e.target.matches('#trial-form input,#trial-form textarea'))error(e.target.id,'');});
 $('#trial-form')?.addEventListener('submit',submit);
 addEventListener('hashchange',()=>openHash(true));
 addEventListener('popstate',()=>{const l=location.pathname.split('/')[1];if(['de','ru','uk','tr'].includes(l)&&l!==config.locale)changeLanguage(l,true);else openHash(true);});
 // ScrollCraft supplies natural-flow progress. Bespoke glove choreography is kept
 // outside the unchanged engine and uses transform/opacity only.
 if(window.ScrollCraft&&$('#main'))window.ScrollCraft.mount($('#main'));
 const sections=$$('main>section[id]'),world=$('.glove-world'),near=$('.glove-near'),far=$('.glove-far');
 let raf=0,current=scrollY,target=scrollY,lastTime=0;
 function scheduleMotion(){target=scrollY;if(!raf&&!document.hidden)raf=requestAnimationFrame(frame);}
 function frame(now){
  raf=0;const dt=Math.min(now-lastTime||16,40);lastTime=now;current+= (target-current)*(1-Math.exp(-dt/95));if(reduce.matches)current=target;
  const mobile=innerWidth<800,hero=$('#start'),val=$('#valset');
  if(world&&hero){const range=Math.max(hero.offsetHeight,700),p=Math.min(current/range,1),fade=val?Math.max(0,Math.min(1,(val.getBoundingClientRect().top-innerHeight*.2)/(innerHeight*.65))):1;
   const motion=reduce.matches?0:p,travel=mobile?.4:1;
   near.style.transform=`translate3d(${-motion*210*travel}px,${motion*-130*travel}px,0) rotate(${18-motion*38}deg) scale(${1-motion*.14})`;
   far.style.transform=`translate3d(${motion*100*travel}px,${motion*115*travel}px,0) rotate(${-24+motion*43}deg) scaleX(-1) scale(${1+motion*.1})`;
   world.style.opacity=String(fade);world.dataset.scVerifyState=`near:${Math.round(motion*210*travel)},far:${Math.round(motion*115*travel)},opacity:${fade.toFixed(2)}`;
   // The gloves deliberately settle after the opening. The rest of the site
   // continues in normal document flow; only this decorative layer holds.
   if(reduce.matches||(p>=1&&(fade>=1||fade<=0)))world.dataset.scVerifyHold='true';else delete world.dataset.scVerifyHold;
  }
  const artwork=$('[data-valset-art]');if(artwork){const r=artwork.closest('.valset-art').getBoundingClientRect();const p=Math.max(-1,Math.min(1,(innerHeight*.5-r.top)/innerHeight));artwork.style.transform=reduce.matches?'none':`translateY(${p*-12}px) scale(1.04)`;}
  let id=sections[0]?.id;for(const s of sections){if(s.getBoundingClientRect().top<=headerOffset()+4)id=s.id;}
  $$('[data-nav]').forEach(a=>{if(a.hash==='#'+id)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});
  if(Math.abs(target-current)>.1&&!reduce.matches)raf=requestAnimationFrame(frame);
 }
 addEventListener('scroll',scheduleMotion,{passive:true});addEventListener('resize',scheduleMotion,{passive:true});reduce.addEventListener('change',scheduleMotion);document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else scheduleMotion();});
 // Section entrances are handled by scroll-motion.js.

 let questionOpener=null;
 function closeQuestion(){const d=$('#question-dialog');if(d?.open)d.close();questionOpener?.focus({preventScroll:true});}
 $('#question-dialog')?.addEventListener('cancel',e=>{e.preventDefault();closeQuestion();});
 $('#question-dialog')?.addEventListener('keydown',e=>{if(e.key!=='Tab')return;const items=Array.from(e.currentTarget.querySelectorAll('button,a[href]')).filter(el=>!el.disabled&&!el.hidden);const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}});
 $('#question-dialog')?.addEventListener('click',e=>{if(e.target!==e.currentTarget)return;const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeQuestion();});
 function filterSchedule(){
  const filters=$$('[data-schedule-filter]');if(!filters.length)return;
  const values=Object.fromEntries(filters.map(el=>[el.dataset.scheduleFilter,el.value]));let count=0;
  $$('[data-schedule-row]').forEach(row=>{const match=(values.brand==='all'||row.dataset.brand===values.brand)&&(values.direction==='all'||row.dataset.directionId===values.direction)&&(values.age==='all'||row.dataset.category===values.age);row.hidden=!match;if(match)count++;});
  $('#schedule-empty').hidden=count>0;$('#schedule-status').textContent=config.t.scheduleResults.replace('{count}',count);
 }
 document.addEventListener('change',e=>{if(e.target.matches('[data-schedule-filter]'))filterSchedule();});
 document.addEventListener('click',e=>{const opener=e.target.closest('[data-question]');if(opener){e.preventDefault();questionOpener=opener;$('#question-dialog').showModal();$('#question-dialog [data-close-question]').focus();}if(e.target.closest('[data-close-question]'))closeQuestion();});
 function headerOffset(){return Math.ceil($('.site-header')?.getBoundingClientRect().height||0)+20;}
 function updateHeaderOffset(){document.documentElement.style.setProperty('--header-offset',headerOffset()+'px');scheduleMotion();}
 const headerObserver=new ResizeObserver(updateHeaderOffset);if($('.site-header'))headerObserver.observe($('.site-header'));
 $('.schedule-picker')?.addEventListener('toggle',()=>{window.ScrollCraft?.instances[0]?.layout();scheduleMotion();});
 filterSchedule();

 groupOptions();syncSubmit();openHash(!!location.hash);updateHeaderOffset();
})();
