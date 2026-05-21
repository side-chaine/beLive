# M1/M2 Marker System + BPM Detection Spec

## Status: PARTIAL — M1/M2 data model + rendering IMPLEMENTED. Detection/analysis/BPM — PLANNED (not yet implemented).

## Implementation Status
- ✅ Implemented: M1/M2 data model, marker rendering (draw-markers.ts), store CRUD (delegate to legacy MM), bridge subscriptions
- 🧭 Vision (Not Yet Implemented): §2 Transition Zone Detection, §2.3 Vocal RMS Analysis, §4 BPM Detection, TransitionZone interface
- ❌ Not building: gap threshold matrix, onset detection — deferred indefinitely

## Overview

The beLive marker system provides precise temporal anchors for lyrics synchronization, block looping, and exercise execution. This specification defines the dual-marker architecture (M1/M2) and its relationship with auto-sync, loop boundaries, and future beat-aware placement.

---

## 1. Marker Taxonomy

### 1.1 M1 — Line Marker (Opening)

| Property | Value |
|----------|-------|
| **Purpose** | Marks the beginning of a lyric line |
| **lineIndex** | `0, 1, 2, 3...` (index into lyrics array) |
| **Source** | lrclib sync (auto) or manual placement ("1" key) |
| **Visual (Canvas)** | Vertical line + colored circle pin head |
| **Visual (Lyrics Display)** | Highlighted lyric line text |
| **Color** | Block-type color (verse=green, chorus=red, etc.) |
| **Loop role** | Defines `startTime` of a block |
| **Data model** | `{ id, lineIndex, time, text, blockType, color, markerType: 'M1' }` |

### 1.2 M2 — Closing Marker (Block Boundary)

