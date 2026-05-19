# TC-010: Block-First Line Sync Architecture

**Status:** ✅ PRODUCTION (since 2025-04-13)
**Replaces:** `matchGeniusToLrc()` (legacy N:M fuzzy matching)
**Files:** `src/services/auto-lyrics.service.ts`, `src/components/UploadPanel.tsx`, `src/types/persistence.types.ts`

---

## 🎯 Problem Statement

### Legacy Approach: `matchGeniusToLrc()` (DEPRECATED)

**Architecture:**
- Genius text = display + structure
- LRC = timing only
- Fuzzy N:M matching (38 Genius lines vs 57 LRC lines)

**Problems:**
1. **N:M line break mismatch** — Genius uses long lines (with commas), LRC uses short lines (split at phrases)
2. **Systematic drift** — LRC timestamps were from WRONG version (201s vs 203s), causing -1.0s to -2.8s drift
3. **Complex matching** — 38 fuzzy matches with 3 passes (forward-first, rescue, word-coverage)
4. **Word-boundary bugs** — Substring matching caused false positives ("you" matching "youre")

### New Approach: `blockFirstLineSync()`

**Architecture:**
- **LRC lines = display + timing** (single source of truth, drift ≈ 0)
- **Genius blocks = structure overlay** (types, performers, metadata)
- **Block-first matching** — only 7-8 matches (one per block) instead of 38 (one per line)

**Benefits:**
- ✅ Drift ≈ 0s (LRC timestamps are exact)
- ✅ No N:M matching complexity
- ✅ No interpolation needed
- ✅ Shorter lines = better for karaoke display
- ✅ Simpler code (163 lines vs 450+ lines)

---

## 🏗️ Architecture

### Data Flow

```
User pastes Genius text
         ↓
  parseTaggedLyrics() → blocks with metadata (type, performer, label)
         ↓
  Fetch LRC from lrclib.net (search API → pick best duration match)
         ↓
  blockFirstLineSync(geniusText, lrcResult)
         ↓
  ┌─────────────────────────────────────────┐
  │ 1. LRC lines → displayLines + markers   │
  │ 2. For each Genius block:               │
  │    - Find first content line in LRC     │
  │    - Word-boundary match (4 words)      │
  │    - Occurrence-aware search (forward)  │
  │ 3. Assign LRC line ranges to blocks     │
  │ 4. Add contentLines for WagonTrain      │
  └─────────────────────────────────────────┘
         ↓
  Return { markers, blocks, confidence: 1.0, lyricsLines }
         ↓
  Save to IDB: track.lyrics, track.syncMarkers, track.blocksData
```

### Key Invariants

1. **LRC is display source of truth**
   - `track.lyrics` = LRC lines (clean, no bracket tags)
   - `track.lyricsOriginalContent` = Genius text (with tags, for audit)

2. **Each LRC line = 1 marker**
   - `marker.lineIndex` = index in displayLines (0-based)
   - `marker.time` = LRC timestamp (exact, no offset)
   - No N:M matching → no drift

3. **Blocks are time-mapped from Genius**
   - Find first line of each Genius block in LRC
   - Block owns all LRC lines from its start to next block's start
   - Block metadata (type, performer) from Genius

4. **Word-boundary matching**
   - Uses `Set(lrcWords)` for exact word matching
   - Prevents substring false positives ("you" ≠ "youre")
   - First 4 words (>2 chars) for matching

5. **Occurrence-aware search**
   - Search FORWARD from last matched position
   - Handles repeated blocks (Chorus ×3)
   - Each block gets its correct occurrence

---

## 📋 Algorithm Details

### Step 1: Build Display Lines + Markers

```typescript
const displayLines: string[] = [];
const markers: PersistedSyncMarker[] = [];

for (let i = 0; i < lrcResult.lines.length; i++) {
  const lrcLine = lrcResult.lines[i];
  if (!lrcLine.text.trim()) continue;
  
  const displayIdx = displayLines.length;
  displayLines.push(lrcLine.text);
  
  markers.push({
    id: `lrc-${i}-${Date.now()}`,
    lineIndex: displayIdx,
    time: lrcLine.time,  // Raw LRC time — no offset!
    text: lrcLine.text,
  });
}
```

**Key decision:** NO LRC_OFFSET needed because search API picks correct version.

### Step 2: Block-First Line Matching

