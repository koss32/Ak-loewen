# Redirect: AK-LOEWEN Release 6

Это исторический filename, сохранённый как redirect. Не используйте старую Release 3 инструкцию и не создавайте отдельную схему handoff.

Текущие entry points:

- [`docs/releases/RELEASE-6-CONTINUATION.md`](docs/releases/RELEASE-6-CONTINUATION.md) — authoritative статус, ограничения, результаты и cloud blockers;
- [`docs/releases/RELEASE-6.md`](docs/releases/RELEASE-6.md) — release status;
- [`docs/releases/RELEASE-6-LAUNCH-CHECKLIST.md`](docs/releases/RELEASE-6-LAUNCH-CHECKLIST.md) — будущий порядок запуска, не разрешение на Production;
- [`README.md`](README.md) и [`docs/README.md`](docs/README.md) — текущие входные точки.

Локально проверенный кандидат: `f5c3660407a6bae1d66d5c3ea662fe5c119c5ea4`; фактический remote SHA после push должен быть записан отдельно в `DELIVERY.json`.

Точный связанный Vercel project установлен read-only: `ak-loewen-release-a` (`prj_0kG9RBjUgIn4UktNF1qYU0cCgRvU`), team `zumeeeeer-6684's projects` (`team_j4dElwkGk5L6ODyrhxQRW1N5`). Но release-6 deployment, production scopes, deployed routes/headers, Telegram delivery/webhook и Redis readiness не подтверждены. Среди 20 просмотренных deployments нет подтверждённого release-6; последний exact detail имеет состояние ERROR. Production branch в metadata — `Ak-loewen`, не `release-6`.

Не повторяйте успешные локальные проверки без изменения кода. Не выполняйте cloud mutations, реальные smoke actions, delivery, webhook, aliases или indexing без отдельной явной команды владельца. Worker/reminders остаются DISABLED/FUTURE и не требуются для базового bot flow.
