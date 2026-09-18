# Release 6 TASK 7 — local browser QA

**Scope/date:** 2026-09-18. Local loopback only: `http://127.0.0.1:4173`; no deployed site, external app/API/browser service, real Telegram delivery, secrets, or real form submission was used. The server was started with `PORT=4173 node server.js` and stopped after the checks.

## Source changes

- Added `site/tests/helpers/browser.mjs`: portable Playwright Chromium launch helper. It honors `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`, otherwise uses Playwright's standard cached executable via `chromium.executablePath()` and gives an actionable install error.
- Updated `site/tests/{browser,form-browser,mobile-locales,portrait-browser,outcomes}.mjs` to use the helper.
- Updated stale browser expectations to match the existing approved current semantics:
  - phone is the initially selected one-contact field;
  - optional time is inside the expandable details control;
  - VALSET retains the shared request form and exposes `#instagram-optional` rather than obsolete separate-flow IDs;
  - the no-JS form remains a progressively enhanced `POST /api/trial-requests`, not a disabled control.
- Made standalone artifact assertions discover the generated `dist/ak-loewen-valset-*.html` rather than obsolete v1/release-3 filenames in `outcomes.mjs` and `build-review.mjs`.
- Made mocked delivery-outcome routing wait for each intercepted local browser request, avoiding a navigation race. The mock never forwards `/api/trial-requests`.

No runtime public/source styling or production-related files were changed.

## Commands and results

| Command | Result |
|---|---|
| `node node_modules/playwright-core/cli.js install chromium` | pass; installed the locked Playwright Chromium revision in the standard cache |
| `node node_modules/playwright-core/cli.js install-deps chromium` | pass; installed sandbox browser libraries |
| `PORT=4173 node server.js` | pass; loopback server only |
| `TEST_BASE_URL=http://127.0.0.1:4173 TEST_OUTPUT=/tmp/ak-browser-artifacts node tests/browser.mjs` | pass; 7 checks, 48 screenshots, no page errors or HTTP >=400 responses |
| `TEST_BASE_URL=http://127.0.0.1:4173 node tests/form-browser.mjs` | pass; root locale preference, DE/RU/UK/TR switching, one-contact validation, retained fields/time, zero demo POSTs |
| `TEST_BASE_URL=http://127.0.0.1:4173 node tests/mobile-locales.mjs` | pass; `[]` overflow report for RU/UK/TR at 360×640 |
| `TEST_BASE_URL=http://127.0.0.1:4173 node tests/portrait-browser.mjs` | pass; Namig responsive approved portrait assets at 390 and 1440 |
| `TEST_BASE_URL=http://127.0.0.1:4173 node tests/outcomes.mjs` | pass; intercepted/mock success, pending locale switch, uncertain retry (same request id), delivery error retention, standalone assets/legal dialog, local HTTP size/origin guards |
| `node tests/build-review.mjs` | pass; generated standalone embeds trainer assets and all locales remain demo mode |
| `npm test` | pass: 189/189 tests passed (23.45s) |

## Visual review and artifacts

I examined the generated DE contact sheet (`browser/sheet.png`) covering desktop 1440×1000, phone 390×844, compact 360×640, and reduced-motion desktop. The sampled hero, sport, trainer, schedule, price, trial, contact, AK-LOEWEN and VALSET views visually showed intact layout/content, no apparent horizontal clipping, correct dark VALSET section, trainer imagery, prices, and legal/footer presentation. This complements (rather than replaces) automated assertions.

Artifacts and command logs are in `work/phase2/browser-artifacts/`:

- `browser/`: 48 screenshots, `sheet.png`, `report.json`
- `script-test-results/`: mobile locale and portrait screenshots/reports
- `browser.log`, `form-browser.log`, `mobile-locales.log`, `portrait-browser.log`, `outcomes.log`, `build-review.log`, `npm-test.log`, `build-for-browser.log`

## Remaining gaps / final-state rerun

- This is simulated/local verification only; it does **not** verify Preview/Production deployment, Vercel configuration, real Redis, webhook, or Telegram delivery.
- The DE screenshot sheet was manually examined. RU/UK/TR screenshots were generated and their functional/mobile-overflow checks passed, but those locale screenshots were not manually reviewed individually.
- Parent should rerun from the final integrated `/tmp/ak-release6/site` state: `npm ci`, `npm test`, `npm run lint`, `npm run build`, then the six browser scripts above against a fresh loopback server. Re-run `node tests/build-review.mjs` after `npm run build` (or regenerate its standalone artifact first).
- Browser setup needed the locked package CLI (`node node_modules/playwright-core/cli.js install chromium`), not a separately versioned `npx playwright@1.55.0`; the latter installed a different browser revision and was not used for passing tests.
