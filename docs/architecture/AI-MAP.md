# AK-LOEWEN — карта архитектуры Release 6

## Модель продукта

Один проект:

```text
AK-LOEWEN
├─ localized landing + legal pages
├─ web trial-request form/API
└─ Telegram integration
   ├─ client booking/status/contact
   ├─ staff authorization and replies
   ├─ webhook boundary
   ├─ optional worker/reminder capability (disabled/future)
   └─ Redis state/idempotency/outbox
```

Telegram не имеет отдельной версии. Исторические Release 2/3 документы не описывают текущий source of truth.

## Ветки и статус

- `release-5` — стабильный неизменяемый baseline `c52e77dcde8548e00f2e6208b143dc87c37f811e`.
- `release-6` — текущая рабочая ветка; Phase 1 завершена, Phase 2 продолжает точечные исправления и документацию.
- Production не запускался. Vercel project identity, deployed env/scopes/routes/headers, Telegram/Redis health и delivery не считаются подтверждёнными без отдельного read-only/deployed evidence.

## Runtime ownership

### Landing и data

- `site/src/data.js` — locales, программы, группы, расписание, цены, тренеры, контакты и legal publication/consent state.
- `site/src/locales.js`, `site/src/*-copy.js` — DE/RU/UK/TR copy.
- `site/src/render.js`, `site/src/render-final.js`, `site/src/entry.js` — page/entry rendering.
- `site/public/style.css`, `public/release-4.css`, `public/section-polish.css`, `public/pride.css` — visual layers; historical filename не означает отдельный Release 4 продукт.
- `site/public/client.js`, `locale-entry.js`, `scroll-motion.js` — browser behavior and locale navigation.

### Build и indexing

- `site/build.js` очищает `dist`, копирует assets, оценивает form readiness и indexing policy, строит локали/legal pages, `robots.txt`, условный `sitemap.xml` и `dist/ak-loewen-valset-release-6.html`.
- `site/server/indexing-config.js` — единый policy helper: `INDEXING_ENABLED=true` недостаточен без production Vercel context и canonical HTTPS `PUBLIC_ORIGIN`; формирует `noindex` default, robots и sitemap.
- `site/middleware.js` — root Vercel proxy entrypoint (`proxy.entrypoint`), использующий `next` из установленного `@vercel/functions`. Без matcher-исключений на каждом запросе сравнивает request origin с canonical origin и выдаёт `X-Robots-Tag`. Preview/noncanonical hosts, API/review paths и Telegram Privacy noindex; noncanonical sitemap не раскрывается.
- `site/vercel.json` задаёт `proxy.entrypoint`, build/output (`npm run build`/`dist`) и security headers. Static duplicate `X-Robots-Tag` не используется.

Indexable paths ограничены `/`, `/de/`, `/ru/`, `/uk/`, `/tr/` и их localized `impressum/`/`datenschutz/`. API, standalone review artifact и `/telegram-privacy/` не индексируются. Build-time flags требуют нового build/deployment; изменение env само по себе не переписывает уже созданный HTML.

### Web form

```text
browser/no-JS form
  -> /api/trial-requests
  -> site/server/hosted-trial.js
  -> validated same-provider Redis ledger + Telegram delivery
```

- `site/server/form-config.js` — redacted readiness; legal source, `FORM_PUBLICATION_STATUS`, exact `FORM_CONSENT_VERSION`, canonical origin, negative chat ID, token и complete same-provider Redis pair.
- `site/api/trial-requests.js` — POST boundary; supplied Origin must exactly equal configured canonical origin, missing Origin remains allowed for no-JS semantics, Host не используется как fallback.
- `site/server.js` — local server. Delivery requires form readiness plus explicit `LOCAL_FORM_DELIVERY_ENABLED=true`; inherited credentials alone do not send.
- `site/server/hosted-trial.js` — validation, idempotency, rate limits and uncertain-delivery behavior; these semantics не заменяются документацией.

### Telegram

```text
Telegram update
  -> site/api/telegram-webhook.js
  -> site/server/bot-runtime.js
  -> site/server/telegram-bot.js
  -> site/server/bot-store.js
  -> Redis aggregate/outbox

explicit ops endpoint
  -> site/api/telegram-ops.js
  -> read-only Preview check (GETs to external transports only)
```

- `server/bot-config.js` — bot flags, strict origin/privacy/readiness, auth mode and secret validation.
- `server/telegram-bot.js` / `bot-copy.js` — client/staff reducers and DE/RU/UK/TR copy.
- `server/telegram-contact.js` / `contact-copy.js` — separate lightweight customer/team conversation flow.
- `server/telegram-staff.js` — current membership verification support.
- `server/bot-store.js` — Redis state, deduplication, outbox and bounded history.
- `api/telegram-webhook.js` — authenticated POST boundary; it is not a proof of deployed webhook configuration.
- `api/telegram-worker.js` — future/disabled background capability; no scheduler required for ordinary booking/contact.
- `server/telegram-ops.js` — release-6 Preview-only target gate, read-only check, and separately gated mutations. Target must be explicit canonical HTTPS and match Vercel branch/platform metadata; release-3 target is rejected.
- `api/telegram-ops.js` — authenticated read-only remote check endpoint; no `setWebhook`, worker drain or delivery call from this endpoint.
- `api/telegram-link.js` — intentionally disabled bridge capability.

## API and deployment

- `site/vercel.json` — root is `site/`, build command `npm run build`, output `dist`, `trailingSlash: true`, Git deployment disabled, function budgets and middleware proxy.
- `site/.env.example` — names and safe defaults only; never put values here.
- `site/server.js` — local loopback runtime with noindex headers and local form safety gates.

## Tests and documentation

Tests live in `site/tests/`, including `telegram-*`, `bot-*`, form/config/indexing/ops tests and browser scripts. A historical pass does not prove a later revision. Current final test status belongs in the parent’s final release delivery, not in this architecture map.

Change routing: data → `src/data.js`; copy → `src/locales.js`/specialized copy; render → `src/render*.js`; browser → `public/`; form → `api/trial-requests.js` + form/hosted services; Telegram → `server/telegram-*`, `bot-*`, `api/telegram-*`; indexing → `server/indexing-config.js`, `middleware.js`, `build.js`.