```typescript
const normalizedDisplay = displayLines.map(l => _normalizeText(l));
let lastMatchedLrcIdx = -1;

const blocks = tagResult.blocks.map((block, bi) => {
  const firstLine = block.contentLines.find(l => l.trim());
  if (!firstLine) return { /* empty block */ };
  
  const firstNorm = _normalizeText(firstLine.trim());
  const firstWords = firstNorm.split(/\s+/).filter(w => w.length > 2).slice(0, 4);
  
  let bestIdx = -1;
  let bestScore = 0;
  
  // Search FORWARD from last matched position (occurrence-aware!)
  const searchStart = Math.max(0, lastMatchedLrcIdx);
  for (let i = searchStart; i < normalizedDisplay.length; i++) {
    const lrcNorm = normalizedDisplay[i];
    
    // Word-boundary match (NOT substring!)
    const lrcWords = new Set(lrcNorm.split(/\s+/));
    const matchCount = firstWords.filter(w => lrcWords.has(w)).length;
    const score = firstWords.length > 0 ? matchCount / firstWords.length : 0;
    
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  
  if (bestScore < 0.5 || bestIdx < 0) {
    console.warn(`Block "${block.label}" not found (score: ${(bestScore * 100).toFixed(0)}%)`);
    return { /* empty block */ };
  }
  
  lastMatchedLrcIdx = bestIdx;
  
  return {
    id: `auto-block-${bi}`,
    name: block.label,
    _lrcStartIdx: bestIdx,  // temp, removed later
    type: block.type,
  };
});
```

**Key decisions:**
- First 4 words (>2 chars) — balances specificity vs robustness
- Threshold 50% — allows minor variations but prevents false matches
- Word-boundary matching — prevents substring false positives
- Forward search — handles repeated occurrences correctly

### Step 3: Assign LRC Line Ranges to Blocks

```typescript
for (let i = 0; i < blocks.length; i++) {
  const startIdx = blocks[i]._lrcStartIdx;
  if (startIdx < 0) continue;
  
  // Find next block's start
  let endIdx = displayLines.length;
  for (let j = i + 1; j < blocks.length; j++) {
    const nextStart = blocks[j]._lrcStartIdx;
    if (nextStart >= 0) {
      endIdx = nextStart;
      break;
    }
  }
  
  blocks[i].lineIndices = [];
  for (let k = startIdx; k < endIdx; k++) {
    blocks[i].lineIndices.push(k);
  }
  
  // Add contentLines for WagonTrain display
  blocks[i].contentLines = blocks[i].lineIndices.map(
    (idx: number) => displayLines[idx]
  );
  
  // Clean up temp fields
  delete blocks[i]._lrcStartIdx;
}
```

**Key decisions:**
- Block N owns lines [startIdx, nextBlock.startIdx)
- Last block owns lines [startIdx, end]
- `contentLines` added for WagonTrain display (TC-010 enhancement)

### Step 4: DEV Diagnostics

```typescript
if (import.meta.env.DEV) {
  const found = blocks.filter(b => b.lineIndices.length > 0).length;
  const total = blocks.length;
  const linesWithBlocks = blocks.reduce((s, b) => s + b.lineIndices.length, 0);
  
  console.log(`[TC-010] Block-first sync:`);
  console.log(`  Display lines: ${displayLines.length} (from LRC)`);
  console.log(`  Markers: ${markers.length} (exact LRC timestamps)`);
  console.log(`  Blocks: ${found}/${total} mapped (${(found/total*100).toFixed(0)}%)`);
  console.log(`  Lines covered by blocks: ${linesWithBlocks}/${displayLines.length}`);
  
  for (const block of blocks) {
    if (block.lineIndices.length > 0) {
      const first = block.lineIndices[0];
      const last = block.lineIndices[block.lineIndices.length - 1];
      console.log(
        `  [${block.type}] "${block.name}": ` +
        `lines ${first}-${last} (${block.lineIndices.length}), ` +
        `time ${markers[first]?.time?.toFixed(1)}s-${markers[last]?.time?.toFixed(1)}s` +
        `${block.lineIndices.length > 8 ? ' ⚠️ >8 lines' : ''}`
      );
    } else {
      console.log(`  [${block.type}] "${block.name}": NOT MAPPED`);
    }
  }
}
```

---

## 🔧 LRC Fetching: Search API

### Problem: `/api/get` Returns Wrong Version

**Symptom:**
- `/api/get` returned LRC version with duration 201s
- Manual timing showed correct version has duration 203s
- Difference: LRC timestamps were ~2s early systematically

