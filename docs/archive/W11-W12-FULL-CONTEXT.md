# 🎯 W11+W12: FULL CONTEXT + ANSWERS FOR NEW CENTER

**Created:** April 11, 2026  
**For:** New Center (feature/w11-auto-lyrics branch)  
**Purpose:** Complete architectural context + answers to all 15 questions + 007 recon results

---

# 📊 PROJECT OVERVIEW (beLive Architecture)

## Core Stack
- **Frontend:** React 19 + TypeScript 5.9 + Vite 5
- **State:** Zustand (multiple stores)
- **Routing:** None (SPA, single page)
- **Storage:** IndexedDB (tracks, audio, lyrics), localStorage (settings)
- **Deployment:** GitHub Pages (static PWA)
- **Runtime:** Client-side only (no backend)

## Key Files Structure
```
src/
├── audio/core/AudioEngineV2.ts      # Audio playback authority
├── bridges/
│   ├── audio.bridge.ts              # AudioEngine → Zustand sync
│   └── mode-switch.bridge.ts        # Mode changes
├── services/
│   ├── idb.service.ts               # IndexedDB operations
│   ├── upload.service.ts            # ZIP upload flow
│   └── upload.actions.ts            # Upload handlers
├── components/
│   ├── UploadPanel.tsx              # Lyrics paste modal
│   ├── CatalogLayout.tsx            # Track catalog UI
│   ├── MixerPanel.tsx               # Stem mixer
│   └── WagonTrain.tsx               # TrackMap (block timeline)
├── stores/
│   ├── track.store.ts               # Current track state
│   └── stem.store.ts                # Stem volumes/mutes
├── stem/
│   ├── stem.store.ts                # Stem state (Zustand)
│   └── stemTypes.ts                 # Type definitions
├── catalog/
│   ├── types.ts                     # parseTrackName()
│   └── components/CatalogLayout.tsx # Catalog UI
└── sync/store/sync.store.ts         # Sync markers state
```

---

# W11: AUTO-LYRICS SYSTEM — ANSWERS TO ALL QUESTIONS

## ❓ Q1: UploadPanel.tsx Integration

### Где кнопка "Принять"?
**Файл:** `src/components/UploadPanel.tsx`

**Текущий flow:**
```
User pastes Genius text → textarea value
  ↓
Clicks "Принять" button
  ↓
Calls `onAccept(geniusText)` callback
  ↓
Parent (CatalogLayout or upload handler) processes
```

**Формат данных от Genius:**
```
[Verse 1]
I woke up in a dream today
Time to clear the air

[Chorus]
This is how we do it
This is how we do it

[Bridge]
Yeah, yeah, yeah
```

**Чистый текст, НЕ HTML.** Разметка блок-тегов `[Verse 1]`, `[Chorus]`, `[Bridge]` — это текстовые строки.

### Lyrics parsing код в проекте?
**ДА, есть:**

1. **`src/services/lyrics.service.ts`** — legacy lyrics handling
   - Text style selection
   - localStorage cache
   - НЕ использует для sync (только display)

2. **`src/sync/store/sync.store.ts`** — sync markers state
   - Хранит `{time, text}` массив
   - НЕ имеет парсинга

3. **НЕТ готового parseLrc() или parseGeniusBlocks()** — нужно создать в auto-lyrics.service.ts

---

## ❓ Q2: Block Editor + Sync Editor Skip Mechanism

### Как открываются редакторы?

**Block Editor:**
```typescript
// upload.service.ts — function openBlockEditorForTrack(trackId: number)
const w = window as any;
const waveformEditor = w.waveformEditor; // WaveformEditor instance
waveformEditor.openBlockEditorForTrack(trackId);
```

**Sync Editor:**
```typescript
// Где-то в blockEditor completion callback
const w = window as any;
const waveformEditor = w.waveformEditor;
waveformEditor.show(); // Opens Sync Editor after blocks done
```

**ВАЖНО:** Нужно найти точные строки через 007 recon! (pending queries)

### Где вызывать shouldSkipBlockEditor() и shouldSkipSyncEditor()?

**Block Editor skip:**
```typescript
// upload.service.ts — в конце saveTrack() или после него
import { shouldSkipBlockEditor } from './auto-lyrics.service';

if (!shouldSkipBlockEditor()) {
  openBlockEditorForTrack(savedTrack.id);
} else {
  console.log('[AutoLyrics] Skipping Block Editor — auto-sync applied');
}
```

