# Telegram setup — AK-LOEWEN Release 6

Этот документ описывает конфигурацию без раскрытия секретов. Он не доказывает, что cloud project, env scopes, webhook, Redis или Preview deployment уже готовы. Production не менять.

## Сначала

1. Работать только с `release-6`; `release-5` не менять.
2. Подтвердить связанный Vercel project через разрешённый read-only источник. Не брать project ID, alias, scopes или route status из старого Release 3 snapshot и не угадывать их.
3. Проверять только metadata: имя переменной, target/scope, type и наличие. Не читать decrypted values, не выполнять `vercel env pull`, не сохранять raw API responses.
4. Убедиться, что build root `site`, command `npm run build`, output `dist`, Node >=24 и `site/vercel.json` остаются согласованы.

## Required shape (values stay in Vercel/local secret store)

### Telegram runtime

- `BOT_ENABLED`, `BOT_WEBHOOK_ENABLED`, `BOT_WORKER_ENABLED` — flags, default false.
- `TELEGRAM_BOT_TOKEN` — server-only secret.
- `TELEGRAM_BOT_USERNAME` — expected bot identity is `ak_loewenbot` in ops checks.
- `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_WORKER_SECRET` — independent strong secrets; worker secret is also used to authenticate the read-only ops endpoint.
- `TELEGRAM_SEND_TIMEOUT_MS` — bounded timeout.
- `TELEGRAM_STAFF_AUTH_MODE` — `allowlist` or `group_members`; default example is `allowlist`.
- `TELEGRAM_STAFF_USER_IDS` — required for allowlist mode; numeric IDs only.
- `TELEGRAM_STAFF_CHAT_ID` and `TELEGRAM_CHAT_ID_AK` — negative group/supergroup IDs where required; never private chat IDs.

### Redis

Use one complete provider pair, never cross-mix aliases:

- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`, or
- `KV_REST_API_URL` + `KV_REST_API_TOKEN`.

URLs must be HTTPS root URLs without credentials, query, fragment or path. If either alias is partially present or invalid, form readiness fails closed. Never print values.

### Privacy and origin

- `PUBLIC_ORIGIN` — canonical HTTPS root, without a path/query/credentials; strict shared normalization applies.
- `PRIVACY_PUBLICATION_STATUS=published`, `PRIVACY_CONSENT_VERSION=telegram-2026-09-15-v1`, `PRIVACY_URL` — exact Telegram privacy readiness required by bot booking.
- `TELEGRAM_OPS_PREVIEW_ORIGIN` — canonical HTTPS root of the explicitly verified Release-6 Preview target. It must equal `PUBLIC_ORIGIN` and the Vercel platform/branch-derived host; no arbitrary host allowlist.
- `TELEGRAM_OPS_MUTATIONS_ENABLED=false` — keep off until a separately approved staging operation.

The current legal source is `site/src/data.js` plus `docs/legal/TELEGRAM-PRIVACY.md`; do not invent a new consent version or rewrite legal copy.

### Web-form distinction

Web form uses its own `FORM_DELIVERY_ENABLED`, `FORM_PUBLICATION_STATUS=published`, exact `FORM_CONSENT_VERSION` and form readiness. Telegram privacy variables alone are not proof that form delivery is ready. Local delivery additionally requires `LOCAL_FORM_DELIVERY_ENABLED=true`.

## Target and webhook safety

Release-6 ops are Preview-only and require:

- `VERCEL=1`, `VERCEL_ENV=preview`;
- exact source branch `release-6`;
- explicit canonical `TELEGRAM_OPS_PREVIEW_ORIGIN` matching canonical `PUBLIC_ORIGIN` and `VERCEL_URL` or `VERCEL_BRANCH_URL`;
- expected bot identity and `/api/telegram-webhook/` path.

A read-only `check` performs diagnostics only after the target gate passes. It uses read operations and does not register a webhook, drain a worker or deliver messages. A mutation is never a routine setup step and needs a separate explicit permission plus rollback plan.

## Local safety

For local browser/build work keep all delivery flags false and use test/mocked transports. A shell that happens to contain Telegram credentials must not make local form delivery active; both form opt-in flags and every readiness gate must pass.