**Root cause:**
- lrclib has multiple versions of same track
- `/api/get` doesn't guarantee best version
- Need to search and pick by duration match

### Solution: Search API + Duration Matching

```typescript
async function _fetchLrclib(artist: string, track: string, duration?: number) {
  // Step 1: Search for all versions
  const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(artist + ' ' + track)}`;
  const results = await fetch(searchUrl);
  
  // Step 2: Filter to synced versions only
  const synced = results.filter(r => r.syncedLyrics);
  
  // Step 3: Pick version with duration closest to our track
  let best = synced[0];
  if (duration) {
    let bestDiff = Math.abs((best.duration || 0) - duration);
    for (const version of synced) {
      const diff = Math.abs((version.duration || 0) - duration);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = version;
      }
    }
  }
  
  // Step 4: Cache selected version
  _cache.set(key, {
    lines: _parseLrc(best.syncedLyrics),
    rawSynced: best.syncedLyrics,
    fetchedAt: Date.now(),
  });
  
  console.log(
    `[AutoLyrics] Selected LRC: id=${best.id} duration=${best.duration}s ` +
    `(requested=${duration}s, diff=${bestDiff.toFixed(1)}s, ${synced.length} versions)`
  );
}
```

**Fallback:** If search fails → old `/api/get` endpoint

**Key decisions:**
- Duration matching ensures correct version
- Search API returns all versions (not just one)
- Fallback preserves backward compatibility

---

## 📊 Type Definitions

### PersistedTextBlock (enhanced)

```typescript
export interface PersistedTextBlock {
  id: string;
  name: string;
  lineIndices: number[];
  type?: string;
  originalLineIndices?: number[];
  contentLines?: string[];  // TC-010: Display text for WagonTrain
}
```

**Enhancement:** `contentLines` added for WagonTrain display (previously missing).

---

## 🎯 Performance Characteristics

| Metric | Legacy `matchGeniusToLrc` | TC-010 `blockFirstLineSync` |
|---|---|---|
| **Matching complexity** | 38 fuzzy matches (N:M) | 7-8 word matches (1:1) |
| **Matching passes** | 3 (forward, rescue, word-coverage) | 1 (block-first) |
| **Drift** | -1.0s to -2.8s | ≈ 0s |
| **Code size** | 450+ lines | 163 lines |
| **Display lines** | 38 (Genius, long) | 57 (LRC, short) |
| **Block accuracy** | Line-based (from Genius) | Time-based (from LRC) |
| **Edge cases** | N:M boundaries, duplicates | Repeated blocks only |

---

## 🔍 Edge Cases & Solutions

### Edge Case 1: Repeated Blocks (Chorus ×3)

**Problem:** Genius has multiple blocks with same type/name.

**Solution:** Occurrence-aware search (forward from last matched position).

```typescript
let lastMatchedLrcIdx = -1;

for (const block of blocks) {
  const searchStart = Math.max(0, lastMatchedLrcIdx);
  // Search forward only → each block gets its correct occurrence
  for (let i = searchStart; i < normalizedDisplay.length; i++) {
    // ... matching logic
  }
  lastMatchedLrcIdx = bestIdx;
}
```

**Example:**
- 1st Chorus → searches from line 0 → finds LRC[14] @ 67.29s
- 2nd Chorus → searches from line 14 → finds LRC[33] @ 115.57s
- 3rd Chorus → searches from line 33 → finds LRC[38] @ 127.07s

### Edge Case 2: Word-Boundary False Positives

**Problem:** Substring matching causes "you" to match "youre".

**Solution:** Word-boundary matching using `Set`.

```typescript
// WRONG (substring):
const matchCount = firstWords.filter(w => lrcNorm.includes(w)).length;

