# Release 6 — текущий статус

**Дата обновления:** 18.09.2026. **Состояние:** подготовка Preview завершена по локальной ревизии; Production не запускался.

- Проект: `koss32/Ak-loewen`, рабочая ветка: `release-6`.
- Проверенный кандидат в этой рабочей копии: `f5c3660407a6bae1d66d5c3ea662fe5c119c5ea4`.
- Стабильная ветка `release-5` не изменяется: `c52e77dcde8548e00f2e6208b143dc87c37f811e`.
- Финальный remote SHA для доставки должен быть записан после push в `DELIVERY.json`; здесь не выдумывается SHA, которого ещё нет в remote.

## Что сделано

В Release 6 сохранены booking и web form, Telegram booking/status/contact со staff authorization и Redis-backed contact relay, локали DE/RU/UK/TR и утверждённая визуальная база. Worker/reminders остаются **DISABLED / FUTURE CAPABILITY** и не требуются для базовых booking/contact flows.

В текущем кандидате завершены точечные исправления Phase 2:

- единая строгая нормализация HTTPS `PUBLIC_ORIGIN`;
- отдельные legal/publication и env readiness gates формы, без подмены их Telegram privacy policy;
- полная same-provider Redis URL/token pair;
- два явных opt-in флага локальной form delivery;
- Preview target для Release 6 в Telegram ops и отдельный mutation gate;
- production-only indexing с default OFF; Preview, local, noncanonical и служебные маршруты остаются `noindex, nofollow`;
- переносимый browser launcher и актуальные browser assertions.

Секреты и реальные значения env в документацию не записывались.

## Проверки текущего кандидата

- `npm ci` — exit 0.
- `npm test` — **207 passed, 0 failed, 0 skipped**, включая локальный Redis; семь phase-2 indexing tests.
- `npm run lint` — exit 0.
- `npm run build` — exit 0.
- Шесть browser scripts и `phase2-accessibility.mjs` — успешно локально с mocks; реальная доставка не выполнялась.
- RU/UK/TR montage просмотрен: явного clipping не обнаружено. Это не полный accessibility/device audit.

Исторические отчёты и подробности предыдущего прогона: [continuation](RELEASE-6-CONTINUATION.md), [runtime audit](release-6-evidence/runtime-audit.md), [browser report](release-6-evidence/browser-report.md). Старые цифры Phase 1/Phase 2 в них сохраняются как исторические и не заменяют результаты выше.

## Cloud и Production: что пока заблокировано

Read-only аудит точно установил Vercel project:

- team `zumeeeeer-6684's projects`, ID `team_j4dElwkGk5L6ODyrhxQRW1N5`;
- project `ak-loewen-release-a`, ID `prj_0kG9RBjUgIn4UktNF1qYU0cCgRvU`;
- GitHub link `koss32/Ak-loewen`.

Сверенные настройки: root `site`, build `npm run build`, output `dist`, Node `24.x`. Remote production branch — `Ak-loewen`, не `release-6`; metadata auto-deployment (`createDeployments=enabled`) расходится с checked-in `site/vercel.json` (`git.deploymentEnabled=false`). Среди 20 просмотренных deployment records подтверждённого deployment из `release-6` нет; последний exact detail — `ERROR`, ref `ksyusha`, SHA `731ebcfdfae96bf371e70d061c9903ddf9664cb`.

В env metadata найдено 34 записи: все target `preview`, старые scopes `release-3`/feature и без branch; Production и `release-6` scope не подтверждены. Наличие env name не доказывает валидность credentials. Deployed routes/headers, Redis, Telegram membership, webhook, form delivery, aliases и indexing не проверялись и не изменялись.

## Следующий шаг

Этот документ — release status, не разрешение на запуск. При будущей отдельной команде владельца использовать [RELEASE-6-LAUNCH-CHECKLIST.md](RELEASE-6-LAUNCH-CHECKLIST.md): сначала подтвердить candidate SHA и cloud target, затем controlled smoke с отдельными разрешениями; indexing включать последним. До этого Production, webhook, delivery, aliases и indexing остаются выключенными.
