# 🔍 RECON-REPORT · TASK-FEEDBOT-TRACK-SYNC · от 006 · 24.08

**Тема:** Отвалился Telegram-бот, который давал клиенту синхронизацию «какие треки у нас есть» (`GET /tracks`).
**Статус:** Разведка завершена. Root cause найден (regression после рефактора). Готов [@PROPOSAL] для 007.
**Frozen-check:** `belive-feed-bot/` НЕ в frozen-зоне (frozen = src/audio/core/AudioEngineV2.ts, patchV1, bridges/*, track.orchestrator.ts, private `_`). Править можно, но 006 — read-only ⇒ только предложение.

---

## 1. Что это вообще такое (архитектура)
- Бот = Cloudflare Worker `belive-feed-bot` (`belive-feed-bot.nikitosss007.workers.dev`), токен `@BeLiveCommunity_bot`.
- **Telegram = файловое хранилище** (Bot API `sendDocument` → `file_id`); **KV `EPHEMERAL_KV` (id `bd9b1fdb…`) = метаданные треков**.
- Клиент `src/catalog/components/CatalogContent.tsx:117` делает `fetch(TG_API_URL/tracks)` → получает список треков (это и есть «синхронизация какие треки есть»). Upload идёт через `src/services/tg-upload.service.ts` → `POST /upload`.
- Спецификация «стилегии»: **`docs/telegram/bot-catalog-integration.md`** (статус 🟢 active). Там задумано: `/tracks` читает ТОТ ЖЕ KV-каталог, что пишет бот.

## 2. 🔴 ROOT CAUSE — рассинхрон KV-ключей (курилка «стилегии»)
В коде **ТРИ разных соглашения ключей KV**, а `GET /tracks` читает только ОДНО:

| # | Кто пишет | Ключ KV | Читает ли `/tracks`? |
|---|-----------|---------|----------------------|
| A | `GET /tracks` (index.ts:45) | читает префикс **`track_data:t:`** | — (сам читатель) |
| B | `POST /upload` (index.ts:239, клиент battle-vocals) | пишет **`track_data:t:<uuid>`** | ✅ ДА |
| C | `cmdUploadType` (commands.ts:289/291, **бот приём ZIP**) | пишет **`track_data:<slug>`** + **`track_data:catalog`** | ❌ НЕТ |
| D | `scripts/bulk-upload.ts:122/134` (массовая заливка) | пишет **`track_data:<slug>`** + **`track_data:catalog`** | ❌ НЕТ |

**Следствие:** любой трек, добавленный **через Telegram-бота** (админ шлёт ZIP → выбор типа → `cmdUploadType`) или **массово** (`bulk-upload.ts`), попадает в `track_data:<slug>`/`track_data:catalog`, которые `/tracks` **никогда не читает**. ⇒ клиент получает `total:0, tracks:[]` ⇒ «синхронизация какие треки есть» пуста/отвалилась.
При этом `track_data:catalog` (массив, который бот аккуратно поддерживает) — **осиротел**: его не читает ни `/tracks` (читает `track_data:t:`), ни `/catalog` бота (читает СТАТИЧЕСКИЙ массив `TRACKS` из `data/tracks.ts`, см. п.4).

## 3. 🟠 ДОКАЗАТЕЛЬСТВО REGRESSION (git)
- `git blame belive-feed-bot/src/index.ts:45` → строка чтения `track_data:t:` появилась в **`1388c57` (SECPUB-03+04a, 2026-06-28)** «KV append-only + UUID».
- `git log -S "track_data:catalog" -- commands.ts` → бот пишет `track_data:catalog` ещё с **`8eff92b`** (исходная интеграция) и НЕ мигрирован.
- `git log -S "track_data:t:" -- index.ts` → `8f5e47e` (TC-104 contentHash) + `1388c57` (SECPUB).
- **Вывод:** до 2026-06-28 `/tracks` и бот писали в ОДИН каталог (работало). После рефактора `/upload` (HTTP) перевели на append-only `track_data:t:`, а **бот-путь оставили на старых ключах** ⇒ расхождение. Это и есть «скорее всего в стилегии» — сломалась стратегия согласования ключей.

## 4. 🟡 ВТОРИЧНЫЕ (усугубляют/могут быть причиной)
- **CORS mismatch (index.ts):** OPTIONS (строки 26-37) динамически разрешает `localhost/127.0.0.1/192.168.*/app.mybelive.com`, а реальный ответ `GET /tracks` (строки 56-59) **жёстко хардкодит `Access-Control-Allow-Origin: https://app.mybelive.com`**. Если клиент на не-prod origin → preflight проходит, но чтение ответа браузер блокирует ⇒ `tgError=true` ⇒ пустой каталог. Латентная, проявляется при смене origin.
- **`EPHEMERAL_KV` — имя буквально «ephemeral».** Если namespace пересоздавался/очищался (последний деплой `20260627`, сейчас авг) — `track_data:t:*` пусты ⇒ `/tracks` пуст. Данные теряются, и даже re-seed через `bulk-upload.ts` НЕ поможет (он пишет осиротелые `track_data:<slug>`).
- **Коллизия ID (commands.ts:274):** `cmdUploadType` генерит `id = lp-${catalog.length+1}` → `lp-01..lp-52`, **совпадает со статичным `TRACKS`** (Papercut=lp-01 и т.д.). Концептуальное затирание.
- **`/catalog` бота показывает статику**, а не реальный KV-каталог ⇒ даже в Telegram бот не отражает загруженное.
- **Shape-расхождение путей записи:** HTTP `/upload` пишет `id: usr-<uuid>`, `fileIds:{[stemType]:fileId}`; бот пишет `id: lp-NN`, `fileIds:{instrumental,full}`. Клиент дедупит по `slug` (CatalogContent:144) — ок, но `id` нестабилен.

## 5. Где описано в доках (цитаты)
- **`docs/telegram/bot-catalog-integration.md`** — каноничная спецификация «стилегии» (архитектура, endpoints, KV namespace id, деплой через CF Dashboard, TG Upload Flow). Описывает `/tracks` и `/upload` как единый каталог — НЕ фиксирует расхождение ключей (док не обновлён под SECPUB/TC-104).
- `NEW-SONNET-MEGA-PACK.md:38634` — `TG_API_URL = '…/tracks'`; `:22989` — «Отправка ZIP … в Telegram каталог (belive-feed-bot)»; `:2173` — «CORS каталога … известный backlog (CatalogContent.tsx:117)».
- `docs/sync/MASTER-SYNC-REGISTRY.yaml:393-407` — упоминание TG Upload Flow и `belive-feed-bot/src/index.ts`.

## 6. 💡 РЕКОМЕНДАЦИЯ (для 007 → Operator), два варианта
**Вар.1 (быстрый анблок, 1 файл, низкий риск):** в `index.ts` `GET /tracks` читать **объединение** `track_data:t:*` + `track_data:catalog` (dedup по `slug`). Сразу оживляет бот- и bulk-загрузки без правки путей записи. Минус: две «правды» в KV остаются.
**Вар.2 (правильный):** мигрировать `cmdUploadType` (commands.ts:289/291) и `bulk-upload.ts` на запись `track_data:t:<id>` (тот же префикс, что читает `/tracks`), убрать осиротелый `track_data:catalog` (или сделать его индексом). Плюс:
  - CORS: привести ACAO `GET /tracks` к динамическому (как в OPTIONS) — см. п.4.
  - `cmdUploadType`: генерить UUID-id вместо `lp-NN` (коллизия).
  - `/catalog` бота: читать реальный каталог (union) вместо статичного `TRACKS`.
  - Проверить, не пуст ли `EPHEMERAL_KV` (возможно нужен re-seed после фикса ключей).

**Verdict 006:** причина «отвалилась» = regression ключей (п.2-3). Вар.1 даёт быстрый возврат синхронизации; Вар.2 — чистое решение. Оба НЕ трогают frozen-зоны.
