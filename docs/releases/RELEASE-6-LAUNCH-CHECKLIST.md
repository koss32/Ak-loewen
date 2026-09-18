# Release 6 — checklist будущего запуска

**Статус: подготовка, не запуск.** Локальный кандидат проверен, но Production, webhook, delivery, aliases и indexing не включались. Каждый пункт требует отдельного подтверждения; при сомнении — **STOP**.

## 0. Правила

- Только ветка `release-6`; `release-5` неизменен (`c52e77dcde8548e00f2e6208b143dc87c37f811e`). Не merge, не force-push, не менять default branch.
- Владелец должен отдельно разрешить production launch и controlled smoke. Этот checklist сам разрешением не является.
- Секреты, PII и raw env не записывать в Git, чат, логи или screenshots. Не считать env name, mocks, READY deployment или connection доказательством доставки.
- Не добавлять scheduler. `BOT_WORKER_ENABLED` и `BOT_REMINDERS_ENABLED` остаются `false`/future capability; worker secret не является требованием базового bot booking/contact.

## 1. Зафиксировать кандидат и cloud target

- [ ] Получена явная команда владельца и отдельное одобрение smoke plan.
- [ ] После push зафиксирован **фактический remote SHA** `release-6` в delivery record. Текущий локальный проверенный кандидат: `f5c3660407a6bae1d66d5c3ea662fe5c119c5ea4`.
- [ ] Read-only target сверен: Vercel team `zumeeeeer-6684's projects` (`team_j4dElwkGk5L6ODyrhxQRW1N5`), project `ak-loewen-release-a` (`prj_0kG9RBjUgIn4UktNF1qYU0cCgRvU`), GitHub `koss32/Ak-loewen`.
- [ ] Подтверждены root `site`, build `npm run build`, output `dist`, Node `24.x`, intended branch и отсутствие неожиданных commits.
- [ ] Разобрано расхождение: remote auto-deploy metadata `createDeployments=enabled`, а checked-in `site/vercel.json` содержит `git.deploymentEnabled=false`. Не менять настройку «для удобства» без отдельного разрешения.
- [ ] Учтено: среди 20 просмотренных deployments нет подтверждённого `release-6`; последний exact detail — `ERROR`, ref `ksyusha`. Это не доказательство готового deployment.

## 2. Environment и readiness (только metadata, без значений)

- [ ] Проверены targets/scopes по именам и типам. Аудит нашёл 34 записи, все `preview`, со старыми scopes; Production и `release-6` scope не подтверждены.
- [ ] Для hosted form, перед её отдельным включением: `FORM_DELIVERY_ENABLED=true`, `FORM_PUBLICATION_STATUS=published`, согласованная `FORM_CONSENT_VERSION`, опубликованный legal source, canonical HTTPS `PUBLIC_ORIGIN`, bot token/chat и полная same-provider Redis pair (URL+token). Алиасы Redis не смешивать.
- [ ] Для Telegram webhook/booking: `BOT_ENABLED=true`, `BOT_WEBHOOK_ENABLED=true`, canonical `PUBLIC_ORIGIN`/`PRIVACY_URL`, published privacy status и consent version, staff auth mode (`allowlist` с numeric staff IDs или `group_members` с актуальной membership logic), отрицательный staff group ID.
- [ ] Webhook secret обязателен для webhook. Worker secret/token проверяются только если worker отдельно включён/требуется; worker не включать для базовых booking/contact.
- [ ] `LOCAL_FORM_DELIVERY_ENABLED` — только local и вторым явным opt-in; не использовать его как Production readiness.
- [ ] Никакие credentials не копируются между scopes; наличие значения не считается проверкой работоспособности.

## 3. Собрать и проверить candidate с indexing OFF

- [ ] Перед exposure выполнен чистый build с `INDEXING_ENABLED=false`.
- [ ] Проверены локали DE/RU/UK/TR, Impressum/Datenschutz, legal links, robots и standalone Release-6 artifact.
- [ ] Учтено: build-time flags требуют нового build/deployment; смена env после build не меняет уже сгенерированный HTML.
- [ ] На неизменённом кандидате не повторять тесты только ради знакомства. После изменения кода обязательны затронутые проверки и финальные `npm ci`, `npm test`, `npm run lint`, `npm run build`.
- [ ] Локальный итог текущего кандидата: 207 passed, 0 failed, 0 skipped; lint/build exit 0; шесть browser scripts и `phase2-accessibility.mjs` прошли с mocks. Это не deployed smoke.

## 4. Проверить actual target до мутаций

Только разрешённым безопасным GET/HEAD или approved inspection:

- [ ] `/api/trial-requests`: POST contract, canonical Origin, legal/readiness gates.
- [ ] `/api/telegram-webhook/`: slash/no-slash поведение совместимо с `trailingSlash=true`; destination не менять автоматически.
- [ ] `/api/telegram-ops/`: auth, Release-6 Preview guard; read-only check ничего не мутирует, mutation gate отдельный.
- [ ] `/api/telegram-worker/`: disabled/not used без отдельного решения.
- [ ] `/telegram-privacy/`, legal links, security headers, `X-Robots-Tag`, robots, sitemap и canonical наблюдались на actual target, а не выводились только из `vercel.json`.

## 5. Controlled smoke — только отдельно одобренные действия

- [ ] Static/legal smoke: locales, links, canonical origin, redirects.
- [ ] Form smoke: только если разрешён; один controlled request, validation/idempotency/uncertain state и согласованная обработка PII.
- [ ] Telegram smoke: только если разрешён; `/start`, booking/contact, staff auth/membership, reply/close/status.
- [ ] Webhook change, Redis observation и delivery mutation имеют отдельное разрешение. Mock, loopback и read-only ops не доказывают реальную доставку.

## 6. Раздельное включение

Каждый пункт ниже — самостоятельная мутация, не следствие другой:

- [ ] expose/assign Preview или Production alias;
- [ ] изменить Telegram webhook на проверенный target;
- [ ] включить hosted form delivery;
- [ ] включить другие delivery actions (worker обычно остаётся выключен);
- [ ] включить indexing последним.

Перед каждым действием заново сверить target, branch, SHA и rollback plan.

## 7. Indexing — только последним

Indexing остаётся OFF, пока не завершены functional/legal/safety checks. Политика fail-closed требует одновременно `INDEXING_ENABLED=true`, `VERCEL=1`, `VERCEL_ENV=production`, отсутствие non-production `VERCEL_TARGET_ENV` и canonical HTTPS `PUBLIC_ORIGIN`. Request origin также должен совпадать с canonical origin.

- [ ] Preview, local, noncanonical, API, standalone и Telegram privacy routes остаются noindex там, где это предусмотрено policy.
- [ ] Actual HTML meta, `X-Robots-Tag`, robots и sitemap проверены после нового production build.
- [ ] Отдельная финальная команда владельца на indexing получена; без неё flag не менять.

## 8. Rollback / STOP / итог

При ошибке или uncertain delivery: остановить дальнейшие мутации, сохранить redacted target/SHA/time/status, отключить relevant flags новым build/deployment, не blind-replay webhook или uncertain delivery. Alias/webhook removal делать только утверждённой процедурой.

Финальный delivery record должен содержать branch, remote SHA, exact project, команды и actual deployed checks, scopes/flags и отдельные разрешения, а также состояние alias/webhook/form delivery/indexing и оставшиеся blockers. Завершение checklist не заменяет явную команду владельца.
