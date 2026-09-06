# Лидерборд змейки (Cloudflare Worker)

Отдельный воркер для игры «Змейка» (VK Mini App). Данные изолированы от Fruit Blast — своё KV.
Лидерборд ведётся **только для режима «Гонка»** по категориям `race60`, `race90`, `race120`.

## Роуты
- `GET  /leaderboard?category=race60&limit=10` — топ игроков категории (кэш 5 мин).
- `GET  /rank?category=race60&vk_user_id=123` — место игрока в категории (кэш ~60 сек). Ответ: `{ success, rank, total, score }`.
- `POST /submit` — отправить рекорд. JSON: `{ vk_user_id, first_name, last_name, photo_100, score, category, vk_sign_params }`.
  Сервер сохраняет рекорд только если `score` выше прежнего для этого пользователя и категории.
- `POST /delete` — удалить пользователя категории. JSON: `{ vk_user_id, category }` (для отладки).

## Деплой
1. `npm i -g wrangler` (если ещё не установлен).
2. `wrangler login`.
3. Создать KV-неймспейс: `wrangler kv namespace create SNAKE_LB` — вставить полученный `id` в `wrangler.toml`.
4. Деплой: `wrangler deploy` — получить URL воркера (например `https://snake-leaderboard.<account>.workers.dev`).
5. Вставить URL в `../js/config.js` → `SNAKE_CONFIG.WORKER_URL`.

## Проверка
```powershell
curl "https://<url>.workers.dev/leaderboard?category=race60"
```

## Валидация подписи VK
**Рекомендуется** задать Client Secret как env-секрет воркера (не хранить в коде):
```powershell
wrangler secret put VK_CLIENT_SECRET
```
В ответ на запрос вставьте Client Secret из настроек VK Mini App
(Настройки → Кнопки и ссылки / Open API).

Пока секрет не задан — подпись не проверяется (режим разработки, воркер открыт для накрутки).