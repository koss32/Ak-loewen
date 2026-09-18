# AK-LOEWEN Release 6 — инструкция следующему агенту Astra 6

Дата передачи: 18.09.2026. Владелец: Vitalii Kostiukov.

> Это промежуточная передача по прямой просьбе владельца. Phase 1 завершена и одобрена. Phase 2 разрешена и начата, но НЕ завершена. Предыдущий агент остановил разработку, сохранил browser-исправления и доказательства проверок. Не выдавай текущую ветку за production-ready и не начинай всё заново.

## 1. Первые действия — без повторного аудита с нуля

1. Открой `DELIVERY.json` в архиве передачи или сообщение владельцу: там точный SHA промежуточного push. В GitHub работай с `koss32/Ak-loewen`, ветка **`release-6`**. Сверь HEAD с этим SHA; если владелец/другой агент уже добавил commits, сначала изучи новые изменения и не перезаписывай их.
2. Стабильная `release-5` должна оставаться на `c52e77dcde8548e00f2e6208b143dc87c37f811e`. Phase 1 была отправлена отдельным commit `f82f9e6b38a8ddc1e652566bfb6fe2d28159e294`; промежуточная передача идёт поверх него, не от старой `release-5`.
3. Прочитай этот файл, `RELEASE-6.md`, `release-6-evidence/runtime-audit.md`, `release-6-evidence/browser-report.md`, env inventory и текущий код указанных ниже модулей. README/docs старых Release 3/4 местами устарели — это известная оставшаяся задача, не источник разрешений на deployment.
4. **Не повторяй уже успешные тесты на неизменённых файлах только ради знакомства.** Используй журнал в разделе 5. Новые регрессии и финальный прогон после будущих изменений необходимы — старый результат не доказывает качество новой ревизии.
5. Продолжай оставшиеся TASK 5–8 в порядке ниже. Не запрашивай повторное одобрение Phase 1: владелец уже написал «продолжай». Однако production и любые неоговорённые действия всё ещё требуют отдельной явной команды.

## 2. Неизменяемые ограничения

- Изменять только `release-6`. Не трогать `release-5`, default branch, не создавать PR, не merge и не force-push.
- **Не запускать production**, не менять домены/aliases, production branch, indexing, production secrets, не активировать webhook и delivery без отдельного явного разрешения владельца. Разрешение на TASK 5–8 = подготовка, НЕ запуск.
- Никаких cron, QStash, minute worker, external scheduler, собственного сервера или миграции. Runtime остаётся Vercel. Локальный loopback server для тестов — не hosting.
- Reminders/worker — **DISABLED / FUTURE CAPABILITY**. Не удалять архитектуру полностью, не делать её launch requirement.
- Визуальная база Release 5 утверждена. Не делать редизайн, не переписывать юридические тексты без доказанной необходимости. Исправлять реальные дефекты точечно.
- Не отправлять реальные тестовые заявки/Telegram-сообщения и не менять Redis пользователя под видом read-only аудита. Сначала отдельный согласованный deployed smoke plan.
- Не публиковать реальные секреты в коде, логах, отчётах, screenshots, архиве или чате. Наличие env не равно валидности credentials.

### Факты проекта

Brand `AK-LOEWEN`; legal `AK-LOEWEN gGmbH`. Не возвращать в runtime/UI `AK Löwen` / `AK LÖWEN`.

Тренер: **Namih Aliyev / Намиг Алиев**. Русское «Намиг» правильно; не менять на «Намих». Технические исторические filenames могут отличаться — не переименовывать изображения без обновления всех связей.

Registered: Parallelstraße 6, 42719 Solingen. Training: Werwolf 8, 42651 Solingen. Geschäftsführer: Dietrich Schmelzer. Email: aklggmbh@gmail.com. Phone: +49 157 30447730. Register: Amtsgericht Wuppertal, HRB 36478. Локали DE/RU/UK/TR.

## 3. Что уже сделано в Phase 1 — не переделывать

### Telegram и контакт