| Property | Value |
|----------|-------|
| **Purpose** | Cuts off instrumental breaks/run-throughs at block end (OPTIONAL) |
| **lineIndex** | `-1` (sentinel value — NOT a lyric line) |
| **Source** | Manual placement (key "2") during sync |
| **Visual (Canvas)** | Vertical line (#1a1a1a) + **red diamond cap** (#ff3333) |
| **Visual (Lyrics Display)** | **NOT VISIBLE** — M2 has lineIndex: -1, not attached to any line |
| **Color** | `#1a1a1a` (near-black) body + `#ff3333` cap |
| **Loop role** | Defines `endTime` of preceding block via `afterBlockId` |
| **Data model** | `{ id, lineIndex: -1, time, afterBlockId, markerType: 'M2', blockType: 'closing', color: '#1a1a1a', isSuggested: false }` |

**KEY BEHAVIOR:**
- M2 is **OPTIONAL** — user places it ONLY when there's instrumental break to cut off
- Without M2, block end is determined by Priority 2 (next block's first M1)
- M2 does NOT upgrade or modify M1 markers — it's a standalone time boundary
- M2 placement uses **active line from DOM** to determine which block to close
- When placed, M2 searches: active line → block containing it → if block has M1 markers → M2 closes that block
- If active line's block has no M1 yet → searches previous blocks for one with M1 markers
- Fallback: last M1 marker before currentTime determines the block

**Verified behavior (2026-04-13):**
```
[M2] Active line 29 → block block-XXX (has M1 markers)
[M2] Placed M2 closing marker after block block-XXX time: 138.91s
[getBlockTimeRange] block.id=block-XXX → M2 Priority 1: endTime = 138.906621s
[LOOP] #1 Lightweight jump → 117.694s ← LOOP WORKS WITH M2!
```

---

## 2. Transition Zone Detection

### 2.1 Detection Algorithm

After `matchGeniusToLrc()` produces markers + blocks, the system computes inter-block gaps:

```typescript
For each adjacent block pair (A → B):
  lastLine_A = max(A.lineIndices)
  firstLine_B = min(B.lineIndices)
  
  lastMarker_A = markers.find(m => m.lineIndex === lastLine_A)
  firstMarker_B = markers.find(m => m.lineIndex === firstLine_B)
  
  gap = firstMarker_B.time - lastMarker_A.time
  avgGap = mean(intra-block gaps within block A)
  
  if gap > avgGap × 1.5 → TRANSITION ZONE DETECTED
```

### 2.2 Gap Threshold Matrix

| Gap / AvgRatio | Classification | M2 Required | Visual |
|----------------|----------------|-------------|--------|
| `< 1.0×` | Overlap / tight transition | No | Normal block boundary |
| `1.0× - 1.5×` | Normal gap (phrase end) | No | Subtle divider |
| `1.5× - 3.0×` | Short interlude | **Yes** | Orange zone + "🔧" icon |
| `> 3.0×` | Long instrumental | **Yes** | Red zone + "⚡" icon |

### 2.3 Vocal RMS Analysis (Audio-Informed Placement)

When a transition zone is detected, the system analyzes the vocal stem's waveform to find where the vocal energy decays to silence:

```typescript
Input:
  vocalData: Float32Array   — PCM samples of vocal stem
  sampleRate: number         — typically 44100 or 48000
  windowStart: number        — lastMarker_A.time + avgGap × 0.5
  windowEnd: number          — firstMarker_B.time
  threshold: number          — RMS silence threshold (0.02)
  windowMs: number           — analysis window (50ms)

Algorithm:
  1. Divide [windowStart, windowEnd] into windows of windowMs
  2. For each window, compute RMS energy: sqrt(Σx²/N)
  3. Find LAST window where RMS > threshold (vocal tail end)
  4. Add 150ms buffer for natural decay (reverb tail, breath)
  5. Result = candidate M2 placement time

  closingTime = vocalSilenceEnd + 0.15s
```

### 2.4 M2 at Track End (Last Block)

The final block requires an M2 marker to prevent looping through the entire track outro:

```typescript
If last block has no subsequent block:
  lastMarker = markers for last block's last line
  closingTime = findVocalEndTime(vocalData, sampleRate,
                    lastMarker.time + avgGap,
                    trackDuration)
  
  If vocalData ends before trackDuration:
    M2 placed at vocalSilenceEnd + 0.15s
  Else:
    M2 placed at trackDuration - 2.0s (safety fallback)
```

---

## 3. Visual Specification

### 3.1 Canvas Rendering (draw-markers.ts)

**M1 marker:**
```
  │         ← vertical line (block color, 2px, alpha 0.85)
  ●         ← circle pin head (block color, radius 5px, alpha 0.9)
  1         ← line number label (9px monospace, alpha 0.7)
```

**M2 marker:**
```
  │         ← vertical line (#1a1a1a, 2px, alpha 0.85)
  ◆         ← diamond cap (#ff3333, 6px, alpha 0.95)
  ─         ← short horizontal dash (closing indicator)
```

**Transition zone highlight (pre-M2 placement):**
```
  ░░░░░░░  ← semi-transparent orange zone (rgba(255,165,0,0.12))
  +         ← small "+" icon at suggested M2 position
```

### 3.2 Lyrics Display (SyncLyrics / RehearsalLyrics)

**M2 between blocks:**
```
"Why does it feel like night today?"     ← M1 (verse, green)
"Something in here's not right today"    ← M1 (verse, green)
─────────────────────────────            ← M2 (empty line, red separator)
"It's like I'm paranoid"                 ← M1 (chorus, red)
```

### 3.3 TrackMap (WagonTrain)

Blocks separated by M2 show a visual divider:
```
[Verse 1] │ [Chorus]
           ↑ M2 divider icon (small "⏹" or "┃")
```

---

## 4. BPM Detection Strategy

### 4.1 Stem-Aware BPM Detection

The availability of separated stems enables **highly accurate BPM detection** that surpasses traditional single-track analysis.

### 4.2 Detection Hierarchy

| Stem Type | Reliability | Method | Confidence |
|-----------|-------------|--------|------------|
| **Drums** | ★★★★★ | Onset detection on kick/snare | 95-99% |
| **Bass** | ★★★★☆ | Rhythmic pattern analysis | 80-90% |
| **Instrumental** | ★★★☆☆ | Full-spectrum onset analysis | 60-80% |
| **Full mix** | ★★☆☆☆ | Traditional FFT-based (prone to errors) | 50-70% |
| **Vocal-only** | ★☆☆☆☆ | Rhythmic vocal patterns only | 30-50% |

### 4.3 Why Traditional DAWs Struggle

Traditional BPM detectors analyze the **full mix**, which causes:
- **Masking**: Vocals hide kick transients
- **Polyrhythms**: Multiple rhythmic layers confuse onset detection
- **Tempo changes**: Gradual accelerando/ritardando break assumptions
- **Genre mismatch**: Classical/jazz detection differs from electronic

### 4.4 beLive Advantage

```
Stems enable selective analysis:

1. Drums stem → primary BPM source (if present)
   - Kick detection: low-pass filter < 150Hz
   - Onset detection: energy spikes > threshold
   - Tempo estimation: autocorrelation on onset times

2. Bass stem → secondary confirmation
   - Root note timing aligns with kick
   - Groove pattern recognition

3. Full instrumental → fallback
   - Traditional onset detection
   - Cross-validate with stems

4. External API → last resort (for ambient/meditative tracks)
   - Spotify Audio Features API
   - Acoustid fingerprint
```

### 4.5 Implementation Priority

| Phase | Feature | Complexity |
|-------|---------|------------|
| P1 | Manual BPM input + tap tempo | Low |
| P2 | Drums stem BPM detection | Medium |
| P3 | Auto-validation (stems vs manual) | Medium |
| P4 | Beat-snapped M2 placement | High |
| P5 | Grid overlay on waveform | High |

---

## 5. Data Model Changes

### 5.1 PersistedSyncMarker (persistence.types.ts)

```typescript
export interface PersistedSyncMarker {
  id: string;
  lineIndex: number;       // -1 for M2 (closing marker)
  time: number;
  text: string;            // ']' for M2 (sentinel)
  blockType?: string;
  color?: string;
  markerType?: 'M1' | 'M2';  // NEW — distinguishes marker types
  afterBlockId?: string;     // M2: which block this closes
}
```

### 5.2 Marker (markers.store.ts)

```typescript
export interface Marker {
  id: string;
  lineIndex: number;       // -1 for M2
  time: number;
  text: string;
  blockType?: string;
  color?: string;
  markerType?: 'M1' | 'M2';  // NEW
}
```

### 5.3 TransitionZone Interface

```typescript
export interface TransitionZone {
  afterBlockId: string;      // Block that precedes the gap
  beforeBlockId: string;     // Block that follows the gap
  fromTime: number;          // Last M1 time of afterBlock
  toTime: number;            // First M1 time of beforeBlock
  gapDuration: number;       // toTime - fromTime
  avgLineGap: number;        // Average line gap in afterBlock
  suggestedTime: number;     // Suggested M2 placement
  needsClosingMarker: boolean; // true if gap > threshold
  hasM2?: boolean;           // true if M2 already placed
  m2Time?: number;           // Actual M2 time if placed
}
```

---

## 6. Implementation Roadmap

### Phase 1: Current Bug Fixes
- [ ] W11.5: cleanIndex in markers
- [ ] W11.6: clean lyrics save
- [ ] W11.7: clean lyrics load
- [ ] W11.8: waitForCache polling
- [ ] W11.9: blocksData cleanIndex
- [ ] W11.10: M2 visual distinction

### Phase 2: M2 System
- [ ] W11.20: M2 marker type definition
- [ ] W11.21: Transition zone detection
- [ ] W11.22: M2 at track end (last block)
- [ ] W11.23: Visual highlighting on canvas
- [ ] W11.24: M2 in lyrics display
- [ ] W11.25: getBlockTimeRange reads M2

### Phase 3: Audio-Informed Placement
- [ ] W11.30: Vocal RMS decay analysis
- [ ] W11.31: Auto-suggested M2 position
- [ ] W11.32: User confirmation flow

### Phase 4: Beat Integration
- [ ] W11.40: Drums stem BPM detection
- [ ] W11.41: Beat-snapped M2
- [ ] W11.42: Grid overlay on waveform

---

## 7. Edge Cases

### 7.1 No Transition Zone (Direct Block Transition)
```
Block A last M1: 25.0s
Block B first M1: 26.5s
Gap: 1.5s (within 1.5× avgGap = 1.8s)

→ No M2 needed
→ Block A endTime = 26.5s (next M1, Priority 2)
```

### 7.2 M2 Updates (Moving M2)
```
User places M2 at 44.0s, then moves to 44.5s

→ System finds existing M2 by afterBlockId
→ Updates time only (no new marker created)
→ Console: [M2] Updated M2 for block <id> time: 44.5s
```

### 7.3 No Vocal Stem Available
```
If vocal stem is missing:

→ M2 still works — it's time-based, not audio-analysis-based
→ User places M2 manually at desired cut-off point
```

### 7.4 Track End M2
```
Last block: Outro
Last M1: 180.0s
Track duration: 185.5s

→ User places M2 at 182.0s to cut off 3.5s outro
→ Loop plays: last block → 182.0s → no extra music!
```

---

## 8. Loop Behavior with M2

### getBlockTimeRange — 3 Priority Levels (VERIFIED)

```
Priority 1: M2 with matching afterBlockId     ← exact block boundary (cuts off instrumental)
Priority 2: First M1 after lastLine           ← default closing (next block start)
Priority 3: trackDuration / +30s              ← final fallback
```

### Before M2 (Priority 2 fallback)
```
Loop block: Chorus (lines 15-24)
startTime: marker[15].time = 77.94s
endTime: marker[30].time = 150.79s (next block's first M1)

If Chorus ends at ~108s but next block starts at 150.79s:
Loop: 77.94 → 150.79 → plays 42s of instrumental!
```

### After M2 (Priority 1)
```
Loop block: Chorus (lines 15-24)
startTime: marker[15].time = 77.94s
endTime: M2.time = 138.91s (user-placed cut-off)

Loop: 77.94 → 138.91 → clean block boundary!
```

### Loop Store Integration (VERIFIED)
```
toggleBlock(block) → getMergedBlockTimeRange(selected, markers)
rebindToBlock(block) → getBlockTimeRange(block, markers)

Both use same priority system — M2 is automatically picked up if afterBlockId matches.
```

### Verified Log Output (2026-04-13)
```
[Loop] toggleBlock: {id: 'block-XXX', name: 'Chorus 2', type: 'chorus', lineIndices: [26,27,28,29]}
[Loop] M2 markers: [{afterBlockId: 'block-XXX', time: 138.91}]
[getBlockTimeRange] block.id=block-XXX, firstLine=26, lastLine=29
[getBlockTimeRange] M2 markers in store: [{id: 'm2-XXX', afterBlockId: 'block-XXX', time: 138.91}]
[getBlockTimeRange] startMarker: {lineIndex: 26, time: 117.69}
[M2] Priority 1: endTime = 138.906621s
[getMergedBlockTimeRange] merged: {startTime: 117.69, endTime: 138.91}
[LOOP] #1 Lightweight jump → 117.694s
```

---

## 9. Future Enhancements

### 9.1 AI-Trained M2 Placement
- Train ML model on user-placed M2 patterns
- Learn per-genre M2 placement preferences
- Automatic M2 with confidence score

### 9.2 Multi-Stem Analysis
- Use drums stem for beat-aligned M2
- Use bass stem for groove confirmation
- Use instrumental stem for energy analysis

### 9.3 Export/Import
- M2 markers in JSON export
- M2 in ZIP re-import
- Cross-project M2 patterns

---

**Document version:** 2.0 (VERIFIED)
**Author:** Center (Chief Architect) + Sonnet
**Approved by:** Nikita (PO)
**Status:** PARTIAL — M1/M2 data model + rendering IMPLEMENTED. Detection/analysis/BPM — PLANNED (not yet implemented).

**Changelog:**
- v2.0: Updated after full verification — M2 is OPTIONAL, uses active line DOM, does NOT upgrade M1
- v1.1: Merged best elements from Sonnet's spec (markerType, ASCII visuals, M2 at track end)
- v1.0: Initial draft