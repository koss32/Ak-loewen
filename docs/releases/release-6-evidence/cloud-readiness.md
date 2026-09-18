# Vercel cloud readiness — Release 6 TASK5

Проверено: `2026-09-18T19:57:34Z`. Аудит выполнен только через разрешённое read-only соединение; выполнены только GET-запросы (identity, teams, projects, project metadata, environment metadata, deployment list и exact deployment detail). POST/PATCH/PUT/DELETE, deployment/alias/domain changes, webhook/form/Redis/Telegram operations и decrypted environment endpoint не использовались. Значения environment variables, токены и raw API responses не сохранялись.

Официальные схемы: [REST API overview](https://vercel.com/docs/rest-api), [projects list](https://vercel.com/docs/rest-api/projects/retrieve-a-list-of-projects), [project metadata](https://vercel.com/docs/rest-api/projects/find-a-project-by-id-or-name), [project env metadata](https://vercel.com/docs/rest-api/projects/retrieve-the-environment-variables-of-a-project-by-id-or-name), [deployment list](https://vercel.com/docs/rest-api/deployments/list-deployments), [deployment detail](https://vercel.com/docs/rest-api/deployments/get-a-deployment-by-id-or-url).

## Точно найденный scope

- Team: `zumeeeeer-6684's projects`; ID `team_j4dElwkGk5L6ODyrhxQRW1N5`; slug `zumeeeeer-6684s-projects`.
- Project: `ak-loewen-release-a`; ID `prj_0kG9RBjUgIn4UktNF1qYU0cCgRvU`.
- GitHub link: `koss32/Ak-loewen` (repo ID `1366037866`). Это единственный найденный точный repo-linked project; personal и team listing указывали на один и тот же ID.
- Live settings: project root `site`, Node `24.x`, build command `npm run build`, output `dist`, framework `null`/не выбран, function region `iad1`.
- Remote Git setting returned `gitProviderOptions.createDeployments=enabled`. В репозитории `site/vercel.json` указано `git.deploymentEnabled=false`; это обнаруженное расхождение, удалённо ничего не менялось.
- Remote linked `productionBranch` — `Ak-loewen`, а не `release-6`.

## Deployments

- `GET /v6/deployments` вернул 20 последних deployment records.
- Самый новый проверенный exact detail: `dpl_D1QyzhY1n9wPUEUmBqKRrusy9URp`, host `ak-loewen-release-p9ucpu7di-zumeeeeer-6684s-projects.vercel.app`, state `ERROR`, GitHub ref `ksyusha`, source SHA `731ebcfdfae96bf371ae70d061c9903ddf9664cb`.
- Deployment с точной веткой `release-6` среди последних 20 не найден: наличие Release-6 deployment и его source SHA не подтверждено. Локальный SHA намеренно с remote deployment не сопоставлялся и deployed не объявляется.
- Exact deployment detail вызван только для безопасной проверки metadata; routes/header metadata в возвращённом и whitelisted результате не присутствуют.

## Environment metadata (без значений)

`GET /v10/projects/{id}/env` вернул 34 записи (23 различных имени). Все записи имеют target `preview`; production target не обнаружен. Скоупы по metadata: `release-3` — 16 записей, `feature/telegram-native-care-2026-09-14` — 10, без branch — 8. Скоуп `release-6` отсутствует.

Сравнение с текущим `site/.env.example` (31 ожидаемое имя):

- отсутствуют в Vercel metadata: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `INDEXING_ENABLED`, `FORM_PUBLICATION_STATUS`, `FORM_CONSENT_VERSION`, `LOCAL_FORM_DELIVERY_ENABLED`, `TELEGRAM_OPS_PREVIEW_ORIGIN`, `TELEGRAM_OPS_MUTATIONS_ENABLED`, `BOT_REMINDERS_ENABLED`, `WEB_TELEGRAM_BRIDGE_ENABLED`, `WEB_TELEGRAM_BRIDGE_SECRET`;
- присутствуют в Vercel, но отсутствуют в текущем example: `KV_URL`, `REDIS_URL`, `KV_REST_API_READ_ONLY_TOKEN`.

Безопасно зафиксированы только явно plaintext boolean flags (для остальных `unknown`): в preview metadata `FORM_DELIVERY_ENABLED=false`; `BOT_ENABLED=true`, `BOT_WEBHOOK_ENABLED=true`, `BOT_WORKER_ENABLED=true` (в старых `release-3` и feature scopes). `INDEXING_ENABLED` отсутствует, поэтому его значение неизвестно, а не `false`. Для encrypted/sensitive/plain non-boolean values значение не извлекалось. Наличие metadata не доказывает работоспособность credentials или готовность delivery.

## Локальная проверка

- `node --version`: `v24.21.0`.
- `npm run build` в `site/`: успешно; сгенерированы 4 локали, legal pages, root entry и Release-6 standalone artifact в `dist/`.
- Generated `dist/robots.txt` остаётся fail-closed (`Disallow: /`), страницы содержат `noindex,nofollow`.

## Blockers / вывод

1. Нет подтверждённого deployment из `release-6`; последний remote deployment — `ERROR` и ref `ksyusha`.
2. GitHub/Vercel production branch настроена как `Ak-loewen`, не `release-6`.
3. Environment metadata относится к preview и старым веткам; production/release-6 scope отсутствует.
4. Remote auto-deployment setting (`enabled`) расходится с checked-in `git.deploymentEnabled=false`.
5. Не подтверждены Release-6 form/privacy readiness vars, local opt-in, ops preview target и production-only indexing switch; production readiness и возможность launch не доказаны.

Этот файл и `work/evidence/vercel-audit.json` — только read-only evidence. Production launch, indexing, Telegram delivery и любые Vercel mutations требуют отдельной явной команды владельца.
