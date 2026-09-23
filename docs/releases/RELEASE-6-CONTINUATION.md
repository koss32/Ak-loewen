# AK-LOEWEN Release 6 — актуальная передача

**Обновлено:** 18.09.2026. Эта запись заменяет промежуточную инструкцию передачи. Реальные cloud mutations и Production launch не выполнялись.

## 1. Текущая точка

- Репозиторий `koss32/Ak-loewen`, работать только в `release-6`.
- Локально проверенный кандидат отчёта от 18.09.2026: `f5c3660407a6bae1d66d5c3ea662fe5c119c5ea4`. Проверенный remote HEAD на 23.09.2026: `a77a4cc464c1f1aec3604d3a262e139447bc7bb0`. Поздние коммиты этим отчётом не проверены.
- `release-5` — неизменяемый baseline `c52e77dcde8548e00f2e6208b143dc87c37f811e`.
- Проверка remote HEAD не означает delivery или deployment. При будущей доставке фиксировать её фактический SHA отдельно; не выдавать локальный SHA за deployed.
- Production не запускался. Не менять домены/aliases, production branch/secrets, webhook, delivery или indexing без отдельной явной команды владельца.

## 2. Неподвижные ограничения и факты

Brand: `AK-LOEWEN`; legal: `AK-LOEWEN gGmbH`. Тренер: Namih Aliyev / Намиг Алиев. Registered: Parallelstraße 6, 42719 Solingen; training: Werwolf 8, 42651 Solingen; Geschäftsführer: Dietrich Schmelzer; register: Amtsgericht Wuppertal, HRB 36478. Локали DE/RU/UK/TR.

Не публиковать секреты или значения env. Не отправлять реальные заявки/Telegram-сообщения и не изменять пользовательский Redis в рамках локальной проверки. Не добавлять cron, QStash, scheduler или собственный сервер. Loopback server используется только для тестов. Worker/reminders — **DISABLED / FUTURE CAPABILITY**; они не являются требованием базовых booking/contact flows.

## 3. Что реализовано в текущем кандидате

Сохранены web form/API и Telegram booking/status/contact, staff authorization, group routing и Redis contact relay (reply/close/new ticket), idempotency и обработка ошибок. В Phase 2 реализованы:

- строгая общая нормализация HTTPS `PUBLIC_ORIGIN` (без path/query/credentials; loopback разрешён только в предназначенном local test path);
- form legal/publication и required-env readiness отдельно от Telegram privacy readiness;
- complete same-provider Redis URL/token pair;
- два явных local form delivery opt-ins, поэтому унаследованные credentials сами по себе не включают локальную отправку;
- Release-6 Preview guard для Telegram ops и отдельный gate для mutations;
- production-only indexing, default OFF, с fail-closed noindex для Preview/noncanonical/local/service routes;
- browser portability and updated assertions.

Код `site/server/bot-config.js` подтверждает: worker secret/token проверяются только при включённом/требуемом worker; базовый bot readiness не делает worker обязательным. `BOT_WORKER_ENABLED` и `BOT_REMINDERS_ENABLED` должны оставаться false, если отдельная будущая capability не разрешена.

## 4. Новая проверка кандидата

- `npm ci`: exit 0.
- `npm test`: **207 passed, 0 failed, 0 skipped**, локальный Redis включён; семь phase-2 indexing tests.
- `npm run lint`: exit 0.
- `npm run build`: exit 0.
- `browser.mjs`, `form-browser.mjs`, `mobile-locales.mjs`, `portrait-browser.mjs`, `outcomes.mjs`, `build-review.mjs` и `phase2-accessibility.mjs`: успешно локально с mocks.
- RU/UK/TR montage просмотрен без очевидного clipping. Это не полный accessibility, PRIDE или device audit; mocks не доказывают реальную доставку.

Исторические доказательства и старые результаты сохранены в [release-6-evidence/runtime-audit.md](release-6-evidence/runtime-audit.md) и [browser-report.md](release-6-evidence/browser-report.md). Не нужно повторять их без изменения соответствующего кода; после дальнейших изменений повторяются только затронутые проверки и финальный suite.

## 5. Read-only cloud findings

Точный связанный Vercel project найден, поэтому старое утверждение «project identity BLOCKED» больше не актуально:

- team `zumeeeeer-6684's projects`, ID `team_j4dElwkGk5L6ODyrhxQRW1N5`;
- project `ak-loewen-release-a`, ID `prj_0kG9RBjUgIn4UktNF1qYU0cCgRvU`, GitHub `koss32/Ak-loewen`;
- root `site`, build `npm run build`, output `dist`, Node `24.x`.

Остающиеся blockers точны: production branch `Ak-loewen` не `release-6`; remote auto-deploy metadata enabled, тогда как checked-in `git.deploymentEnabled=false`; среди 20 просмотренных deployments нет подтверждённого `release-6`, последний exact deployment — `ERROR`, ref `ksyusha`; 34 env records имеют только `preview` target и старые scopes (`release-3`, feature, без branch), Production/release-6 scope отсутствуют. Deployed routes/headers, valid credentials, Redis, Telegram membership, webhook и delivery не подтверждены.

## 6. Будущее действие

До отдельной команды «Запускай production» ничего не активировать. При такой команде идти по [RELEASE-6-LAUNCH-CHECKLIST.md](RELEASE-6-LAUNCH-CHECKLIST.md): зафиксировать remote SHA, сверить project/branch/scopes, собрать candidate с indexing OFF, выполнить только отдельно одобренный smoke, раздельно разрешить alias/webhook/form delivery и включить indexing последним. Worker/reminders и scheduler не добавлять.
