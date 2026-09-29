# Release 8 — текущий статус

Дата: 29.09.2026. Ветка: `release-8`, продолжает `release-7`.

Релиз включает обновлённую систему scroll-анимаций: 15 разных entrance-профилей, синхронные профили для визуальных пар, запуск у границы viewport и отдельную хореографию для карточек, текста, изображений и композиции AK-LOEWEN × VALSET. Фоновая PRIDE-анимация не изменялась.

## Проверки

- `npm run build` — успешно.
- `npm run lint` — успешно.
- `npm test` — 215 успешно, 0 ошибок, 2 пропуска: локально отсутствует `redis-server`.
- Удалённые файлы в рабочем diff отсутствуют; изменения ограничены текущим релизным кодом, документацией и тестовыми идентификаторами Release 8.

## Публикация

- Vercel-проект: `ak-loewen-release-a`.
- GitHub: ветка `release-8`, коммит `6d7b815` (`Release 8: refine scroll animation system`).
- Vercel Preview: deployment `dpl_UERF3XQfr6U9BGspWQSTXXzXTzjv`, состояние `READY`, target `preview`.
- Preview URL: https://ak-loewen-release-ee2iet5ds-zumeeeeer-6684s-projects.vercel.app/de/.
- На Preview главная и standalone Release 8 отвечают `200`; `X-Robots-Tag: noindex, nofollow`. Form delivery отключена build-time override `FORM_DELIVERY_ENABLED=false`; Production не менялся.
- Production Release 7 остаётся без изменений до отдельной проверки Preview.
