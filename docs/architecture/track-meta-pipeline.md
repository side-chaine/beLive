# Track Meta Pipeline — External API Flow & Audio Analysis

**Status:** Architecture Reference  
**Version:** 2.0  
**Date:** 2026-06-04  
**Authors:** Центр_33 + Agent 007 + Operator

---

## Overview

beLive собирает метаданные трека из **4 внешних источников** и **1 локального WASM-анализатора**.
Данные подгружаются **лениво** — не при загрузке трека, а при открытии панели **Track Info Board** (TIB).

```
Upload Track → [метаданные НЕ запрашиваются]
                  ↓
TIB открыт  → loadCachedTrackMeta(IDB) → fetchTrackMeta(API) → merge → IDB
                  ↓
Кнопка "Analyze Audio" → analyzeAndPersist(WASM) → IDB
```

---

## §1. Data Sources

### 1.1 MusicBrainz

| Свойство | Значение |
|----------|----------|
| **Endpoint** | `https://musicbrainz.org/ws/2/recording` |
| **API Key** | Не требуется (User-Agent header) |
| **Rate Limit** | 1 req/sec |
| **CORS** | ✅ Да |
| **Что отдаёт** | `genre[]`, `label`, `releaseDate`, `isrc`, `mbid` |
| **Метод** | Двухшаговый: `search` → `lookup` (search не поддерживает `inc`) |
| **Файл** | `src/services/track-meta.service.ts` — `fetchMusicBrainz()` |
| **Статус** | ✅ Работает |

**Схема вызова:**
```
Step 1: GET /recording?query={artist AND title}&fmt=json&limit=1
Step 2: GET /recording/{mbid}?inc=releases+tags+isrcs&fmt=json
```

**Примечание:** Если lookup падает, результат search всё равно сохраняется (мягкое падение).

---

### 1.2 Last.fm

| Свойство | Значение |
|----------|----------|
| **Endpoint** | `https://ws.audioscrobbler.com/2.0/` |
| **API Key** | `VITE_LASTFM_API_KEY` (из `.env` / GitHub Secrets) |
| **Метод** | `track.getInfo` |
| **Что отдаёт** | `tags[]`, `listeners`, `playcount`, `similarTracks` |
| **Файл** | `src/services/track-meta.service.ts` — `fetchLastFm()` |
| **Статус** | ✅ Работает |

Также используется для **Cover Art** (см. §3).

---

### 1.3 GetSongBPM / api.getsong.co

| Свойство | Значение |
|----------|----------|
| **Endpoint** | `https://api.getsong.co/search/` |
| **API Key** | `VITE_GETSONGBPM_KEY` (из `.env` / GitHub Secrets) |
| **Что отдаёт** | `tempo` (BPM), `key_of` (тональность), `open_key` (Camelot в Open Key формате) |
| **Файл** | `src/services/track-meta.service.ts` — `fetchGetSongBPM()` |
| **Статус** | ✅ Работает (ключ активирован 2026-06-04) |

**Формат ответа API:**
```json
{
  "search": [
    {
      "tempo": 120,
      "key_of": "Gm",
      "open_key": "6d"
    }
  ]
}
```

> **Важно:** `open_key` конвертируется в Camelot через таблицу (см. §5).

**Дублирующий вызов в AI-чате:**
В `src/components/TrackInfoBoard/ai-tools.ts` есть функция `executeSearchAudioDB()`, которая тоже ходит в GetSongBPM, но по **старому URL** `api.getsongbpm.com`. Используется только когда AI-эксперт запрашивает BPM через команду `[SEARCH_AUDIO]`.

---

### 1.4 @libraz/libsonare (WASM — локальный анализ)

| Свойство | Значение |
|----------|----------|
| **Пакет** | `@libraz/libsonare@^1.0.2` |
| **Метод** | WASM (`sonare.wasm`) — инициализация через `import()` |
| **Сложность** | Offline, $0, работает для любого трека |
| **Что отдаёт** | `bpm`, `key.name`, `energy` (RMS), `mood` (инференс) |
| **Файл** | `src/services/audio-analysis.service.ts` — `analyzeTrack()` |
| **Вызывается** | Из `TrackInfoBoard.tsx` по кнопке "🔍 Analyze Audio" |
| **Статус** | ✅ Работает |

**WASM Init Strategy (2 попытки):**
```
Strategy 1: libsonare.init() — auto-detect WASM path
    ↓ fail
Strategy 2: import('@libraz/libsonare/wasm?url') — explicit Vite ?url
    ↓ fail
→ init не удался, _analyzeFn = null
```

