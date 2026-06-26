# ZIP Pipeline — Export & Import

**Status:** Production-ready
**Version:** 2.0
**Date:** 2026-06-26
**Authors:** Centre6, Центр_30, 001, 002, 007, 009, Operator

---

## 1. Overview

beLive ZIP is the portable track format. A single ZIP file contains everything needed to reconstruct a track offline: audio, lyrics, sync markers, block structure, word-sync alignment, cover art, and theme data.

### Design Principles

- **Self-contained:** No network required after import
- **Backward compatible:** Old ZIPs (without new fields) import gracefully
- **Functional roundtrip:** Export → Import preserves audio, lyrics, sync markers, blocks, cover art, scenes, backgrounds, and stem data. Fields NOT preserved: `stemDisplayOrder`, `stemAutomation`, `trackMeta`, `transitionPreset`, `dataVersion`.  
  **TC-ZIP-02:** `stemsMode` now preserved — set `true` when additional stems are imported via `handleZipFileSelect()`.
- **Offline-first:** Cover art stored as binary, not URL reference
- **TG limit compliant:** ZIP ≤ 50MB (Telegram upload limit). Non-vocal stems transcoded as needed via «Sample & Tighten» (v2.0)

---

## 2. ZIP Structure

```
track-name.zip
│
├── track-name.mp3                   # Instrumental stem (STORE compression)
├── track-name_vocals.mp3            # Vocal stem (optional, STORE)
├── stems/                           # Additional stems (optional)
│   ├── bass.mp3
│   ├── drums.mp3
│   ├── guitar.mp3
│   ├── keys.mp3
│   └── other.mp3
│
├── lyrics.txt                       # Clean lyrics text (no tags)
├── cover.jpg|jpeg|png / folder.jpg|png / artwork.jpg|png / front.jpg|png  # Cover art binary (glob-search, case-insensitive, STORE)
├── backgrounds/                     # Custom background image (optional, TC-CBG-07)
│   └── bg_01.jpg / bg_01.png
├── scenes/                          # Block scenes — per-block images (optional, TC-29-09)
│   ├── 0.jpg                        # scene: blockIndex=0, lineIndex=null
│   ├── 0_2.jpg                      # scene: blockIndex=0, lineIndex=2
│   └── 1.jpg
├── export.json                      # Track metadata + sync data + scenes/backgrounds metadata
└── alignment.json                   # Word-sync alignment (optional)
```

---

## 3. export.json Contract

```json
{
  "id": 1234567890,
  "title": "Artist - Track Name",
  "savedAt": "2026-04-22T10:30:00.000Z",
  "markers": [
    { "lineIndex": 0, "time": 12.34, "color": "#4ade80" }
  ],
  "lyrics": "Line 1\nLine 2\nLine 3...",
  "textBlocks": [
    { "id": "auto-block-0", "type": "verse", "name": "Verse 1", "lineIndices": [0,1,2,3] }
  ],
  "lyricsHash": "fnv1a:abc12345",
  "coverArtUrl": "https://is1-ssl.mzstatic.com/.../600x600bb.jpg",
  "coverTheme": {
    "coverUrl": "https://...",
    "primary": "#1a1a2e",
    "secondary": "#16213e",
    "accent": "#e94560",
    "isDark": true,
    "text": "#ffffff"
  },
  "lyricsOriginalContent": "[Verse 1]\nI'm waking up to ash and dust\n\n[Chorus]\nThis is how we rise...",
  "backgrounds": [
    { "file": "backgrounds/bg_01.jpg", "trackId": 1234567890 }
  ],
  "scenes": [
    { "blockIndex": 0, "lineIndex": null, "file": "scenes/0.jpg", "theme": { "primary": "#1a1a2e", "secondary": "#16213e", "accent": "#e94560", "isDark": true } }
  ]
}
```

