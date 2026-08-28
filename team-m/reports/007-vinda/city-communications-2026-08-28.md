---
agent: 007-vinda (Hub)
task: city-communications
status: delivered
updated: 2026-08-28
---

# 📡 КОММУНИКАЦИИ ЗА ГОРОДОМ · Пайплайн внешних сервисов beLive

> Разведка: 007_Винда + research-скаут (read-only, 28.08). Концепт: город beLiveBase питается от внешних коммуникаций — порты, электросеть, почта. Этот отчёт = карта всех труб города с дырами.
> Источник «как видно жителю»: секция Пайплайн 008 VISUAL-MAP. Источник «как есть в коде»: grep src/ + инвентарь воркеров.

---

## §1. ПАЙПЛАЙН ГЛАЗАМИ ЖИТЕЛЯ (008 VISUAL-MAP)

```
MVSEP(warn) → ПОРТ/DUO(ok) → Genius(ok) → lrclib(ok) → GetSongBPM(warn)
  → gateway-align(info: missing) → Telegram-бот(ok) → OpenRouter(ok)
  → Cloudflare(warn: аудит) → 🎤 beLive («сосуд наполняется»)
```

## §2. ИНВЕНТАРЬ СЕРВИСОВ В РЕПО (все — Cloudflare Workers)

| Сервис | Путь | Что это | Размер | Статус |
|---|---|---|---|---|
| **belive-gateway** | `gateway/` | Ядро коммуникаций: `/v1/chat/stream` (SSE-proxy→OpenRouter, ephemeral-токены, rate-limit), `/v1/align` (**MOCK**: provider:'mock', stub-v1, фейковые тайминги), `/api/feed*` (соцлента TC-101..109), `/api/metrics/*`, `/admin/operator-prompt`. KV×5 + D1×2 (feed, metrics). itty-router-free, 1 тест, 5 SQL-миграций. | ~2600 строк | ✅ жив (dist-new/dist-w2 от 22-23.06) |
| **belive-rehearsal** (суб-воркер) | `gateway/rehearsal/` | Durable Object RehearsalRoomDO, tickets HMAC. Клиент в `src/Rehearsal/`. | ~167 строк | ✅ жив, заготовка-плюс |
| **belive-auth** | `belive-api/` | Google OAuth: `/auth/google`→`/auth/callback`→JWT→редирект в APP_URL. | ~175 строк | ✅ жив (URL захардкожен фолбэком в src) |
| **belive-mvsep** | `belive-mvsep/` | Proxy к mvsep.com/api (submit/status/download/quota/cancel), JWT + лимит 10/день + concurrent-lock, заголовок X-Mvsep-User-Key. Один index.js + KV rate-limit. | 255 строк | ✅ жив. 🔴 **MVSEP_API_KEY plaintext в DEPLOY.md** |
| **belive-feed-bot** | `belive-feed-bot/` | TG-бот @BeLiveCommunity_bot (/catalog /track /start, ZIP→TG) + HTTP `/upload` (ZIP от клиента, API-key, magic-bytes, dedup по slug+contentHash→KV-каталог) + `/tracks`, `/download/:file_id`. Скрипты bulk-upload/fix-catalog. | ~870 строк | ✅ жив (deploy-20260627) |
| **belive-ai** | ❌ НЕТ В РЕПО | `VITE_AI_WORKER_URL` используется в src, но кода воркера не существует. | — | 🔴 отсутствует |

## §3. ТОЧКИ ВХОДА В КОДЕ ГОРОДА (src/ → внешний мир)

| Коммуникация | Кто зовёт в src/ |
|---|---|
| Gateway (AI/feed/metrics) | `src/js/ai/providers/gateway-provider.ts:3` · `src/sync/word-sync/config.ts:2` · `src/catalog/feed/feed-data.store.ts:8` · `src/services/metrics-sync.service.ts:69` · `src/main.tsx:782` |
| Align | `src/sync/word-sync/providers/gateway-align.provider.ts:21` → вызов `src/sync/components/SyncEditorPanel.tsx:513` (кнопка :1199) |
| OpenRouter напрямую | `src/js/ai/providers/openrouter-direct.provider.ts:9,95` · `src/components/AiSettingsModal.tsx:47` |
| AI-worker | `src/js/ai/providers/belive.provider.ts:9` · `src/main.tsx:793` |
| Auth | `src/services/auth.service.ts:2` · `src/components/AiSettingsModal.tsx:117` |
| MVSEP | `src/services/mvsep.service.ts:19,220,250,282` (+mvsep-polling.service.ts) · UI: UserRoom.tsx:178, OnboardingAccordion.tsx:101, scout.skill.ts:16 |
| TG-бот | `src/services/tg-upload.service.ts:4` (/upload) · `src/catalog/components/CatalogContent.tsx:14` (/tracks) · t.me share: FeedPostCard.tsx:98 |
| lrclib | `src/services/auto-lyrics.service.ts:1737,1813,2003` |
| GetSongBPM | `track-meta.service.ts:172` · TrackInfoBoard/ai-tools.ts:372 (api.getsong.co, **ключ в URL**) |
| LastFM | `cover-art.service.ts:9` · `track-meta.service.ts:94` |
| Genius | **API НЕТ** — только ссылка на поиск (UploadPanel.tsx:370) + парсер вставленного текста (blocks/parser/tagged-lyrics.parser.ts:137) |
| Rehearsal | `src/Rehearsal/services/signaling-client.ts:21` (VITE_REHEARSAL_SIGNALING_URL) · deep-link.service.ts:30 |

