# Лидерборд змейки (Cloudflare Worker)

Отдельный воркер для игры «Змейка» (VK Mini App). Данные изолированы от Fruit Blast — своё KV.
Лидерборд ведётся для режима «Гонка» (`race60`, `race90`, `race120`) и «Бесконечной»
по скоростям (`endless_slow`, `endless_normal`, `endless_fast`).

## Роуты
- `GET  /leaderboard?category=race60&limit=10` — топ игроков категории (кэш 5 мин).
- `GET  /rank?category=endless_normal&vk_user_id=123` — место игрока в категории (кэш ~60 сек). Ответ: `{ success, rank, total, score }`.
- `POST /submit` — отправить рекорд. JSON: `{ vk_user_id, first_name, last_name, photo_100, score, category, vk_sign_params }`.
  Сервер сохраняет рекорд только если `score` выше прежнего для этого пользователя и категории.

Категории ограничены белым списком `race60 / race90 / race120 / endless_slow / endless_normal / endless_fast`.
Очки — целое число: для Гонки не больше `длительность × 6`, для Бесконечной — не больше 225
(столько клеток на поле 15×15). Длина имени ограничена 64 символами, аватар принимается только
по `http(s)`-ссылке. На отправку действует лимит раз в 3 секунды на пользователя и категорию.

## Деплой
1. `npm i -g wrangler` (если ещё не установлен).
2. `wrangler login`.
3. Создать KV-неймспейс: `wrangler kv namespace create SNAKE_LB` — вставить полученный `id` в `wrangler.toml`.
4. Деплой: `wrangler deploy` — получить URL воркера (например `https://snake-leaderboard.<account>.workers.dev`).
5. Вставить URL в `../js/config.js` → `SNAKE_CONFIG.WORKER_URL`.

## Проверка
```powershell
curl "https://<url>.workers.dev/leaderboard?category=race60"
curl "https://<url>.workers.dev/rank?category=race60&vk_user_id=123"
```

## Валидация подписи VK
**Настоятельно рекомендуется** задать Client Secret как env-секрет воркера (не хранить в коде):
```powershell
wrangler secret put VK_CLIENT_SECRET
```
В ответ на запрос вставьте Client Secret из настроек VK Mini App
(Настройки → Кнопки и ссылки / Open API).

Пока секрет не задан — подпись не проверяется, и воркер принимает рекорды от любого клиента
(режим разработки). После установки секрета `vk_sign_params` становится обязательным,
а подпись проверяется по алгоритму VK (HMAC-SHA256 по отсортированным launch-параметрам).
Дополнительно `vk_user_id` из подписанной строки должен совпадать с `vk_user_id` в теле
запроса — иначе 403, чтобы нельзя было отправить рекорд за другого игрока.

## Удаление записей
Публичного `/delete` больше нет: раньше любой мог удалить чужой рекорд по `vk_user_id`.
Для ручного удаления используйте wrangler:
```powershell
wrangler kv key delete --namespace-id=<id> --remote "user:race60:<vk_user_id>"
wrangler kv key delete --namespace-id=<id> --remote "_index:race60"
wrangler kv key delete --namespace-id=<id> --remote "_rank:race60"
```
