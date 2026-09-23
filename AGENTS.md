# AK-LOEWEN — правила проекта

## Модель проекта

В репозитории находится один продукт **AK-LOEWEN**:

- лендинг и локализованные страницы;
- backend/API, включая web-форму пробной тренировки;
- Telegram-интеграция для booking, статуса и связи с командой.

Telegram — часть приложения, а не отдельный проект и не отдельная линия релизов.

## Текущий релиз

- `release-5` — стабильный утверждённый baseline: `c52e77dcde8548e00f2e6208b143dc87c37f811e`.
- `release-6` — единственная рабочая ветка текущего продолжения. Кандидатный SHA берётся из проверенного HEAD финальной передачи; synthetic SHA не используется.
- Перед изменениями сверяйте `origin/release-6` с GitHub и отделяйте текущий HEAD от SHA старых проверок. Ветка по умолчанию `Ak-loewen` — навигация, а не исходник текущего лендинга.
- `RELEASE-2.md` и `RELEASE-3.md` — исторические записи, не текущий source of truth.
- Статус, ограничения и доказательства текущего релиза: `docs/releases/RELEASE-6.md`, `RELEASE-6-CONTINUATION.md` и `release-6-evidence/`.

Не создавайте отдельные версии для сайта, бота, handoff, preview или подсистем.

## Обязательные границы

- Не менять `release-5`, default branch, aliases или Production.
- Не делать deployment, не включать Production delivery, Telegram webhook, scheduler, reminders или indexing без отдельной явной команды владельца.
- Не отправлять реальные заявки, Telegram-сообщения или менять Redis во время локальной проверки.
- Не записывать секреты в Git, документацию, логи, screenshots или отчёты. Наличие переменной окружения не доказывает работоспособность credentials.
- Worker/reminders — `DISABLED / FUTURE CAPABILITY`; scheduler не является требованием запуска.
- Не переписывать утверждённые legal-тексты и не менять факты, брендинг, тренеров, цены, расписание, адреса и контакты без подтверждения.
- Не выдавать локальные mocks, unit-тесты или наличие env за deployed readiness.

## Структура и маршрутизация изменений

- `site/` — исполняемое приложение и deployment root.
- `site/src/data.js` — фактические данные и legal state.
- `site/src/locales.js`, `site/src/*-copy.js` — copy локалей.
- `site/src/render.js`, `site/src/render-final.js` — разметка.
- `site/public/` — браузерные assets и поведение.
- `site/api/` — HTTP boundaries Vercel.
- `site/server/` — runtime, validation, Redis, Telegram и form services.
- `site/server/indexing-config.js` — единая политика indexing/robots/sitemap.
- `site/middleware.js` — request-time `X-Robots-Tag`, robots и canonical-host gate через Vercel proxy entrypoint.
- `site/build.js` — очищает и генерирует `dist`, localized/legal pages, robots и standalone Release 6 review artifact.
- `site/tests/` — тесты всего приложения.
- `docs/` — текущая документация; `archive/` — только исторический материал; `tools/` — development tools.

## Indexing и readiness

Indexing по умолчанию выключен. Для indexable output одновременно нужны `INDEXING_ENABLED=true`, настоящий Vercel Production runtime (`VERCEL=1`, `VERCEL_ENV=production`, без непроизводственного target), валидный canonical HTTPS `PUBLIC_ORIGIN` и запрос именно с этого origin. Preview, local, custom/noncanonical hosts, API, review artifact и Telegram Privacy остаются noindex.

Web-form readiness — отдельная политика: `FORM_DELIVERY_ENABLED`, legal publication/version, canonical origin, отрицательный Telegram group ID и полная same-provider Redis URL/token pair. Локально дополнительно требуется `LOCAL_FORM_DELIVERY_ENABLED=true`; одних унаследованных credentials недостаточно.

## Документация

Начинайте с `README.md`, затем `docs/README.md`, текущих release-6 документов и relevant integration/development map. Исторические Release 2/3 документы сохраняются и должны быть явно прочитаны как история. Не создавайте новый handoff/version scheme: обновляйте существующие current documents.