// CORRECT (word-boundary):
const lrcWords = new Set(lrcNorm.split(/\s+/));
const matchCount = firstWords.filter(w => lrcWords.has(w)).length;
```

**Example:**
- "you" does NOT match "youre" ✅
- "with you" matches "im with you" ✅

### Edge Case 3: Block Not Found (< 50% match)

**Problem:** First line of block not found in LRC.

**Solution:** Block gets empty `lineIndices`, warning logged.

```typescript
if (bestScore < 0.5 || bestIdx < 0) {
  console.warn(`Block "${block.label}" first line not found in LRC`);
  return {
    id: `auto-block-${bi}`,
    name: block.label,
    lineIndices: [],  // Empty → no lines assigned
    type: block.type,
  };
}
```

**Impact:** Block exists but has no lines → user can manually assign in Block Editor.

### Edge Case 4: LRC Version Mismatch

**Problem:** `/api/get` returns wrong version (201s vs 203s).

**Solution:** Search API + duration matching (see section above).

**Diagnostic:**
```
[AutoLyrics] Selected LRC: id=XXX duration=203.5s 
(requested=203.2s, diff=0.3s, 4 synced versions available)
```

### Edge Case 5: LRC Markers Misaligned with Vocal Stem

**Symptom:** After VOC correction, first marker is correct but subsequent markers drift progressively.

**Cause:** LRC timestamps from lrclib.net correspond to a different version/mastering of the track. Linear offset correction aligns the first marker to vocal onset, but cannot fix per-marker placement errors by the LRC author.

**Solution (W13):** Multi-anchor correction — find vocal onsets at each block boundary, interpolate between anchor points.

**Solution (now):** Manual adjustment in Sync Editor. Use marker selection + group drag (planned) to shift multiple markers at once.

---

## 🧪 Testing Protocol

### Test 1: Correct LRC Version

1. Clear cache (DevTools → Application → Clear storage)
2. Load "Linkin Park - With You"
3. Check `[AutoLyrics] Selected LRC` log

**Expected:**
- `duration ≈ 203s` (NOT 201s!)
- `diff < 1.0s`
- `synced versions > 1`

### Test 2: Timing Accuracy

1. Check first few LRC timestamps
2. Play track, verify markers sync with vocals

**Expected:**
- LRC[0] ≈ 30.40s (NOT 29.60s!)
- LRC[1] ≈ 33.62s (NOT 31.09s!)
- Drift ≈ ±0.1s

### Test 3: Block Mapping Accuracy

1. Check `[TC-010]` logs
2. Verify block boundaries

**Expected:**
- Pre-Chorus = lines 8-13
- Chorus = lines 14-18
- "Even if you're not with me" in Pre-Chorus (NOT Chorus!)

### Test 4: Repeated Blocks

1. Load track with multiple choruses
2. Check each chorus gets correct LRC range

**Expected:**
- Each chorus has different line range
- Occurrence-aware search works correctly

---

## 📝 Migration Notes

### From `matchGeniusToLrc` to `blockFirstLineSync`

**Breaking changes:**
1. `track.lyrics` now contains LRC lines (not Genius lines)
2. `marker.lineIndex` references LRC indices (not Genius indices)
3. Block `lineIndices` reference LRC indices (not Genius indices)

**Migration:**
- Old tracks with Genius lyrics → migrate on next load (TC-006/007)
- Extract clean lyrics from `track.lyricsOriginalContent`
- Re-run `blockFirstLineSync` with existing LRC cache

**Backward compatibility:**
- `matchGeniusToLrc` still exists (not deleted)
- Can be used for legacy tracks if needed
- New tracks always use `blockFirstLineSync`

---

## 🚀 Future Work

### VOC — Vocal Onset Correction (TC-VOC-01/02/03/04) ✅ COMPLETE

**Problem:** LRC markers may be misaligned with actual vocal stem due to different mastering/offset in LRC source.

**Solution:** RMS envelope analysis of vocal stem detects first vocal onset, computes linear offset, shifts all markers (M1+M2), persists to IDB with `dataVersion=3`.

**Algorithm:**

1. Decode `track.vocalsData` via `AudioContext.decodeAudioData()`
2. Compute RMS envelope (50ms windows)
3. Find first sustained onset (>threshold, ≥3 consecutive windows = 150ms)
4. `offset = vocalOnsetTime - firstMarkerTime`
5. Apply if `0.3s ≤ |offset| ≤ 3.0s` — shift ALL markers (M1 + M2)
6. Persist: `updateTrackField(trackId, { syncMarkers: correctedMarkers, dataVersion: 3 })`

**Files:** `src/services/vocal-onset.service.ts`, `src/services/track.orchestrator.ts` (step 11a.5)

**Result:** First marker aligns with actual vocal onset. ~80% of all markers land accurately. Remaining ~20% may have non-linear drift (see Multi-Anchor Correction roadmap).

**Known limitation:** Linear offset cannot fix non-linear drift where individual markers diverge from actual timing. See `docs/architecture/sync-accuracy-roadmap.md` for L3+ roadmap.

**Performance:** ~5-13s on current hardware (`decodeAudioData` of full vocal stem). Async VOC planned for W13.

### TC-011: Block Splitting (8-Line Limit)

**Problem:** Some blocks have > 8 LRC lines (Legacy limit).

**Solution:** Auto-split blocks into sub-blocks.

```typescript
if (block.lineIndices.length > 8) {
  const subBlocks = splitBlockInto8LineChunks(block);
  // Replace block with sub-blocks
}
```

**Status:** 📋 PENDING (after TC-010 stabilizes)

### LRC Offset Calibration

**Current:** No offset needed (search API provides correct version).

**Future:** If needed, add configurable offset per track:

```typescript
const LRC_OFFSET = getTrackOffset(trackId); // default 0
time: lrcLine.time + LRC_OFFSET,
```

**Status:** ⏸️ DEFERRED (not needed now)

---

## 📚 Related Documents

- **TC-001 to TC-008:** Legacy auto-sync improvements (deprecated by TC-010)
- **TC-006/007:** Legacy track migration
- **sync-system.md:** General sync system architecture
- **marker-system-spec.md:** Marker system specification
- **sync-accuracy-roadmap.md:** Full L0-L5 accuracy progression roadmap
- **vocal-onset.service.ts:** VOC algorithm implementation
- **zip-pipeline.md:** ZIP export/import pipeline with lyricsOriginalContent roundtrip

---

## LRC Picker Integration

### How LRC Picker uses blockFirstLineSync

When a user selects an LRC version in the picker:

1. `handleLrcVersionSelect()` reads `geniusText` from `legacyTrack.lyricsOriginalContent`
2. `parseLrcVersion(version, geniusText)` calls `blockFirstLineSync(geniusText, lrcResult)` internally
3. If `geniusText` contains structural tags `[Verse]`, `[Chorus]`, `[Bridge]` → blocks are created
4. If `geniusText` lacks tags or is undefined → `blocks=[]` returned

### Block Preservation Rule (TC-LRC-03)

When `parseLrcVersion()` returns `blocks=[]`:

```typescript
const blocksToApply = result.blocks.length > 0 
  ? result.blocks           // New blocks from LRC (wins)
  : (ld.textBlocks || []);  // Preserve existing blocks
