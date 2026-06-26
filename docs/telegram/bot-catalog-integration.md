# 🤖 Telegram Bot — Catalog Integration

**Статус:** 🟢 active
**Репозиторий:** `belive-feed-bot/` (отдельный Worker)
**Worker URL:** `https://belive-feed-bot.nikitosss007.workers.dev`

## Суть

Telegram-бот предоставляет каталог треков (52 трека Linkin Park) для скачивания в beLive. Пользователь выбирает треки через поиск в CatalogLayout → ZIP скачивается через `/download/<file_id>` → распаковывается через ZIP pipeline.

## Архитектура

```
Telegram Bot (belive-feed-bot)        beLive PWA (app.mybelive.com)
┌──────────────────────┐              ┌──────────────────────┐
│  /tracks (GET)       │◄────CORS────►│  CatalogLayout.tsx   │
│  /download/:fileId   │  fetch       │  Поиск → ↓ click    │
│  (CORS: app.mybelive)│              │  → fetch /download   │
│                      │              │  → handleZip()       │
│  KV: track metadata  │              │  → PORT progress     │
│  file_ids → TG files │              │  → IDB saveTrack()   │
└──────────────────────┘              └──────────────────────┘
```

## Команды бота

| Команда | Описание |
|---------|----------|
| `/start` | Приветствие + инструкция |
| `/catalog` | Показать каталог треков (52 шт) |
| `/track <slug>` | Информация о треке + скачать |
| `/cancel` | Отменить текущую операцию |
| `/upload` | Загрузить ZIP → file_id → KV |

## API Endpoints (Worker)

### `GET /tracks`
Возвращает JSON со всеми треками:
```json
{
  "tracks": [
    {
      "id": "file_id_string",
      "title": "In the End",
      "artist": "Linkin Park",
      "slug": "in-the-end",
      "type": "2stem",
      "fileIds": {
        "instrumental": "zip_file_id",
        "full": "zip_file_id"
      },
      "fileSize": 12345678,
      "fileName": "Linkin Park - In the End.zip"
    }
  ]
}
```

### `GET /download/:fileId`
Прокси-скачивание ZIP файла из Telegram. CORS: `https://app.mybelive.com`.
- TG file_path TTL: ~1 час
- ZIP содержит instrumental + vocals + опционально stems

## Отображение в UI

### Бейджи
| Тип | Отображается | Цвет |
|-----|-------------|------|
| `type: '2stem'` (в KV) | `‹ DUO ›` | Оранжевый #FF8C00 |
| `type: 'full'` (в KV) | `‹ FULL ›` | Зелёный #4CAF50 |

### Поиск
- `searchQuery >= 2` символов → дропдаун с секциями:
  - **В КАТАЛОГЕ** (зелёный) — совпадения из IDB
  - **В TELEGRAM** (оранжевый) — совпадения из TG
- ↓ клик → `setSearchQuery('')` → дропдаун закрывается
- PORT прогресс показывает название трека

## Деплой

**Wrangler НЕ работает** (macOS 12.6 network issue). Используется manual deploy через CF Dashboard:

```bash
npx esbuild src/index.ts --bundle --platform=node --format=esm --outfile=dist/worker-bundle.js
```

Затем вставить содержимое `dist/worker-bundle.js` в CF Dashboard → Workers → belive-feed-bot → Edit → Paste → Save & Deploy.

### KV Namespace
- **ID:** `bd9b1fdbafd64d9d9018da2aa478d99c`
- **Содержит:** file_id → track metadata (title, artist, slug, type, fileIds, fileSize, fileName)

### Secrets
- `BOT_TOKEN`: `8506268729:AAF_4gkscFhHUTGdEJUeFNVKoWSaYsNgHiA`

## Файловая структура бота