**Детект потери качества (bpm guard):**
```typescript
if (bpm <= 0 || isNaN(bpm)) return null;
```

**Energy** считается независимо от libsonare — через RMS на первых 30 секундах аудио, с коэффициентом `* 3.33` для нормализации.

**Mood** выводится из key + energy:
| Key | Energy | Mood |
|-----|--------|------|
| Minor | > 0.6 | aggressive |
| Minor | ≤ 0.6 | melancholic |
| Major | > 0.6 | energetic |
| Major | ≤ 0.6 | calm |

---

## §2. Data Flow

### 2.1 Sequence: открытие TrackInfoBoard

```
User открывает TIB
        │
        ▼
loadCachedTrackMeta(trackId)     ← IDB (синхронно, кеш)
        │
        ├── есть кеш → setMeta(кеш)     ← мгновенный показ
        │
        ▼
fetchTrackMeta(trackId, title)
        │
        ├── parseTrackName(title) → { artist, title }
        │
        ├── Promise.allSettled([
        │     fetchMusicBrainz(artist, title),    ← genre, label, release, isrc, mbid
        │     fetchLastFm(artist, title),          ← tags, listeners, playcount, similar
        │     fetchGetSongBPM(artist, title),      ← bpm, key, camelot (open_key→camelot)
        │   ])
        │
        ▼
mergeNonNull(merged, mbResult)
mergeNonNull(merged, lfResult)
mergeNonNull(merged, gsbResult)
        │
        ▼
updateTrackField(trackId, { trackMeta: merged })   ← IDB (fire & forget)
        │
        ▼
setMeta(merged)   ← UI обновляется
```

### 2.2 Sequence: Analyze Audio (кнопка)

```
User нажимает "🔍 Analyze Audio"
        │
        ▼
analyzeAndPersist(trackId)
        │
        ├── getTrack(trackId) → track.instrumentalData (ArrayBuffer из IDB)
        │
        ├── guard: if (track.trackMeta?.bpm != null) return null     ← skip если уже есть
        │
        ├── analyzeTrack(instrumentalData)
        │     ├── ensureInit() → import(@libraz/libsonare) + init WASM
        │     ├── decodeAudioFromArrayBuffer() → OfflineAudioContext @ 22050Hz → mono
        │     ├── _analyzeFn(samples, sampleRate) → WASM BPM + Key
        │     ├── computeEnergy(samples) → RMS-based
        │     └── inferMood(key, energy)
        │
        ├── merge с existingMeta
        │
        └── updateTrackField(trackId, { trackMeta: merged })
```

### 2.3 Merge Strategy

```typescript
const mergeNonNull = (target: TrackMeta, source: TrackMetaPartial) => {
  for (const [k, v] of Object.entries(source)) {
    if (v != null) (target as any)[k] = v;
  }
};
```

**Правила:**
- Новые данные **не затирают** существующие, если API вернул `null`
- Audio analysis (WASM) сохраняется при повторном `fetchTrackMeta()` — потому что `existingMeta` читается из IDB перед мержем
- GetSongBPM BPM не затирает libsonare BPM — они живут в одном поле `bpm`, побеждает последний записанный

---

## §3. Cover Art Pipeline

| Свойство | Значение |
|----------|----------|
| **Источник** | Last.fm (`track.getInfo` → album.image) |
| **API Key** | `VITE_LASTFM_API_KEY` (тот же, что для Last.fm meta) |
| **Файл** | `src/services/cover-art.service.ts` — `fetchCoverArt()` |
| **Куда сохраняется** | IDB → `track.coverArtUrl` (URL) + `track.coverArtBlob` (Blob) |
| **Дополнительно** | Из обложки извлекаются доминантные цвета (`coverTheme`) |

**Схема:**
```
ZIP upload → cover.jpg → Blob → IDB coverArtBlob (offline)
TIB open  → fetchCoverArt(artist, title) → Last.fm → URL → IDB coverArtUrl
Fallback  → placeholder gradient
```

---

## §4. Persistence (IDB)

### 4.1 TrackMeta type

```typescript
// src/types/track-meta.types.ts
export interface TrackMeta {
  // MusicBrainz
  genre: string[] | null;
  label: string | null;
  releaseDate: string | null;
  isrc: string | null;
  mbid: string | null;

  // Last.fm
  tags: string[] | null;
  listeners: number | null;
  playcount: number | null;
  similarTracks: SimilarTrack[] | null;

  // @libraz/libsonare (WASM) + GetSongBPM
  bpm: number | null;
  key: string | null;
  camelot: string | null;
  energy: number | null;
  danceability: number | null;
  mood: string | null;

  // Metadata
  analysedAt: string | null;
  analysisEngine: string | null;
}
```