### Field Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | number | ✅ | Track ID |
| `title` | string | ✅ | Track title |
| `savedAt` | string | ✅ | ISO timestamp |
| `markers` | array | ✅ | Sync markers with lineIndex + time |
| `lyrics` | string | ✅ | Clean lyrics (no structural tags) |
| `textBlocks` | array | ✅ | Block structure with lineIndices |
| `lyricsHash` | string | ❌ | FNV-1a hash for word-sync cache |
| `coverArtUrl` | string | ❌ | Original HTTP URL (fallback, NOT "cover.jpg") |
| `coverTheme` | object | ❌ | Extracted dominant colors |
| `lyricsOriginalContent` | string | ❌ | Original text with [Verse]/[Chorus] tags for LRC Picker |
| `backgrounds` | array | ❌ | Custom background metadata — `[{file, trackId}]` (TC-CBG-07) |
| `scenes` | array | ❌ | Block scenes metadata — `[{blockIndex, lineIndex, blockId?, file, theme}]` (TC-29-09) |

---

## 4. Export Flow

**Authority:** `handleExportZip()` in `src/sync/components/SyncEditorPanel.tsx`

```
1. Load fullTrack from IDB
2. Create JSZip instance
3. Pre-flight: calculate total size of ALL components
   a. Measure stems + instrumental + vocals + cover + bg + scenes
   b. If predicted ≥ 49MB → enters transcode path (see §10)
   c. If predicted < 49MB → fast path (add audio with STORE compression)
4. Transcode path (if needed):
   a. Build rawStemsData snapshot (for potential tightening re-encode)
   b. Run pipeline: encode stems in priority order (other → keys → guitar)
      at 128kbps until running budget < 50MB
   c. After encode: wouldFitZip() check — if passes, proceed to ZIP assembly
   d. If wouldFitZip fails: tighten 1 largest encoded stem → 64kbps, recheck
   e. If still over 50MB: ABORT with user-facing message
5. Add lyrics.txt from ld.lyrics (clean lines, not raw text)
6. Add cover art:
   a. If coverArtBlob exists → zip.file('cover.jpg', blob)
   b. Else if coverArtUrl is HTTP → fetch → blob → zip.file('cover.jpg')
   c. Also save fetched blob to IDB for future exports
   d. export.json gets ORIGINAL HTTP URL (not "cover.jpg")
7. Add scenes (block-scene images):
   a. Load blockScenes from IDB (getBlockScenes())
   b. For each scene → zip.file(`scenes/${file}`, blob)
   c. export.json.scenes[] = scene metadata
8. Add backgrounds (custom background images):
   a. Load custom background from IDB
   b. If exists → zip.file(`backgrounds/${file}`, blob)
   c. export.json.backgrounds[] = background metadata
9. Build exportData object:
   - coverArtUrl = original HTTP URL (fallback)
   - lyricsOriginalContent = full text with structural tags
   - scenes = blockScenes metadata array
   - backgrounds = background metadata array
10. Add export.json
11. Add alignment.json (if available)
12. Generate ZIP with streaming + progress
13. assertZipSize() — defense-in-depth check after generation
14. Download
```

### Key Design Decisions

- **coverArtUrl in export.json = HTTP URL** — not internal reference "cover.jpg". This ensures the URL works even if export.json is opened outside ZIP context.
- **cover.jpg is separate file** — binary blob in ZIP, not base64 in JSON. Smaller size, no encoding overhead.
- **lyricsOriginalContent preserved** — contains structural tags [Verse]/[Chorus] needed by LRC Picker to create blocks on reimport.
- **lyrics.txt = clean text** — from ld.lyrics array joined with \n, no LRC tags, no structural tags.

---

## 5. Import Flow

**Authority:** `handleZipFileSelect()` in `src/services/upload.service.ts`

