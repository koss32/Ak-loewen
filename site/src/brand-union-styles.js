// Release 4 landing styles: brand marks in the contact cards, the AK Löwen + VALSET
// union composition, the uncropped VALSET artwork and the compact Telegram button.
// Injected into <head> together with the other render-final styles so the localized
// pages and the standalone review build stay identical.
export const brandUnionStyles = `
.contact-card-head{display:flex;align-items:center;gap:16px;margin-bottom:4px}
.contact-card-head h3{margin:0}
.contact-mark{flex:0 0 64px;width:64px;height:64px;object-fit:contain;background:#fff;padding:6px;border:1px solid var(--line)}
.contact-card.b .contact-mark{border-color:#f4cc4655;padding:0;object-fit:cover}
.address-strip .address-legal{display:flex;flex-direction:column;align-items:flex-start;gap:12px;max-width:44ch}
.address-strip .address-legal p{margin:0}
.brand-union{display:flex;flex-direction:column;align-items:center;gap:22px}
.brand-union-stage{display:grid;grid-template-columns:auto auto auto;align-items:center;justify-items:center;gap:clamp(10px,1.6vw,22px)}
.brand-union-mark{display:grid;place-items:center;width:clamp(104px,13vw,164px);aspect-ratio:1;border:1px solid var(--line);background:var(--surface);overflow:hidden;will-change:transform}
.brand-union-mark img{width:100%;height:100%;object-fit:contain}
.brand-union-mark.is-ak{background:#fff;padding:9px}
.brand-union-mark.is-valset{background:var(--b-bg);border-color:#f4cc4655}
.brand-union-mark.is-valset img{object-fit:cover}
.brand-union-seam{width:2px;height:clamp(104px,13vw,164px);background:linear-gradient(var(--accent),var(--b-accent));transform-origin:center}
.brand-union-caption{font-size:13px;color:var(--ink-3);text-align:center;max-width:36ch;margin:0}
@keyframes ak-union-enter-left{from{transform:translate3d(-42%,0,0) scale(.94);opacity:.2}to{transform:none;opacity:1}}
@keyframes ak-union-enter-right{from{transform:translate3d(42%,0,0) scale(.94);opacity:.2}to{transform:none;opacity:1}}
@keyframes ak-union-seam{from{transform:scaleY(.1);opacity:0}to{transform:scaleY(1);opacity:1}}
@media(prefers-reduced-motion:no-preference){
 .brand-union-mark.is-ak{animation:ak-union-enter-left .95s cubic-bezier(.22,1,.36,1) both}
 .brand-union-mark.is-valset{animation:ak-union-enter-right .95s cubic-bezier(.22,1,.36,1) both}
 .brand-union-seam{animation:ak-union-seam .55s .5s cubic-bezier(.22,1,.36,1) both}
 @supports(animation-timeline:view()){
  .brand-union-mark.is-ak,.brand-union-mark.is-valset{animation-timeline:view();animation-range:entry 12% entry 88%;animation-duration:auto;animation-delay:0s}
  .brand-union-seam{animation-timeline:view();animation-range:entry 48% entry 96%;animation-duration:auto;animation-delay:0s}
 }
}
@media(prefers-reduced-motion:reduce){.brand-union-mark,.brand-union-seam{animation:none!important;transform:none!important;opacity:1!important}}
.valset-art.is-full{overflow:hidden}
.valset-art.is-full img{aspect-ratio:auto;height:auto;object-fit:contain;object-position:center;padding:clamp(16px,2.4vw,30px);background:var(--b-bg)}
.telegram-cta{position:fixed;right:24px;bottom:24px;z-index:70;display:inline-flex;align-items:center;gap:0;max-width:60px;min-height:58px;padding:17px;background:#229ED9;color:#fff;border:1px solid #6fc7ee;border-radius:999px;box-shadow:0 14px 34px #0007;font-size:13px;font-weight:700;overflow:hidden;transition:max-width .34s cubic-bezier(.22,1,.36,1),gap .34s cubic-bezier(.22,1,.36,1),padding .34s cubic-bezier(.22,1,.36,1),background .25s}
.telegram-cta-icon{flex:0 0 24px;display:grid;place-items:center}
.telegram-cta-label{white-space:nowrap;opacity:0;transform:translateX(-8px);transition:opacity .22s .05s,transform .3s cubic-bezier(.22,1,.36,1)}
.telegram-cta:hover,.telegram-cta:focus-visible,.telegram-cta:focus-within{max-width:min(320px,calc(100vw - 48px));gap:12px;padding-right:24px;background:#1b86b8}
.telegram-cta:hover .telegram-cta-label,.telegram-cta:focus-visible .telegram-cta-label,.telegram-cta:focus-within .telegram-cta-label{opacity:1;transform:none}
.telegram-cta:focus-visible{outline:2px solid var(--ink);outline-offset:4px}
@media(hover:none),(pointer:coarse){.telegram-cta{max-width:min(320px,calc(100vw - 40px));gap:12px;padding:15px 22px 15px 17px}.telegram-cta-label{opacity:1;transform:none}}
@media(max-width:540px){.telegram-cta{right:14px;bottom:max(14px,env(safe-area-inset-bottom));min-height:52px;font-size:12px}}
@media(prefers-reduced-motion:reduce){.telegram-cta,.telegram-cta-label{transition:none}}
@media(max-width:800px){.brand-union-stage{gap:12px}}
@media(max-width:540px){.brand-union-mark{width:clamp(92px,29vw,126px)}.brand-union-seam{height:clamp(92px,29vw,126px)}.contact-mark{flex-basis:56px;width:56px;height:56px}}
`;
