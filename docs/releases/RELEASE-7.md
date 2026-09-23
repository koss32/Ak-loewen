# Release 7 — текущий статус

Дата: 23.09.2026. Ветка: `release-7`, основана на `release-6` (`626be5ead2633b9d6a3fccb6c3ad4ad8007950c8`).

Релиз включает последние правки лендинга: кнопку заявки через Telegram-бота, контакт Анара в Telegram, оптимизированный логотип, обновлённую секцию цен и видимость фоновой анимации. Также обновлены проверки текущего сценария заявки бота.

Локальные проверки: `npm run build` и `npm run lint` — успешно; `npm test` — 215 успешно, 0 ошибок, 2 пропуска (на машине отсутствует Redis-server); браузерная проверка — 48 снимков, 0 замечаний; мобильная проверка локалей — 0 замечаний. Полный accessibility-скрипт не прошёл на простом локальном HTTP-сервере, потому что он проверяет заголовок `X-Robots-Tag`, который добавляет только Vercel middleware.

Vercel-проект: `ak-loewen-release-a` (team `team_j4dElwkGk5L6ODyrhxQRW1N5`, project `prj_0kG9RBjUgIn4UktNF1qYU0cCgRvU`).

## Публикация Preview

- GitHub: ветка `release-7`, SHA исходников `f88d832d519318a35e7c22aed20ed7ae40bcd6ec`.
- Vercel deployment: `dpl_mgzvuhUbVT9LjzNxj7hhsxjtCMg9`, состояние `READY`, target `Preview`.
- Адрес: https://ak-loewen-release-dph2ubsmt-zumeeeeer-6684s-projects.vercel.app/de/.
- Доставка веб-формы отключена build-time и runtime override `FORM_DELIVERY_ENABLED=false` только для этого деплоя: прежняя Preview-переменная включала доставку, но необходимые publication/consent/origin/chat-id настройки отсутствовали. Первые две попытки сборки остановились соответственно из-за неверной точки запуска CLI и fail-closed проверки формы.
- На опубликованном адресе DE/RU/UK/TR и Impressum отвечают 200; логотип и анимационный скрипт загружаются; `X-Robots-Tag: noindex, nofollow`; на телефоне и компьютере нет ошибок страницы и горизонтального переполнения. Telegram-кнопка и ссылка Анара присутствуют, форма имеет `data-live=false`.
- Этот Preview не назначался основному адресу. Webhook, Redis, indexing и реальная доставка не менялись в ходе Preview и удалённо не проверялись.

## Production

- GitHub HEAD при сборке: `69d979507970be12fd185c3f83f3a00b1f89bf52`; функциональные изменения зафиксированы в родительском коммите `f88d832d519318a35e7c22aed20ed7ae40bcd6ec`.
- Vercel deployment: `dpl_HXVakL8Ju5EP36umTgVNv6tKwzAh`, target `production`, `READY`.
- Основной адрес: https://ak-loewen-release-a.vercel.app/de/. Alias `ak-loewen-release-a-zumeeeeer-6684s-projects.vercel.app` указывает на тот же deployment.
- Production env перед запуском прошёл локальную redacted проверку `assessFormConfig`: `ready=true`, errors пусты. `INDEXING_ENABLED=false`. Секреты и фактические env-значения не публиковались.
- Удалённая проверка: главная, DE/RU/UK/TR, Impressum, Datenschutz, логотип, анимационный скрипт и standalone Release 7 отвечают 200; везде `X-Robots-Tag: noindex, nofollow`. DE-форма имеет `data-live=true`, но реальная заявка не отправлялась. Браузерные проверки при 390 и 1440 px: 0 ошибок страницы, 0 горизонтального переполнения, нужные Telegram-ссылки присутствуют.
- Реальная отправка формы, входящий webhook, Telegram staff flow и Redis в Production не проверялись во избежание создания настоящих заявок/сообщений. Вебхук и переменные бота уже были включены до этого деплоя; здесь их не меняли.