- После `/start` две основные функции: заявка на пробную тренировку и связь с командой. Status/language/help/FAQ — вторичные.
- Сохранены booking, confirm/reject/reschedule/cancel/status, trainer-group routing и staff authorization.
- `server/contact-copy.js`: естественные локализованные тексты DE/RU/UK/TR.
- `server/telegram-contact.js`: отдельный от booking lightweight ticket/conversation flow. Redis хранит OPEN/CLOSED, несколько клиентов/диалогов, клиентские follow-up и ответы тренеров.
- Клиент пишет текст → бот доставляет в trainer group карточку с минимальным контекстом, языком и ticket ID. Личных контактов тренера клиент не получает.
- Trainer нажимает Reply, затем пишет обычный текст; per-trainer state выбирает ticket. Клиент получает ответ **от бота**. Conversation остаётся OPEN. Проверяется актуальный membership, а не только прежняя авторизация.
- Close закрывает ticket, обновляет staff cards, очищает reply state и отменяет ожидающие доставки ticket. Устаревший случайный ответ не отправляется. Клиент может начать новый ticket.
- Обработаны duplicate updates/callbacks, retry, unauthorized/lost membership, closed/stale ticket, blocked client, Telegram errors/rate limits/uncertain delivery.
- Сохранена update-idempotency. Добавлены bounded backlog и compaction terminal contact history для ограничения общего Redis snapshot. Uncertain delivery не следует слепо переотправлять: это может создать дубликат.
- Staff chat должен быть отрицательным group/supergroup ID и в allowlist, и в group-members режиме.

### Сайт / reminders

- Web form и `/api/trial-requests` сохранены; Telegram не обязателен для web booking.
- Telegram CTA ведёт к plain bot entry (`https://t.me/ak_loewenbot`) без старого `start=site_question`.
- Booking/contact/status работают без worker. `.env.example` оставляет `BOT_WORKER_ENABLED=false` и `BOT_REMINDERS_ENABLED=false`; пользовательские обещания автоматических reminders убраны. Код будущей capability сохранён.
- Deployed env не менялись. Не утверждать, что реальные облачные значения уже проверены или выключены.

## 4. Что добавлено в начатой Phase 2

**Runtime-код Phase 2 пока НЕ менялся.** Изменены только browser-тесты и затем документы передачи:

- Новый `site/tests/helpers/browser.mjs`: launcher через `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` либо стандартный cache Playwright.
- `browser.mjs`, `form-browser.mjs`, `mobile-locales.mjs`, `portrait-browser.mjs`, `outcomes.mjs`: убран жёсткий путь к Windows Chrome.
- Исправлены устаревшие ожидания уже утверждённого UX: phone как исходное contact поле, optional time в раскрываемых details, общая VALSET форма и optional Instagram, no-JS POST.
- `build-review.mjs` и `outcomes.mjs` находят фактически собранный standalone artifact вместо старых v1/release-3 имен; outcome mocks синхронизируются с перехваченными запросами.
- Проведён read-only аудит конфигурации и env, результаты сохранены. Исправления по этому аудиту **ещё не реализованы**.

Маленькая известная незавершённость: fallback error message нового browser helper всё ещё предлагает пример `npx playwright@1.55.0 install chromium`. Этот пример не совпал с locked revision в текущем окружении. При следующем изменении helper замени подсказку на **`node node_modules/playwright-core/cli.js install chromium`**. Сам успешный запуск использовал правильную locked revision.

## 5. Реестр проверок — использовать, а не повторять без причины

### Phase 1, commit `f82f9e6…`

- `npm ci` — успешно, 0 найденных vulnerabilities в том запуске.
- `npm test` — **189 tests, 189 pass, 0 fail, 0 skipped**. Включён настоящий локальный Redis CAS/restart test; Telegram network и membership в тестах моделируются.
- `npm run lint` — успешно.
- `npm run build` — успешно: 4 локализованные страницы, legal pages, standalone review artifact.
- Новые Phase 1 тесты: `phase1-contact.test.js`, `phase1-contact-redis.test.js`, `phase1-site.test.js`; существующие Telegram regression tests обновлены. Покрыты main menu, сохранённый booking/web POST, contact/reply/close/new ticket, parallel clients/trainers, auth/membership, duplicate update, stale closed reply, локали, отсутствие worker-зависимости.

### Phase 2, текущие browser-файлы промежуточной передачи