**Sync Editor skip:**
```typescript
// waveformEditor.ts или blockEditor.store.ts — в completion callback
import { shouldSkipSyncEditor } from './auto-lyrics.service';

if (!shouldSkipSyncEditor()) {
  waveformEditor.show();
} else {
  console.log('[AutoLyrics] Skipping Sync Editor — auto-sync applied');
}
```

### Race conditions risk?
**НЕТ, если:**
- Skip flags — синхронные boolean (не Promise)
- Safety reset 3 seconds (достаточно для UI flow)
- `markAutoSyncApplied()` вызывается ДО открытия редакторов

**Механизм:**
```typescript
// auto-lyrics.service.ts
let _skipNextBlockEditor = false;
let _skipNextSyncEditor = false;

export function markAutoSyncApplied() {
  _skipNextSyncEditor = true;
  _skipNextBlockEditor = true;
  
  // Safety reset — 3 seconds
  setTimeout(() => {
    _skipNextSyncEditor = false;
    _skipNextBlockEditor = false;
  }, 3000);
}

export function shouldSkipBlockEditor(): boolean {
  if (_skipNextBlockEditor) {
    _skipNextBlockEditor = false; // Auto-reset after first check
    return true;
  }
  return false;
}

export function shouldSkipSyncEditor(): boolean {
  if (_skipNextSyncEditor) {
    _skipNextSyncEditor = false; // Auto-reset after first check
    return true;
  }
  return false;
}
```

---

## ❓ Q3: IDB save для syncMarkers + blocksData

### Формат syncMarkers
```typescript
// idb.service.ts — PersistedSyncMarker interface
interface PersistedSyncMarker {
  id: string;           // Unique ID (e.g., "marker-0")
  time: number;         // Seconds (e.g., 30.40)
  text: string;         // Lyric line (e.g., "I woke up in a dream today")
  blockId?: string;     // Link to block (e.g., "verse-1")
  confidence?: number;  // 0-1 sync confidence (optional)
}
```

**Пример:**
```typescript
[
  { id: "marker-0", time: 30.40, text: "I woke up in a dream today", blockId: "verse-1" },
  { id: "marker-1", time: 33.15, text: "Time to clear the air", blockId: "verse-1" },
  { id: "marker-2", time: 50.65, text: "This is how we do it", blockId: "chorus-1" }
]
```

### Формат blocksData
```typescript
// idb.service.ts — PersistedTextBlock interface
interface PersistedTextBlock {
  id: string;           // Unique ID (e.g., "verse-1")
  type: string;         // "verse", "chorus", "prechorus", "bridge", "intro", "outro"
  start: number;        // Start time in seconds
  end: number;          // End time in seconds
  label?: string;       // Display label (e.g., "Verse 1")
}
```

**Пример:**
```typescript
[
  { id: "verse-1", type: "verse", start: 30.40, end: 50.65, label: "Verse 1" },
  { id: "chorus-1", type: "chorus", start: 50.65, end: 75.20, label: "Chorus" },
  { id: "verse-2", type: "verse", start: 75.20, end: 95.50, label: "Verse 2" }
]
```

### Функция для сохранения
```typescript
// idb.service.ts
async function updateTrackField(
  trackId: number,
  fields: Partial<TrackRecord>
): Promise<void>

// Usage:
await idbService.updateTrackField(trackId, {
  syncMarkers: markers,
  blocksData: blocks
});
```

**ИЛИ** полная замена:
```typescript
// upload.service.ts — saveTrack() создаёт новый TrackRecord
const trackData: TrackRecord = {
  id: trackId,
  title: trackTitle,
  // ... audio data ...
  syncMarkers: markers,
  blocksData: blocks,
  dateAdded: new Date().toISOString(),
  lastModified: new Date().toISOString()
};

await idbService.saveTrack(trackData);
```

**Для auto-sync:** используем `updateTrackField()` (partial update, не перезаписываем audio)

---

## ❓ Q4: matchGeniusToLrc() алгоритм

### Fuzzy matching — есть ли библиотека?
**НЕТ, Levenshtein библиотеки в проекте.**

