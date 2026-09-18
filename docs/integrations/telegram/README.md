# Telegram integration — AK-LOEWEN Release 6

Telegram — интеграция единого приложения AK-LOEWEN, не отдельный продукт и не отдельная версия.

## Роль

Интеграция поддерживает:

- клиентский `/start`, выбор языка и booking/status flow;
- связь клиента с командой через отдельный ticket/conversation flow;
- staff actions для заявок и текущую проверку авторизации/membership;
- Redis-backed idempotency, state и bounded outbox.

Основной web booking остаётся отдельным web flow. Telegram не является обязательным условием для статической landing страницы.

## Текущий статус

**Release 6 / WIP / Preview preparation. Production не активирован.**

Phase 1 сохранена как завершённая в release evidence. Phase 2 продолжает точечные safety/config/indexing и documentation changes. Реальные Vercel project/env scopes, deployed routes/headers, Redis health, Telegram membership, webhook и delivery остаются отдельными непроверенными пунктами до финальной передачи.

Без отдельной команды владельца запрещены:

- Production deployment/alias или изменение Production env;
- смена Telegram webhook или отправка реальной заявки/message;
- Redis mutation/worker drain;
- включение worker/reminders/scheduler;
- включение indexing.

## Архитектура

```text
Telegram update
  -> /api/telegram-webhook/
  -> bot-runtime + telegram-bot/contact reducers
  -> Redis state/dedup/outbox
  -> Telegram response
```

`/api/telegram-ops/` — отдельная authenticated read-only Preview check surface. Она не разрешает `setWebhook`, worker drain или delivery. Mutation commands в `server/telegram-ops.js` имеют отдельные gates, включая `TELEGRAM_OPS_MUTATIONS_ENABLED=true`, и не допускаются в Production.

Worker/reminders остаются disabled/future capability. Обычные booking/contact flows не должны зависеть от scheduler.

## Конфигурационная политика

Основные переменные и безопасные defaults находятся в `site/.env.example`. В частности:

- `BOT_ENABLED`, `BOT_WEBHOOK_ENABLED`, `BOT_WORKER_ENABLED` — явные flags;
- `TELEGRAM_BOT_TOKEN`, secrets и Redis credentials — server-only, в документацию не копируются;
- `TELEGRAM_STAFF_AUTH_MODE=allowlist` или `group_members` — staff chat должен быть отрицательной group/supergroup ID;
- `PUBLIC_ORIGIN` — canonical HTTPS root без path/query/credentials;
- `PRIVACY_URL`, `PRIVACY_PUBLICATION_STATUS`, `PRIVACY_CONSENT_VERSION` — отдельная Telegram privacy readiness;
- `TELEGRAM_OPS_PREVIEW_ORIGIN` — explicit canonical HTTPS Release-6 Preview target, а не произвольный allow-host;
- `TELEGRAM_OPS_MUTATIONS_ENABLED=false` — default off;
- `BOT_WORKER_ENABLED=false`, `BOT_REMINDERS_ENABLED=false` — disabled/future.

Telegram privacy readiness не подменяет web-form legal readiness: web form использует собственные `FORM_PUBLICATION_STATUS` и `FORM_CONSENT_VERSION`, согласованные с текущим legal source.

## Документы

- [`SETUP.md`](SETUP.md) — безопасная конфигурация без секретов.
- [`ACTIVATION.md`](ACTIVATION.md) — будущий порядок активации с отдельными разрешениями.
- [`VERIFICATION.md`](VERIFICATION.md) — проверки и границы доказательств.
- [`../../releases/RELEASE-6-LAUNCH-CHECKLIST.md`](../../releases/RELEASE-6-LAUNCH-CHECKLIST.md) — общий launch order; сам не разрешает launch.
- [`../../legal/TELEGRAM-PRIVACY.md`](../../legal/TELEGRAM-PRIVACY.md) — approved legal source.

Исторический `PREVIEW-SNAPSHOT-2026-09-15.json` не является текущей конфигурацией.
