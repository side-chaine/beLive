# Sync Accuracy Roadmap

> **Status:** Living Document — Roadmap for auto-sync accuracy progression  
> **Version:** 1.0  
> **Date:** 2025-04-19  
> **Authors:** Center3 (Architecture) + Nikita (Product Vision)  
> **Related:** architecture-map-2.1.md, auto-lyrics.service.ts, vocal-onset.service.ts

---

## Core Philosophy

> **LRC = чужие субтитры. Vocal stem = наш свидетель.**

LRC timestamps from lrclib.net are community-contributed and may not match the user's audio version. Our unique advantage: **MVSEP ZIP provides isolated vocal stems**, letting us verify and correct timing against actual vocal amplitude.

No other karaoke app does this. This is our product differentiator.

---

## Current Status (W12 Complete)

| Level | Method | Accuracy | Status |
|-------|--------|----------|--------|
| L0 | No auto-sync | 0% | Superseded |
| L1 | LRC parse + structural guards | 60% (structurally correct, timing may drift) | ✅ Ship-ready |
| L2 | + Vocal Onset Correction (linear offset) | 80% (linear timing corrected) | ✅ Ship-ready |
| L3 | + Multi-anchor correction | 90% (non-linear correction) | ⚠️ Код готов, нужен tuning порогов |
| L3.5 | + Group Drag (ручная доводка) | 95% | ✅ TC-DRAG-01 COMPLETE |
| L4 | + Inline loop markers + beat dots | 95% (user-adjustable) | 📝 W14 |
| L5 | + Beat-aware auto alignment | 99% (snap to beat) | 📝 W15+ |

### What "80% accuracy" means:
- First marker aligns with vocal onset (verified by amplitude)
- All markers shifted by the same linear offset
- Individual marker errors from LRC authors remain (≈20% of markers may be off by 0.2-0.5s)

### What "80% accuracy" does NOT fix:
- Non-linear drift (LRC gradually diverges from actual timing)
- Individual marker placement errors (author put marker at wrong syllable)
- Different tempo versions (radio edit vs album version)

---

## L1: LRC Parse + Structural Guards (DONE)

### TC Implemented:
- TC-AL-01: Runtime guard in lyrics.bridge.ts — skip markers with lineIndex out of bounds
- TC-AL-02: Mirror filter in markers.bridge.ts — don't pass invalid markers to Zustand store
- TC-AL-03: parseLrcString() + lrcToMarkers() in auto-lyrics.service.ts
- TC-AL-04: LRC processing in saveTrack() — clean text + valid markers

### What this solves:
- INDEX MISMATCH: App no longer crashes when markers reference non-existent lines
- Raw LRC saved correctly: timestamps removed, empty lines filtered, lineIndex valid

### What this doesn't solve:
- Timing accuracy: LRC timestamps may not match user's audio version

---

## L2: Vocal Onset Correction (DONE)

### TC Implemented:
- TC-VOC-01: vocal-onset.service.ts — RMS envelope → onset detection → offset calculation
- TC-VOC-02: dataVersion field in TrackRecord
- TC-VOC-03: VOC integration in track.orchestrator.ts (step 11a.5)
- TC-VOC-04: Fix — decode vocalsData from IDB instead of StemPlayer.audioBuffer

### Algorithm:
```
1. Decode vocal stem AudioBuffer from IDB (track.vocalsData)
2. Compute RMS envelope (50ms windows)
3. Estimate background noise (10th percentile of envelope)
4. Threshold = max(bgNoise × 5, 0.01)
5. Find first sustained onset (RMS > threshold for ≥3 consecutive windows = 150ms)
6. offset = vocalOnsetTime - firstM1MarkerTime
7. If 0.3s ≤ |offset| ≤ 3.0s → shift ALL markers (M1 + M2) by offset
8. Persist corrected markers to IDB with dataVersion=3
```

### Verified Result:
```
[VOC] Applied offset: -1.670s (onset=25.0s, firstMarker=26.7s)
```
"From the Inside" by Linkin Park: markers shifted -1.67s, now aligned with vocal onset.

### Data Version Progression:
```
dataVersion: undefined → raw LRC saved (pre-W12 tracks)
dataVersion: 1          → raw LRC saved (upload flow)
dataVersion: 2          → clean lyrics, no timestamps (TC-AL-04)
dataVersion: 3          → VOC corrected (TC-VOC-04)
```

### Known Issue: Performance
- Current: ~12.7s on old MacBook (decodeAudioData of full 3-min vocal stem)
- Expected on modern hardware: ~3-5s
- Solution: Async VOC (W13) — play with L1 markers, apply L2 in background