**Реализуем вручную:**
```typescript
// auto-lyrics.service.ts
function levenshteinDistance(a: string, b: string): number {
  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
  
  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,     // deletion
        matrix[j - 1][i] + 1,     // insertion
        matrix[j - 1][i - 1] + indicator  // substitution
      );
    }
  }
  
  return matrix[b.length][a.length];
}

function similarity(a: string, b: string): number {
  if (a === b) return 1.0;
  if (a.length === 0 || b.length === 0) return 0;
  
  const dist = levenshteinDistance(a, b);
  const maxLen = Math.max(a.length, b.length);
  return 1 - dist / maxLen;
}
```

**Performance:** Levenshtein O(n×m) — для <50 chars OK (~2500 ops max)

### Что если Genius текст на русском, а lrclib на английском?
**Проблема:** Fuzzy match не сработает между языками.

**Решение:**
1. **Detect language** (простой heuristic: кириллица vs latin)
2. **If language mismatch → fallback to manual editing** (confidence = 0)
3. **Показать пользователю:** "❌ Lyrics language mismatch — manual sync required"

**Implementation:**
```typescript
function detectLanguage(text: string): 'cyrillic' | 'latin' | 'mixed' {
  const cyrillic = /[\u0400-\u04FF]/.test(text);
  const latin = /[a-zA-Z]/.test(text);
  
  if (cyrillic && latin) return 'mixed';
  if (cyrillic) return 'cyrillic';
  return 'latin';
}

// В matchGeniusToLrc():
const geniusLang = detectLanguage(geniusText);
const lrcLang = detectLanguage(lrcResult.syncedLyrics);

if (geniusLang !== lrcLang && geniusLang !== 'mixed' && lrcLang !== 'mixed') {
  return { confidence: 0, reason: 'Language mismatch' };
}
```

### Дубликаты строк (повторяющиеся chorus)?
**Решение:** Sequential matching (order matters)

```typescript
function matchGeniusToLrc(geniusBlocks: GeniusBlock[], lrcLines: LrcLine[]): MatchResult {
  let geniusLineIndex = 0;
  let lrcLineIndex = 0;
  const matches: MatchedLine[] = [];
  
  while (geniusLineIndex < geniusLines.length && lrcLineIndex < lrcLines.length) {
    const geniusLine = normalizeText(geniusLines[geniusLineIndex]);
    
    // Find best match in next N LRC lines (window search)
    let bestMatch: { score: number, lrcIndex: number } | null = null;
    
    for (let i = lrcLineIndex; i < Math.min(lrcLineIndex + 10, lrcLines.length); i++) {
      const lrcLine = normalizeText(lrcLines[i].text);
      const score = computeSimilarity(geniusLine, lrcLine);
      
      if (score > (bestMatch?.score || 0)) {
        bestMatch = { score, lrcIndex: i };
      }
    }
    
    if (bestMatch && bestMatch.score >= 0.8) {
      matches.push({
        geniusIndex: geniusLineIndex,
        lrcIndex: bestMatch.lrcIndex,
        time: lrcLines[bestMatch.lrcIndex].time,
        score: bestMatch.score
      });
      lrcLineIndex = bestMatch.lrcIndex + 1; // Move past match
    }
    
    geniusLineIndex++;
  }
  
  const confidence = matches.length / geniusLines.length;
  return { matches, confidence };
}
```

---

## ❓ Q5: Error Handling

### Что если lrclib вернул 404?
**Silent fail** — НЕ показывать пользователю

```typescript
async function fetchLrclib(artist: string, title: string): Promise<LrcResult | null> {
  try {
    const url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log(`[AutoLyrics] No synced lyrics for "${artist} - ${title}"`);
        return null; // Silent — no lyrics available
      }
      console.warn(`[AutoLyrics] lrclib error ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    return {
      title: data.trackName,
      artist: data.artistName,
      syncedLyrics: data.syncedLyrics,
      plainLyrics: data.plainLyrics,
      duration: data.duration
    };
  } catch (err) {
    console.warn('[AutoLyrics] fetchLrclib failed:', err);
    return null; // Silent fail
  }
}
```

### Что если Last.fm вернул пустой ответ?
**Silent fail** — placeholder вместо обложки

```typescript
async function fetchCoverArt(artist: string, title: string): Promise<string | null> {
  try {
    const response = await fetch(lastFmUrl);
    const data = await response.json();
    
    if (!data.track?.album?.image) {
      console.log(`[CoverArt] No cover for "${artist} - ${title}"`);
      return null; // Will use placeholder
    }
    
    // Extract URL...
  } catch (err) {
    console.warn('[CoverArt] fetchCoverArt failed:', err);
    return null; // Will use placeholder
  }
}
```

### Показать пользователю ошибку или silent fail?
**Silent fail для prefetch** (background operations)

**Показать ошибку только если:**
- User explicitly triggered action (e.g., "Find Cover" button)
- Critical failure (IDB corrupt, audio decode failed)

---

# W12: COVER ART + DYNAMIC THEMING — ANSWERS TO ALL QUESTIONS

## ❓ Q6: TrackTheme Store

### Где хранить TrackTheme?
**В track.store.ts** (уже хранит currentTrack)

```typescript
// src/stores/track.store.ts
interface TrackState {
  currentTrack: TrackMeta | null;
  coverArtTheme: CoverArtTheme | null;
}