```
1. JSZip.loadAsync(file)
2. Iterate ZIP entries → classify files:
   - Audio → instrumental / vocal / stems
   - Text → lyrics.txt
   - JSON → export.json or alignment.json
3. Session reset (preserve additionalStems + overrideTitle)
4. handleFileSelect() for each file type:
   - 'instrumental' → uploadSession.instrumental
   - 'vocal' → uploadSession.vocal
   - 'lyrics' → uploadSession.lyrics
    - 'json' → parse export.json:
      • markers → uploadSession.jsonMarkers
      • blocks → uploadSession.jsonTextBlocks
      • lyricsHash → uploadSession.lyricsHash
      • coverArtUrl → uploadSession.coverArtUrl
      • coverTheme → uploadSession.coverTheme
      • lyricsOriginalContent → uploadSession.lyricsOriginalContent
      • scenes[] → uploadSession.jsonScenes (optional, TC-29-09)
      • backgrounds[] → uploadSession.jsonBackgrounds (optional, TC-CBG-07)
5. Extract cover art from ZIP:
   - Glob search: cover, folder, artwork, front + .jpg, .jpeg, .png (case-insensitive, any depth)
   - Found entry → arraybuffer → Blob with MIME type
   - uploadSession.coverArtBlob = Blob
6. Extract scenes/ from ZIP (optional):
   - zip.folder('scenes') → iterate files → Blob per scene
   - uploadSession.sceneBlobs = Map<filename, Blob>
7. Extract backgrounds/ from ZIP (optional):
   - zip.folder('backgrounds') → iterate files → Blob per background
   - uploadSession.backgroundBlobs = Map<filename, Blob>
 8. saveTrack():
    - All session data → trackData → IDB
    - Cover art: coverArtUrl + coverArtBlob + coverTheme
    - Lyrics: lyrics + lyricsOriginalContent
    - Sync: syncMarkers + blocksData + lineMap + alignmentData
    - Stems: stemsData saved to IDB via updateTrackField (separate from initial save)
    - Stems mode: stemsMode=true when additional stems present (TC-ZIP-02)
    - Scenes: jsonScenes + sceneBlobs → IDB blockScenes store
    - Backgrounds: jsonBackgrounds + backgroundBlobs → IDB backgrounds store
 9. Skip API if coverArtBlob || coverArtUrl
10. Apply theme synchronously
11. loadTrackIntoApp()
```

### Cover Art Import Priority

```
1. cover.*|folder.*|artwork.*|front.* in ZIP (glob) → Blob → IDB coverArtBlob → OFFLINE ✅
2. coverArtUrl in export.json (HTTP) → IDB coverArtUrl → FALLBACK
3. No cover art → fetchCoverArtAndUpdate() → iTunes/Last.fm API
```

### Lyrics Paste Fallback (No LRC)

When a ZIP is imported without lyrics, the app opens the lyrics paste modal. If the user pastes tagged lyrics (`[Verse]`, `[Chorus]`, etc.) but lrclib has no synced version:

- `parseTaggedLyrics()` produces `DetectedBlock[]`.
- `detectedBlocksToPersistedBlocks()` (in `src/services/auto-lyrics.service.ts`) converts `DetectedBlock[]` → `PersistedTextBlock[]` by mapping each block's `contentLines` to indices in the clean lyric lines.
- The resulting `PersistedTextBlock[]` is saved to `track.blocksData` so `track.orchestrator.ts` loads it via `loadImportedBlocks()` and `sanitizeBlocks()` accepts it.

This ensures TrackMap structure is preserved even without timing data. (TC-ZIP-03)

### MIME Type Handling

JSZip `async('blob')` does NOT set MIME type. We use `async('arraybuffer')` + explicit Blob construction:

```typescript
const ab = await coverZipFile.async('arraybuffer');
const isPng = coverZipFile.name.toLowerCase().endsWith('.png');
const coverBlob = new Blob([ab], { type: isPng ? 'image/png' : 'image/jpeg' });
```

This ensures correct extension detection on re-export.

---

## 6. Cover Art Offline Pipeline

### Data Model

| Storage | Field | Type | Purpose |
|---------|-------|------|---------|
| IDB | `coverArtUrl` | string (HTTP URL) | Fallback + API reference |
| IDB | `coverArtBlob` | Blob | Offline binary |
| IDB | `coverTheme` | CoverArtTheme | Dominant colors for UI |
| Store | `TrackMeta.coverArtUrl` | string (Object URL) | Runtime display |
| Store | `TrackState.currentCoverTheme` | CoverArtTheme | Runtime theme |

### Hydration Chain

```
IDB coverArtBlob → URL.createObjectURL() → store coverArtUrl → <img src="blob:...">
     (if no blob) → IDB coverArtUrl (HTTP) → store coverArtUrl → <img src="https://...">
     (if no URL) → null → CoverArt placeholder (gradient + initial letter)
```