- Подготовка окружения: `npm ci` успешно; package.json/package-lock.json не менялись.
- `npm test` — **189/189 passed**. Лог `evidence/phase-2/browser-artifacts/npm-test.log` в архиве; exit code записан отдельно.
- `npm run build` для browser QA — успешно. Runtime/build-код не менялся.
- `node tests/browser.mjs` — успешно: desktop 1440×1000, phone 390×844, compact 360×640, reduced-motion; layout/images/anchors/accordions/mobile menu/locale retention/demo no-POST/VALSET/no-JS POST, без page errors или HTTP >=400; 48 screenshots.
- `node tests/form-browser.mjs` — успешно: root locale preference, DE/RU/UK/TR, one-contact validation, retention полей, optional time, zero demo POSTs.
- `node tests/mobile-locales.mjs` — успешно: RU/UK/TR 360×640, overflow report `[]`.
- `node tests/portrait-browser.mjs` — успешно: утверждённые responsive Namig assets, 390 и 1440.
- `node tests/outcomes.mjs` — успешно: **mocked/local** success/error/uncertain/pending/retry, тот же request ID для retry, standalone legal/assets, HTTP size/origin guards. Реальной отправки не было.
- `node tests/build-review.mjs` — успешно: standalone содержит trainer assets, локали в demo mode.
- Сводный DE screenshot sheet действительно визуально просмотрен: явного clipping не обнаружено, секции/тренеры/цены/форма/контакты/VALSET/legal присутствуют. RU/UK/TR screenshots созданы и автоматические проверки прошли, **отдельно вручную они не просмотрены**. Не считать это полным accessibility/PRIDE/device audit.
- `git diff --check` промежуточных browser-изменений — успешно.

**Не запускалось / не подтверждено:** Phase 2 lint после `.mjs` изменений; полноценный финальный suite на будущей исправленной ревизии; реальные Vercel project settings/env scopes; deployed headers/routes; реальные Upstash/Telegram webhook/delivery/group membership. Не называть их passed.

### Правило повторов

Не тратить время на повтор вышеуказанных успешных проверок, если соответствующий код не менялся. Если среда новая, `npm ci` нужен для подготовки зависимостей — это не новый аудит. После исправлений TASK 5/6 запусти затронутые tests, затем обязательный финальный `npm ci && npm test && npm run lint && npm run build` и релевантные browser regressions. Отдельно укажи, на каком новом commit они выполнены.

## 6. Точная оставшаяся работа

### TASK 5 — Vercel / production readiness

1. Заверши read-only доступ Vercel и найди именно проект, связанный с `koss32/Ak-loewen`. Не угадывай team/project IDs. Сверь root `site`, build `npm run build`, output `dist`, Node >=24, branch и действующие deployment settings с репозиторием. `site/vercel.json` уже содержит `git.deploymentEnabled=false`; не меняй это для удобства.
2. Проверь реальные env **по именам, типам и scopes**, не выгружая секреты: Preview / Production / branch-specific overrides. Наличие значения не доказывает его работоспособности. Не активируй flags и не копируй secrets между scopes.
3. Раздели env на REQUIRED FOR LAUNCH / OPTIONAL / DISABLED-FUTURE с точными требованиями для form и bot; используй inventory как начальный список, проверяй текущий код. Добавь отсутствующий в `.env.example` `TELEGRAM_STAFF_AUTH_MODE` с понятным описанием allowlist/group_members без смены выбранной владельцем модели. Negative trainer group ID обязателен; allowlist требует staff IDs, group_members — существующую membership/admin логику.
4. Проверь `/api/trial-requests`, `/api/telegram-webhook`, `/api/telegram-worker`, `/api/telegram-ops`, privacy URL и security headers. Нельзя объявлять их deployed-проверенными только на основе `vercel.json`. Особое внимание slash/no-slash при `trailingSlash:true`: Telegram webhook URL должен отвечать корректно без нежелательного redirect. Не выполняй live POST для проверки без отдельного согласования.
5. `FORM_DELIVERY_ENABLED` влияет на **build-time HTML** и runtime API. Простая смена env после build не обновляет форму: в launch plan необходим новый build/deployment.
6. Исправь подтверждённые конфигурационные дефекты минимальными изменениями и тестами — см. audit. Не раскрывай форму отправки до корректных legal/privacy/required-env условий.

### Кандидаты на исправления из runtime-аудита — сначала подтвердить семантику

- `server/telegram-ops.js` содержит hard-coded preview origin/privacy URL/`release-3`. Обновить guards для выбранного Release 6 target с fail-closed безопасностью, не просто удалить ограничения. Read-only check и mutating ops чётко разделить; никакие setWebhook/worker ops здесь не запускать.
- `PUBLIC_ORIGIN` trailing slash: bot validator принимает его, а form API сравнивает Origin буквально и build конкатенирует URL. Ввести согласованную строгую нормализацию HTTPS origin, протестировать trailing slash, malformed URL, path/query/credentials, Origin mismatch и canonicals. Не вводить wildcard origins.
- Form endpoint валидирует Redis/env менее строго, чем bot. Проверить полный URL/token pair, HTTPS и безопасное отсутствие конфигурации. Сохранить idempotency, uncertain state и server-side validation.
- Form readiness пока gate только `FORM_DELIVERY_ENABLED`; сопоставить с реальной privacy publication/version моделью. Добавить доказанный readiness guard, не сломав обычный POST и legal consent semantics. Это аудиторский finding, не основание механически скопировать Telegram policy в web flow без анализа.
- `site/server.js` локально включает delivery по наличию token/chat и legal source, игнорируя `FORM_DELIVERY_ENABLED`. Добавить явный безопасный opt-in; тесты должны доказывать, что случайно унаследованные credentials не отправляют реальные сообщения.