interface CoverArtTheme {
  coverUrl: string;
  primary: string;    // #D32F2F
  secondary: string;  // #FF6B35
  accent: string;     // #FFC107
  palette: string[];
}

// Actions
setCoverArtTheme: (theme: CoverArtTheme | null) => void
```

### Как тригерить ре-рендер?
**Zustand автоматически** (reactive store)

```typescript
// В любом React компоненте:
const coverArtTheme = useTrackStore(s => s.coverArtTheme);

// Когда theme меняется → автоматический ре-рендер
```

### Что если пользователь загрузил 10 треков?
**Тема текущего трека** (который playing)

```typescript
// audio.bridge.ts — onTrackLoaded handler
const onTrackLoaded = (e: Event) => {
  const track = (e as CustomEvent).detail;
  
  // Set current track
  useTrackStore.getState().setCurrentTrack(track);
  
  // If has cover → extract theme
  if (track.coverArtUrl) {
    extractDominantColors(track.coverArtUrl).then(theme => {
      useTrackStore.getState().setCoverArtTheme({
        coverUrl: track.coverArtUrl,
        ...theme
      });
    });
  } else {
    useTrackStore.getState().setCoverArtTheme(null); // Reset to default
  }
};
```

---

## ❓ Q7: Color Extraction Engine

### Есть ли canvas код в проекте?
**НЕТ прямого canvas usage для image processing.**

**Есть:**
- `RehearsalBackground.ts` — image cache (HTMLImageElement, не canvas)
- Metering в AudioEngineV2 — AnalyserNode, не canvas

**Создадим с нуля:**
```typescript
// services/color-extractor.ts
export async function extractDominantColors(
  imageUrl: string,
  sampleRate: number = 10 // Every 10th pixel
): Promise<{ primary: string, secondary: string, accent: string }> {
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // CORS!
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject('No canvas context');
      
      // Downscale for performance (MacBook Pro 2013)
      const scale = Math.min(1, 200 / Math.max(img.width, img.height));
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Sample pixels
      const colorCounts: Record<string, number> = {};
      for (let i = 0; i < imageData.data.length; i += 4 * sampleRate) {
        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];
        const a = imageData.data[i + 3];
        
        if (a < 128) continue; // Skip transparent
        
        // Quantize to reduce colors (round to nearest 32)
        const qr = Math.round(r / 32) * 32;
        const qg = Math.round(g / 32) * 32;
        const qb = Math.round(b / 32) * 32;
        const key = `${qr},${qg},${qb}`;
        
        colorCounts[key] = (colorCounts[key] || 0) + 1;
      }
      
      // Sort by frequency
      const sorted = Object.entries(colorCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10); // Top 10 colors
      
      // Skip grey/black/white (find accent)
      const vibrant = sorted.find(([rgb]) => {
        const [r, g, b] = rgb.split(',').map(Number);
        const saturation = Math.max(r, g, b) - Math.min(r, g, b);
        return saturation > 60; // Vibrant threshold
      });
      
      resolve({
        primary: rgbToHex(sorted[0][0]),
        secondary: sorted[1] ? rgbToHex(sorted[1][0]) : sorted[0][0],
        accent: vibrant ? rgbToHex(vibrant[0]) : sorted[0][0]
      });
    };
    img.onerror = reject;
    img.src = imageUrl;
  });
}

