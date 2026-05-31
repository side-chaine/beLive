# 📘 Block Scenes Editor — Architecture Document v1.0

**Status:** Current implementation baseline  
**Date:** 2026-05-29  
**Authors:** Центр_28.3 + Центр_28.4  
**Next Phase:** Block Scenes Editor v2 (effects, transitions, plate controls, fonts)

---

## 1. WHAT THIS SYSTEM DOES

Block Scenes Editor allows users to assign custom background images to **individual lines** or **entire blocks** of a song. When rehearsing, backgrounds change automatically as the active line moves — creating a music-video-like visual experience.

**Priority chain (runtime):**
```
lineScene > blockScene > customBg > coverArt > pexels slideshow
```

---

## 2. DATA MODEL

### 2.1 Separate IDB Database

**DB:** `beLive_scenes` v1  
**Store:** `custom_backgrounds`  
**Key path:** `id`  
**Index:** `trackId`

This is SEPARATE from `TextAppDB` v9 (legacy, frozen). Never merge.

### 2.2 BlockScene Record

```typescript
interface BlockScene {
  id: string;            // `${trackId}_${blockIndex}` or `${trackId}_${blockIndex}_${lineIndex}`
  trackId: number;
  blockIndex: number;
  lineIndex?: number | null;  // null = block-level, number = line-level
  blockId?: string;
  blob: Blob;
  theme: CoverArtTheme;
  addedAt: string;
}
```

**ID convention:**
- Block scene: `1779964512057_0` (trackId_blockIndex)
- Line scene: `1779964512057_0_3` (trackId_blockIndex_lineIndex)

**lineIndex is LOCAL to block** — not global. Line 3 in block 2 = index 3 within that block's lineIndices array. Conversion happens via `subOffset` accumulator in the modal.

### 2.3 SceneMap (runtime, not persisted)

```typescript
interface SceneEntry {
  url: string;        // Object URL from URL.createObjectURL(blob)
  theme: CoverArtTheme;
}

interface SceneMap {
  blockScenes: Map<number, SceneEntry>;    // blockIndex → scene
  lineScenes: Map<string, SceneEntry>;     // `${blockIndex}_${lineIdxInBlock}` → scene
}
```

SceneMap is built at preload time and passed to RehearsalBackground via `setBlockSceneMap()`.

---

## 3. EVENT TOPOLOGY

```
Track Load
  │
  ├─ document 'track-loaded'
  │    └─ block-scene.service.onTrackLoaded()
  │         └─ doPreload()
  │              └─ preloadScenesForTrack(trackId)
  │                   ├─ revokeAllSceneUrls() — clean previous Object URLs
  │                   ├─ getScenesForTrack() — IDB read (metadata only)
  │                   ├─ For each scene: getSceneBlob() → URL.createObjectURL()
  │                   └─ Build SceneMap { blockScenes, lineScenes }
  │
  ├─ document 'block-scenes-loaded' { trackId, sceneCount, sceneMap }
  │    └─ useBackgroundManagers.onScenesLoaded()
  │         ├─ useTrackStore.setHasBlockScenes(sceneCount > 0)
  │         └─ managers.rehearsal.setBlockSceneMap(sceneMap)
  │
  └─ Playback active-line-changed
       └─ RehearsalBackground._boundHandler()
            ├─ _getBlockIndexByLine() — global lineIndex → blockIndex
            ├─ _getLineIndexInBlock() — global lineIndex → local lineIdxInBlock
            ├─ _resolveSceneUrl(blockIndex, lineIdxInBlock) — line > block > null
            ├─ Cooldown: BLOCK=300ms, LINE=150ms
            ├─ setBlockScene(url) — crossfade with preload
            └─ _prefetchNextLine() — lookahead 1 line
```

### 3.1 Double Preload Guard

```typescript
let _lastPreloadedTrackId: number | null = null;
let _preloadInProgress = false;

const doPreload = async () => {
  if (_lastPreloadedTrackId === numId || _preloadInProgress) return;
  _preloadInProgress = true;
  try {
    const sceneMap = await preloadScenesForTrack(numId);
    _lastPreloadedTrackId = numId;
    // dispatch event...
  } finally {
    _preloadInProgress = false;
  }
};
```

Without `_preloadInProgress`: eager call + event call both fire synchronously before async preload completes → double load.

### 3.2 Object URL Lifecycle

| URL Type | Managed By | Revoked On |
|----------|-----------|-----------|
| Scene Object URLs | `block-scene.service._sceneObjectUrls` Set | `before-track-change`, track switch |
| Cover art Object URLs | `track.bridge._coverArtObjectUrls` Set | `syncAll` (deferred 1200ms) |
| Preview URLs (modal) | `previewUrlsRef` Map | Modal close, unmount |

---

## 4. RUNTIME BACKGROUND SYSTEM (5 Layers)