---

## L3: Multi-Anchor Correction (W13)

### Problem:
Linear offset works when ALL markers are shifted equally. But LRC authors may have:
- Verse markers accurate, Chorus markers 0.5s late
- Bridge markers 0.3s early
- Different tempo versions causing gradual drift

### Algorithm:
```
For each block (verse, chorus, bridge):
1. Determine expected start time from LRC markers
2. Search for vocal onset ONLY within ±5s of expected time
3. If onset found → anchor point = actual onset
4. If onset NOT found → anchor point = LRC time (trust the data)
5. Between anchor points → linear interpolation
```

### Safety Net (Nikita's Rule):
> **A scream before the chorus is NOT the chorus onset. The system must know the difference.**

- False positives (ad-libs, breaths, "Yeah!") are filtered by:
  1. **Structural filter:** Only search near EXPECTED block boundaries
  2. **Duration constraint:** Average line duration = sanity check
  3. **Sustained onset requirement:** ≥3 consecutive windows (150ms)
  4. **No single-marker cascade:** One bad anchor doesn't pull others

### Performance: Async VOC
- Current: VOC blocks track loading for ~5-12s
- Solution: Asynchronous application
  1. Track loads immediately with L1 (uncorrected) markers
  2. VOC runs in background after audio decode
  3. When complete: markers update, UI refreshes
  4. User doesn't wait — correction appears within seconds
- dataVersion=3 prevents re-correction on next load

### Текущий статус (W12.5)
**Реализация:** ✅ Код написан (TC-ANCHOR-01, TC-ANCHOR-02).

**Тестирование:** ⚠️ L3 пока откатывается на L2.

**Причина:** На тестовом треке (Linkin Park — With You) найден только 1 anchor point (нужно ≥2). Пороги поиска (searchWindowSec, threshold) требуют настройки (tuning) под разные типы вокала.

**Лог:**
```
[VOC-L3] Skipped: Only 1 anchor(s) found, need ≥2. Falling back to L2.
```

**Следующий шаг:** Настройка ANCHOR_CONFIG (расширение окна или смягчение порога) для увеличения количества найденных anchor points.

---

## L3.5: Group Drag в Sync Editor (✅ РЕАЛИЗОВАНО W12)

### Проблема:
L2 и L3 дают 80-90% точности. Оставшийся нелинейный drift требует ручной корректировки, но двигать маркеры по одному — долго и нарушает относительные интервалы.

### Решение: Групповой drag выделенных маркеров (TC-DRAG-01)

**Workflow:**
1. Выделить диапазон маркеров (rectangle selection)
2. Тянуть любой из выделенных — все сдвигаются на одинаковый delta
3. При закрытии/Save — позиции фиксируются

**Архитектура:**
- `WaveformCanvas.tsx` → `dragRef.isGroupDrag` + `groupInitialTimes: Map<string, number>`
- Delta-based calculation: сохраняет относительные интервалы между маркерами
- Visual feedback: direct mutation (быстро, без store churn)
- Persist on mouseUp: `updateMarker()` для каждого измененного маркера

**Продуктовая ценность:** Позволяет за 5 секунд поправить смещенный блок, превращая 80% точности в 95% вручную.

---

## L4: Inline Loop Markers + Beat Transients (W14)

### Problem:
- Loop may "swallow" half a word at block start or end
- Sync Editor is too technical for casual users
- Need intuitive way to fine-tune marker placement

### Concept: Drag Markers on Plate

On the plate (lyrics display), at block boundaries where loop lines currently appear, place draggable markers. Dragging a marker shifts the corresponding M1/M2 marker time in the Sync Editor.

### Visual Schema:
```
     ┃  ← drag-marker (start of block, corresponds to M1 marker)
     · ·   · · ·   · ·   · · ·   ← beat transients (dots from drums stem)
     ┃
     ┃  One thing, I don't know why
     ┃  It doesn't even matter how hard you try
     ┃  Keep that in mind, I designed this rhyme
     ┃  To remind myself how I tried so hard
     ┃  In spite of the way you were mockin' me
     ┃
     · ·   · · ·   · ·   · · ·   ← beat transients (dots from drums stem)
     ┃  ← drag-marker (end of block, corresponds to M2 marker)
```

### Key Properties:
- **Drag horizontally** = shift TIME of corresponding marker in Sync Editor
- **Drum transients** = visual guide for snapping to beat
- **Not a separate editor** — same markers, friendlier UI
- **Discrete precision** = one line of text (not millisecond-level)
- **Solves:** Loop "swallowing" words at block boundaries

