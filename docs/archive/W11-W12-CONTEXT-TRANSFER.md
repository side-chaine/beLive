# 🚀 W11 + W12 CONTEXT TRANSFER — FOR NEW BRANCH

**Created:** April 11, 2026  
**Purpose:** Transfer full architectural context to new branch  
**Delete after:** New branch initialized and context loaded by AI

---

# W11: AUTO-LYRICS SYSTEM (lrclib + Genius)

## 🎯 GOAL
При загрузке ZIP автоматически:
1. Prefetch synced lyrics из lrclib (fire-and-forget)
2. Когда пользователь вставляет текст с Genius → auto-match с lrclib таймкодами
3. Если confidence ≥ 80% → пропускаем Block Editor + Sync Editor
4. Трек готов за 5-8 секунд вместо 5-20 минут

## 🏗️ ARCHITECTURE

### Two-Phase Prefetch
```
ZIP drop → parseTitle("Linkin Park - With You")
  ↓
Phase 1: prefetch(title) — fire-and-forget (без duration)
  → lrclib query → cache in memory (Map)
  ↓
Audio loaded → 'track-loaded' event → duration=203s
  ↓
Phase 2: refetchWithDuration(title, duration) — если first result weak (<60%)
```

### Matching Flow
```
User pastes Genius text → "Принять"
  ↓
getCached(title) → LrcResult с syncedLyrics
  ↓
matchGeniusToLrc(geniusText, lrcResult):
  - parseGeniusBlocks() → [{type: "verse", lines: [...]}, ...]
  - parseLrc() → [{time: 30.40, text: "..."}, ...]
  - fuzzy match (substring + Levenshtein <50 chars)
  - confidence = matched / total
  ↓
If confidence ≥ 80%:
  - save syncMarkers + blocksData to IDB
  - markAutoSyncApplied() (skip flags)
  - showToast("✅ Auto-sync applied (97%)")
  - Track ready! ✅

If confidence < 80%:
  - Open Block Editor (manual mode)
  - Then Sync Editor
```

## 📊 KEY INTEGRATION POINTS

### 1. auto-lyrics.service.ts (NEW FILE)
```typescript
// Public API
export function parseTitleToArtistTrack(title: string): { artist: string, title: string }
export function prefetch(title: string, duration?: number): void
export async function refetchWithDuration(title: string, duration: number): Promise<void>
export function getCached(title: string): LrcResult | null
export function markAutoSyncApplied(): void
export function shouldSkipBlockEditor(): boolean
export function shouldSkipSyncEditor(): boolean

// Internal
async function fetchLrclib(artist: string, title: string, duration?: number): Promise<LrcResult | null>
function parseLrc(syncedLyrics: string): LrcLine[]
function parseGeniusBlocks(text: string): GeniusBlock[]
function matchGeniusToLrc(geniusText: string, lrcResult: LrcResult): MatchResult
function levenshteinDistance(a: string, b: string): number
function normalizeText(s: string): string
```

### 2. Skip Flags (Service-Level, NOT monkey-patch)
```typescript
let _skipNextBlockEditor = false;
let _skipNextSyncEditor = false;

export function markAutoSyncApplied() {
  _skipNextSyncEditor = true;
  _skipNextBlockEditor = true;
  setTimeout(() => {
    _skipNextSyncEditor = false;
    _skipNextBlockEditor = false;
  }, 3000); // Safety reset
}

export function shouldSkipBlockEditor(): boolean {
  if (_skipNextBlockEditor) {
    _skipNextBlockEditor = false;
    return true;
  }
  return false;
}

export function shouldSkipSyncEditor(): boolean {
  if (_skipNextSyncEditor) {
    _skipNextSyncEditor = false;
    return true;
  }
  return false;
}
```

### 3. Integration Points
- **upload.service.ts:** `autoLyricsService.prefetch(overrideTitle)` after overrideTitle defined
- **audio.bridge.ts:** `autoLyricsService.refetchWithDuration(title, duration)` in onTrackLoaded
- **UploadPanel.tsx:** matchLyricsToLrc() in "Принять" handler (ZIP context)
- **upload.service.ts:** shouldSkipBlockEditor() check before openBlockEditorForTrack()
- **blockEditor.store.ts OR waveformEditor.ts:** shouldSkipSyncEditor() check before show()

