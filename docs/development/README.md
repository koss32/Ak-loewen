# Разработка AK-LOEWEN Release 6

`site/` — исполняемый root одного приложения: landing, legal pages, web booking/API и Telegram integration. Node.js **24+** обязателен.

## Локальная подготовка

```sh
cd site
npm ci
```

Секреты не нужны для статического build и unit-тестов. Не подставляйте production token, Redis credentials или реальные Telegram IDs в локальный shell. Для browser QA Chromium должен соответствовать `package-lock.json`:

```sh
node node_modules/playwright-core/cli.js install chromium
```

Не устанавливайте произвольную версию Playwright поверх lockfile.

## Build

```sh
cd site
npm run build
```

Build очищает `dist/`, копирует public assets, создаёт DE/RU/UK/TR и localized legal pages, entry page, `robots.txt`, условный `sitemap.xml` и standalone review artifact `dist/ak-loewen-valset-release-6.html`.

`FORM_DELIVERY_ENABLED`, `FORM_PUBLICATION_STATUS`, `FORM_CONSENT_VERSION`, `PUBLIC_ORIGIN` и `INDEXING_ENABLED` участвуют в build-time output. Изменение Vercel env после build не меняет уже созданный HTML: для новой политики нужен новый build/deployment.

По умолчанию form delivery и indexing выключены. Build должен fail closed, если явно запрошенная form delivery не готова; production indexing дополнительно требует настоящего Vercel production metadata и canonical HTTPS origin.

## Локальный сервер

```sh
cd site
PORT=4173 node server.js
```

Сервер слушает loopback и отдаёт `/de/`, `/ru/`, `/uk/`, `/tr/`, legal routes, public assets и `/api/trial-requests`. Local form delivery требует одновременно `FORM_DELIVERY_ENABLED=true` и `LOCAL_FORM_DELIVERY_ENABLED=true`, а также всей readiness-конфигурации. Унаследованный token/chat/Redis без второго opt-in ничего не отправляет.

Для безопасного preview оставляйте оба delivery flags, Telegram flags и reminders false. Не используйте реальный webhook, Redis или Telegram delivery.

## Проверки

```sh
cd site
npm test
npm run lint
npm run build
```

Browser scripts запускаются только с новым локальным build/server и безопасными mocks; предыдущие результаты считаются историческими для конкретной ревизии. Для browser scripts можно задать:

```sh
TEST_BASE_URL=http://127.0.0.1:4173 TEST_OUTPUT=/tmp/ak-browser-artifacts node tests/browser.mjs
TEST_BASE_URL=http://127.0.0.1:4173 node tests/form-browser.mjs
TEST_BASE_URL=http://127.0.0.1:4173 node tests/mobile-locales.mjs
TEST_BASE_URL=http://127.0.0.1:4173 node tests/portrait-browser.mjs
TEST_BASE_URL=http://127.0.0.1:4173 node tests/outcomes.mjs
node tests/build-review.mjs
```

Не считать mocks доказательством deployed form, Telegram, Redis, webhook, Vercel routes/headers или indexing.

## Ownership

- data/copy/render: `site/src/`;
- browser behavior/assets: `site/public/`;
- API boundaries: `site/api/`;
- runtime/config/state: `site/server/`;
- build/indexing: `site/build.js`, `site/server/indexing-config.js`, `site/middleware.js`;
- tests: `site/tests/`.

Релизные ограничения и launch order находятся в `docs/releases/RELEASE-6-CONTINUATION.md` и `RELEASE-6-LAUNCH-CHECKLIST.md`. Не запускайте Production, не меняйте aliases/secrets/webhook и не создавайте scheduler без отдельной команды владельца.