```
belive-feed-bot/
├── src/
│   ├── index.ts          — Worker fetch handler (webhook, /download, /tracks, OPTIONS CORS)
│   ├── commands.ts       — cmdUploadDoc, cmdUploadType, cmdCatalog (‹ DUO › display)
│   ├── tg.ts             — Telegram API wrappers
│   ├── auth.ts           — isAllowedUser, getUserId
│   └── data/tracks.ts    — Static TRACKS array (52 tracks)
├── dist/
│   └── worker-bundle.js  — Single-file bundle для CF Dashboard
└── scripts/
    ├── bulk-upload.ts    — Bulk upload script
    └── compress-tracks.sh — ffmpeg сжатие >50MB треков
```

## CORS Configuration
```yaml
Access-Control-Allow-Origin: https://app.mybelive.com
Access-Control-Allow-Methods: GET, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

## TG Upload Flow (Phase 1 — 2026-06-26)

### Суть
Пользователь может отправить ZIP-архив трека из SyncEditorPanel напрямую в Telegram каталог. ZIP не скачивается локально — отправляется через Worker в TG и сохраняется в KV каталог.

### Поток
```
SyncEditorPanel.tsx
  → handleExportZip() генерирует Blob (JSZip, transcode, budget gate)
  → Blob сохраняется в exportBlobRef
  → Кнопка «📤 TG» становится активной
  → uploadToTelegram() — XHR POST /upload
    → FormData: file, artist, title, type
    → XHR.upload.onprogress — UI прогресс
  → belive-feed-bot POST /upload
    → strict origin check (===)
    → Content-Length guard (>1MB → 413)
    → X-API-Key timingSafeEqual
    → ZIP magic bytes validation (PK\x03\x04)
    → Filename sanitize (/[a-zA-Z0-9._-]/g, ≤64)
    → sendDocument → TG API
    → retry-on-429 (Retry-After)
    → KV catalog write (optimistic lock)
    → orphan protection (если KV fail → deleteMessage)
    → Response: { success, fileId, slug, id }
  → CatalogContent.tsx слушает 'tg-upload-complete'
    → re-fetch /tracks
    → polling fallback (3×5s для KV eventual consistency)
```

### POST /upload hardening
| Слой | Проверка | Статус |
|------|---------|--------|
| CORS | Access-Control-Allow-Origin: app.mybelive.com | ✅ |
| Origin | strict === (не includes) | ✅ |
| Size | Content-Length > 1MB → 413 | ✅ |
| Auth | X-API-Key → timingSafeEqual | ✅ |
| File type | ZIP magic bytes (первые 4 байта) | ✅ |
| Filename | sanitize: /[a-zA-Z0-9._-]/g, ≤64 chars | ✅ |
| Timeout | AbortSignal.timeout(8000) | ✅ |
| Retry | 429 → Retry-After → 1 retry | ✅ |
| Catalog | KV optimistic lock + duplicate slug guard | ✅ |
| Orphan | KV fail → deleteMessage | ✅ |

### API
- `POST /upload` — FormData: file, artist, title, type
- Headers: `X-API-Key` (required), `Origin: https://app.mybelive.com`
- Response: `{ success, fileId, slug, id }`
- Limit: 1MB (Content-Length), только ZIP

### Client-side
- Кнопка «📤 TG» в SyncEditorPanel (рядом с «ZIP»)
- XHR с upload.onprogress
- Blob в useRef (не ревокается пока upload активен)
- Событие `tg-upload-complete` для CatalogContent

## Known Limitations
- **TG file_path TTL:** ~1 час — после этого ссылка умирает, retry бесполезен
- **No webhook retry:** бот не переотправляет webhook при падении Worker
- **Manual deploy:** только через CF Dashboard (wrangler падает на macOS 12.6)
- **6 треков >50MB:** ждут ffmpeg сжатия перед bulk upload
- **KV eventual consistency:** трек может появиться в каталоге через 30-60с (polling fallback 3×5s)
- **Phase 1 KV RMW race:** известен, зафиксирован. Phase 2 → DO migration
- **Phase 1 без JWT:** X-API-Key shared secret, не user-bound. Phase 2 → JWT
