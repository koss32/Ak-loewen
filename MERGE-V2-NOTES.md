# V2 (PRIDE) × Release 4 merge notes

Visual source of truth: `AK-LOEWEN-PRIDE-BG-V2.html`.
Backend source of truth: `release-4` (commit 3c1f909).

## Ported into sources (not into the built HTML)

- `site/public/pride.css`, `site/public/pride-points.js`, `site/public/pride-engine.js` — PRIDE lion particle background (fixed canvas + veil, scroll-driven assembly, dispersed on the first screen, mobile-tuned, reduced-motion fallback).
- `site/public/section-polish.css`, `site/public/section-polish.js` — the V2 “donor transplant” styling for `#trainer` / `#preise` and the IMPACT / STEPS / SIGNAL card motion.
- `site/src/render.js`
  - boxing-glove parallax layer removed, PRIDE canvas + veil inserted right after `<body>`;
  - new stylesheets/scripts linked after `style.css` / `scroll-motion.js` (so `release-4.css` / `release-4.js` still load first);
  - polish markup (`polish-card`, `polish-fx`) on disciplines, first-visit steps and the two contact cards;
  - trainer cards carry `data-trainer`, use the V2 `sizes` attribute and no longer render the “approach” block (V2 design);
  - price cards ordered Boxen → VALSET → Sambo & MMA (colour gradation) via `priceOrder`.
- `site/src/release-4-patch.js` — contact-card replacement targets updated to the new markup, all Release 4 behaviour kept.
- `site/src/data.js` — Anar Karimov portrait promoted from AI illustration to approved responsive photo (`anar-480/960.avif|webp|jpg` added to `site/public/assets/`).
- `site/public/scroll-motion.js` — the three polished card groups are animated only by `section-polish.js` (no double animation).
- `site/build.js` — standalone bundle now inlines the new CSS/JS files.
- Naming: `AK Löwen` / `AK LÖWEN` → `AK-LOEWEN` across site sources, public assets and Telegram bot copy (39 + 4 occurrences). `legal.entityName` (`AK-LOEWEN gGmbH`) and `aklggmbh@gmail.com` untouched.
- Data fix: German biography copy `Namig Aliyev` → `Namih Aliyev` (2 occurrences).
- `html,body{overflow-x:clip}` so decorative absolutes cannot create a horizontal scrollbar.

## Preserved unchanged

`site/api/*`, `site/server/*`, `site/tests/*` logic, `vercel.json`, `.env.example`, `package.json`, `package-lock.json`, `docs/`. The trial form still posts to `POST /api/trial-requests` with the Release 4 validation, Telegram booking/staff/reminder flow and Redis/outbox storage.

## Conflicts found while comparing V2 against Release 4

1. V2 is a standalone export built with `data-live="false"`. Taking its inline form code would have disabled live delivery, so only markup/CSS/JS presentation was ported; the form wiring stays the Release 4 one.
2. V2 drops the trainer “So gelingt der Einstieg” block. This is copy loss, not operational loss — kept as in V2; the locale keys (`coachApproachTitle`, `*Approach`) remain in `locales.js`, so it can be restored in one line.
3. Telegram bot copy used `AK LÖWEN`. Renaming it keeps branding legally consistent; test expectations were updated accordingly.

## Test status

`node build.js` OK. `npm test`: same failures as the untouched release-4 zip (Telegram suites need network/Redis env, plus two pre-existing content assertions) — no new regressions. `npm run lint` could not run: `eslint` is not installed in this offline environment.
