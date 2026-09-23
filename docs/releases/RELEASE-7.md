# Release 7 — текущий статус

Дата: 23.09.2026. Ветка: `release-7`, основана на `release-6` (`626be5ead2633b9d6a3fccb6c3ad4ad8007950c8`).

Релиз включает последние правки лендинга: кнопку заявки через Telegram-бота, контакт Анара в Telegram, оптимизированный логотип, обновлённую секцию цен и видимость фоновой анимации. Также обновлены проверки текущего сценария заявки бота.

Локальные проверки: `npm run build` и `npm run lint` — успешно; `npm test` — 215 успешно, 0 ошибок, 2 пропуска (на машине отсутствует Redis-server); браузерная проверка — 48 снимков, 0 замечаний; мобильная проверка локалей — 0 замечаний. Полный accessibility-скрипт не прошёл на простом локальном HTTP-сервере, потому что он проверяет заголовок `X-Robots-Tag`, который добавляет только Vercel middleware. Точный SHA опубликованного коммита и удалённые проверки фиксируются после доставки.

Vercel-проект: `ak-loewen-release-a` (team `team_j4dElwkGk5L6ODyrhxQRW1N5`, project `prj_0kG9RBjUgIn4UktNF1qYU0cCgRvU`).

## Публикация Preview

- GitHub: ветка `release-7`, SHA исходников `f88d832d519318a35e7c22aed20ed7ae40bcd6ec`.
- Vercel deployment: `dpl_mgzvuhUbVT9LjzNxj7hhsxjtCMg9`, состояние `READY`, target `Preview`.
- Адрес: https://ak-loewen-release-dph2ubsmt-zumeeeeer-6684s-projects.vercel.app/de/.
- Доставка веб-формы отключена build-time и runtime override `FORM_DELIVERY_ENABLED=false` только для этого деплоя: прежняя Preview-переменная включала доставку, но необходимые publication/consent/origin/chat-id настройки отсутствовали. Первые две попытки сборки остановились соответственно из-за неверной точки запуска CLI и fail-closed проверки формы.
- На опубликованном адресе DE/RU/UK/TR и Impressum отвечают 200; логотип и анимационный скрипт загружаются; `X-Robots-Tag: noindex, nofollow`; на телефоне и компьютере нет ошибок страницы и горизонтального переполнения. Telegram-кнопка и ссылка Анара присутствуют, форма имеет `data-live=false`.
- Production aliases по-прежнему указывают на предыдущий Release 6 deployment `dpl_3JHAVbWxoFWqQULhYC52xJJ11Yrb`. Webhook, Redis, indexing и реальная доставка не менялись и удалённо не проверялись.
