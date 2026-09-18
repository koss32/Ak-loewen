# Release 6 — промежуточная передача

Статус на 18.09.2026: **Phase 1 завершена и одобрена; Phase 2 начата, но НЕ завершена. Production не запускался.** По просьбе владельца дальнейшая разработка остановлена для передачи следующему агенту Astra 6.

- Проект: `koss32/Ak-loewen`.
- Стабильная ветка: `release-5`, неизменяемый baseline `c52e77dcde8548e00f2e6208b143dc87c37f811e`.
- Рабочая ветка: `release-6`.
- Завершённая Phase 1: `f82f9e6b38a8ddc1e652566bfb6fe2d28159e294`.
- Текущая промежуточная версия: commit, содержащий этот файл; точный SHA также указан в сообщении передачи и `DELIVERY.json` внешнего архива.

## Продолжение

**Начать с [RELEASE-6-CONTINUATION.md](RELEASE-6-CONTINUATION.md).** Это специально запрошенная владельцем инструкция для следующего агента: ограничения, проверенное состояние, оставшиеся TASK 5–8, порядок выполнения и границы тестовых доказательств.

## Завершено

Phase 1: Telegram main menu с booking/contact; Redis-backed многосообщенчатый contact relay с Reply/Close и текущей staff authorization; существующий booking/web form сохранён; Telegram CTA исправлены; reminders/worker disabled по умолчанию без удаления архитектуры; DE/RU/UK/TR.

В начатой Phase 2 изменены только browser-тесты: переносимый запуск Chromium, актуализация устаревших ожиданий формы и поиска standalone artifact. Runtime/frontend-дизайн, API, Vercel-конфигурация и env в Phase 2 ещё не исправлялись. Документы передачи добавлены отдельно, не означают завершение TASK 6/8.

## Реально выполненные проверки

| Проверка | Результат и область |
| --- | --- |
| Phase 1 `npm ci` | Успешно |
| Phase 1 `npm test` | 189 passed, 0 failed, 0 skipped; включая локальный Redis CAS/restart |
| Phase 1 `npm run lint` | Успешно на Phase 1 |
| Phase 1 `npm run build` | Успешно на Phase 1 |
| Phase 2 подготовка `npm ci` | Успешно; зависимости не менялись |
| Phase 2 `npm test` | 189/189 passed; лог в архиве передачи |
| Phase 2 browser/form-browser/mobile-locales/portrait-browser/outcomes/build-review | Все шесть скриптов успешно выполнены локально; подробности в [browser-report.md](release-6-evidence/browser-report.md) |
| Phase 2 `npm run build` для browser QA | Успешно; runtime/build-код остался Phase 1 |
| Phase 2 `npm run lint` после изменений `.mjs` | **Не запускался**; не переносить статус Phase 1 lint на эти изменения |
| Проверка deployed Vercel/Telegram/Redis | **Не выполнялась** |

Успешные проверки на неизменённом коде не нужно повторять только ради передачи. После дальнейших изменений нужны затронутые регрессии и финальные команды TASK 7.

## Не завершено

TASK 5: реальные настройки Vercel/env scopes/API/Redis/webhook не проверены. Создано подключение Vercel, но рабочий API-доступ ещё не одобрен и не использован.

TASK 6: найдены устаревшие ops guards и docs/branding/reference pointers; не реализован безопасный indexing switch; нужны точечные проверки Origin/privacy/form readiness/local delivery guards.

TASK 7: локальное browser QA пройдено; полного финального прогона после будущих исправлений ещё нет. Реальные deployed проверки остаются отдельными.

TASK 8: промежуточная передача не является финализацией. Финальный `RELEASE-6-LAUNCH-CHECKLIST.md` намеренно **не создан**, чтобы не выдавать незавершённую readiness за готовность к запуску.

Аудит по коду: [runtime-audit.md](release-6-evidence/runtime-audit.md). Это список наблюдений и кандидатов на исправление, а не доказательство deployed-состояния.