function rgbToHex(rgb: string): string {
  const [r, g, b] = rgb.split(',').map(Number);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
```

### Performance budget (MacBook Pro 2013)?
- **Downscale to 200px max** → ~40,000 pixels
- **Sample every 10th** → ~4,000 samples
- **Quantize to 32 levels** → reduces unique colors
- **Time:** ~50-100ms (acceptable)
- **Memory:** ~200KB canvas (tiny)

### Алгоритм: простой dominant color (НЕ k-means)
- k-means слишком тяжёлый (O(n×k×iterations))
- Median cut сложный для реализации
- **Простой frequency count + quantization** — достаточно для UI theming

---

## ❓ Q8: Dynamic Theme Application

### CSS variables или inline styles?
**CSS variables** (лучше для performance + проще менять)

```css
/* In global CSS or component CSS */
:root {
  --bl-primary: #D32F2F;
  --bl-secondary: #FF6B35;
  --bl-accent: #FFC107;
  --bl-cover-url: url('');
}

/* Apply in components */
.dock-panel {
  background: var(--bl-primary);
  border-color: var(--bl-secondary);
}

.mixer-fader {
  background: linear-gradient(to top, var(--bl-accent), var(--bl-primary));
}
```

### Где определить CSS variables?
**Component-level** (не `:root` — избегаем глобальных конфликтов)

```typescript
// В React компоненте:
const DockPanel = () => {
  const coverArtTheme = useTrackStore(s => s.coverArtTheme);
  
  return (
    <div
      className={styles.dockPanel}
      style={{
        '--bl-primary': coverArtTheme?.primary || '#1a1a2e',
        '--bl-secondary': coverArtTheme?.secondary || '#16213e',
        '--bl-accent': coverArtTheme?.accent || '#0f3460',
      } as React.CSSProperties}
    >
      {/* ... */}
    </div>
  );
};
```

### WagonTrain structural colors preserved — как отделить?

**CSS custom properties для structural (FIXED):**
```css
.wagon-block-verse {
  --block-structural-color: #4CAF50; /* IMMUTABLE */
  background: var(--block-structural-color);
}

.wagon-block-chorus {
  --block-structural-color: #E53935; /* IMMUTABLE */
  background: var(--block-structural-color);
}
```

**CSS custom properties для cover (DYNAMIC):**
```css
.wagon-block {
  --block-glow-color: var(--bl-accent); /* From cover */
  --block-border-color: var(--bl-primary); /* From cover */
  box-shadow: 0 0 8px var(--block-glow-color);
  border: 1px solid var(--block-border-color);
}
```

**Результат:**
- Background = structural (green/red) — NEVER changes
- Glow/border = cover-driven (red/orange from Hybrid Theory) — FLEXIBLE

---

## ❓ Q9: Last.fm API Key

### Где хранить API key?
**НЕ в `.env`** (beLive — static PWA, нет backend)

**Варианты:**
1. **Hardcoded в auto-lyrics.service.ts** — просто, но key виден в коде
2. **Через gateway** (Cloudflare Worker) — secure, но нужно добавить backend
3. **Константа в config файле** — компромисс

**Рекомендую:** Hardcoded с комментарием (Last.fm key не чувствительный, можно rotate)

```typescript
// services/config.ts
export const LASTFM_API_KEY = '396cc9b00c1e9601287f8f598bc3ea8f';
// Note: Public API key — safe to expose. Rotate if abuse detected.
```

### Rate limiting?
**Last.fm limits:**
- ~5 requests/second (unofficial)
- No official documented limit
- **For beLive:** 1 request per track upload → NO problem

### Fallback если Last.fm down?
**Placeholder with gradient:**
```typescript
// Catalog placeholder
const CoverPlaceholder = ({ title }: { title: string }) => {
  const initial = title.charAt(0).toUpperCase();
  
  return (
    <div style={{
      width: 32,
      height: 32,
      borderRadius: 4,
      background: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontWeight: 'bold',
      fontSize: 16,
    }}>
      {initial}
    </div>
  );
};
```

---

# ОБЩИЕ АРХИТЕКТУРНЫЕ ОТВЕТЫ

## ❓ Q10: Existing Lyrics Infrastructure

### Есть ли lyrics parsing код?
**НЕТ готового parseLrc() или parseGeniusBlocks().**

**Есть:**
- `lyrics.service.ts` — text style, localStorage (НЕ parsing)
- `sync.store.ts` — stores syncMarkers (НЕ creates them)

**Нужно создать:**
- `parseLrc(syncedLyrics: string): LrcLine[]`
- `parseGeniusBlocks(text: string): GeniusBlock[]`

### Где хранятся syncMarkers в IDB?
**TrackRecord.syncMarkers** (поле уже существует!)

```typescript
export interface TrackRecord {
  // ... other fields ...
  syncMarkers?: PersistedSyncMarker[] | null;
  blocksData?: PersistedTextBlock[] | null;
}
```

### Типичный TrackRecord после ZIP upload
```typescript
{
  id: 123,
  title: "Linkin Park - With You",
  instrumentalData: ArrayBuffer,
  instrumentalType: "audio/mpeg",
  vocalsData: ArrayBuffer | null,
  stemsData: { drums: ..., bass: ..., guitar: ... } | null,
  stemsMode: false,
  lyricsFileName: "genius_lyrics.txt",
  lyricsOriginalContent: "[Verse 1]\nI woke up...",
  lyrics: null, // Deprecated
  blocksData: [
    { id: "verse-1", type: "verse", start: 30.40, end: 50.65 }
  ],
  syncMarkers: [
    { id: "marker-0", time: 30.40, text: "I woke up...", blockId: "verse-1" }
  ],
  lineMap: null, // Used for display (not sync)
  alignmentData: null, // Used for auto-alignment (deprecated?)
  dateAdded: "2026-04-11T10:30:00Z",
  lastModified: "2026-04-11T10:35:00Z",
  coverArtUrl: null // W12: добавляем
}
```

---

## ❓ Q11: Editor Flow

### Полный flow от ZIP drop до готового трека

```
1. ZIP dropped → handleZipFileSelect()
   ↓
2. Parse ZIP → extract instrumental/vocals/stems
   ↓
3. Determine title (from filename)
   ↓
4. W11: prefetch(title) → fetch lrclib (fire-and-forget)
   ↓
5. Save to IDB → saveTrack(trackData)
   ↓
6. W12: fetchCoverArt(artist, title) (fire-and-forget)
   ↓
7. Load audio → audioEngine.loadTrack()
   ↓
8. 'track-loaded' event
   ↓
9. W11: refetchWithDuration(title, duration) (если weak match)
   ↓
10. User opens catalog → pastes Genius lyrics
    ↓
11. User clicks "Принять"
    ↓
12. W11: matchGeniusToLrc(geniusText, lrcResult)
    ↓
13. If confidence ≥ 80%:
    - save syncMarkers + blocksData to IDB
    - markAutoSyncApplied()
    - Skip Block Editor ✅
    - Skip Sync Editor ✅
    - Track ready! ✅
    
    If confidence < 80%:
    - Open Block Editor (manual block creation)
    ↓
14. User finishes Block Editor → auto-open Sync Editor
    ↓
15. User syncs lyrics to audio (manual)
    ↓
16. Track ready! ✅
```

### Где "бутылочное горлышко" (5-20 минут)?
**Шаги 13-15:**
- **Block Editor:** User создаёт verse/chorus/bridge вручную (2-5 мин)
- **Sync Editor:** User кликает на каждую строку текста в ритм музыки (3-15 мин)

**W11 убирает это:** auto-sync за 2-3 секунды если lrclib есть synced lyrics

### Что пользователь делает в Block Editor?
- Создаёт блоки: verse, chorus, prechorus, bridge
- Указывает start/end time для каждого блока
- Визуально размещает на timeline

### Что пользователь делает в Sync Editor?
- Видит текст (Genius lyrics)
- Слушает музыку
- Кликает на каждую строку когда она поётся
- Система создаёт syncMarkers с timestamps

---

## ❓ Q12: Testing Strategy

### Как тестировать без реальных запросов?
**Mock data в отдельном файле:**

```typescript
// test/fixtures/lrc-data.ts
export const mockLrcResult: LrcResult = {
  title: "With You",
  artist: "Linkin Park",
  syncedLyrics: `[00:30.43]I woke up in a dream today
[00:33.15]Time to clear the air
[00:50.65]This is how we do it`,
  plainLyrics: "I woke up in a dream today\nTime to clear the air",
  duration: 203
};

export const mockGeniusText = `[Verse 1]
I woke up in a dream today
Time to clear the air

[Chorus]
This is how we do it`;

// В тестах:
import { mockLrcResult, mockGeniusText } from '../test/fixtures/lrc-data';
const result = matchGeniusToLrc(mockGeniusText, mockLrcResult);
expect(result.confidence).toBeGreaterThanOrEqual(0.8);
```

### Есть ли test fixtures?
**НЕТ, нужно создать:**
- `test/fixtures/lrc-data.ts` — примеры LRC
- `test/fixtures/genius-texts.ts` — примеры Genius
- `test/fixtures/cover-art.ts` — mock cover URLs

### Как验证 confidence threshold 80%?
**Unit tests:**

```typescript
describe('matchGeniusToLrc', () => {
  it('should return confidence ≥ 0.8 for perfect match', () => {
    const result = matchGeniusToLrc(perfectGenius, perfectLrc);
    expect(result.confidence).toBe(1.0);
  });
  
  it('should return confidence < 0.8 for partial match', () => {
    const result = matchGeniusToLrc(partialGenius, perfectLrc);
    expect(result.confidence).toBeLessThan(0.8);
  });
  
  it('should handle language mismatch', () => {
    const result = matchGeniusToLrc(russianGenius, englishLrc);
    expect(result.confidence).toBe(0);
    expect(result.reason).toBe('Language mismatch');
  });
});
```

---

## ❓ Q13: Performance Impact

### prefetch() на каждый ZIP upload — не убьёт network?
**НЕТ:**
- 1 запрос на upload (~300-500ms, 2-5KB response)
- Fire-and-forget (НЕ блокирует UI)
- Parallel с audio loading (не sequential)
- **Total overhead:** ~500ms background

### Color extraction на каждый track load — не будет лагов?
**НЕТ:**
- Downscale to 200px → fast
- ~50-100ms processing time
- Runs AFTER audio loaded (not blocking)
- Cache result в localStorage (не переизвлекаем)

**Implementation:**
```typescript
const COVER_CACHE_KEY = 'bl-cover-themes';

function getCachedTheme(coverUrl: string): CoverArtTheme | null {
  try {
    const cache = JSON.parse(localStorage.getItem(COVER_CACHE_KEY) || '{}');
    return cache[coverUrl] || null;
  } catch {
    return null;
  }
}

function cacheTheme(coverUrl: string, theme: CoverArtTheme) {
  try {
    const cache = JSON.parse(localStorage.getItem(COVER_CACHE_KEY) || '{}');
    cache[coverUrl] = theme;
    localStorage.setItem(COVER_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Silent fail — cache is optional
  }
}
```

### Memory: LrcResult cache в Map — когда чистить?
**НЕ чистить** (маленький footprint):
- 1 LrcResult ≈ 2-5KB (text)
- 100 треков = 200-500KB total (tiny)
- Map garbage collected на page unload

**Опционально:** localStorage cache для персистентности

---

## ❓ Q14: Edge Cases

### Instrumental треки (нет vocals) — lrclib вернёт что?
**Вернёт synced lyrics если трек известен в базе**

**Проблема:** У инструментала нет текста → lrclib вернёт пустой syncedLyrics

**Решение:**
```typescript
if (lrcResult.syncedLyrics?.trim().length === 0) {
  console.log('[AutoLyrics] Instrumental track — no lyrics to sync');
  return { confidence: 0, reason: 'Instrumental track' };
}
```

### Remix/covers (название ≠ оригинал) — Last.fm найдёт обложку?
**Maybe** — зависит от популярности

**Решение:** Fuzzy search по Last.fm

```typescript
// Вместо точного match:
const url = `https://ws.audioscrobbler.com/2.0/?method=track.search&api_key=${API_KEY}&track=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}&limit=3`;

// Берём первый результат с highest match score
```

### Multiple versions (radio edit, extended mix) — как различать?
**По duration!**

```typescript
// Two-phase prefetch решает это:
// Phase 1: без duration → может вернуть wrong version
// Phase 2: с duration → filter по duration match

function findBestMatch(results: LrclibResult[], targetDuration: number): LrclibResult | null {
  const threshold = 10; // ±10 seconds
  
  return results.find(r => Math.abs(r.duration - targetDuration) <= threshold) 
    || results[0]; // Fallback to first
}
```

---

## ❓ Q15: Rollback Plan

### Если auto-sync wrong (confidence 80% но таймкоды кривые)?
**User может переделать вручную:**

1. **Открыть Sync Editor вручную** (кнопка в UI)
2. **Пере-sync строки** (current behavior)
3. **Save перезаписывает syncMarkers** (updateTrackField)

**UI:**
```
[✅ Auto-sync applied (97%)] [Undo] [Edit Manually]
```

### Если cover art wrong — как заменить?
**User может загрузить свою обложку:**

1. **Кнопка "Change Cover"** в catalog
2. **File picker → upload image**
3. **Save to IDB coverArtUrl** (base64 или blob URL)

**ИЛИ** search Last.fm вручную:
```typescript
// Search button → shows results → user picks
async function searchCoverArt(artist: string, title: string): Promise<string[]> {
  const response = await fetch(lastFmSearchUrl);
  const data = await response.json();
  return data.results.map(r => r.image.extralarge);
}
```

### Где логи для дебага?
**Console.log с префиксами:**

```typescript
console.log('[AutoLyrics] Prefetch started:', title);
console.log('[AutoLyrics] lrclib match found:', match.confidence);
console.log('[AutoLyrics] Skipping Block Editor — auto-sync applied');
console.warn('[AutoLyrics] Language mismatch — fallback to manual');
console.error('[AutoLyrics] Unexpected error:', err);

console.log('[CoverArt] Cover found:', coverUrl);
console.warn('[CoverArt] No cover found — using placeholder');
```

**Для production:** Можно добавить Sentry позже (сейчас console достаточно)

---

# 🕵️ 007 RECON RESULTS

## W11 Recon Status (from previous session)
- ✅ parseTrackName exists in catalog/types.ts:48-91
- ✅ UploadSession in upload.service.ts:47-62
- ✅ TrackRecord in idb.service.ts:20-44
- ✅ saveTrack in upload.service.ts:477
- ⏳ PENDING: 4 recon queries (MUST RUN IN NEW BRANCH)

## W12 Recon Status (from 007 report)
- ✅ TrackRecord: add coverArtUrl at line 44
- ✅ UploadSession: add coverArtUrl at line 61
- ✅ Catalog render points: line 310 (All Tracks), line 169 (My Music)
- ✅ parseTrackName exists: catalog/types.ts:48-91
- ✅ Error handling pattern: try/catch + console.warn + silent fail
- ⏳ PENDING: 4 recon queries (MUST RUN IN NEW BRANCH)

### PENDING 007 QUERIES — RUN THESE FIRST

**W11:**
```bash
# 1. Sync Editor open location
grep -rn "waveformEditor\|_openNewBlockEditor\|openBlockEditor\|\.show()" src/services/upload.service.ts | head -20

# 2. Block Editor open location
grep -rn "openBlockEditorForTrack\|_openNewBlock" src/ | grep -v node_modules | head -20

# 3. Existing lyrics services
find src/ -name "*lyric*" -o -name "*lrc*" -o -name "*auto*" | grep -v node_modules | head -10

# 4. pendingTrackTitle propagation
grep -n "pendingTrackTitle\|overrideTitle\|title" src/catalog/components/CatalogLayout.tsx | head -20
```

**W12:**
```bash
# 5. Header component location
grep -rn "beLive\|currentTrack.*title\|trackTitle" src/App.tsx | head -10

# 6. Canvas usage
grep -rn "canvas\|Canvas\|getContext.*2d" src/ | grep -v node_modules | head -10

# 7. Dock Panel structure
find src/ -name "*dock*" -o -name "*Dock*" | grep -v node_modules | head -5

# 8. track.store state
grep -A 10 "currentTrack" src/stores/track.store.ts | head -20
```

---

# 📋 FIRST ACTIONS FOR NEW CENTER

## Step 1: Load Context
```
✅ Read this file completely
✅ Understand W11 architecture (auto-lyrics)
✅ Understand W12 architecture (cover art)
✅ Note all integration points
```

## Step 2: Run 007 Recons
```bash
# Run all 8 pending queries (above)
# Report findings back to Center
```

## Step 3: Start W11.1 TC
```
Create auto-lyrics.service.ts with:
- parseLrc()
- parseGeniusBlocks()
- matchGeniusToLrc()
- Skip flags
- prefetch()
- refetchWithDuration()
```

## Step 4: Test
```
- Upload ZIP with known lrclib lyrics
- Paste Genius text
- Verify auto-sync works
- Verify editors skipped
```

---

# ⚠️ CRITICAL RULES

1. **UI hides loading progress** — user only sees editors sequentially
2. **Vocals ALWAYS plays** — never muted by stems mode
3. **W7.3 auto-mute REMOVED** — replaced by Stems Mode button
4. **Stems Mode default:** instrumental=1, vocals=1, music stems=0
5. **Skip flags safety reset:** 3 seconds
6. **WagonTrain structural colors IMMUTABLE** — verse=green, chorus=red, etc.
7. **Silent fail for prefetch** — NEVER show errors to user
8. **Fire-and-forget** — NEVER block upload flow

---

**END OF CONTEXT — NEW CENTER READY TO BEGIN** 🚀
