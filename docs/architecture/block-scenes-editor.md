# 📘 Block Scenes Editor — Architecture Document v2.0

**Status:** Proactive Visual + ZIP Roundtrip  
**Date:** 2026-05-31  
**Authors:** Центр_28.3 + Центр_28.4 + Центр_29 + Центр_29.1  
**Next Phase:** Block Scenes Editor v3 (effects, transitions, plate controls, fonts)

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
  │         ├─ Resolve currentTrack via trackCatalog (synchronous, no race)
  │         ├─ Fallback to store if trackCatalog unavailable
  │         ├─ useTrackStore.setHasBlockScenes(sceneCount > 0)
  │         └─ managers.rehearsal.setBlockSceneMap(sceneMap)
  │              ├─ Compute fingerprint → skip if unchanged (no crossfade)
  │              ├─ PROACTIVE APPLY: resolve blockIndex from window.lyricsDisplay
  │              ├─ Dedup: skip setBlockScene if URL unchanged
  │              └─ setBlockScene(url) — crossfade with preload
  │
  └─ Playback active-line-changed
       └─ RehearsalBackground._boundHandler()
            ├─ _getBlockIndexByLine() — global lineIndex → blockIndex
            ├─ _getLineIndexInBlock() — global lineIndex → local lineIdxInBlock
            ├─ _resolveSceneUrl(blockIndex, lineIdxInBlock) — line > block > null
            ├─ Cooldown: BLOCK=300ms, LINE=150ms
            ├─ setBlockScene(url) — dedup + crossfade with preload
            └─ _prefetchNextLine() — lookahead 1 line
```

### 3.1 Source-Aware Events

All `tracks-changed` dispatches now carry `{ detail: { source } }`:

| Source | Emitter | Consumer Action |
|--------|---------|-----------------|
| `'scene-crud'` | BlockScenesModal (6 places), upload.service (ZIP import) | `softReloadScenesForTrack()` |
| `'catalog'` | CatalogLayout (ZIP import, manual upload) | Skip — `doPreload` handles via `track-loaded` |
| `'track-import'` | upload.service | Skip — `doPreload` handles |
| `'track-delete'` | track.actions | Skip — cleanup handled by `before-track-change` |
| No source | Backward compat | `softReloadScenesForTrack()` |

### 3.2 Proactive Scene Apply

When `setBlockSceneMap` receives a valid sceneMap:
1. Compute fingerprint → if unchanged, update URLs silently (no crossfade)
2. Resolve current blockIndex from `window.lyricsDisplay` or fallback to block 0
3. Save `_currentBlockIndex` for future `active-line-changed` events
4. Apply scene via `setBlockScene()` with dedup guard

### 3.3 Race Condition Guard in onScenesLoaded

`track.bridge.ts` updates store with 100ms debounce. `block-scenes-loaded` fires before store is updated.
**Fix:** `onScenesLoaded` reads `currentTrackIndex` from `window.trackCatalog` (synchronous) instead of store.
Fallback to store if trackCatalog unavailable.

### 3.4 Object URL Lifecycle

| URL Type | Managed By | Revoked On |
|----------|-----------|-----------|
| Scene Object URLs | `block-scene.service._sceneObjectUrls` Set | `before-track-change`, track switch |
| Cover art Object URLs | `track.bridge._coverArtObjectUrls` Set | `syncAll` (deferred 1200ms) |
| Preview URLs (modal) | `previewUrlsRef` Map | Modal close, unmount |

### 3.5 ZIP Scene Roundtrip Events

| Event | When | Purpose |
|-------|------|---------|
| `tracks-changed` source=`track-import` | Inside `saveTrack()` during ZIP import | Skip softReload — doPreload handles |
| `tracks-changed` source=`scene-crud` | After scene import loop completes | softReload to pick up all imported scenes |

---

## 4. RUNTIME BACKGROUND SYSTEM (5 Layers)

```
Layer 1: body.backgroundImage (SUPPRESSED when scene layers active)
  ├── Scene divs #bg-scene-a / #bg-scene-b — A/B crossfade — SINGLE SOURCE when shown
  ├── customBgUrl → setCustomBg() — suppressed when scene layer shows
  └── Pexels slideshow — base layer — STOPPED when scene layer shows