### Object URL Lifecycle

Object URLs must be revoked to prevent memory leaks:

```typescript
const _coverArtObjectUrls = new Set<string>();

function revokeAllCoverArtUrls() {
  _coverArtObjectUrls.forEach(url => URL.revokeObjectURL(url));
  _coverArtObjectUrls.clear();
}
```

Called at: syncAll() start, catalog-cleared, bridge cleanup.

### Fetch → Blob Flow

When cover art is fetched from API:

```
fetchCoverArtAndUpdate():
  1. iTunes/Last.fm API → coverUrl
  2. updateTrackField({ coverArtUrl }) → IDB
  3. fetch(coverUrl) → blob
  4. updateTrackField({ coverArtBlob }) → IDB
  5. extractDominantColors(coverUrl) → theme
  6. updateTrackField({ coverTheme }) → IDB
```

---

## 7. lyricsOriginalContent Roundtrip

### Why It Matters

`lyricsOriginalContent` contains structural tags like `[Verse 1]`, `[Chorus]`, `[Bridge]`. The LRC Picker uses these tags via `blockFirstLineSync()` to create colored blocks for markers.

Without `lyricsOriginalContent`, LRC Picker returns `blocks=[]` → existing blocks destroyed → white markers.

### Export

`export.json` includes `lyricsOriginalContent` from `fullTrack.lyricsOriginalContent`.

### Import

`upload.service.ts` extracts `lyricsOriginalContent` from `export.json` → saves to IDB.

### LRC Version Switch

`handleLrcVersionSelect()` saves `lyricsOriginalContent` to IDB on every version change (TC-LRC-02).

---

## 8. Backward Compatibility

| ZIP Version | Has cover.jpg? | Has coverArtUrl? | Has lyricsOriginalContent? | Has scenes/backgrounds? | Import Behavior |
|-------------|---------------|-----------------|--------------------------|------------------------|----------------|
| Pre-W12 | ❌ | ❌ | ❌ | ❌ | Fetch cover from API |
| W12 early | ❌ | ✅ HTTP URL | ❌ | ❌ | Use URL, fetch blob lazily |
| W12 current | ✅ | ✅ HTTP URL | ✅ | ❌ | Full offline, blocks preserved |
| W13+ (current) | ✅ | ✅ HTTP URL | ✅ | ✅ | Full offline + scenes + backgrounds |

---

## 10. Stem Transcode System — «Sample & Tighten»

**Версия:** 2.0 (2026-06-26)  
**Проблема:** ZIP с 6 стэмами (drums, bass, keys, guitar, other) выходит 53-55MB, превышая лимит Telegram 50MB.  
**Решение:** Клиентское пережатие не-vocal стемов при ZIP-экспорте через lamejs в Web Worker.

### 10.1 Priority Chain

Стемы сжимаются строго в порядке приоритета. Как только бюджет закрыт (< 50MB), pipeline останавливается.

| # | Стем | Битрейт T0 | Зачем |
|---|------|-----------|-------|
| 1 | `other` | 128kbps | Первый кандидат — остаточный шум, наименее критичен |
| 2 | `keys` | 128kbps | Второй кандидат — клавиши, приемлемая потеря качества |
| 3 | `guitar` | 128kbps | Третий кандидат — гитара, сжимается только если other+keys не хватило |

### 10.2 Protected Stems (оригинальное качество)

| Стем | Причина |
|------|---------|
| `drums` | Ритм-секция — потеря качества заметна |
| `bass` | Ритм-секция — потеря качества заметна |
| `vocals` | Критический стем (падение → ABORT) |
| `instrumental` | Master clock, не в stemsData |

### 10.3 Architecture