## 🔍 RECON STATUS

**DONE:**
- ✅ lrclib API tested (works from localhost)
- ✅ parseLrc() tested (outputs `{time, text}` array)
- ✅ Last.fm API tested (cover art works)

**PENDING (007 must run):**
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

## 📋 W11 ROADMAP
```
W11.1: auto-lyrics.service.ts (core service)
W11.2: Prefetch trigger (upload.service.ts)
W11.3: Apply in UploadPanel ("Принять" handler)
W11.4: Skip editors integration (Block + Sync)
```

---

# W12: COVER ART + DYNAMIC THEMING

## 🎯 GOAL
Обложка трека = источник вайба для всего UI:
1. Catalog: обложки в списке треков (32x32, 28x28)
2. Header: обложка 40x40 + название трека
3. Dock: обложка 48x48 + color-themed buttons/faders
4. Dynamic theme: весь интерфейс в тонах обложки
5. WagonTrain: structural colors preserved, but glow/border/tint from cover

## 🏗️ ARCHITECTURE

### Last.fm API
```typescript
const API_KEY = '396cc9b00c1e9601287f8f598bc3ea8f';

async function fetchCoverArt(artist: string, title: string): Promise<string | null> {
  const url = `https://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=${API_KEY}&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(title)}&format=json`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.track && data.track.album) {
    const covers = data.track.album.image;
    const best = covers.find(c => c.size === 'extralarge') || covers.find(c => c.size === 'large');
    return best?.['#text'] || null;
  }
  
  return null;
}
```

### Two-Layer Theming
```typescript
interface TrackTheme {
  // Structural colors (IMMUTABLE — semantic meaning)
  structural: {
    verse: '#4CAF50';
    chorus: '#E53935';
    prechorus: '#FFC107';
    bridge: '#9C27B0';
    intro: '#00BCD4';
    outro: '#607D8B';
  };
  
  // Cover-driven colors (DYNAMIC — from Last.fm)
  cover: {
    primary: string;   // Dominant color
    secondary: string; // Secondary color
    accent: string;    // Accent color
    palette: string[];
  };
  
  // Computed (structural + cover blended)
  computed: {
    blockBackground: (blockType: string) => string;
    blockGlow: (blockType: string) => string;
    blockBorder: string;
    progressGradient: string;
  };
}
```

### GOLDEN RULE
**WagonTrain structural colors = IMMUTABLE**  
**Design elements (glow, border, gradient) = FLEXIBLE from cover**

## 📊 INTEGRATION POINTS

### 1. TrackRecord (IDB)
```typescript
// idb.service.ts — add to TrackRecord interface
coverArtUrl?: string | null;

