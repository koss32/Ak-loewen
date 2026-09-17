/* ScrollCraft-inspired choreography, progressively enhanced.
 * Content is visible without JS. Native scrolling and all form controls stay untouched.
 * No additional scroll listener, framework or perpetual animation loop.
 * The three polished card sections are handled exclusively by section-polish.js.
 */
(() => {
 'use strict';
 if(!('IntersectionObserver' in window)||!Element.prototype.animate)return;
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 const narrow=matchMedia('(max-width: 800px)');
 const running=new Map(),seen=new WeakSet(),plans=new Map();
 const easing='cubic-bezier(.16,1,.3,1)';
 const groups=[
  ['.hero-copy>.eyebrow,.hero-copy>h1,.hero-copy>.lead','heading'],
  ['.entry-card','card'],
  ['.section-head,.valset-top,#valset-groups>h3','heading'],
  ['.section-intro,.trial-layout>div:first-child,.address-strip,.footer-invitation','flow'],
  ['.trainer-card','portrait'],
  ['.price-card','price'],
  ['.about-grid>div,.valset-grid>div','flow'],
  ['.valset-art','scene'],
  ['.val-group','flow']
 ];
 for(const [selector,kind] of groups){
  const counts=new Map();
  document.querySelectorAll(selector).forEach(el=>{
   const index=counts.get(el.parentElement)||0;counts.set(el.parentElement,index+1);
   plans.set(el,{kind,index});
  });
 }
 function stop(el){const animation=running.get(el);if(animation){running.delete(el);animation.cancel();}}
 function reveal(el){
  if(seen.has(el))return;seen.add(el);observer.unobserve(el);
  if(reduce.matches||el.contains(document.activeElement))return;
  const {kind,index}=plans.get(el),mobile=narrow.matches;
  const side=index%2===0?-1:1;
  let from={opacity:.28,transform:`translate3d(0,${mobile?16:30}px,0)`},duration=780;
  if(kind==='heading'){from={opacity:.25,transform:`translate3d(0,${mobile?22:42}px,0)`};duration=900;}
  if(kind==='card'){from={opacity:.3,transform:`translate3d(${mobile?0:side*26}px,${mobile?18:32}px,0) scale(.985)`};duration=880;}
  if(kind==='portrait'){from={opacity:.35,transform:`translate3d(${mobile?0:side*38}px,${mobile?24:44}px,0) scale(${mobile?.985:.965})`};duration=1050;}
  if(kind==='price'){from={opacity:.4,transform:`translate3d(0,${mobile?18:38}px,0) scale(.975)`};duration=850;}
  if(kind==='step'){from={opacity:.3,transform:`translate3d(${mobile?0:18}px,${mobile?18:30}px,0)`};duration=800;}
  if(kind==='scene'){from={opacity:.35,transform:`translate3d(0,${mobile?24:52}px,0) scale(.95)`};duration=1100;}
  const delay=mobile?0:Math.min(index,3)*(kind==='step'?100:75);
  const animation=el.animate([from,{opacity:1,transform:'none'}],{duration,delay,easing,fill:'backwards'});
  running.set(el,animation);
  animation.finished.then(()=>{if(running.get(el)===animation)running.delete(el);}).catch(()=>{});
 }
 const observer=new IntersectionObserver(entries=>{
  for(const entry of entries)if(entry.isIntersecting)reveal(entry.target);
 },{threshold:.08,rootMargin:'0px 0px -5% 0px'});
 for(const el of plans.keys())observer.observe(el);
 // Keyboard users never have to chase a moving control or wait for a reveal.
 document.addEventListener('focusin',event=>{
  for(const [el] of running)if(el.contains(event.target))stop(el);
 });
 reduce.addEventListener('change',()=>{if(reduce.matches){for(const [el] of running)stop(el);}});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)for(const [el] of running)stop(el);});
})();