### 4.2 IDB field

В схеме IDB (`idb.service.ts`) поле `trackMeta` опционально:

```typescript
trackMeta?: TrackMeta | null;
```

Запись происходит через `updateTrackField()`. Чтение — через `getTrack()`.

### 4.3 Persistence ключи (DB_VERSION = 9)

| Ключ | Формат |
|------|--------|
| rec_studio_* | Основные данные треков |
| rec_img_* | Изображения |
| rec_html_* | HTML-слайды |
| bl-track-info | Zustand persist TIB state |

---

## §5. Open Key → Camelot Conversion

GetSongBPM (api.getsong.co) возвращает тональность в формате **Open Key** (`1d`–`12d` для мажора, `1m`–`12m` для минора).
Перед сохранением в `TrackMeta.camelot` значение конвертируется в **Camelot** (`1B`–`12B` / `1A`–`12A`).

**Функция:** `openKeyToCamelot()` в `src/services/track-meta.service.ts`
**Таблица:**

| Open Key | Camelot | Open Key | Camelot |
|:--------:|:-------:|:--------:|:-------:|
| 1d | 8B | 1m | 8A |
| 2d | 3B | 2m | 9A |
| 3d | 10B | 3m | 10A |
| 4d | 5B | 4m | 11A |
| 5d | 12B | 5m | 12A |
| 6d | 7B | 6m | 1A |
| 7d | 2B | 7m | 2A |
| 8d | 9B | 8m | 3A |
| 9d | 4B | 9m | 4A |
| 10d | 11B | 10m | 5A |
| 11d | 6B | 11m | 6A |
| 12d | 1B | 12m | 7A |

---

## §6. File Map

| Файл | Роль | Строк |
|------|------|-------|
| `src/types/track-meta.types.ts` | Типы данных TrackMeta, SimilarTrack, TrackComparison | 54 |
| `src/services/track-meta.service.ts` | API-клиенты: MusicBrainz, Last.fm, GetSongBPM + merge + IDB | 304 |
| `src/services/audio-analysis.service.ts` | WASM-анализ: @libraz/libsonare, BPM/Key/Energy/Mood + persist | 287 |
| `src/services/cover-art.service.ts` | Обложка через Last.fm API | 304 |
| `src/services/idb.service.ts` | IndexedDB — поле trackMeta | 609 |
| `src/stores/trackInfo.store.ts` | Zustand store: meta, isFetchingApi, isAnalyzing | 126 |
| `src/components/TrackInfoBoard/TrackInfoBoard.tsx` | UI: загрузка meta, кнопка Analyze Audio, отображение | 338 |
| `src/components/TrackInfoBoard/ai-tools.ts` | AI-чат: GetSongBPM (api.getsong.co) + AudioDB fallback | 999 |
| `.env` | Локальные API-ключи (в .gitignore) | 2 |
| `.github/workflows/deploy.yml` | CI: VITE_GETSONGBPM_KEY, VITE_LASTFM_API_KEY из Secrets | 48 |
| `index.html` | GetSongBPM attribution (fixed bottom-left) | 600 |

---

## §7. Configuration (API Keys)

| Переменная | Где используется | Откуда берётся | Статус |
|------------|-----------------|----------------|--------|
| `VITE_LASTFM_API_KEY` | `track-meta.service.ts`, `cover-art.service.ts` | `.env` + GitHub Secrets | ✅ |
| `VITE_GETSONGBPM_KEY` | `track-meta.service.ts`, `ai-tools.ts` | `.env` + GitHub Secrets | ✅ Активирован 2026-06-04 |

**Локально:** `.env` (в `.gitignore`, не коммитится)  
**CI:** GitHub Secrets → `deploy.yml` → `env:` на шаге Build

---

## §8. Attribution

Согласно условиям API GetSongBPM, на странице отображается ссылка:

```html
<a href="https://getsongbpm.com"
   style="position:fixed;bottom:4px;left:4px;font-size:10px;
   color:#999;text-decoration:none;z-index:99999;opacity:0.5">
   BPM data by GetSongBPM
</a>
```

**Файл:** `index.html`, строка 596 (перед `</body>`).

---

## §9. Known Issues & Limitations