// upload.service.ts — add to UploadSession interface
coverArtUrl?: string | null;
```

### 2. Fire-and-Forget Fetch
```typescript
// upload.service.ts — after saveTrack()
const { artist } = parseTrackName(trackTitle);
if (artist !== 'Разное') {
  fetchCoverArt(artist, trackTitle).then(coverUrl => {
    if (coverUrl) {
      w.idbService?.updateTrackField(savedTrack.id, { coverArtUrl });
    }
  }).catch(() => {}); // Silent fail
}
```

### 3. Catalog Render Points
- **CatalogLayout.tsx line ~310:** All Tracks column (32x32)
- **CatalogLayout.tsx line ~169:** My Music column (28x28)

### 4. Color Extraction
```typescript
// Canvas-based (no external libs)
function extractDominantColors(imageUrl: string): Promise<{
  primary: string;
  secondary: string;
  accent: string;
}> {
  // 1. Load image to canvas
  // 2. Sample every 10th pixel
  // 3. Group by similar colors
  // 4. Return top 3
}
```

## 📋 W12 ROADMAP
```
W12.1: Infrastructure (coverArtUrl in IDB, fetchCoverArt service)
W12.2: Catalog Integration (All Tracks + My Music)
W12.3: Header Integration (40x40 + track title)
W12.4: Color Extraction Engine (canvas-based)
W12.5: Dynamic Theme System (TrackTheme interface)
W12.6: Apply Theme — Dock Panel
W12.7: Apply Theme — MixerPanel
W12.8: Apply Theme — WagonTrain (structural preserved!)
```

---

# 🎯 KEY DECISIONS (FROZEN)

## W11 Decisions
- ✅ Two-phase prefetch (without duration → retry with duration)
- ✅ Service-level skip flags (NOT monkey-patch)
- ✅ lrclib для таймкодов, Genius для структуры блоков
- ✅ Fuzzy matching: substring first, Levenshtein only for <50 chars
- ✅ Confidence threshold: 80% for auto-accept
- ✅ Skip BOTH editors if confidence ≥ 80%

## W12 Decisions
- ✅ Last.fm API (not iTunes) — already tested, works
- ✅ Fire-and-forget cover fetch after saveTrack
- ✅ Two-layer theming: structural (immutable) + cover (flexible)
- ✅ WagonTrain structural colors NEVER change
- ✅ Cover drives: glow, border, gradient, background tint
- ✅ Placeholder if cover not found (gradient + first letter)

---

# 📊 RECON SUMMARY FROM 007

## W11 Recon Status
- ✅ parseTrackName exists in catalog/types.ts:48-91
- ✅ UploadSession in upload.service.ts:47-62
- ✅ TrackRecord in idb.service.ts:20-44
- ✅ saveTrack in upload.service.ts:477
- ⏳ PENDING: 4 recon queries (Sync Editor, Block Editor, existing lyrics services, pendingTrackTitle)

## W12 Recon Status (from 007 report)
- ✅ TrackRecord: add coverArtUrl at line 44
- ✅ UploadSession: add coverArtUrl at line 61
- ✅ Catalog render points: line 310 (All Tracks), line 169 (My Music)
- ✅ parseTrackName exists: catalog/types.ts:48-91
- ✅ Error handling pattern: try/catch + console.warn + silent fail
- ⏳ PENDING: 4 recon queries (header, canvas usage, Dock Panel, track.store)

---

# 🚀 GETTING STARTED CHECKLIST

## For W11 Branch
1. [ ] Run 4 pending 007 recons
2. [ ] Create auto-lyrics.service.ts (W11.1)
3. [ ] Add prefetch trigger in upload.service.ts (W11.2)
4. [ ] Add apply logic in UploadPanel.tsx (W11.3)
5. [ ] Add skip editor checks (W11.4)
6. [ ] Test with ZIP upload → verify auto-sync works

## For W12 Branch (after W11 done)
1. [ ] Run 4 pending 007 recons (header, canvas, Dock, track.store)
2. [ ] Add coverArtUrl to TrackRecord + UploadSession (W12.1)
3. [ ] Create fetchCoverArt service (W12.1)
4. [ ] Add catalog cover rendering (W12.2)
5. [ ] Add header cover (W12.3)
6. [ ] Create color extraction engine (W12.4)
7. [ ] Implement TrackTheme system (W12.5)
8. [ ] Apply to Dock, MixerPanel, WagonTrain (W12.6-8)

---

# ⚠️ CRITICAL NOTES

1. **UI hides loading progress** — user only sees Block/Sync Editors sequentially
2. **Vocals ALWAYS plays** — never muted by stems mode
3. **W7.3 auto-mute REMOVED** — replaced by Stems Mode button
4. **Stems Mode:** instrumental=1, vocals=1, music stems=0 by default
5. **Skip flags safety reset:** 3 seconds
6. **Last.fm API Key:** 396cc9b00c1e9601287f8f598bc3ea8f (store in env, not hardcoded)
7. **lrclib API:** https://lrclib.net/api/get (public, no key needed)

---

**END OF CONTEXT TRANSFER — DELETE THIS FILE AFTER NEW BRANCH INITIALIZED**