```

**Rationale:** `blocks=[]` means "this LRC format has no block information" — NOT "the user deleted all blocks". Existing blocks are tied to the track structure and remain valid across LRC version changes.

### lyricsOriginalContent Persistence

`lyricsOriginalContent` is the source text with structural tags. It must survive:
- **F5 (page reload):** Persisted to IDB via `updateTrackField()` (TC-LRC-02)
- **ZIP roundtrip:** Included in `export.json` (TC-LRC-04) and restored on import (TC-LRC-05)
- **LRC version switch:** Saved to IDB on every switch (TC-LRC-02)

Without `lyricsOriginalContent`, the LRC Picker cannot run `blockFirstLineSync()`, resulting in `blocks=[]` and potential block destruction.

### Data Flow Diagram

```
Genius API / Manual Upload
  ↓
lyricsOriginalContent = "[Verse 1]\nLine 1\n[Chorus]\nLine 2"
  ↓
IDB persist ──────────────────────┐
  ↓                               ↓
LRC Picker reads geniusText    ZIP export.json
  ↓                               ↓
blockFirstLineSync()           ZIP import
  ↓                               ↓
blocks created              lyricsOriginalContent
  ↓                        restored to IDB
ld.loadImportedBlocks()        ↓
  ↓                        LRC Picker works
Markers colored ✅           after reimport ✅
```

### Failure Modes

| Scenario | geniusText | blocks result | Impact | Mitigation |
|----------|-----------|---------------|--------|------------|
| Normal (tags present) | 1882 chars with tags | 8 blocks | ✅ Full sync | — |
| After ZIP reimport (old ZIP) | 1564 chars no tags | 0 blocks | ⚠️ Blocks not created | TC-LRC-03 preserves existing |
| No lyricsOriginalContent | undefined | 0 blocks | ⚠️ No block creation | TC-LRC-03 preserves existing |
| F5 after version switch | Restored from IDB | Depends on content | ✅ Works | TC-LRC-02 persist |

---

## §10. Genius-as-Scaffold Architecture

**Status:** ❄️ Frozen principle (2026-04-29)

### Принцип

beLive использует два независимых источника данных для формирования TrackMap:

```
Genius  = КАРКАС (структура, боксы, триггеры)
           "Есть Bridge между Verse 3 и Chorus"