## §4. ENV-ПЕРЕМЕННЫЕ (.env.example)

`VITE_BASE_PATH` (деплой) · `VITE_LASTFM_API_KEY` (каверы/мета) · `VITE_GETSONGBPM_KEY` (BPM) · `VITE_AUTH_WORKER_URL` (OAuth) · `VITE_USE_MOCK_AUTH` (dev) · `VITE_GATEWAY_URL` (AI/feed/metrics/align; fail-loud после BAC-108) · `VITE_ENGINE` (v2/v3 — не сервис) · `VITE_AI_WORKER_URL` (belive-ai proxy).

## §5. ДЫРЫ КОММУНИКАЦИЙ (что чинить/строить)

| # | Дыра | Серьёзность | Факт |
|---|---|---|---|
| H1 | 🔴 **MVSEP_API_KEY plaintext** в `belive-mvsep/DEPLOY.md` | БЕЗОПАСНОСТЬ | Секрет в репо; ротация + зачистка истории по решению Босса |
| H2 | 🔴 **belive-ai воркер отсутствует** | P1 | `VITE_AI_WORKER_URL` зовётся из src (belive.provider.ts:9, main.tsx:793), кода нет |
| H3 | 🟡 `/v1/align` = **mock** | P2 | UI-вызов есть (SyncEditorPanel:513), бэкенд — stub-v1 с фейковыми таймингами; 008 «missing в UI» уточнён: кнопка есть, мозга нет |
| H4 | 🟡 `VITE_MVSEP_WORKER_URL`, `VITE_REHEARSAL_SIGNALING_URL` **нет в .env.example** | P2 | Используются в src; mvsep спасён хардкод-фолбэком |
| H5 | 🟡 Genius-пайплайн **ручной** (копипаст) | P3 | В пайплайне 008 помечен ok, но авто-API нет — только ссылка+парсер |
| H6 | 🟡 `METRICS_DB` в gateway/wrangler.toml: `database_id=""` | P2 | D1 не привязан — metrics-персистентность не работает |
| H7 | ⚪ GetSongBPM: ключ в URL + атрибуция=баг (008 warn) | P3 | api.getsong.co, ключ светится в запросе |
| H8 | ⚪ Cloudflare-аудит воркеров не проведён | P2 | 008 рек. #2: ждать скрины владельца; в репо 5 воркеров + 1 отсутствующий |
| H9 | ⚪ MVSEP API отложен → юзер-ключ (008 warn) | P3 | 008 рек. #4: возврат после аудита |

## §6. КАРТА КОММУНИКАЦИЙ ДЛЯ ГОРОДА (в ОТЧЁТ 1)

| Коммуникация | Роль в городе | Квартал-потребитель |
|---|---|---|
| MVSEP-порт | Склад сырья: трек → стемы | Завод Studio, Дом профиля |
| ПОРТ/DUO (zip) | Городские врата для грузов | Площадь Каталог |
| Genius (ручной) | Библиотекарь текстов | Завод Studio (TrackMap) |
| lrclib | Часовщик таймингов | Мастерская Sync (Lines) |
| GetSongBPM | Метроном города | Каталог (ДНК трека) |
| gateway-align | Настройщик синхронизации (МОК!) | Мастерская Sync |
| Telegram-бот | Почта/курьер | Площадь Каталог (Publish) |
| OpenRouter/gateway | Электростанция ИИ | Башня Билли, Ателье Styles, AI Config |
| Cloudflare | Облачная сеть города | Всё выше (5 воркеров) |
| Rehearsal DO | Телефонная станция для дуэтов | Башня Split (Студент-Педагог) |

## §7. ВЫВОД

1. **Коммуникации города в основном живы** (5 воркеров, все деплоены), но есть **1 красная дыра безопасности (H1)** и **1 отсутствующий воркер (H2)**.
2. **Align — бутафория** (H3): житель видит кнопку, за ней mock. Кандидат в «квесты города» (ОТЧЁТ 1 §6).
3. Для карты города пайплайн 008 = готовый слой «коммуникации за городом» — данные уже в VISUAL-MAP (`PIPE=[имя, описание, цвет]`), переносить в bLb-SNAPSHOT как есть + пометить дыры H1-H9 статусами.

---

*Все факты: grep/ls/чтение файлов 28.08. Frozen-файлы не читались. Ничего не изменено. 📡*