```
Pre-flight (calcPreFlight):
  ├─ threshold = zipSizeLimit - zipOverheadSlack = 49MB
  ├─ deficit от zipSizeLimit (50MB), не от threshold
  └─ stemsToTranscode в порядке priorityChain
       └─ ['other', 'keys', 'guitar'] — только существующие в stemsData

Pipeline (runTranscodePipeline):
  ├─ Single T0 pass — 128kbps для всех
  ├─ Overlap: decode следующего стема WHILE текущий encode в worker (-50% time)
  ├─ Progressive budget: runningTotal -= savings; if < 50MB → break
  ├─ terminateWorker() на каждый вход (FM-6: не sticky __aborted)
  └─ Return: compressed + skipped

Budget gate (в caller, handleExportZip):
  ├─ wouldFitZip(finalBytes) — проверка ДО генерации ZIP
  ├─ Если не влезло → tightening pass:
  │   ├─ largest encoded stem → re-encode 64kbps из rawStemsData snapshot
  │   └─ re-check wouldFitZip
  └─ Если всё ещё > 50MB → user-facing ABORT

Defense-in-depth:
  └─ assertZipSize(blob) — после generateInternalStream
```

### 10.4 Performance

| Метрика | Значение |
|---------|----------|
| Время (слабый ПК, 2 stems) | ~4 мин (было 7-8, overlap -50%) |
| Экономия на стем | ~60% (8.3MB → 3.3MB на 209s треке) |
| Доп. память | rawStemsData snapshot ~48MB временно |
| Рабочее окружение | Web Worker (`@breezystack/lamejs`, lazy import) |

### 10.5 Key Files (transcode)

| File | Role |
|------|------|
| `src/config/stem-transcode.config.ts` | Priority chain, bitrates, protected types, slack |
| `src/utils/zip-preflight.ts` | calcPreFlight, wouldFitZip, assertZipSize |
| `src/utils/zip-transcode-pipeline.ts` | Pipeline with overlap + progressive budget |
| `src/utils/mp3-transcoder.ts` | decodeStem (main thread), encodeDecoded (worker) |
| `src/utils/mp3-transcoder.worker.ts` | LAME mp3 encoding in Web Worker |
| `src/utils/zip-logger.ts` | Structured logging (15 events) |
| `src/utils/audio-context-manager.ts` | Singleton AudioContext for exports |

### 10.6 Configuration

```typescript
// stem-transcode.config.ts
{
  priorityChain:      ['other', 'keys', 'guitar'],
  compressibleTypes:  ['other', 'keys', 'guitar'],
  protectedTypes:     ['drums', 'bass', 'vocals', 'instrumental'],
  criticalTypes:      ['vocals'],
  defaultBitrate:     128,      // T0
  fallbackBitrate:    64,       // tightening
  zipOverheadSlack:   1 * 1024 * 1024, // 1MB
  maxDurationSec:     240,
  zipSizeLimit:       50 * 1024 * 1024, // 50MB
}
```

### 10.7 Observability

Логи с префиксом `[zip-enc]`:
- `PREFLIGHT` — predicted размер, deficit
- `START` — сколько стемов кодировать
- `DECODE_START` — декодирование стема
- `ENCODE_PROGRESS` — прогресс кодирования (только при смене %)
- `OK` / `SKIP` — результат стема (tier, savings, runningTotal)
- `BUDGET_MET` — бюджет закрыт, pipeline остановлен
- `BUDGET_GATE` / `BUDGET_EXCEEDED` — результат проверки wouldFitZip
- `TIGHTENING_START/DONE/FAILED` — tightening pass
- `ABORT_USER` — экспорт невозможен
- `FINAL` — итог pipeline

### 10.8 Fallback Chain

```
T0 (128kbps):   try encode → success → check budget → next stem
                ↓ fail → skip stem, continue to next
Tightening:     if budget not met → pick largest encoded → 64kbps → recheck
                ↓ still > 50MB → ABORT with user-facing message
```

---

## 9. Key Files