```
Layer 1: body.backgroundImage
  ├── Scene divs #bg-scene-a / #bg-scene-b — A/B crossfade
  ├── customBgUrl → setCustomBg()
  └── Pexels slideshow — base layer (block-change triggers new pexels image)

Layer 2: :root CSS vars (--bl-cover-*)
  └── cover-theme-applicator → applyCoverTheme()

Layer 3: .coverBackground (inside plate/плашка)
  └── effectiveBgUrl = (customBgUrl || hasBlockScenes) ? null : coverArtUrl

Layer 4: .activeBlock — backdrop-filter blur
Layer 5: WagonTrain — solid bg
```

### 4.1 Crossfade Mechanism

```
RehearsalBackground.setBlockScene(url)
  ├─ new Image() → img.src = url  (preload first)
  ├─ img.onload → doCrossfade()
  │    ├─ nextLayer = (activeLayer === 'A') ? B : A
  │    ├─ nextLayer.style.backgroundImage = url
  │    ├─ nextLayer.style.opacity = '1'
  │    ├─ currentLayer.style.opacity = '0'
  │    ├─ transition: opacity 0.3s ease
  │    └─ After 700ms: _swapLayers() — clean old layer
  └─ Fallback: setTimeout(500ms) if img.onload doesn't fire
```

### 4.2 hasBlockScenes Flag

When `hasBlockScenes = true`:
- Cover art background in plate is suppressed (`effectiveBgUrl = null`)
- Scene system takes priority over cover art
- Pexels slideshow only triggers on block change (not line change)

---

## 5. UI: BlockScenesModal

### 5.1 Layout Structure

```
.overlay (fixed, below header)
  └── .modal (98vw × calc(100vh - header - 16px))
       ├── .topBar
       │    ├── .tabs [Scenes | Custom]
       │    └── .closeBtn [Done]
       ├── .trackMap (flex row, scroll, align-items: flex-start)
       │    ├── .blockColumn × N (flex: 1 1 auto, border-bottom colored)
       │    │    ├── .columnHeader (block name · count, thumbnail if filled, ✕ if scenes exist)
       │    │    └── .subBlocksRow (flex-direction: row, align-items: flex-start)
       │    │         ├── .subBlock (flex: var(--sub-lines), cells vertical)
       │    │         ├── .subBlockDivided (border-left dashed)
       │    │         └── .subBlock ...
       │    └── ...
       └── (footer zone — reserved for future effects)
```

### 5.2 Cell Types

| Cell State | Visual | Click Action | Hover |
|-----------|--------|-------------|-------|
| Empty | Number only | → file picker (upload line scene) | CSS tooltip with lyric text |
| Filled | Thumbnail bg + number + accent left border + ✕ button | → file picker (replace) | ✕ button appears |

### 5.3 Header Types

| Header State | Visual | Click Action |
|-------------|--------|-------------|
| No scenes | Block name · count + "+" | → file picker (upload block scene) |
| Has scenes | Block name · count + thumbnail + ✕ | → select block; ✕ removes ALL scenes |

### 5.4 Sub-block Layout

Sub-blocks are created by `createSubBlocks()` from `block-utils.ts`. Logic:
- Blocks with ≤5 lines: single sub-block
- Blocks with 6–10 lines: 2 sub-blocks (balanced split or echo-detected)
- Blocks with 11–15 lines: 3 sub-blocks

Sub-blocks render **horizontally** (side by side) within `.subBlocksRow`. Each sub-block is a vertical column of cells. Dividers are `border-left: dashed` on subsequent sub-blocks.

### 5.5 Colors (TrackMap Canonical)

| Block Type | Hex | Material Color |
|-----------|-----|---------------|
| verse | `#4CAF50` | Green 500 |
| chorus | `#F44336` | Red 500 |
| bridge | `#9C27B0` | Purple 500 |
| intro | `#2196F3` | Blue 500 |
| outro | `#00BCD4` | Cyan 500 |
| prechorus | `#FFEB3B` | Yellow 500 |

Applied via CSS variable `--block-color` on `.blockColumn`:
```tsx
style={{ '--block-color': blockColor } as React.CSSProperties}
```

### 5.6 Active Block Indicator

Current playback block gets `.blockColumnActive` class:
```css
.blockColumnActive {
  border-color: var(--block-color, #6b7280);
}
/* + optional glow via @supports color-mix() */
```

Computed from `lyricsStore.activeLineIndex` + `block.lineIndices.includes()`.

---

## 6. UPLOAD FLOW

```
User clicks empty cell/header
  └─> sceneInputRef.current?.click()
       └─> <input type="file" accept="image/*"> onChange
            └─> handleSceneUpload(e) or handleLineUpload(e)
                 ├─ resizeImage(file) — max 1920px, JPEG/PNG auto
                 ├─ extractThemeFromBlob(resized) — median cut color extraction
                 ├─ Check quota (MAX_BG_PER_TRACK = 20)
                 ├─ uploadBlockScene(trackId, blockIndex, file, blockId, lineIndex?)
                 │    ├─ idbSaveScene(scene) — write to beLive_scenes DB
                 │    └─ return BlockSceneMeta
                 ├─ loadScenes() — reload all scenes + preview URLs
                 └─ document.dispatchEvent('tracks-changed')
```