lrclib  = ТАЙМИНГИ (точные позиции строк)
           "Строка X на 159.8s, строка Y на 163.5s"

blockFirstLineSync = СОЕДИНИТЕЛЬ
           "Bridge из Genius → позиция 30-38 в LRC"
```

**Genius определяет СТРУКТУРУ, lrclib определяет ВРЕМЯ.**

### Последствия

1. **LRC может иметь больше строк чем Genius** — полный текст припева vs сокращение "All, all, a-a-a-a-all (Oh)". Это не баг, а разница форматов.
2. **LRC может иметь меньше строк чем Genius** — инструментальные паузы, переходы без вокала.
3. **Range assignment использует nextStart** (не contentLineCount) — потому что LRC структура может отличаться от Genius структуры.
4. **firstWords supplementation** использует contentLines[1..2] из Genius для усиления матчинга — Genius каркас даёт контекст.

---

## §11. firstWords Matching Strategy

**Status:** ✅ Implemented (TC-BRIDGE-07)

### Pipeline формирования firstWords

```
1. Extract first non-empty contentLine из блока
2. _normalizeText() — lowercase, strip punctuation, collapse hyphens
3. Filter: w.length > 2 (первичный фильтр)
4. Fallback: если пусто → w.length >= 2 (TC-BRIDGE-01)
5. Дедупликация: [...new Set(firstWords)] (TC-BRIDGE-07)
6. Supplementation: если < 2 уникальных слов → добавить из contentLines[1..2]
```

### Дедупликация (TC-BRIDGE-07)

**Проблема:** "All, all, a-a-a-a-all (Oh)" → после нормализации → ["all", "all", "all"]
**Ложный матч:** LRC "All caught up in the eye of the storm" содержит "all" → 3/3 = 100%

**Фикс:** `[...new Set(firstWords)]` → ["all"] → supplementation активируется

### Supplementation (TC-BRIDGE-07)

**Условие:** Если после дедупликации < 2 уникальных слов — добавить слова из contentLines[1..2].

**Пример:**
```
Chorus first line: "All, all, a-a-a-a-all (Oh)"
→ dedup: ["all"]  ← только 1 слово!

Supplement из contentLines[1]: "All I wanna do is trade this life for something new"
→ normalize → filter → unique: ["wanna", "trade", "this", "life", ...]
→ Добавить до 3 уникальных: ["all", "wanna", "trade"]

LRC line 33 "All caught up in the eye of the storm":
  matchCount = 1/3 = 33% < 50% → REJECTED ✅

LRC line 39 "All I wanna do is trade this life for something new":
  matchCount = 3/3 = 100% → ACCEPTED ✅