| # | Проблема | Файл | Статус |
|---|----------|------|--------|
| 1 | ~~GetSongBPM дублирование URL~~: ✅ Исправлено — оба файла теперь используют `api.getsong.co`. URL унифицирован, хардкодный ключ убран. | `ai-tools.ts:371` | ✅ Fixed 2026-06-05 |
| 2 | **danceability всегда null**: libsonare не предоставляет danceability, RMS-based energy — только прокси. | `audio-analysis.service.ts:237` | 🟢 Low |
| 3 | **Анализ только по instrumental**: нет анализа вокала отдельно. | `audio-analysis.service.ts` | 🟢 Low |
| 4 | **WASM init может не сработать**: две стратегии, но если Vite config меняется — `?url` import ломается. | `audio-analysis.service.ts:113-121` | 🟡 Medium |
| 5 | **Essentia.js legacy**: в комментариях типов упоминается "Essentia.js Phase 2", хотя реально используется @libraz/libsonare. | `track-meta.types.ts:3` | 🟢 Low |
| 6 | **MusicBrainz rate-limit**: 1 req/sec, при быстром переключении треков может не успеть. | `track-meta.service.ts` | 🟢 Low |

---

## §10. Related Documents

| Документ | Что покрывает |
|----------|---------------|
| `track-loading-pipeline.md` | 5 фаз загрузки трека (ZIP → Audio → State) |
| `architecture-map-2.1.md` | Ownership matrix, event contracts |
| `zip-pipeline.md` | ZIP export/import (cover art pipeline) |
| `tib-current-state-context.md` | TrackInfoBoard UI state (устарел, май 2026) |
| `audio-engine.md` | AudioEngineV2 транспорт |
| `sync-system.md` | Двухслойная архитектура синхронизации |

---

## §11. Diagram (рабочий флоу)

```
                         ┌─────────────────────────────┐
                         │     TrackInfoBoard opens     │
                         └──────────┬──────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
            ┌───────────────┐             ┌──────────────────┐
            │  IDB Cache    │             │  fetchTrackMeta  │
            │  (instant)    │             │  (parallel)      │
            └───────┬───────┘             └────┬─────────────┘
                    │                          │
                    ▼              ┌───────────┼───────────┐
            ┌──────────────┐      ▼           ▼           ▼
            │ setMeta(cached)│ ┌────────┐ ┌────────┐ ┌──────────┐
            └───────┬──────┘  │MusicBrz│ │Last.fm │ │GetSongBPM│
                    │          └───┬────┘ └───┬────┘ └────┬─────┘
                    ▼              │          │           │
            ┌──────────────┐       ▼          ▼           ▼
            │ UI Render    │   genre     tags       tempo
            │ (cached)     │   label     listeners  key_of
            └──────────────┘   release   playcount  open_key
                               isrc      similar    │
                               mbid                 ▼
                                            openKeyToCamelot()
                                                   │
                                                   ▼
                                              camelot
                                                   │
                    ┌───────────────────────────────┘
                    │
                    ▼
            ┌────────────────┐
            │  mergeNonNull  │
            └───────┬────────┘
                    │
                    ▼
            ┌────────────────┐     ┌──────────────────┐
            │  IDB Save      │────▶│  setMeta(merged) │
            │  (fire&forget) │     └───────┬──────────┘
            └────────────────┘             │
                                           ▼
                                   ┌────────────────┐
                                   │  UI Re-render  │
                                   └────────────────┘

┌───────────────────────────────────────────────────────────┐
│              Analyze Audio (кнопка)                       │
│                                                           │
│  TrackInfoBoard → analyzeAndPersist(trackId)              │
│       │                                                    │
│       ▼                                                    │
│  getTrack(trackId) → instrumentalData (IDB ArrayBuffer)    │
│       │                                                    │
│       ▼                                                    │
│  OfflineAudioContext @ 22050Hz → mono Float32Array         │
│       │                                                    │
│       ▼                                                    │
│  @libraz/libsonare WASM → analyze(samples, sampleRate)     │
│       │                                                    │
│       ├── bpm (число)                                       │
│       ├── key (объект {name: string})                       │
│       └── energy (RMS-based, независимый)                   │
│       │                                                    │
│       ▼                                                    │
│  keyToCamelot(keyName) → Camelot                           │
│  inferMood(key, energy) → mood                             │
│       │                                                    │
│       ▼                                                    │
│  mergeMeta(result) → IDB + UI                              │
└───────────────────────────────────────────────────────────┘
```

---

*Track Meta Pipeline v2.0 | 2026-06-04 | Центр_33 + 007*