---

## 7. DELETE FLOW

### 7.1 Inline ✕ on filled cell

```
Hover filled cell → ✕ button appears
  └─> handleInlineLineRemove(blockIndex, localLineIndex, e)
       ├─ e.stopPropagation() — prevent cell click
       ├─ lineSceneMap.get(key) → find scene
       ├─ deleteBlockScene(scene.id) — IDB delete
       ├─ loadScenes() — reload
       └─ document.dispatchEvent('tracks-changed')
```

### 7.2 ✕ on header (removes ALL block scenes)

```
Header ✕ visible when blockHasScenes = true
  └─> handleRemoveBlockScenes(blockIndex)
       ├─ scenes.filter(blockIndex match) — find all (block + line)
       ├─ Sequential deleteBlockScene() for each
       ├─ loadScenes()
       └─ document.dispatchEvent('tracks-changed')
```

---

## 8. CUSTOM BACKGROUND TAB

Separate from block scenes. Persists to `TrackRecord.customBgBlob` + `customBgTheme` in TextAppDB.

Priority: `customBgUrl` takes precedence over `coverArtUrl` but is overridden by block/line scenes.

---

## 9. STORES INVOLVED

| Store | Key Fields | Role |
|-------|-----------|------|
| `track.store` | `currentTrack`, `customBgUrl`, `hasBlockScenes`, `currentCoverTheme` | Runtime state mirror |
| `blockScene.store` | `isOpen`, `selectedBlockIndex`, `selectedLineIndex` | Modal UI state |
| `blocks.store` | `blocks[]` (TextBlock[]) | Block structure mirror from legacy |
| `lyrics.store` | `lines[]`, `activeLineIndex` | Lines + active line |
| `plate.store` | `useAutoBg`, `width`, `position` | Plate display settings |

---

## 10. KEY FILES

| File | Role | Lines |
|------|------|-------|
| `src/components/BlockScenesModal.tsx` | Main UI component | ~400 |
| `src/components/BlockScenesModal.module.css` | Styles | ~280 |
| `src/services/block-scene.service.ts` | Upload, preload, delete, SceneMap | ~260 |
| `src/services/idb.service.ts` | beLive_scenes DB CRUD | ~500 |
| `src/backgrounds/RehearsalBackground.ts` | Runtime scene switching | ~400 |
| `src/hooks/useBackgroundManagers.ts` | Wiring: preload → manager | ~145 |
| `src/utils/block-utils.ts` | createSubBlocks(), echo detection | ~430 |
| `src/utils/image-resize.ts` | Canvas resize, max 1920px | ~70 |
| `src/utils/storage-quota.ts` | Quota check, MAX_BG_PER_TRACK=20 | ~47 |

---

## 11. KNOWN ISSUES (for next Architect)

### 11.1 Scenes not applied after "Done"
**Symptom:** User uploads scenes, clicks Done, but backgrounds don't change until track restart (sometimes 2 restarts).  
**Likely cause:** `block-scenes-loaded` event fires during modal open, but `useBackgroundManagers` may not re-read sceneMap after modal closes.  
**Fix needed:** Force sceneMap refresh when modal closes with `setOpen(false)`.

### 11.2 BS-08 ZIP roundtrip
Block scenes are NOT exported/imported via ZIP. Need to add scene blobs to ZIP export and restore on import.

### 11.3 Pexels slideshow during scenes
When hasBlockScenes=true, pexels should only change on block change. Currently it may also change on line change in some code paths.

---

## 12. FROZEN GUARD

```
❌ src/audio/core/AudioEngineV2.ts
❌ src/audio/compat/patchV1.ts
❌ src/bridges/**  (read-only reference)
❌ src/services/track.orchestrator.ts
❌ js/  (legacy boundary shells)
❌ TextAppDB — migration blocked by legacy track-catalog.js
❌ New npm dependencies without approval
```

---

## 13. BLOCK EDITOR v2 — ROADMAP

The current system is the **scene assignment layer** of a larger Block Editor vision:

### Phase 1 (Current) ✅
- Per-block and per-line scene upload
- Inline delete (✕ buttons)
- Active block indicator
- Auto-upload on click
- CSS tooltip lyric preview

### Phase 2 — Scene Effects
- Transition effects between scenes (fade, slide, zoom, dissolve)
- Transition duration control
- Per-block transition override
- Crossfade timing presets

### Phase 3 — Plate Controls
- Plate position per block (left/center/right)
- Plate width per block
- Plate opacity/glow per block
- Vignette intensity per block

### Phase 4 — Typography
- Font family per block
- Font size per block
- Text color per block (overriding coverTheme)
- Word FX mode per block

### Phase 5 — Full Block Editor
- Unified editor UI combining scenes + effects + plate + typography
- Timeline view
- Live preview while editing
- Undo/redo
- Preset system ("concert look", "intimate look", etc.)

---

*Document v1.0 — Центр_28.3 — 2026-05-29*  
*Wave 2.5 complete. 8 MICRO-PACKs delivered. 7 files changed. 0 frozen violations. 🚀*
