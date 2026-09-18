# AK-LOEWEN

> **Текущая рабочая точка — Release 6.** Локальная ревизия прошла финальные тесты, но Production не запускался и deployed readiness не подтверждена. Начните с [RELEASE-6-CONTINUATION.md](docs/releases/RELEASE-6-CONTINUATION.md), затем сверяйте [RELEASE-6.md](docs/releases/RELEASE-6.md) и [launch checklist](docs/releases/RELEASE-6-LAUNCH-CHECKLIST.md).

Один репозиторий = один проект **AK-LOEWEN**: локализованный лендинг и legal-страницы, web-форма/API и Telegram booking/status/contact со staff flow. Telegram не является отдельным продуктом и не имеет отдельной нумерации.

## Релизы

| Релиз | Статус | Ветка | Примечание |
| --- | --- | --- | --- |
| Release 2 | исторический утверждённый baseline | `release-2` | landing |
| Release 3 | исторический Preview/WIP | `release-3` | не текущий source of truth |
| Release 5 | стабильный baseline | `release-5` | неизменный, SHA `c52e77dcde8548e00f2e6208b143dc87c37f811e` |
| **Release 6** | текущая локально проверенная подготовка | `release-6` | кандидат `f5c3660407a6bae1d66d5c3ea662fe5c119c5ea4`; Production не запускался |

## Быстрый маршрут

1. Ограничения, результаты и cloud blockers: [`docs/releases/RELEASE-6-CONTINUATION.md`](docs/releases/RELEASE-6-CONTINUATION.md).
2. Текущий release status: [`docs/releases/RELEASE-6.md`](docs/releases/RELEASE-6.md).
3. Будущий безопасный порядок запуска (не разрешение): [`docs/releases/RELEASE-6-LAUNCH-CHECKLIST.md`](docs/releases/RELEASE-6-LAUNCH-CHECKLIST.md).
4. Карта ownership: [`docs/architecture/AI-MAP.md`](docs/architecture/AI-MAP.md).
5. Разработка и локальные команды: [`docs/development/README.md`](docs/development/README.md).
6. Telegram: [`docs/integrations/telegram/README.md`](docs/integrations/telegram/README.md).

## Структура

- `site/` — deployment root и приложение;
- `docs/` — текущая документация и исторические release records;
- `archive/` — исторические материалы, не source of truth;
- `tools/` — инструменты разработки.

## Safety defaults

- Production, webhook, hosted form delivery и indexing выключены до отдельных решений владельца.
- Local form delivery требует двух явных flags; credentials сами по себе её не включают.
- Indexing production-only и default OFF; Preview и noncanonical hosts остаются `noindex, nofollow`.
- Worker/reminders — отключённая будущая capability, не требование для booking/contact.
- Секреты не хранятся в репозитории и не должны попадать в документацию или логи.

Исторические Release 2/3 документы сохранены для контекста и не разрешают действия в Release 6.