Layer 2: :root CSS vars (--bl-cover-*)
  └── cover-theme-applicator → applyCoverTheme()

Layer 3: .coverBackground (inside plate/плашка)
  └── effectiveBgUrl = (customBgUrl || hasBlockScenes) ? null : coverArtUrl

Layer 4: .activeBlock — backdrop-filter blur
Layer 5: WagonTrain — solid bg
```

Note: Layer 1 body bg is now SCENE-AWARE. When `setBlockScene(url !== null)` fires, body bg (Pexels/custom/dimming) is cleared immediately before crossfade starts — only scene layers render. When `setBlockScene(null)` fires, body bg is restored from Pexels slideshow. This eliminates dual rendering and saves GPU memory.

### 4.1 Crossfade + Dedup Mechanism

```
RehearsalBackground.setBlockScene(url)
  ├─ Dedup guard: skip if url === _lastAppliedSceneUrl
  ├─ Update _lastAppliedSceneUrl = url
  ├─ Pre-render on HIDDEN (inactive, opacity 0) layer — zero visual impact
  │    └─ nextLayer.style.backgroundImage = url  (invisible at this point)
  ├─ img.onload → doCrossfade()  (guarded by `started` flag — prevents double-fire)
  │    ├─ Clear pending transitionend listener
  │    ├─ Stop Pexels interval + clear body bg — NOW, image ready
  │    ├─ nextLayer.style.opacity = '1'
  │    └─ currentLayer.style.opacity = '0'
  │         ├─ transition: opacity 0.15s ease + will-change: opacity (GPU)
  │         └─ After 700ms: _swapLayers() — clean old layer
  └─ img.onerror → doCrossfade() (no flash — shows current layer until error)
```

### 4.2 Fingerprint + Unchanged Path

When `setBlockSceneMap` is called with data that hasn't changed (fingerprint match):
- `_sceneMap` is still updated with new Object URLs (for future `_resolveSceneUrl` calls)
- Active layer's `backgroundImage` is updated directly without crossfade
- Image preload ensures no broken image during decode

### 4.3 clearAllScenes() — Atomic Reset

```typescript
clearAllScenes(): void {
  this._sceneMap = { blockScenes: new Map(), lineScenes: new Map() };
  this._sceneLayerA.style.opacity = '0';
  this._sceneLayerB.style.opacity = '0';
  this._sceneLayerA.style.backgroundImage = '';
  this._sceneLayerB.style.backgroundImage = '';
  this._lastSceneFingerprint = '';
  this._lastAppliedSceneUrl = null;
  this._currentBlockIndex = null;
}
```

Used in: `before-track-change`, `onTracksChanged` when sceneCount === 0.

### 4.4 hasBlockScenes Flag

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
        │    ├── .tabs [Scenes | Custom] + packProgress indicator ⚠️ PLANNED — Custom tab UI not yet implemented
       │    └── .topActions [Upload Pack btn] + [Done btn]
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

### 5.7 Upload Pack (Bulk Upload)

**Button:** "Upload Pack" in topBar
**Input:** `<input type="file" accept="image/*" multiple>`
**Flow:**
1. User selects multiple files
2. Natural sort by filename (`1, 2, ... 10, 11` — not `1, 10, 11, 2`)
3. Quota pre-check: `MAX_BG_PER_TRACK - currentCount`
4. Collect all empty cells in reading order (block 0 line 0, block 0 line 1, ... block 1 line 0, ...)
5. Skip cells that already have line-level scenes
6. Upload one by one with progress indicator (`12/52`)
7. Dispatch `tracks-changed` with `source: 'scene-crud'`

**Limit:** `MAX_BG_PER_TRACK = 100` (raised from 20)

---

## 6. UPLOAD FLOW

### 6.1 Single Upload

```
User clicks empty cell/header
  └─> sceneInputRef.current?.click()
       └─> <input type="file" accept="image/*"> onChange
            └─> handleSceneUpload(e) or handleLineUpload(e)
                 ├─ resizeImage(file) — max 1920px, JPEG/PNG auto
                 ├─ extractThemeFromBlob(resized) — median cut color extraction
                 ├─ Check quota (MAX_BG_PER_TRACK = 100)
                 ├─ uploadBlockScene(trackId, blockIndex, file, blockId, lineIndex?)
                 │    ├─ idbSaveScene(scene) — write to beLive_scenes DB
                 │    └─ return BlockSceneMeta
                 ├─ loadScenes() — reload all scenes + preview URLs
                 └─ document.dispatchEvent('tracks-changed', { detail: { source: 'scene-crud' } })