### TASK 6 — SEO / legal / focused cleanup / docs

1. Indexing сейчас выключен сразу в `vercel.json` header, robots.txt, root/localized HTML meta. Безопасного единого launch switch ещё нет. Подготовить понятный явный production-only switch (например `INDEXING_ENABLED`, окончательное решение за следующим агентом), default OFF; Preview должен оставаться noindex/nofollow даже при ошибочной общей настройке. Согласовать HTML/HTTP headers/robots/canonical/sitemap; не обещать, что env автоматически изменит статический `vercel.json`. Добавить negative tests для Preview и default.
2. Проверить Impressum, Datenschutz, Telegram privacy против фактов раздела 2. Не изобретать юр.тексты и не менять утверждённую consent version без необходимости и согласования.
3. Проверить runtime/UI branding, Namih/Намиг, старые preview URLs/release-3/release-4 references, gloves/dead assets/runtime imports/broken links. Отличать исторический документ или стабильный CSS/asset filename от неверного runtime текста. Не выполнять массовые переименования.
4. Обновить README, docs/README, architecture/development/integration docs и текущий release status. Старые Release 2/3 материалы оставить явно историческими. Reminder docs привести к DISABLED/FUTURE, без scheduler как требования запуска. Сейчас build log/standalone filename ещё говорят Release 4 — это не было исправлено в промежуточной передаче.

### TASK 7 — финальная стабилизация

- После исправлений: реальные локальные `npm ci`, `npm test`, `npm run lint`, `npm run build`; разобрать failures, не отключать tests и не ослаблять assertions ради зелёного результата.
- Сохранить Telegram booking/contact/reply/close/staff auth/status/cancel/confirm/reject/reschedule/duplicates/Redis/webhook error coverage.
- Browser QA переносимо: запустить затронутые шесть scripts с новым локальным build/server, добавить недостающее для конкретных fixes. Дополнить точечную проверку PRIDE, accessibility basics, legal links и визуальный просмотр RU/UK/TR; не выдавать предыдущие automated checks за полный ручной аудит.
- Отдельным списком оставить всё, что требует реального deployed runtime и/или разрешённого smoke-сценария. Не считать mocks доказательством успешной доставки.

### TASK 8 — финализация, НЕ запуск

1. Только после стабилизации обновить README/docs/release status.
2. Создать `docs/releases/RELEASE-6-LAUNCH-CHECKLIST.md` простым языком: exact target project/branch/SHA, required env и scopes, build-time flags, deployment до включения indexing, PUBLIC_ORIGIN/privacy, отдельно разрешённые alias/domain/webhook/delivery actions, smoke form + booking + contact/reply/close, indexing **последним**, rollback и условия STOP. Не копировать пример checklist буквально, если порядок создаёт доступную публике полуработающую систему.
3. Launch checklist должен позволить следующему агенту действовать по будущей команде «Запускай production», но сам эту команду не заменяет. Worker/reminders и bridge остаются disabled, не добавлять scheduler.
4. Push только `release-6`, без merge/default/force. Проверить remote commit, неизменность `release-5` и совпадение загруженных файлов. Дать владельцу branch/SHA/actual tests/known limitations/точные оставшиеся действия до production. При необходимости оставить явно blocked, а не «одна кнопка», если реальные Vercel/runtime проверки не завершены.

## 7. Подключения и среда

### Tasklet

В исходной среде исходники: `/tasklet/threads/a_4acdybzhw360hyyfe079/work/repo`; не Git worktree. Runnable `/tmp/ak-release6` — ephemeral synthetic local Git snapshot для diff, не настоящий clone с историей GitHub. **Не использовать его synthetic SHA в отчётах**. Новая среда может не содержать `/tmp`, packages/Chromium/Redis придётся установить заново.

