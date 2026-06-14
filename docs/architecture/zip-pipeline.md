# ZIP Pipeline — Export & Import

**Status:** Production-ready
**Version:** 1.0
**Date:** 2026-04-22
**Authors:** Centre6

---

## 1. Overview

beLive ZIP is the portable track format. A single ZIP file contains everything needed to reconstruct a track offline: audio, lyrics, sync markers, block structure, word-sync alignment, cover art, and theme data.

### Design Principles

- **Self-contained:** No network required after import
- **Backward compatible:** Old ZIPs (without new fields) import gracefully
- **Functional roundtrip:** Export → Import preserves audio, lyrics, sync markers, blocks, cover art, scenes, backgrounds, and stem data. Fields NOT preserved: `stemDisplayOrder`, `stemAutomation`, `trackMeta`, `transitionPreset`, `dataVersion`.  
  **TC-ZIP-02:** `stemsMode` now preserved — set `true` when additional stems are imported via `handleZipFileSelect()`.
- **Offline-first:** Cover art stored as binary, not URL reference

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
├── cover.jpg / cover.png           # Cover art binary (JPEG or PNG, detected by extension, STORE)
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
3. Add audio files (instrumental, vocals, stems) — STORE compression
4. Add lyrics.txt from ld.lyrics (clean lines, not raw text)
5. Add cover art:
   a. If coverArtBlob exists → zip.file('cover.jpg', blob)
   b. Else if coverArtUrl is HTTP → fetch → blob → zip.file('cover.jpg')
   c. Also save fetched blob to IDB for future exports
   d. export.json gets ORIGINAL HTTP URL (not "cover.jpg")
6. Add scenes (block-scene images):
   a. Load blockScenes from IDB (getBlockScenes())
   b. For each scene → zip.file(`scenes/${file}`, blob)
   c. export.json.scenes[] = scene metadata
7. Add backgrounds (custom background images):
   a. Load custom background from IDB
   b. If exists → zip.file(`backgrounds/${file}`, blob)
   c. export.json.backgrounds[] = background metadata
8. Build exportData object:
   - coverArtUrl = original HTTP URL (fallback)
   - lyricsOriginalContent = full text with structural tags
   - scenes = blockScenes metadata array
   - backgrounds = background metadata array
9. Add export.json
10. Add alignment.json (if available)
11. Generate ZIP with streaming + progress
12. Download
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
5. Extract cover.jpg/png from ZIP:
   - zip.file('cover.jpg') → arraybuffer → Blob with MIME type
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
1. cover.jpg/png in ZIP → Blob → IDB coverArtBlob → OFFLINE ✅
2. coverArtUrl in export.json (HTTP) → IDB coverArtUrl → FALLBACK
3. No cover art → fetchCoverArtAndUpdate() → iTunes/Last.fm API
```

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

## 9. Key Files

| File | Role |
|------|------|
| `src/sync/components/SyncEditorPanel.tsx` | ZIP export + LRC Picker |
| `src/services/upload.service.ts` | ZIP import |
| `src/services/cover-art.service.ts` | Cover art fetch + blob save |
| `src/services/idb.service.ts` | IDB schema (coverArtBlob field, blockScenes store) |
| `src/services/block-scene.service.ts` | Block scenes load/save from IDB |
| `src/bridges/track.bridge.ts` | Blob → Object URL hydration |
| `src/bridges/cover-theme.bridge.ts` | Theme hydration from IDB |
| `src/components/CoverArt.tsx` | UI component (img + fallback) |

---

**Last updated:** 2026-06-10
**Status:** Production-ready
**See also:** `block-first-lyrics-sync.md`, `architecture-map-2.1.md`
