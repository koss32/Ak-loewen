/* Release 4 — progressive enhancement for the AK Löwen × VALSET union.
 * Without JS the composition is still fully visible; motion is skipped for
 * prefers-reduced-motion users (CSS renders the joined end state statically).
 */
(() => {
 'use strict';
 const stage=document.querySelector('[data-brand-union]');
 if(!stage)return;
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 let played=false;
 const impact=()=>{stage.classList.add('is-impact');};
 const join=(instant)=>{
  if(played)return;played=true;
  stage.classList.add('is-joined');
  if(instant){impact();return;}
  setTimeout(impact,900);
 };
 if(reduce.matches||!('IntersectionObserver' in window)){join(true);return;}
 const observer=new IntersectionObserver(entries=>{
  for(const entry of entries)if(entry.isIntersecting){join(false);observer.disconnect();}
 },{threshold:.35,rootMargin:'0px 0px -8% 0px'});
 observer.observe(stage);
 reduce.addEventListener('change',()=>{if(reduce.matches)join(true);});

 // subtle 3d tilt follow (pointer only, never required for the animation)
 if(matchMedia('(hover: hover) and (pointer: fine)').matches){
  let frame=0;
  stage.addEventListener('pointermove',event=>{
   if(reduce.matches||frame)return;
   frame=requestAnimationFrame(()=>{
    frame=0;
    const box=stage.getBoundingClientRect();
    const x=(event.clientX-box.left)/box.width-.5;
    const y=(event.clientY-box.top)/box.height-.5;
    stage.style.setProperty('--ry',`${(x*12).toFixed(2)}deg`);
    stage.style.setProperty('--rx',`${(-y*12).toFixed(2)}deg`);
   });
  });
  stage.addEventListener('pointerleave',()=>{
   stage.style.setProperty('--ry','0deg');
   stage.style.setProperty('--rx','0deg');
  });
 }
})();
