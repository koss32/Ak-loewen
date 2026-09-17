/* Stage 2 · IMPACT / STEPS / SIGNAL.
 * Native one-shot animations: no scroll hijacking, polling, dependencies or hidden states.
 * Original accordions, links and form listeners are deliberately left alone.
 */
(() => {
  'use strict';
  const cards = Array.from(document.querySelectorAll('[data-polish]'));
  if (!cards.length || !('IntersectionObserver' in window) || !Element.prototype.animate) return;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const narrow = matchMedia('(max-width: 760px)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const ease = 'cubic-bezier(.16,1,.3,1)';
  const active = new Map();
  const seen = new WeakSet();
  const plans = new WeakMap();
  const counts = new Map();
  const pointerResets = [];
  for (const card of cards) {
    const index = counts.get(card.parentElement) || 0;
    counts.set(card.parentElement, index + 1);
    plans.set(card, { kind: card.dataset.polish, index });
  }

  function stop(card) {
    const animations = active.get(card);
    active.delete(card);
    if (animations) for (const animation of animations) animation.cancel();
  }
  function animate(card, target, frames, duration, delay = 0, easing = ease) {
    if (!target || reduce.matches || document.hidden) return;
    try {
      const animation = target.animate(frames, { duration, delay, easing, fill: 'backwards' });
      if (!active.has(card)) active.set(card, new Set());
      active.get(card).add(animation);
      const release = () => {
        const group = active.get(card);
        if (!group) return;
        group.delete(animation);
        if (!group.size) active.delete(card);
      };
      animation.finished.then(release, release);
    } catch {
      // Unsupported effects degrade to the fully visible CSS design.
    }
  }

  function impact(card, index, mobile) {
    const side = index % 2 ? 1 : -1;
    const delay = mobile ? 0 : index * 140;
    animate(card, card, [
      { opacity: .36, transform: `perspective(1200px) translate3d(${side * (mobile ? 12 : 62)}px,${mobile ? 22 : 36}px,0) rotateY(${side * (mobile ? 3 : 10)}deg) rotateZ(${side * .9}deg) scale(.955)` },
      { opacity: 1, transform: 'perspective(1200px) translate3d(0,-3px,0) rotateY(0deg) rotateZ(0deg) scale(1)', offset: .78 },
      { opacity: 1, transform: 'none' }
    ], 1180, delay);
    animate(card, card.querySelector('.polish-sheen'), [
      { opacity: 0, transform: 'translateX(-40%) rotate(24deg)' },
      { opacity: 1, offset: .24 },
      { opacity: .8, offset: .58 },
      { opacity: 0, transform: 'translateX(440%) rotate(24deg)' }
    ], 1250, delay + 140, 'cubic-bezier(.3,0,.2,1)');
    animate(card, card.querySelector('.polish-ring'), [
      { opacity: 0, transform: 'scale(.35)' },
      { opacity: .9, transform: 'scale(1.12)', offset: .62 },
      { opacity: .65, transform: 'none' }
    ], 1250, delay + 160);
    animate(card, card.querySelector('.polish-trace'), [
      { opacity: 0, transform: `scaleX(.08)` },
      { opacity: .6, transform: 'scaleX(1)' }
    ], 1000, delay + 220);
  }

  function steps(card, index, mobile) {
    const delay = mobile ? 0 : index * 180;
    animate(card, card, [
      { opacity: .28, transform: `perspective(1100px) translate3d(0,${mobile ? 32 : 76}px,0) rotateX(${mobile ? 7 : 18}deg) scale(.965)` },
      { opacity: 1, transform: 'perspective(1100px) translate3d(0,-4px,0) rotateX(0deg) scale(1)', offset: .76 },
      { opacity: 1, transform: 'none' }
    ], 1250, delay);
    animate(card, card.querySelector('.first-visit-number'), [
      { opacity: .3, transform: 'rotate(-100deg) scale(.55)' },
      { opacity: 1, transform: 'rotate(6deg) scale(1.1)', offset: .7 },
      { opacity: 1, transform: 'none' }
    ], 950, delay + 160);
    animate(card, card.querySelector('.polish-trace'), [
      { opacity: .1, transform: 'scaleX(0)' },
      { opacity: .6, transform: 'scaleX(1)' }
    ], 1050, delay + 350);
    animate(card, card.querySelector('.polish-ring'), [
      { opacity: 0, transform: 'scale(.3)' },
      { opacity: .65, transform: 'scale(1)' }
    ], 1400, delay + 200);
  }

  function signal(card, index, mobile) {
    const side = index % 2 ? 1 : -1;
    const delay = mobile ? 0 : index * 160;
    animate(card, card, [
      { opacity: .32, transform: `translate3d(${mobile ? 0 : -side * 44}px,${mobile ? 22 : 32}px,0) rotate(${side * (mobile ? .6 : 2.2)}deg) scale(.94)` },
      { opacity: 1, transform: 'translate3d(0,-2px,0) rotate(0deg) scale(1.006)', offset: .76 },
      { opacity: 1, transform: 'none' }
    ], 1300, delay);
    animate(card, card.querySelector('.polish-ring'), [
      { opacity: 0, transform: 'scale(.15)' },
      { opacity: 1, transform: 'scale(1.13)', offset: .6 },
      { opacity: .65, transform: 'scale(1)' }
    ], 1550, delay + 200);
    animate(card, card.querySelector('.contact-logo'), [
      { opacity: .4, transform: 'scale(.7) rotate(-8deg)' },
      { opacity: 1, transform: 'none' }
    ], 1000, delay + 220);
    card.querySelectorAll('.contact-link').forEach((row, rowIndex) => {
      animate(card, row, [
        { opacity: .35, transform: `translate3d(${mobile ? 8 : 18}px,0,0)` },
        { opacity: 1, transform: 'none' }
      ], 780, delay + 300 + rowIndex * 85);
    });
    animate(card, card.querySelector('.polish-trace'), [
      { opacity: 0, transform: 'scaleX(0)' },
      { opacity: .4, transform: 'scaleX(1)' }
    ], 1250, delay + 360);
  }

  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting || document.hidden) continue;
      const card = entry.target;
      observer.unobserve(card);
      if (seen.has(card)) continue;
      seen.add(card);
      if (reduce.matches || card.contains(document.activeElement) || card.open) continue;
      const {kind, index} = plans.get(card);
      ({impact, steps, signal})[kind]?.(card, index, narrow.matches);
    }
  }, {threshold: .1, rootMargin: '0px 0px -24px 0px'});
  cards.forEach(card => observer.observe(card));

  // Pointer-only polish is optional and uses a frame only while the pointer moves.
  for (const card of cards) {
    let frame = 0;
    let x = 0;
    let y = 0;
    const reset = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      for (const key of ['--card-rx','--card-ry','--pointer-x','--pointer-y']) card.style.removeProperty(key);
    };
    pointerResets.push(reset);
    card.addEventListener('pointermove', event => {
      if (event.pointerType === 'touch' || !fine.matches || reduce.matches || card.contains(document.activeElement)) return;
      x = event.clientX; y = event.clientY;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const rect = card.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const px = Math.min(1,Math.max(0,(x-rect.left)/rect.width));
        const py = Math.min(1,Math.max(0,(y-rect.top)/rect.height));
        card.style.setProperty('--pointer-x', `${(px*100).toFixed(2)}%`);
        card.style.setProperty('--pointer-y', `${(py*100).toFixed(2)}%`);
        const strength = card.dataset.polish === 'impact' ? 5 : 3;
        card.style.setProperty('--card-rx', `${((.5-py)*strength).toFixed(2)}deg`);
        card.style.setProperty('--card-ry', `${((px-.5)*strength).toFixed(2)}deg`);
      });
    }, {passive:true});
    card.addEventListener('pointerleave', reset);
    card.addEventListener('pointercancel', reset);
    card.addEventListener('pointerdown', () => {stop(card); reset();}, {passive:true});
    card.addEventListener('focusin', () => {
      seen.add(card); observer.unobserve(card); stop(card); reset();
    });
    if (card.matches('details')) card.addEventListener('toggle', () => {stop(card); reset();});
  }
  function stopAll() {
    for (const card of Array.from(active.keys())) stop(card);
    pointerResets.forEach(reset => reset());
  }
  reduce.addEventListener('change', () => {if (reduce.matches) stopAll();});
  fine.addEventListener('change', () => {if (!fine.matches) pointerResets.forEach(reset => reset());});
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopAll();
    else for (const card of cards) if (!seen.has(card)) {observer.unobserve(card); observer.observe(card);}
  });
})();
