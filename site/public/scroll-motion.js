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
 const profiles=[
  (s)=>({duration:780,frames:[{opacity:.05,filter:'blur(12px)',clipPath:s<0?'inset(0 100% 0 0)':'inset(0 0 0 100%)',transform:'translate3d('+(s*24)+'px,0,0) rotateY('+(s*8)+'deg) scale(.96)'},{opacity:.82,filter:'blur(2px)',clipPath:'inset(0 8% 0 0)',transform:'translate3d('+(s*3)+'px,0,0) scale(1.01)',offset:.72},{opacity:1,filter:'blur(0)',clipPath:'inset(0)',transform:'none'}]}),
  ()=>({duration:920,frames:[{opacity:0,filter:'blur(14px)',clipPath:'circle(0% at 50% 50%)',transform:'scale(.72) rotate(-8deg)'},{opacity:.72,filter:'blur(3px)',clipPath:'circle(72% at 50% 50%)',transform:'scale(1.04) rotate(2deg)',offset:.68},{opacity:1,filter:'blur(0)',clipPath:'circle(100% at 50% 50%)',transform:'none'}]}),
  (s)=>({duration:980,frames:[{opacity:.08,filter:'blur(6px)',clipPath:'inset(0 7% round 28px)',transform:'perspective(1000px) translate3d('+(s*20)+'px,0,0) rotateY('+(s*18)+'deg) rotateZ('+(s*2)+'deg) scale(.91)'},{opacity:1,filter:'blur(0)',clipPath:'inset(0)',transform:'perspective(1000px) rotateY('+(s*-2)+'deg) scale(1.01)',offset:.78},{opacity:1,transform:'none'}]}),
  (s)=>({duration:840,frames:[{opacity:.08,filter:'blur(9px)',clipPath:s<0?'inset(0 100% 0 0)':'inset(0 0 0 100%)',transform:'translate3d('+(s*34)+'px,0,0) skewX('+(s*8)+'deg)'},{opacity:.75,filter:'blur(1px)',clipPath:'inset(0 4% 0 0)',transform:'skewX(0deg)',offset:.7},{opacity:1,filter:'blur(0)',clipPath:'inset(0)',transform:'none'}]}),
  ()=>({duration:900,frames:[{opacity:.04,filter:'blur(18px) saturate(.2)',transform:'scale(1.16) rotateX(8deg)'},{opacity:.78,filter:'blur(2px) saturate(1.15)',transform:'scale(.985) rotateX(-1deg)',offset:.7},{opacity:1,filter:'blur(0) saturate(1)',transform:'none'}]}),
  (s)=>({duration:1020,frames:[{opacity:.06,filter:'blur(8px)',clipPath:'inset(0 0 100% 0)',transform:'translate3d('+(s*16)+'px,0,0) rotateX(18deg) scale(.94)'},{opacity:.88,filter:'blur(1px)',clipPath:'inset(0 0 8% 0)',transform:'rotateX(-2deg) scale(1.015)',offset:.76},{opacity:1,filter:'blur(0)',clipPath:'inset(0)',transform:'none'}]}),
  (s)=>({duration:860,frames:[{opacity:.08,filter:'blur(10px)',clipPath:'inset(0 0 0 100%)',transform:'translate3d('+(s*28)+'px,0,0) rotateZ('+(s*5)+'deg) scale(.93)'},{opacity:1,filter:'blur(0)',clipPath:'inset(0)',transform:'rotateZ(0deg) scale(1.01)',offset:.78},{opacity:1,transform:'none'}]}),
  ()=>({duration:1100,frames:[{opacity:.04,filter:'blur(13px) saturate(.7)',clipPath:'inset(10% round 34px)',transform:'scale(.8) rotate(-5deg)'},{opacity:.9,filter:'blur(1px)',clipPath:'inset(0 round 10px)',transform:'scale(1.025) rotate(1deg)',offset:.74},{opacity:1,filter:'blur(0)',clipPath:'inset(0)',transform:'none'}]}),
  (s)=>({duration:940,frames:[{opacity:.05,filter:'blur(8px) contrast(.8)',clipPath:'inset(0 100% 0 0)',transform:'translate3d('+(s*20)+'px,0,0) scaleX(.82)'},{opacity:.9,filter:'blur(0) contrast(1.05)',clipPath:'inset(0)',transform:'scaleX(1.02)',offset:.8},{opacity:1,transform:'none'}]}),
  (s)=>({duration:880,frames:[{opacity:.08,filter:'blur(9px)',clipPath:'inset(0 100% 0 0)',transform:'translate3d('+(s*18)+'px,0,0) rotateY('+(s*12)+'deg) scale(.96)'},{opacity:1,filter:'blur(0)',clipPath:'inset(0)',transform:'rotateY(0deg) scale(1.01)',offset:.75},{opacity:1,transform:'none'}]}),
  ()=>({duration:1000,frames:[{opacity:.06,filter:'blur(11px) saturate(.45)',clipPath:'circle(16% at 50% 50%)',transform:'scale(.72) rotate(6deg)'},{opacity:.82,filter:'blur(1px) saturate(1.1)',clipPath:'circle(84% at 50% 50%)',transform:'scale(1.02) rotate(-1deg)',offset:.76},{opacity:1,filter:'blur(0)',clipPath:'circle(100% at 50% 50%)',transform:'none'}]}),
  (s)=>({duration:960,frames:[{opacity:.06,filter:'blur(7px)',clipPath:'inset(0 0 0 100%)',transform:'translate3d('+(s*24)+'px,0,0) rotateZ('+(s*2)+'deg) skewX('+(s*4)+'deg)'},{opacity:1,filter:'blur(0)',clipPath:'inset(0)',transform:'skewX(0deg)',offset:.8},{opacity:1,transform:'none'}]}),
  ()=>({duration:1080,frames:[{opacity:.04,filter:'blur(15px) brightness(1.7)',transform:'scale(.86) rotateX(-8deg)'},{opacity:.92,filter:'blur(0) brightness(1.08)',transform:'scale(1.02) rotateX(1deg)',offset:.8},{opacity:1,filter:'blur(0) brightness(1)',transform:'none'}]}),
  (s)=>({duration:900,frames:[{opacity:.05,filter:'blur(9px)',clipPath:'inset(0 8% 100% 8% round 18px)',transform:'translate3d('+(s*16)+'px,0,0) rotateY('+(s*6)+'deg) scale(.94)'},{opacity:.88,filter:'blur(0)',clipPath:'inset(0 round 8px)',transform:'scale(1.015)',offset:.72},{opacity:1,filter:'blur(0)',clipPath:'inset(0)',transform:'none'}]}),
  (s)=>({duration:1040,frames:[{opacity:.03,filter:'blur(16px) saturate(.3)',transform:'perspective(1000px) translate3d('+(s*22)+'px,0,0) rotateY('+(s*24)+'deg) scale(.9)'},{opacity:.85,filter:'blur(1px) saturate(1.1)',transform:'perspective(1000px) rotateY('+(s*-2)+'deg) scale(1.02)',offset:.78},{opacity:1,filter:'blur(0) saturate(1)',transform:'none'}]}),
  ()=>({duration:1180,frames:[{opacity:.02,filter:'blur(18px)',clipPath:'inset(12% round 40px)',transform:'scale(.76) rotate(-7deg)'},{opacity:.9,filter:'blur(0)',clipPath:'inset(0 round 14px)',transform:'scale(1.025) rotate(1deg)',offset:.82},{opacity:1,filter:'blur(0)',clipPath:'inset(0)',transform:'none'}]})
 ];
 const groups=[
  ['.hero-copy>.eyebrow,.hero-copy>h1,.hero-copy>.lead','parent'],['.entry-card','parent'],
  ['.section-head,.valset-top,#valset-groups>h3','self'],['.section-intro','self'],['.trial-layout>div:first-child','self'],
  ['.address-strip','self'],['.footer-invitation','self'],['.trainer-card','parent'],['.price-card','parent'],
  ['.about-grid>div','parent'],['.valset-grid>div','parent'],['.valset-art','self'],['.val-group','self']
 ];
 let nextProfile=0;
 for(const [selector,groupMode] of groups){
  const counts=new Map(),profileGroups=new Map();
  document.querySelectorAll(selector).forEach(el=>{
   const key=groupMode==='parent'?el.parentElement:el;
   const index=counts.get(key)||0;counts.set(key,index+1);
   if(!profileGroups.has(key))profileGroups.set(key,nextProfile++%profiles.length);
   plans.set(el,{index,profile:profileGroups.get(key)});
  });
 }
 function stop(el){const animation=running.get(el);if(animation){running.delete(el);animation.cancel();}}
 function reveal(el){
  if(seen.has(el))return;seen.add(el);observer.unobserve(el);
  const {index,profile}=plans.get(el);
  if(reduce.matches||el.contains(document.activeElement))return;
  const mobile=narrow.matches;
  const side=index%2===0?-1:1;
  const motion=profiles[profile](side,mobile),delay=mobile?0:Math.min(index,3)*25;
  const animation=el.animate(motion.frames,{duration:motion.duration,delay,easing,fill:'backwards'});
  running.set(el,animation);
  animation.finished.then(()=>{if(running.get(el)===animation)running.delete(el);}).catch(()=>{});
 }
 const observer=new IntersectionObserver(entries=>{
  for(const entry of entries)if(entry.isIntersecting)reveal(entry.target);
 },{threshold:0,rootMargin:'0px 0px 1% 0px'});
 for(const el of plans.keys())observer.observe(el);
 // Keyboard users never have to chase a moving control or wait for a reveal.
 document.addEventListener('focusin',event=>{
  for(const [el] of running)if(el.contains(event.target))stop(el);
 });
 reduce.addEventListener('change',()=>{if(reduce.matches){for(const [el] of running)stop(el);}});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)for(const [el] of running)stop(el);});
})();
