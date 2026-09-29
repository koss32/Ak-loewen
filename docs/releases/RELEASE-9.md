# Release 9 — текущий статус

Дата: 29.09.2026. Ветка: `release-9`, продолжает `release-8`.

Релиз исправляет стартовую загрузку сайта: корневой адрес сразу перенаправляется на немецкую страницу `/de/`, поэтому сырой белый entry-screen больше не показывается. Тёмная тема стала стандартной для новых посетителей; ручной выбор светлой темы сохраняется. Языковые страницы остаются отдельными ссылками: `/de/`, `/ru/`, `/uk/`, `/tr/`.

## Проверки

- `npm run build` — успешно.
- Синтаксис изменённых JavaScript-файлов — успешно.
- Удалённых файлов в рабочем diff нет.

## Публикация

- Vercel-проект: `ak-loewen-release-a`.
- GitHub: ветка `release-9`, коммит `e925fdb` (`Release 9: fix entry redirect and default dark theme`).
- Vercel Preview: deployment `dpl_7unavRXKzC5xaRxBGqEVU9mV4bsE`, состояние `READY`, target `preview`.
- Preview URL: https://ak-loewen-release-i1sx6pxpn-zumeeeeer-6684s-projects.vercel.app/de/.
- Проверка Preview: корень отвечает `307 Location: /de/`, немецкая страница и standalone artifact отвечают `200`; Production не менялся.
- Production Release 8 остаётся без изменений до отдельной проверки Preview.