```

### 6.2 Bulk Upload Pack

```
User clicks "Upload Pack" button
  └─> <input type="file" accept="image/*" multiple> onChange
       └─> handlePackUpload(e)
            ├─ Natural sort files by filename
            ├─ Quota pre-check: MAX_BG_PER_TRACK - currentCount
            ├─ Collect empty cells in reading order
            ├─ For each file → uploadLineScene() + update progress
            ├─ loadScenes()
            └─ document.dispatchEvent('tracks-changed', { detail: { source: 'scene-crud' } })
```

### 6.3 ZIP Import

```
User imports ZIP archive containing scenes/
  └─> handleZipFileSelect(file)
       ├─ Extract export.json → parse scenes[] metadata
       ├─ saveTrack() (audio, lyrics, markers, etc.)
       ├─ Capture jsonScenes before detachUploadSession()
       ├─ For each scene in jsonScenes:
       │    ├─ Read blob from ZIP (scenes/block_line.ext)
       │    ├─ resizeImage(blob) — max 1920px
       │    ├─ saveScene() to beLive_scenes DB (with new trackId)
       │    └─ importedCount++
       ├─ Dispatch 'tracks-changed' { source: 'scene-crud' }
       └─ Show notification with scene count
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
| `src/components/BlockScenesModal.tsx` | Main UI component + Upload Pack | ~500 |
| `src/components/BlockScenesModal.module.css` | Styles | ~480 |
| `src/services/block-scene.service.ts` | Upload, preload, delete, SceneMap, softReload | ~380 |
| `src/services/upload.service.ts` | ZIP import + scene roundtrip | ~970 |
| `src/services/idb.service.ts` | beLive_scenes DB CRUD | ~500 |
| `src/backgrounds/RehearsalBackground.ts` | Runtime scene switching + proactive apply + fingerprint | ~480 |
| `src/hooks/useBackgroundManagers.ts` | Wiring: preload → manager + source filter + race fix | ~230 |
| `src/sync/components/SyncEditorPanel.tsx` | ZIP export + scene export | ~1300 |
| `src/utils/block-utils.ts` | createSubBlocks(), echo detection | ~430 |
| `src/utils/image-resize.ts` | Image resize, max 1920px | ~70 |
| `src/utils/storage-quota.ts` | Quota check, MAX_BG_PER_TRACK=100 | ~47 |

---

## 11. KNOWN ISSUES (for next Architect)

### 11.1 ~~Scenes not applied after "Done"~~ — ✅ FIXED (TC-29-01/04)
**Symptom:** User uploads scenes, clicks Done, but backgrounds don't change until track restart.  
**Fix:** Proactive Scene Apply in `setBlockSceneMap` — resolves blockIndex from `window.lyricsDisplay` immediately.

### 11.2 BS-08 ZIP roundtrip — ✅ FIXED (TC-29-09)
**What was fixed:** Scene blobs are now exported to `scenes/` folder in ZIP + `scenes[]` array in `export.json`.  
**Import:** Extracts scenes from ZIP, resizes, saves to `beLive_scenes` DB, dispatches `scene-crud` for softReload.

### 11.3 Pexels slideshow during scenes
When hasBlockScenes=true, pexels should only change on block change. Currently it may also change on line change in some code paths.

