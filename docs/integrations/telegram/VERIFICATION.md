# Telegram verification — AK-LOEWEN Release 6

Этот документ разделяет локальные доказательства, read-only cloud inspection и реальную delivery verification. Обновление документа само по себе не запускало tests, Telegram, Redis, Vercel или webhook.

## Что проверять локально

На конкретном candidate SHA, после изменений:

```sh
cd site
npm ci
npm test
npm run lint
npm run build
```

Для browser QA использовать свежий локальный build/server и безопасные mocks. Telegram unit/integration tests проверяют reducer, idempotency, staff authorization, Redis behavior и error paths; они не доказывают cloud webhook или успешную доставку.

## Read-only cloud checks

Разрешённый read-only Vercel audit должен подтвердить только metadata:

- exact project identity, root `site`, build/output, Node >=24;
- branch/deployment settings;
- env names, types and scopes/targets, без values;
- deployed route/header behavior, если доступно безопасное GET/HEAD inspection.

Пока это не подтверждено отдельным evidence, status остаётся **UNVERIFIED**. Старый Release 3 snapshot и наличие Doppler/Vercel connection не являются проверкой project, env credentials или runtime health.

## Target gates

Release-6 `telegram-ops` read-only check должен fail closed, если не выполнены все target conditions:

- Vercel Preview (`VERCEL=1`, `VERCEL_ENV=preview`);
- exact branch `release-6`;
- canonical HTTPS `TELEGRAM_OPS_PREVIEW_ORIGIN`;
- equality with canonical `PUBLIC_ORIGIN` and platform-derived `VERCEL_URL`/`VERCEL_BRANCH_URL`;
- expected bot identity, privacy publication/version and `/api/telegram-webhook/` path.

Только после прохождения local gate check может выполнять read-only GET-like transport checks. Он не вызывает `setWebhook`, worker drain или delivery.

## Deployed smoke (только по отдельному разрешению)

Согласованный controlled smoke должен отдельно фиксировать:

1. target и candidate SHA;
2. canonical route/slash behavior и security/indexing headers;
3. legal/privacy pages и consent version;
4. web form validation/idempotency/uncertain behavior, если form smoke разрешён;
5. Telegram `/start`, booking/contact, staff authorization, reply/close/status, если real Telegram smoke разрешён;
6. webhook status, Redis state and rollback observation.

Не отправлять реальные заявки или Telegram-сообщения без explicit permission. Смена webhook текущего бота влияет на реальных пользователей и требует отдельного разрешения, наблюдения и rollback.

## Не выдавать за verification

- старые Release 2/3 результаты;
- локальный mock или screenshot;
- наличие env name/value в scope;
- READY deployment без подтверждения Git source/target;
- `vercel.json` как доказательство фактического deployed route/header;
- read-only check как доказательство успешной delivery.

Финальный verification status, список команд и остаточные blockers должен записать parent в release delivery после фактических проверок. Секреты и raw responses не сохранять.
