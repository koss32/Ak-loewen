/* PRIDE ambient background. Procedural particle lion on a single canvas.
 * Scroll drives the assembly: the page opens on loose dust, the mark gathers
 * while reading, disperses again and returns at the end.
 * Mobile: centered, fewer particles, capped DPR/FPS. Reduced motion: static frame.
 */
(() => {
 'use strict';
 const canvas = document.getElementById('pride-scene');
 if (!canvas) return;
 const ctx = canvas.getContext('2d', { alpha: true });
 if (!ctx) { canvas.style.display = 'none'; return; }
 const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
 const mix = (a, b, t) => a + (b - a) * t;
 const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
 const TAU = Math.PI * 2;
 const rnd = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
 const reduced = matchMedia('(prefers-reduced-motion: reduce)');
 const root = document.documentElement;

 let w = 1, h = 1, dpr = 1, mobile = false, light = false;
 let progress = 0, target = 0, maxScroll = 1, time = 0, raf = 0, lastPaint = 0;

 const lion = (window.__LION_POINTS__ || []).map((v, i) => ({
  x: v[0], y: v[1], seed: rnd(i + 120), r: rnd(i + 830), angle: rnd(i + 68) * TAU
 }));
 if (!lion.length) { canvas.style.display = 'none'; return; }

 /* The lion mark is rasterised once into three tinted masks: a warm body for the
  * dark theme, a darker one for the light theme and a bright edge pass. */
 const textures = { dark: null, light: null, edge: null };
 const logo = document.querySelector('.brand img');
 function prepareTextures() {
  if (!logo || !logo.complete || !logo.naturalWidth) return;
  const sizeX = 504, sizeY = 544, source = document.createElement('canvas');
  source.width = sizeX; source.height = sizeY;
  const c = source.getContext('2d', { willReadFrequently: true });
  if (!c) return;
  const scale = Math.min(sizeX / logo.naturalWidth, sizeY / logo.naturalHeight);
  const sw = logo.naturalWidth * scale, sh = logo.naturalHeight * scale;
  c.drawImage(logo, (sizeX - sw) / 2, (sizeY - sh) / 2, sw, sh);
  let image;
  try { image = c.getImageData(0, 0, sizeX, sizeY); } catch { return; }
  const mask = new Uint8Array(sizeX * sizeY);
  for (let i = 0; i < mask.length; i++) {
   const k = i * 4, lum = image.data[k] * .2126 + image.data[k + 1] * .7152 + image.data[k + 2] * .0722;
   mask[i] = Math.round(image.data[k + 3] * clamp((lum - 85) / 130));
  }
  for (const mode of ['dark', 'light', 'edge']) {
   const tex = document.createElement('canvas');
   tex.width = sizeX; tex.height = sizeY;
   const tc = tex.getContext('2d');
   if (!tc) continue;
   const pixels = tc.createImageData(sizeX, sizeY);
   const color = mode === 'light' ? [127, 52, 21] : mode === 'edge' ? [255, 222, 164] : [252, 174, 88];
   for (let y = 1; y < sizeY - 1; y++) for (let x = 1; x < sizeX - 1; x++) {
    const i = y * sizeX + x, k = i * 4;
    let alpha = mask[i];
    if (mode === 'edge') {
     const neighbor = Math.min(mask[i - 1], mask[i + 1], mask[i - sizeX], mask[i + sizeX]);
     alpha = clamp((mask[i] - neighbor) / 80) * 255;
    }
    pixels.data[k] = color[0]; pixels.data[k + 1] = color[1]; pixels.data[k + 2] = color[2]; pixels.data[k + 3] = alpha;
   }
   tc.putImageData(pixels, 0, 0);
   textures[mode] = tex;
  }
 }

 function rgba(r, g, b, a) { return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${clamp(a)})`; }
 function bloom(x, y, r, color, alpha) {
  if (alpha <= .002) return;
  const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, rgba(...color, alpha));
  grad.addColorStop(.48, rgba(...color, alpha * .3));
  grad.addColorStop(1, rgba(...color, 0));
  ctx.fillStyle = grad; ctx.fillRect(x - r, y - r, r * 2, r * 2);
 }
 function projection(x, y, z, yaw, pitch, unit, cx, cy) {
  const a = x * Math.cos(yaw) + z * Math.sin(yaw), b = -x * Math.sin(yaw) + z * Math.cos(yaw);
  const yy = y * Math.cos(pitch) - b * Math.sin(pitch), zz = y * Math.sin(pitch) + b * Math.cos(pitch);
  const f = 4.6 / (4.6 + zz);
  return { x: cx + a * unit * f, y: cy + yy * unit * f, z: zz, f };
 }
 function path(points, close = false) {
  ctx.beginPath();
  points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
  if (close) ctx.closePath();
 }
 function dust(p, t, count, accent) {
  for (let i = 0; i < count; i++) {
   const x = ((rnd(i + 19) * w + Math.sin(t * .12 + i) * 18 + p * 40 * (rnd(i + 32) - .5)) % w + w) % w;
   const y = ((rnd(i + 81) * h - t * (4 + rnd(i + 66) * 8) - p * h * .28) % h + h) % h;
   const a = (.09 + rnd(i + 77) * .27) * (light ? .45 : 1);
   ctx.fillStyle = rgba(...accent, a);
   const size = .5 + rnd(i + 5) * 1.1;
   ctx.fillRect(x, y, size, size);
  }
 }

 /* 0 = free dust, 1 = the finished mark. The first screen is deliberately pure
  * dust: the lion only earns its shape once the visitor starts reading. */
 function assembly(p) {
  if (p < .06) return 0;
  if (p < .34) return smooth(.06, .34, p);
  if (p < .58) return 1;
  if (p < .76) return mix(1, .08, smooth(.58, .76, p));
  return mix(.08, 1, smooth(.76, .94, p));
 }

 function pride(p, t) {
  const gather = assembly(p), spread = 1 - gather;
  const unit = Math.min(w * (mobile ? .38 : .30), h * (mobile ? .30 : .36));
  const cx = w * (mobile ? .50 : .68), cy = h * (mobile ? .42 : .47);
  const tilt = spread * (Math.sin(p * TAU) * .20 + Math.sin(t * .15) * .02);
  const tex = light ? textures.light : textures.dark;
  bloom(cx, cy, unit * 1.48, [205, 87, 35], (light ? .075 : .15) * mix(.35, 1, gather));
  // The continuous underprint only fades in once the dots are nearly home.
  if (tex && gather > .55) {
   ctx.save();
   ctx.globalAlpha = Math.pow(smooth(.55, 1, gather), 2) * (light ? .17 : .26);
   ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
   ctx.drawImage(tex, cx - unit, cy - unit * 1.08, unit * 2, unit * 2.16);
   if (!light && textures.edge) {
    ctx.globalAlpha = Math.pow(smooth(.55, 1, gather), 3) * .5;
    ctx.drawImage(textures.edge, cx - unit, cy - unit * 1.08, unit * 2, unit * 2.16);
   }
   ctx.restore();
  }
  const positions = [], buckets = Array.from({ length: 8 }, () => []);
  const skip = mobile ? 3 : 1;
  const scan = ((p * 3.2 + t * .045) % 1) * 2.5 - 1.25;
  const dotScale = clamp(unit / 330, .58, 1.35);
  for (let i = 0; i < lion.length; i += skip) {
   const v = lion[i], radius = .55 + v.r * 1.42, angle = v.angle + p * 3.4 + t * .065 * (.4 + v.seed);
   const x = mix(Math.cos(angle) * radius, v.x, gather), y = mix(Math.sin(angle) * radius * .84, v.y, gather);
   const z = spread * (Math.sin(angle * 2) * .8 + Math.sin(v.y * 3 + t * .16) * .02);
   const point = projection(x, y, z, tilt, spread * .04, unit, cx, cy);
   const ripple = spread * Math.sin(t * .9 + v.seed * TAU) * 3;
   point.x += ripple; point.y += ripple * .4;
   const beam = Math.exp(-Math.pow((v.y - scan) * 7, 2)) * gather;
   const twinkle = .93 + .07 * Math.sin(t * .6 + v.seed * 15);
   const strength = clamp((.52 + v.seed * .30 + beam * .35) * twinkle);
   const bucket = Math.min(7, Math.floor(strength * 8));
   point.size = (.75 + v.r * .42 + beam * .38) * dotScale * (mobile ? 1.22 : 1);
   point.beam = beam;
   buckets[bucket].push(point); positions.push(point);
  }
  // Batched paths avoid thousands of state changes while preserving dense detail.
  for (let i = 0; i < buckets.length; i++) {
   const brightness = i / 7;
   ctx.beginPath();
   for (const point of buckets[i]) { ctx.moveTo(point.x + point.size, point.y); ctx.arc(point.x, point.y, point.size, 0, TAU); }
   ctx.fillStyle = light
    ? rgba(145 + brightness * 26, 61 + brightness * 16, 24, .78)
    : rgba(255, 170 + brightness * 70, 83 + brightness * 125, .67 + brightness * .30);
   ctx.fill();
  }
  // A few crisp sparkles, not a blur over the whole face.
  ctx.strokeStyle = light ? '#a75f3644' : '#ffe7bdbb';
  ctx.lineWidth = .6; ctx.beginPath();
  for (let i = 0; i < positions.length; i += mobile ? 61 : 103) {
   const v = positions[i];
   if (v.beam < .6) continue;
   const r = 3.4 * dotScale;
   ctx.moveTo(v.x - r, v.y); ctx.lineTo(v.x + r, v.y);
   ctx.moveTo(v.x, v.y - r); ctx.lineTo(v.x, v.y + r);
  }
  ctx.stroke();
  const lineAlpha = spread * .17;
  if (lineAlpha > .01) {
   ctx.lineWidth = .6;
   ctx.strokeStyle = light ? rgba(149, 91, 52, lineAlpha) : rgba(245, 172, 107, lineAlpha);
   ctx.beginPath();
   for (let i = 0; i < positions.length - 15; i += 13) {
    const a = positions[i], b = positions[i + 13];
    if (Math.hypot(a.x - b.x, a.y - b.y) < unit * .4) { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
   }
   ctx.stroke();
  }
  // Orbits and beacons belong to the assembled mark, so they fade in with it.
  const orbitFade = smooth(.12, .7, gather);
  if (orbitFade > .01) for (let orbit = 0; orbit < 2; orbit++) {
   const points = [];
   for (let j = 0; j <= 100; j++) {
    const a = j / 100 * TAU;
    points.push(projection(Math.cos(a) * (1.20 + orbit * .18), Math.sin(a) * (1.20 + orbit * .18), 0, .48 + orbit * .3, .28 + orbit * .35, unit, cx, cy));
   }
   path(points);
   ctx.lineWidth = .7;
   ctx.strokeStyle = light ? rgba(145, 88, 51, .19 * orbitFade) : rgba(237, 154, 83, .25 * orbitFade);
   ctx.stroke();
   const a = p * TAU * (orbit ? -.6 : .85) + t * .12;
   const beacon = projection(Math.cos(a) * (1.20 + orbit * .18), Math.sin(a) * (1.20 + orbit * .18), 0, .48 + orbit * .3, .28 + orbit * .35, unit, cx, cy);
   bloom(beacon.x, beacon.y, 14, [255, 187, 102], (light ? .12 : .27) * orbitFade);
   ctx.fillStyle = light ? rgba(183, 98, 50, orbitFade) : rgba(255, 228, 175, orbitFade);
   ctx.beginPath(); ctx.arc(beacon.x, beacon.y, 2.0, 0, TAU); ctx.fill();
  }
  dust(p, t, mobile ? 16 : 50, [242, 183, 110]);
 }

 function measure() { maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight); }
 function readTheme() { light = root.dataset.theme === 'light'; }
 function resize() {
  w = innerWidth; h = innerHeight; mobile = w < 800;
  dpr = Math.min(devicePixelRatio || 1, mobile ? 1.5 : 2);
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  measure(); position(); wake();
 }
 function position() { target = clamp(scrollY / maxScroll); }

 function draw() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, w, h);
  pride(progress, time);
 }
 function frame(now) {
  raf = 0;
  if (document.hidden) return;
  // A 30fps ceiling on phones keeps the main thread free for scrolling.
  if (mobile && lastPaint && now - lastPaint < 32) { raf = requestAnimationFrame(frame); return; }
  const dt = Math.min(.045, lastPaint ? (now - lastPaint) / 1000 : 1 / 60);
  lastPaint = now;
  time += dt;
  progress = mix(progress, target, 1 - Math.exp(-dt * 7.5));
  draw();
  if (Math.abs(target - progress) > .0004 || !reduced.matches) raf = requestAnimationFrame(frame);
 }
 function wake() {
  if (reduced.matches) { progress = target; draw(); return; }
  if (!raf && !document.hidden) raf = requestAnimationFrame(frame);
 }

 prepareTextures();
 logo?.addEventListener('load', () => { prepareTextures(); wake(); });
 readTheme(); resize(); progress = target;
 new MutationObserver(() => { readTheme(); wake(); }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
 new ResizeObserver(() => { measure(); position(); wake(); }).observe(document.body);
 addEventListener('scroll', () => { position(); wake(); }, { passive: true });
 addEventListener('resize', resize, { passive: true });
 reduced.addEventListener('change', () => { lastPaint = 0; wake(); });
 document.addEventListener('visibilitychange', () => {
  if (document.hidden) { cancelAnimationFrame(raf); raf = 0; lastPaint = 0; }
  else { measure(); position(); wake(); }
 });
 wake();
})();