| File | Role |
|------|------|
| `src/sync/components/SyncEditorPanel.tsx` | ZIP export + LRC Picker + budget gate |
| `src/services/upload.service.ts` | ZIP import |
| `src/services/cover-art.service.ts` | Cover art fetch + blob save |
| `src/services/idb.service.ts` | IDB schema (coverArtBlob field, blockScenes store) |
| `src/services/block-scene.service.ts` | Block scenes load/save from IDB |
| `src/bridges/track.bridge.ts` | Blob → Object URL hydration |
| `src/bridges/cover-theme.bridge.ts` | Theme hydration from IDB |
| `src/components/CoverArt.tsx` | UI component (img + fallback) |
| `src/config/stem-transcode.config.ts` | Transcode config (v2.0) |
| `src/utils/zip-preflight.ts` | Pre-flight + budget gate |
| `src/utils/zip-transcode-pipeline.ts` | Transcode pipeline |
| `src/utils/mp3-transcoder.ts` | Decode/encode bridge |
| `src/utils/mp3-transcoder.worker.ts` | LAME worker |
| `src/utils/zip-logger.ts` | Structured logs |
| `src/utils/audio-context-manager.ts` | AudioContext singleton |

---

## 11. TG Upload Flow

**Версия:** 1.0 (Phase 1 — Hardened MVP)  
**Дата:** 2026-06-26  
**Статус:** ✅ Production-ready

### 11.1 Назначение

Отправка ZIP-архива трека из SyncEditorPanel напрямую в Telegram каталог (belive-feed-bot).  
Пользователь НЕ скачивает ZIP локально — трек сразу попадает в общий каталог.

### 11.2 Поток

```
1. handleExportZip() генерирует Blob (JSZip + transcode + budget gate)
2. exportBlobRef.current = blob (сохраняется в ref)
3. Пользователь жмёт «📤 TG»
4. uploadToTelegram():
   a. XHR.open('POST', /upload)
   b. FormData: file, artist, title, type='full'
   c. xhr.upload.onprogress → UI fill
   d. Отправка на belive-feed-bot
5. Worker POST /upload:
   a. Strict origin check (===)
   b. Content-Length guard (>1MB → 413)
   c. X-API-Key → timingSafeEqual
   d. ZIP magic bytes: PK\x03\x04
   e. Filename sanitize
   f. sendDocument → TG API (AbortSignal.timeout 8s)
   g. 429 retry (Retry-After)
   h. KV catalog write (optimistic lock + duplicate slug guard)
   i. Если KV fail → deleteMessage (orphan protection)
   j. Response: { success, fileId, slug, id }
6. CatalogContent слушает 'tg-upload-complete':
   a. re-fetch /tracks
   b. Polling 3×5s (KV eventual consistency)
```

### 11.3 Key Files

| File | Role |
|------|------|
| `src/sync/components/SyncEditorPanel.tsx` | uploadToTelegram() + TG кнопка |
| `belive-feed-bot/src/index.ts` | POST /upload hardening |
| `src/catalog/components/CatalogContent.tsx` | auto-refresh after upload |
| `belive-feed-bot/wrangler.toml` | Rate limiting binding, secrets |

### 11.4 Security Layers

| Layer | Mechanism |
|-------|-----------|
| CORS | Strict origin (===), не includes |
| Size | Content-Length > 1MB → 413 |
| Auth | X-API-Key, timingSafeEqual |
| File type | ZIP magic bytes PK\x03\x04 |
| Filename | Whitelist: /[a-zA-Z0-9._-]/g, ≤64 chars |
| Timeout | AbortSignal.timeout(8000) |
| Retry | 429 → Retry-After capped 5s |
| Catalog | KV optimistic lock, duplicate slug guard |
| Orphan | KV fail → deleteMessage rollback |

### 11.5 Known Limitations (Phase 1)

- KV read-modify-write race condition (будет исправлено в Phase 2 → Durable Object)
- Shared secret (X-API-Key), не user-bound JWT
- KV eventual consistency: до 60s задержка появления трека
- Лимит 1MB на запрос (Content-Length guard)

### 11.6 Future (Phase 2/3)

- Durable Object CatalogDO с SQLite (атомарные INSERT)
- JWT authentication вместо shared secret
- Cron cleanup для orphaned TG files
- Streaming upload для файлов > 1MB

---

**Last updated:** 2026-06-26
**Status:** Production-ready (v2.0 — «Sample & Tighten» + §11 TG Upload)
**See also:** `stem-transcode.config.ts`, `block-first-lyrics-sync.md`, `architecture-map-2.1.md`, `bot-catalog-integration.md`
