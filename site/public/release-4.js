/* Release 4 — progressive enhancement for the brand union animation.
 * Without JS the composition is still fully visible; motion is skipped for
 * prefers-reduced-motion users (CSS already renders the joined end state).
 */
(() => {
 'use strict';
 const stage=document.querySelector('[data-brand-union]');
 if(!stage)return;
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 const join=()=>stage.classList.add('is-joined');
 if(reduce.matches||!('IntersectionObserver' in window)){join();return;}
 const observer=new IntersectionObserver(entries=>{
  for(const entry of entries)if(entry.isIntersecting){join();observer.disconnect();}
 },{threshold:.35,rootMargin:'0px 0px -8% 0px'});
 observer.observe(stage);
 reduce.addEventListener('change',()=>{if(reduce.matches)join();});
})();