```

### Fallback для коротких слов (TC-BRIDGE-01)

**Проблема:** Слова длины 2 ("yo", "oh", "we") отфильтровывались → Bridge "Yo, yo" → firstWords=[]

**Фикс:** Если `w.length > 2` даёт пустой массив → использовать `w.length >= 2`

### Почему supplementation лучше чем multi-line verification

| Подход | Идея | Проблема |
|--------|------|----------|
| Multi-line verification | Проверять 2-ю/3-ю строку блока при матче | Слишком агрессивно — разные структуры LRC/Genius ломаются |
| lastMatchedLrcIdx += contentLineCount | Сдвигать search start | Overshot — Outro теряется (TC-BRIDGE-05) |
| **Supplementation** | Усилить firstWords из следующих строк | **Мягкий подход — не ломает структуру, только уточняет матч** |

---

## §12. Range Assignment Logic

**Status:** ❄️ Frozen design

### Алгоритм

Block N получает ВСЕ LRC строки от своего `_lrcStartIdx` до `_lrcStartIdx` блока N+1:

```typescript
for (let i = 0; i < blocks.length; i++) {
  const startIdx = (blocks[i] as any)._lrcStartIdx;
  if (startIdx < 0) continue;
  
  let endIdx = displayLines.length;
  for (let j = i + 1; j < blocks.length; j++) {
    const nextStart = (blocks[j] as any)._lrcStartIdx;
    if (nextStart >= 0) {
      endIdx = nextStart;
      break;
    }
  }
  
  blocks[i].lineIndices = [];
  for (let k = startIdx; k < endIdx; k++) {
    blocks[i].lineIndices.push(k);
  }
}
```

### Почему НЕ contentLineCount

| Подход | Bridge (9 Genius строк) | Результат |
|--------|------------------------|-----------|
| nextStart | startIdx=30, nextStart=39 → lines 30-38 | 8-9 LRC строк ✅ |
| contentLineCount | startIdx=30, +9 → lines 30-38 | Работает ТОЛЬКО если LRC имеет ≥9 строк |
| contentLineCount + lookback | startIdx=30, +9-2=37 → Chorus ищет с 37 | Может overshot (TC-BRIDGE-05) |

**nextStart — самый надёжный подход** потому что основан на реальной LRC структуре, а не на предполагаемом количестве строк.

### Известные ограничения

1. **Bridge может иметь 8/9 строк** — если LRC не содержит первую Genius строку ("Yo, yo" может отсутствовать в LRC)
2. **"All, all, a-a-a-a-all (Oh)" отсутствует в дисплее** — Genius shorthand vs LRC полный текст. Это не баг.

---

## §14. Block Auto-Numbering Logic

**Status:** ✅ PRODUCTION (since WTM-03/04/05, 2026-04-30)
**Owner:** Blocks System / TrackMap
**Files:** `src/blocks/parser/tagged-lyrics.parser.ts`, `src/blocks/store/blockEditor.store.ts`, `src/components/WagonTrain.tsx`

### 🎯 Core Principle

Auto-numbering applies **exclusively to `verse` and `chorus` block types**, and **only when duplicated**:

- `verse` × 1 → `"Verse"`
- `verse` × 2 → `"Verse 1"`, `"Verse 2"`
- `chorus` × 3 → `"Chorus 1"`, `"Chorus 2"`, `"Chorus 3"`
- `bridge`, `intro`, `outro`, `prechorus` → **never numbered**, regardless of count

> ✅ This is enforced at **ALL layers**: parser, save, and display.

### 🧩 Two-Path Architecture

#### Path 1: Auto-Sync (lrclib + Genius)

1. `auto-lyrics.service.ts` fetches lrclib timing + Genius structure
2. `parseTaggedLyrics()` processes Genius text → extracts blocks with `type`, `label`, `number?`
3. **TC-WTM-03**: Post-processes `filteredBlocks` → adds auto-numbering for duplicate `verse`/`chorus`
   - Counts total per type → `sameTypeTotals`
   - Assigns `number` only if `count > 1`
   - Respects explicit author numbers (`[Verse 2]` → `number: 2`)
4. `block.label` is passed directly to IDB → `name: block.label`

#### Path 2: Manual (Block Editor)

1. User pastes Genius text or edits manually
2. `parseTaggedLyrics()` runs same logic (TC-WTM-03)
3. **TC-WTM-04**: `blockEditor.store.ts` applies auto-numbering on `save()`
   - Counts `state.blocks` per type → `sameTypeTotals`
   - Assigns sequential number on save → `"Verse 1"`, `"Verse 2"`
   - Uses `BLOCK_TYPE_CONFIG` for base label

> ✅ Both paths converge on the same `SavedBlock.name` format in IDB.

### 🖼️ Display Logic (WagonTrain)

#### TC-WTM-02: Defensive structural labeling

WagonTrain uses IIFE fallback to ensure correct labels **even for legacy data**:

```tsx
{(() => {
  if (block.name && !block.name.match(/^Block \d+$/)) return block.name;
  if (block.type) {
    const config = BLOCK_TYPE_CONFIG.find(c => c.type === block.type);
    if (config) return config.label;
  }
  return block.name || 'Block';
})()}
```

#### TC-WTM-05: Remove redundant block index

- Removed `<span className={styles.index}>{i + 1}</span>` from WagonTrain
- Now shows **only semantic label**: `"Verse 2"`, not `"3 Verse 2"`
- Layout preserved via flex: `flex: 1 1 auto` on `.title`
- Loop toggle remains `position: absolute; right: 4px`

### 🚫 What Does NOT Happen

- ❌ No numbering for `bridge`, `intro`, `outro`, `prechorus`, `instrumental`
- ❌ No auto-numbering for `verse`/`chorus` when count = 1
- ❌ No fallback to first-line content — always uses structural label
- ❌ No dependency on `block.id` or order — pure type-based logic

---

## 📁 Files Affected

| File | Role | TC |
|------|------|----|
| `src/blocks/parser/tagged-lyrics.parser.ts` | Source fix: auto-numbering in parser | TC-WTM-03 |
| `src/blocks/store/blockEditor.store.ts` | Save fix: auto-numbering on Block Editor save | TC-WTM-04 |
| `src/components/WagonTrain.tsx` | Display fix: structural labels + no block index | TC-WTM-02, TC-WTM-05 |
| `src/blocks/types.ts` | Canonical mapping: `BLOCK_TYPE_CONFIG` | Reference |

---

## 📈 Impact Summary

| Metric | Before | After |
|--------|--------|-------|
| Block naming consistency | Mixed: first lines, "Block N", structural | ✅ 100% structural labels |
| Verse/Chorus clarity | "Verse", "Chorus" (no context) | ✅ "Verse 1", "Chorus 2" |
| UI clutter | "3 Verse 2" (confusing) | ✅ "Verse 2" (semantic) |
| Auto-sync reliability | Required manual fixes | ✅ Works out-of-the-box |
| Block Editor UX | Required manual re-labeling | ✅ Auto-numbered on save |

---

## 📌 Next Steps

- [ ] Add to `architecture-map-2.1.md` ownership matrix
- [ ] Update `BLOCK_TYPE_CONFIG` docs if new types added
- [ ] Verify all legacy tracks render correctly

---

## 📝 Migration Notes

### From Legacy Block Naming to Auto-Numbering

**Breaking changes:**
1. `SavedBlock.name` now contains semantic labels with optional numbering (`"Verse 1"`, `"Chorus 2"`)
2. Legacy `"Block 1"`, `"Block 2"` names are replaced by structural labels
3. First-line content fallback is removed — always structural

**Migration:**
- Old tracks with legacy names → migrate on next Block Editor save (TC-WTM-04)
- Existing `name: "Block N"` entries → automatically converted to structural labels on save
- Tracks with no structure → fall back to `BLOCK_TYPE_CONFIG` mapping

**Backward compatibility:**
- Legacy `"Block N"` names still work as fallback (TC-WTM-02)
- All new tracks use auto-numbering
- `BLOCK_TYPE_CONFIG` remains source of truth for base labels

---

## 🚀 Future Work

### Block Type Expansion

**Current:** Only `verse` and `chorus` are auto-numbered.

**Future expansion:** Add `prechorus`, `bridge`, `outro` to `typesToNumber` Set if user demand increases.

### Enhanced Numbering Rules

**Current:** Sequential numbering based on appearance order.

**Future:** Support for explicit author numbering like `[Verse 2]`, `[Chorus 1a]`, `[Chorus 1b]` for complex structures.

---

**Last updated:** 2026-04-30
**Author:** Center (with GLM + Nikita collaboration)
**Status:** ✅ PRODUCTION

---

## §13. Known Issues & Fixes (TC-BRIDGE Series)

| TC | Проблема | Фикс | Файл | Статус |
|----|----------|------|------|--------|
| TC-BRIDGE-01 | Короткие слова (yo, oh, we) отфильтрованы | Fallback w.length >= 2 | `auto-lyrics.service.ts` | ✅ |
| TC-BRIDGE-02 | Пустые lineIndices не фильтруются в blocks.bridge | Filter перед map | `blocks.bridge.ts` | ✅ |
| TC-BRIDGE-03 | TC-006 читает stale маркеры | Guard: m1Markers.length > 0 | `track.orchestrator.ts` | ✅ |
| TC-BRIDGE-04-DIAG | Diagnostics после удаления temp fields | Перемещён до cleanup | `auto-lyrics.service.ts` | ✅ |
| TC-BRIDGE-05 | lastMatchedLrcIdx += contentLineCount | Отклонён — overshot | — | ❌ Reverted |
| TC-BRIDGE-06 | Revert к original lastMatchedLrcIdx | lastMatchedLrcIdx = bestIdx | `auto-lyrics.service.ts` | ✅ |
| TC-BRIDGE-07 | False positive matches (дубликаты слов) | Dedup + supplementation | `auto-lyrics.service.ts` | ✅ ROOT FIX |
| TC-BRIDGE-08 | Verbose DEV логирование | Упрощённый формат | `auto-lyrics.service.ts` | ✅ |

### VOC Systematic Offset (отдельная проблема)

Все блоки имеют ~-5s offset в VOC. Это систематический LRC time shift, не связан с Bridge truncation.

**Recommendation:** TC-VOC-01 для investigation.

---

**Last updated:** 2026-04-29
**Author:** Center (with GLM + Nikita collaboration)
**Status:** ✅ PRODUCTION