### Beat Transients:
- Extracted from drums stem (available in MVSEP ZIP)
- Displayed as dots along the marker line
- Non-interactive (visual guide only)
- Path to automation: markers can snap to nearest beat

### Implementation Notes:
- drag-marker ↔ Sync Editor marker = same data, different UI
- Moving drag-marker → updates markerManager → Sync Editor reflects change
- Beat transient detection = offline analysis of drums stem amplitude
- Transients cached in track record (like coverTheme)

---

## L5: Beat-Aware Auto Alignment (W15+)

### Concept:
After L3 (multi-anchor) places markers near correct positions, L5 snaps each marker to the nearest drum transient (beat). This gives musically-aligned sync where every marker lands on a beat boundary.

### Algorithm:
```
1. Compute drum transient list from drums stem
2. For each M1 marker:
   a. Find nearest transient within ±200ms
   b. If found → snap marker to transient time
   c. If not found → keep L3 position
3. Verify: no two markers snap to same transient
4. Persist with dataVersion=5
```

### Dependencies:
- Drums stem must be available (MVSEP ZIP or user-provided)
- Beat transient detection service needed (new)
- Inline loop markers (L4) provide visual verification

---

## Architecture: Auto-Lyrics Pipeline (Current)

```
┌─────────────────────────────────────────────────────────────────┐
│  ZIP IMPORT FLOW                                                │
│                                                                 │
│  1. ZIP → extract files                                         │
│     ↓                                                           │
│     lyrics.lrc (raw) + export.json (optional)                   │
│     ↓                                                           │
│  2. saveTrack()                                                 │
│     ├─ LRC detected? → parseLrcString() → lrcToMarkers()       │
│     │  → trackData.lyrics = clean text (no timestamps)         │
│     │  → trackData.syncMarkers = valid markers                  │
│     │  → trackData.dataVersion = 2                              │
│     └─ No LRC → raw text, markers=[]                           │
│                                                                 │
│  3. loadTrack() (orchestrator)                                  │
│     ├─ Step 8: ld.reloadLyrics()                                │
│     ├─ Step 10: ae.loadTrack()                                  │
│     ├─ Step 11a: mm.setMarkers()                                │
│     │  └─ [GUARD markers.bridge] → filter invalid               │
│     ├─ Step 11a.5: VOC (if dataVersion < 3)                    │
│     │  ├─ Decode vocal stem from IDB                            │
│     │  ├─ Compute RMS envelope                                  │
│     │  ├─ Find vocal onset                                      │
│     │  ├─ Apply offset if 0.3-3.0s                              │
│     │  ├─ Persist dataVersion=3                                 │
│     │  └─ [GUARD lyrics.bridge] → runtime clamp                 │
│     ├─ Step 11b: wordSync prepare                               │
│     └─ Step 12-14: autoplay, sync editor                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Reference

| File | Role | Key Functions |
|------|------|--------------|
| src/services/vocal-onset.service.ts | VOC algorithm | detectVocalOffset(), applyOffsetToMarkers() |
| src/services/auto-lyrics.service.ts | LRC parse + block sync | parseLrcString(), lrcToMarkers(), blockFirstLineSync() |
| src/services/upload.service.ts | ZIP import pipeline | saveTrack() — LRC processing (TC-AL-04) |
| src/services/track.orchestrator.ts | Track load pipeline | Step 11a.5 — VOC integration (TC-VOC-03/04) |
| src/bridges/lyrics.bridge.ts | Active line detection | Guard: skip invalid markers (TC-AL-01) |
| src/bridges/markers.bridge.ts | Marker mirror | Guard: filter invalid markers (TC-AL-02) |
| src/services/idb.service.ts | Persistence | dataVersion field, updateTrackField() |

---

## Glossary

| Term | Meaning |
|------|---------|
| **VOC** | Vocal Onset Correction — auto timing offset from vocal amplitude |
| **L1 accuracy** | Structurally correct (no crashes, valid indices) |
| **L2 accuracy** | Linear timing corrected (VOC applied) |
| **Anchor point** | A verified marker position where vocal onset matches expected time |
| **Safety Net** | Nikita's Rule: filter false positives using structural context |
| **Beat transient** | Amplitude peak in drums stem = visual beat marker |
| **Inline loop marker** | Draggable UI element on plate ↔ Sync Editor marker |
| **dataVersion** | Track record processing level (1=raw, 2=clean, 3=VOC-corrected) |