GitHub connection `conn_7pfphncge55dw88x8wbs`: approved, push в существующую ветку доступен. Пользователь разрешал браузер GitHub только для создания ветки, но ветку создал сам; это не общее разрешение browser-access.

Vercel connection `conn_qvbt9abck4v5m33xrwn1` с названием `Vercel Read Only` создан пользователем перед передачей. **Название не гарантирует техническую read-only политику**: фактически CONNECTION.md перечисляет GET, POST, PATCH, PUT, хотя исходно был запрошен только GET. Инструмент `remote_http_call` ещё требует approval. Рабочих Vercel API-запросов предыдущий агент не делал. Использовать исключительно GET; не считать создание подключения проверкой project/env/deployment.

Для доступа в новой Tasklet-среде сначала прочитать manifest и CONNECTION.md, при необходимости добавить это подключение и запросить разрешение. Не предполагать, что ID доступны другому агенту. Не собирать токен заново и не просить его в чат. После подключения объяснить владельцу возможность sharing; не включать sharing без согласия.

Официальные read-only API ориентиры — `release-6-evidence/vercel-api-reference.md`: base `https://api.vercel.com`, GET `/v10/projects`, `/v9/projects/{idOrName}`, `/v10/projects/{idOrName}/env`, teamId/slug и pagination. Уточнить текущую schema до вызова. Не использовать endpoint decrypted env, не логировать value fields. Для scope/config аудита достаточно имён/targets/branch и нужных явно несекретных flags.

### Локальные команды, когда понадобятся новые проверки

Рабочая директория — `site/`, Node >=24. Не ставить node_modules в cloud-backed `/tasklet/.../work`; подготовить `/tmp` checkout. Для Redis integration нужен локальный `redis-server` (без credentials пользователя).

```sh
npm ci
node node_modules/playwright-core/cli.js install chromium
# При нехватке библиотек Linux:
node node_modules/playwright-core/cli.js install-deps chromium
```

Не ставить отдельно произвольную версию Playwright: browser revision должен соответствовать package-lock. Можно задать `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` к совместимому executable.

Для browser QA нужен свежий loopback server без реальных secrets. До исправления local delivery guard особенно важно убрать `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID_AK` из окружения. Build standalone до build-review; убрать старые generated standalone artifacts, чтобы glob не выбрал прежнюю версию.

```sh
npm run build
PORT=4173 node server.js
# В другом терминале, с тестовыми mocks, не real delivery:
TEST_BASE_URL=http://127.0.0.1:4173 TEST_OUTPUT=/tmp/ak-browser-artifacts node tests/browser.mjs
TEST_BASE_URL=http://127.0.0.1:4173 node tests/form-browser.mjs
TEST_BASE_URL=http://127.0.0.1:4173 node tests/mobile-locales.mjs
TEST_BASE_URL=http://127.0.0.1:4173 node tests/portrait-browser.mjs
TEST_BASE_URL=http://127.0.0.1:4173 node tests/outcomes.mjs
node tests/build-review.mjs
```

Screenshots staging делать в `/tmp`, затем копировать завершённые артефакты в постоянное хранилище. Сервер остановить после проверки. Команды здесь — инструкция для будущих изменений, не просьба повторить уже пройденную QA прямо сейчас.

## 8. Что находится в передаче

- GitHub `release-6`: весь проект с сохранённой историей, Phase 1, текущими browser-исправлениями и этой инструкцией.
- Архив: `source/` — рабочие исходники с public assets и docs; исторический `archive/` репозитория не выгружался и доступен в GitHub. `preview/` — standalone локальный preview Phase 1 (runtime Phase 2 не изменён), без реальной отправки.
- `evidence/phase-1/` — финальные ci/test/lint/build logs Phase 1.
- `evidence/phase-2/` — audits/env inventory/browser report/logs/exit codes/screenshots, включая 48 screenshot frames и DE contact sheet.
- `historical-tasklet-scripts/` — использованные служебные скрипты для воспроизводимости истории. **Не запускать их вслепую**: часть скриптов изменяет файлы или выполняет GitHub push и привязана к старым путям/connection IDs.
- `DELIVERY.json` — точный промежуточный SHA, stable/Phase 1 SHA, состав передачи и границы verification. `SHA256SUMS` — контроль целостности файлов архива.

Никаких tokens, production secrets, node_modules или облачных credential-данных в архиве нет. Проверки actual Vercel/Telegram/Redis не приписывать этой передаче. Сначала продолжи оставшиеся доказанные задачи, затем отчитайся владельцу и дождись отдельной команды на production.
