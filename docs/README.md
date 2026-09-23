# Документация AK-LOEWEN

Документация относится к одному приложению **AK-LOEWEN**: лендинг, web booking/API и Telegram-интеграция.
Текущая рабочая ветка — `release-7`, код — `site/`. Ветка по умолчанию `Ak-loewen` служит навигацией; `release-5` — историческая стабильная база. Перед работой сверяйте удалённый HEAD, а результаты проверок — с конкретным коммитом.

## Текущая точка

- [`releases/RELEASE-7.md`](releases/RELEASE-7.md) — актуальный status record.
- [`releases/RELEASE-6.md`](releases/RELEASE-6.md) — исторический status record.
- [`releases/RELEASE-6-CONTINUATION.md`](releases/RELEASE-6-CONTINUATION.md) — фактическая передача, ограничения, проверки и cloud blockers.
- [`releases/RELEASE-6-LAUNCH-CHECKLIST.md`](releases/RELEASE-6-LAUNCH-CHECKLIST.md) — простой safety-порядок будущего запуска; не разрешение и не доказательство deployed readiness.
- [`releases/release-6-evidence/`](releases/release-6-evidence/) — датированные evidence и inventory; исторические результаты не заменяют новый аудит.

Для Release 7 проект Vercel: `ak-loewen-release-a`. Фактический статус новой публикации указывается в [RELEASE-7.md](releases/RELEASE-7.md); старые отчёты не доказывают её работоспособность.

## Релизы и разделы

- [`releases/RELEASE-2.md`](releases/RELEASE-2.md) — исторический baseline.
- [`releases/RELEASE-3.md`](releases/RELEASE-3.md) — исторический Preview/WIP, не source of truth.
- [`integrations/telegram/README.md`](integrations/telegram/README.md) — роль, архитектура и safety defaults.
- [`integrations/telegram/SETUP.md`](integrations/telegram/SETUP.md) — конфигурация без секретов.
- [`integrations/telegram/ACTIVATION.md`](integrations/telegram/ACTIVATION.md) — будущая активация с отдельными разрешениями.
- [`integrations/telegram/VERIFICATION.md`](integrations/telegram/VERIFICATION.md) — проверки и unverified items.
- [`architecture/AI-MAP.md`](architecture/AI-MAP.md) — ownership.
- [`development/README.md`](development/README.md) — Node 24, build и local QA.
- [`legal/TELEGRAM-PRIVACY.md`](legal/TELEGRAM-PRIVACY.md) — legal source.

`archive/` и старые Release 2/3 материалы исторические. Не использовать их для разрешения Production, изменения legal facts или cloud configuration.