### 11.4 Mode switch loses scenes (pre-existing)
Switching rehearsal → concert → rehearsal loses sceneMap because `stop()` clears it. No `block-scenes-loaded` fires on mode return.  
**Workaround:** Manually trigger preload or switch tracks.  
**Proper fix:** Export `triggerScenePreload(trackId)` from block-scene.service and call from useBackgroundManagers on mode→rehearsal. ⚠️ NOT IMPLEMENTED — function does not exist in current code

### 11.5 Unnecessary crossfade after softReload
When softReload creates new Object URLs for identical visual content, fingerprint matches and unchanged path avoids crossfade. However, if fingerprint changes (CRUD on another block), the current block may crossfade to the same visual. This is documented as acceptable — content-hash comparison is overkill.

---

## 12. ZIP SCENE ROUNDTRIP

### 12.1 Purpose

ZIP scene roundtrip allows users to export a track (audio, lyrics, markers, scenes) and import it back — including all block/line background scenes — enabling backup, cloning, and sharing of complete visual productions.

### 12.2 Export Flow (SyncEditorPanel)

```
User clicks "Export" in SyncEditorPanel
  ├─ Read all scenes for current track from beLive_scenes DB
  ├─ Write export.json with scenes[] metadata array
  ├─ For each scene: write blob to scenes/{blockIndex}_{lineIndex}.{ext}
  ├─ Compression strategy:
  │    ├─ Audio/images → STORE (no compression, faster access)
  │    └─ Text/json → DEFLATE (better compression ratio)
  └─ Return completed Blob for download
```

### 12.3 Import Flow

```
User imports ZIP via CatalogLayout
  ├─ Parse export.json — extract scenes[] metadata
  ├─ saveTrack() — saves audio, lyrics, markers
  ├─ Capture jsonScenes BEFORE detachUploadSession()
  ├─ For each scene in jsonScenes:
  │    ├─ Read blob from ZIP path scenes/{blockIndex}_{lineIndex}.{ext}
  │    ├─ resizeImage(blob) — max 1920px
  │    ├─ saveScene() to beLive_scenes DB with NEW trackId
  │    └─ importedCount++
  ├─ Dispatch 'tracks-changed' { source: 'scene-crud' }
  └─ Show notification: "Imported {importedCount} scenes"
```

### 12.4 Data Structures

**export.json scenes[] entry:**
```typescript
interface ExportedSceneMeta {
  blockIndex: number;
  lineIndex: number | null;     // null = block-level scene
  blockId: string | null;
  filename: string;             // "scenes/block_line.ext"
  theme: CoverArtTheme;
}
```

**beLive_scenes DB record (after import):**
```typescript
interface BlockScene {
  id: string;                   // NEW: `${newTrackId}_${blockIndex}_${lineIndex}`
  trackId: number;              // NEW: mapped to imported track
  blockIndex: number;           // Preserved from export
  lineIndex: number | null;     // Preserved from export
  blockId: string | null;       // Preserved from export
  blob: Blob;                   // Resized, re-compressed
  theme: CoverArtTheme;         // Re-extracted
  addedAt: string;              // NEW: current timestamp
}
```

### 12.5 Roundtrip Fidelity

| Field | Preserved | Notes |
|-------|-----------|-------|
| `blockIndex` | ✅ | Unchanged |
| `lineIndex` | ✅ | Unchanged |
| `blockId` | ✅ | Unchanged |
| Image blob | ✅ | Resized to max 1920px |
| Theme colors | ✅ | Re-extracted from resized blob |
| `id` | ❌ | Regenerated with new trackId |
| `trackId` | ❌ | Mapped to imported track |
| `addedAt` | ❌ | Set to import timestamp |
| Higher-level metadata | ❌ | Not scene-related |

### 12.6 Event Sequence

See [Section 3.5](#35-zip-scene-roundtrip-events) for the complete event topology.

---

## 13. FROZEN GUARD

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

## 14. BLOCK EDITOR v2 — ROADMAP

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

*Document v2.0 — Центр_28.3 + Центр_28.4 + Центр_29 + Центр_29.1 — 2026-05-31*  
*Centre 29 complete. 9 TC delivered (TC-29-01 through TC-29-09) + 1 hotfix. Block Scenes Editor v2 — Proactive Visual + ZIP Roundtrip operational.*
