# Telegram activation plan — AK-LOEWEN Release 6

Это план будущей контролируемой активации, а не разрешение менять cloud configuration. До отдельной команды владельца ничего не включать, не менять webhook и не отправлять реальные сообщения.

## Preconditions

1. Зафиксировать проверенный Release-6 candidate SHA. `release-5` и default branch не менять.
2. Через разрешённый read-only Vercel access подтвердить точный project identity, root `site`, build/output, Node version, branch and env scopes. Если project ID или deployed target не подтверждены — STOP.
3. Проверить metadata env без values. Наличие secret не доказывает его работоспособность.
4. Подтвердить canonical HTTPS `PUBLIC_ORIGIN`, legal/privacy publication и exact consent version. Для web form отдельно пройти `FORM_*` readiness.
5. Подготовить rollback: known prior webhook destination (если он действительно подтверждён), способ выключить flags и сделать новый build/deployment. Не восстанавливать webhook вслепую после uncertain delivery.
6. Получить **явную команду на launch** и отдельный согласованный smoke plan. Checklist не заменяет это разрешение.

## Безопасный порядок

### 1. Candidate без indexing

Собрать и проверить candidate с `INDEXING_ENABLED=false`. Сначала подтвердить legal output, form readiness, API guards и Telegram configuration. Новый build обязателен после изменения build-time env.

### 2. Controlled readiness smoke

Только после отдельного разрешения выполнить минимальный согласованный smoke на контролируемом Preview/target. Реальная Telegram webhook смена затрагивает пользователей текущего бота и требует отдельного permission + rollback. Не считать mock или локальный test заменой deployed smoke.

### 3. Раздельные действия

Владелец отдельно разрешает, в нужном порядке и с наблюдением:

- alias/public exposure;
- Telegram webhook change;
- web form delivery;
- worker, если когда-либо будет согласован и действительно нужен;
- indexing — только последним.

Одно действие не является разрешением на остальные. Worker/reminders не включать как условие обычного booking/contact и не создавать scheduler.

### 4. Indexing последним

Перед indexing повторно проверить:

- Production runtime, canonical HTTPS origin и отсутствие preview/custom target;
- HTML meta, request-time `X-Robots-Tag`, robots и sitemap;
- API, standalone review artifact и Telegram Privacy остаются noindex;
- alias и legal/privacy links работают на согласованном target.

Только затем, с отдельной явной командой, выставить `INDEXING_ENABLED=true` в нужном Production scope и сделать новый build/deployment. Preview должен оставаться noindex.

## STOP conditions

Остановиться при любом из следующих признаков:

- project/branch/target не совпадает или не подтверждён;
- нет canonical `PUBLIC_ORIGIN`, privacy/legal gate или required env scope;
- найден trailing slash/path/query/credential mismatch;
- webhook уже указывает на неизвестную среду;
- smoke дал uncertain delivery, duplicate или непонятный status;
- требуется secret value, decrypted env или изменение Production без явного разрешения.

## Rollback

При проблеме сначала выключить соответствующие flags и выполнить новый build/deployment; не полагаться на изменение env без rebuild для статического output. Для webhook восстановление допустимо только на заранее подтверждённый известный destination и после отдельного разрешения. Не повторять uncertain delivery вслепую: это может создать duplicate.

After-action должен содержать candidate SHA, фактические checks, изменённые scopes/actions и остаточные blockers. Не записывать credentials.
