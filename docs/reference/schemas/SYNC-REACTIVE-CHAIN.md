---
schema: SYNC-REACTIVE-CHAIN
version: 1.0
generated: 2026-04-27
nodes:
  - id: audioEngineTime
    file: src/audio/core/AudioEngineV2.ts
    layer: engine
    authority: true
    frozen: true
    observable: true
    p0: false
  - id: markersBackbone
    file: src/stores/markers.store.ts
    layer: store
    authority: true
    frozen: true
    observable: true
    p0: false
  - id: lyricsStore
    file: src/stores/lyrics.store.ts
    layer: store
    authority: false
    frozen: false
    observable: true
    p0: false
  - id: wordSyncStore
    file: src/stores/wordSync.store.ts
    layer: store
    authority: true
    frozen: true
    observable: true
    p0: false
  - id: triggerEngine
    file: src/triggers/trigger.engine.ts
    layer: trigger
    authority: true
    frozen: false
    observable: true
    p0: false
  - id: wordLineDetector
    file: src/triggers/detectors/word-line.detector.ts
    layer: trigger
    authority: false
    frozen: false
    observable: true
    p0: false
  - id: playbackVisualScheduler
    file: src/playback/playback-visual-scheduler.ts
    layer: trigger
    authority: false
    frozen: false
    observable: true
    p0: false
  - id: triggerBridge
    file: src/triggers/trigger.bridge.ts
    layer: bridge
    authority: false
    frozen: false
    observable: true
    p0: false
  - id: lyricsBridge
    file: src/bridges/lyrics.bridge.ts
    layer: bridge
    authority: false
    frozen: false
    observable: true
    p0: false
  - id: audioReactiveBridge
    file: src/bridges/audio-reactive.bridge.ts
    layer: bridge
    authority: false
    frozen: false
    observable: true
    p0: false
  - id: stemReactiveBridge
    file: src/bridges/stem-reactive.bridge.ts
    layer: bridge
    authority: false
    frozen: false
    observable: true
    p0: false
  - id: triggerStore
    file: src/triggers/trigger.store.ts
    layer: store
    authority: false
    frozen: false
    observable: true
    p0: false
  - id: wordHighlightLine
    file: src/triggers/WordHighlightLine.tsx
    layer: ui
    authority: false
    frozen: true
    observable: false
    p0: false
  - id: wordEffectsCSS
    file: src/triggers/word-effects.css
    layer: ui
    authority: false
    frozen: true
    observable: false
    p0: false
  - id: performanceStore
    file: src/performance/performance.store.ts
    layer: store
    authority: true
    frozen: false
    observable: true
    p0: false
  - id: performanceClamp
    file: src/performance/performance.clamp.ts
    layer: service
    authority: false
    frozen: false
    observable: false
    p0: false
  - id: cssVarBatch
    file: src/runtime/visual/css-var-batch.ts
    layer: runtime
    authority: false
    frozen: false
    observable: false
    p0: false
---

# SYNC-REACTIVE-CHAIN — Как слова светятся

> Полная цепочка: AudioEngineV2 → markers → active line → word-sync → 
> triggers → scheduler → CSS vars → visual FX.
> Cue vs Fill split. Scheduler lifecycle. Performance budgets.

## Legend

🟢 Stable | 🟡 Active | 🔴 P0 | ⚠️ Seam | ❄️ Frozen | 🔵 Observable | 📦 Boundary

## Level 1 — Bird's Eye

```
AudioEngineV2.getCurrentTime()
        │
        │ (transport truth)
        ▼
   ┌─────────────────┐
   │  SCHEDULER      │ ◄── PlaybackVisualScheduler (60Hz rAF)
   │  Reader Phase   │     triggerBridge OWNS start/stop ⚠️
   └────────┬────────┘
            │ ctx.currentTime
      ┌─────┴──────┐
      ▼            ▼
 ┌──────────┐  ┌──────────────┐
 │  Line     │  │  Word         │
 │ Detector  │  │  Detector     │
 │ (lyrics   │  │  (word-line   │
 │ bridge)   │  │   .detector)  │
 └─────┬────┘  └──────┬───────┘
       │              │
       │       cue vs fill split ❄️
       │       getActiveWordForLine (cue: +180ms lookahead)
       │       getFillWordForLine   (fill: exact timing)
       │              │
       ▼              ▼
 ┌───────────┐  ┌─────────────┐
 │lyrics     │  │ trigger     │
 │bridge     │  │ bridge      │
 │writer     │  │ writer      │
 └─────┬─────┘  └──────┬──────┘
       │               │
       ▼               ▼
 ┌───────────┐  ┌──────────────┐
 │lyrics     │  │ CSS vars     │
 │.store     │  │ (batched)    │
 │activeLine │  │ --bl-word-*  │
 └───────────┘  └──────┬───────┘
                       │
                       ▼
               ┌───────────────┐
               │  Scheduler     │
               │  Flush Phase   │ ← flushQueuedCssVars()
               └───────┬───────┘
                       │
                       ▼
               ┌───────────────┐
               │WordHighlight  │
               │Line.tsx       │ ← reads triggerStore.activeWordId
               └───────┬───────┘
                       │
                       ▼
               ┌───────────────┐
               │ word-effects  │
               │ .css          │ ← 4 FX families + tier clamps
               └───────────────┘
```

## Level 2 — Wire Table

### Секция A: Timing Chain (откуда берётся время)

| Node | Source | Signal | Freq | Status |
|------|--------|--------|------|--------|
| AudioEngineV2 | Master clock (instrumental stem) | getCurrentTime() | on demand | ❄️ |
| triggerBridge reader | window.audioEngine.getCurrentTime() | ctx.currentTime | 60Hz (rAF) | 🟢 |
| timeSync bridge | window.audioEngine.getCurrentTime() | audioStore.currentTime | 10Hz (poll) | 🟢 |
| lyricsBridge detector | markers.store.markers + ctx.currentTime | frameActiveLineIndex | 60Hz (rAF) | 🟢 |
| wordLineDetector | ctx.currentTime + lyricsStore.activeLineIndex | word events | 60Hz (rAF) | 🟢 |

### Секция B: Line Sync Chain (как определяется активная строка)

| Node | Source | Signal | Freq | Status |
|------|--------|--------|------|--------|
| markers.store | window.markerManager (legacy) | markers array | on event | 🟢 |
| lyricsBridge detector | markers + currentTime | frameActiveLineIndex | 60Hz | 🟢 |
| lyricsBridge writer | frameActiveLineIndex | lyricsStore.activeLineIndex | on change | 🟢 |
| lyricsBridge reverse-sync | lyricsStore.activeLineIndex | document: active-line-changed | on change | 🟢 |
| wordLineDetector | lyricsStore.activeLineIndex | line-start/line-end/line-active events | on change | 🟢 |

### Секция C: Word Sync Chain (как определяются активные слова)

| Node | Source | Signal | Freq | Selector | Status |
|------|--------|--------|------|----------|--------|
| wordSync.store | AlignmentResult (IDB) | lineMap, alignmentData | on load | ❄️ |
| shouldEnableWordHighlight | line.confidence | boolean (≥0.55) | per call | ❄️ |
| getActiveWordForLine (cue) | line.words + currentTime +180ms | WordTiming | 60Hz | ❄️ |
| getFillWordForLine (fill) | line.words + currentTime (exact) | WordTiming | 60Hz | ❄️ |
| wordLineDetector.tick | getFillWordForLine (FILL TRUTH) | word-start/word-active/word-progress | 60Hz | 🟡 |
| triggerBridge writer | word events from detector | activeWordId, activeWordText | on change | 🟢 |

### Секция D: Publication Chain (как данные попадают в DOM)

| Node | Source | Target | Signal | Freq | Status |
|------|--------|--------|--------|------|--------|
| triggerBridge writer | trigger events | queueCssVar() | --bl-word-active, --bl-word-progress, --bl-line-active | 60Hz | 🟢 |
| scheduler flush | queueCssVar | document.documentElement.style | batched setProperty | per frame | 🟢 |
| trigger.store | triggerBridge writer | activeWordId, activeWordText, activeWordConfidence, triggerLineIndex | on change | 🟢 |
| WordHighlightLine | triggerStore.activeWordId | React render (word spans) | on change | 🟡 |
| word-effects.css | CSS vars (--bl-*) | .bl-word--active styles | per frame (GPU) | 🟢 |

### Секция E: Visual FX Chain (как рендерятся эффекты)

| FX Family | CSS vars consumed | Performance tier | Recording clamp | Status |
|-----------|-------------------|------------------|-----------------|--------|
| **Progress** | `--bl-word-progress`, `--bl-active-color`, `--bl-dim-color` | All tiers (gradient) | Kept functional | 🟢 |
| **Neon** | `--bl-neon-color`, `--bl-block-{type}` | lite: 1 glow, balanced: 2 glows, max/ultra: 3 glows | Hard-clamp to color-only | 🟢 |
| **Underline** | `--bl-word-progress`, `--bl-active-color` | All tiers (background-size) | No extra glow | 🟢 |
| **Bounce** | `--bl-active-scale`, `--bl-active-glow` | lite: disabled, balanced: animation, max/ultra: +will-change | Disabled (animation: none) | 🟢 |
| **Settled Trail** | None (static opacity/color) | lite: 0.4-0.55, balanced: 0.5-0.65, max/ultra: 0.6-0.75 | Calmer (0.4-0.55) | 🟢 |
| **Focus Levels** | `--bl-active-scale`, `--bl-active-glow` | off/soft/strong variants | All clamped | 🟢 |

### Секция F: Cue vs Fill Split ❄️

| Path | Selector | Consumer | Purpose | Status |
|------|----------|----------|---------|--------|
| **Cue** | `getActiveWordForLine(lineIndex, currentTime)` | lyricsBridge detector (legacy compat) | Early highlight (+180ms lookahead) for responsive feel | ❄️ |
| **Fill** | `getFillWordForLine(lineIndex, currentTime)` | wordLineDetector.tick, triggerBridge writer | EXACT timing for progress FX, activation, fill effects | ❄️ |
| **Rule** | Word FX follows FILL truth, NOT cue truth | All trigger consumers | Prevents progress/activation divergence | ❄️ |

## Level 3 — Deep Dive

### Node: PlaybackVisualScheduler

- **Role:** coordinator (truth-blind — doesn't own timing/sync/trigger truth)
- **Lifecycle:** owned by triggerBridge (start/stop via playback-state-changed)
- **Participants:** 
  - Readers: trigger-reader (audioEngine time)
  - Detectors: trigger-detector (engine.tick), lyrics-line-detector (active line), audio-reactive-detector (FFT), stem-reactive-detector (per-stem RMS)
  - Writers: trigger-writer (CSS vars + store), lyrics-line-writer (line sync), audio-reactive-writer (5 audio vars), stem-reactive-writer (per-stem vars)
- **Frame pipeline:** read → detect → write → flushQueuedCssVars (single batched DOM write)
- **Performance:** EMA frame timing (alpha=0.1), tracks frameCount/lastFrameMs/avgFrameMs/queuedCssVarCount
- **Known issues:** 
  - ⚠️ Hidden coupling — if triggerBridge doesn't start scheduler, ALL participants dead (lyricsBridge, audioReactiveBridge, stemReactiveBridge can't start independently)
  - ⚠️ stemReactiveBridge starts scheduler independently as workaround (line 248-251), creating dual lifecycle

### Node: wordSync.store

- **Selectors:** 
  - `getActiveWordForLine` (cue): +180ms lookahead, ACTIVE_WORD_EPSILON=0.03s — for responsive early highlight
  - `getFillWordForLine` (fill): exact timing — source of truth for progress/FX
- **Confidence thresholds:** 
  - `LOW_CONFIDENCE = 0.55` — below this: NO word highlight
  - `HIGH_CONFIDENCE = 0.80` — above this: safe display
  - `shouldEnableWordHighlight(confidence)` — returns true if confidence ≥ 0.55 (medium or high band)
- **Hydration:** orchestrator-driven (alignment data from IDB)
- **State:** lineMap[], alignmentData, lyricsHash, audioSource, status (idle/ready/missing/loading/error), degraded
- **Known issues:** None (frozen split is intentional)

### Node: wordLineDetector

- **Role:** transforms currentTime + activeLineIndex into discrete/continuous/gate trigger events
- **Events produced:**
  - `line-start` (discrete) — when activeLineIndex changes
  - `line-end` (discrete) — when leaving previous line
  - `line-active` (gate, value=1) — while lineIndex >= 0
  - `word-start` (discrete) — when active word changes (includes wordId, wordText, wordIndex, lineIndex, confidence, duration)
  - `word-end` (discrete) — when leaving word or changing line
  - `word-active` (gate, value=1) — while word is active
  - `word-progress` (continuous, 0-1) — `(time - word.start) / word.duration`
- **Fill truth:** uses `getFillWordForLine()` (NOT cue selector) — critical invariant
- **Discontinuity guard:** resets if time jumps > 0.5s (handles seek/loop)
- **Known issues:** None (healthy pattern)

### Node: triggerBridge

- **Role:** SCHEDULER LIFECYCLE OWNER (starts/stops based on playback-state-changed)
- **Registers with scheduler:**
  - `trigger-reader` — reads audioEngine.getCurrentTime(), isPlaying
  - `trigger-detector` — runs engine.tick(currentTime)
  - `trigger-writer` — publishes CSS vars + store updates
- **CSS vars published:** `--bl-word-active` (0|1), `--bl-word-progress` (0.000-1.000), `--bl-line-active` (0|1)
- **Store updates (throttled):** triggerStore.activeWordId, .activeWordText, .activeWordConfidence, .triggerLineIndex
- **Throttle:** progress step = 0.03 (writes store every 3% progress, NOT every frame)
- **Start trigger:** `playback-state-changed` event with `detail.isPlaying = true`
- **Stop trigger:** `playback-state-changed` event with `detail.isPlaying = false`
- **Cleanup on track change:** resets engine, clears CSS vars, clears pending batched vars
- **Known issues:** None (healthy owner pattern)

### Node: lyricsBridge (scheduler participant)

- **Role:** line sync via scheduler (NOT event-only path)
- **Registers with scheduler:**
  - `lyrics-line-detector` — computes active line from markers + currentTime (skips M2 markers, filters out-of-bounds lineIndex)
  - `lyrics-line-writer` — publishes to lyricsStore.activeLineIndex + reverse-syncs to legacy
- **Reverse-sync to legacy:** sets `window.lyricsDisplay.currentLine`, dispatches `active-line-changed` event on document
- **Guard throttle:** logs invalid markers ONCE per track (not every frame)
- **Event listeners (separate from scheduler):** active-line-changed, lyrics-rendered, track-loaded, mode-changed, before-track-change, playback-state-changed
- **Known issues:** None (healthy dual path: scheduler for playback, events for legacy sync)

### Node: audioReactiveBridge (scheduler participant)

- **Role:** audio FFT analysis for visual reactivity
- **Registers with scheduler:**
  - `audio-reactive-detector` — reads AnalyserNode.getByteFrequencyData, computes energy/bass/mid/high/beat
  - `audio-reactive-writer` — publishes 5 CSS vars: `--bl-audio-energy`, `--bl-audio-bass`, `--bl-audio-mid`, `--bl-audio-high`, `--bl-audio-beat`
- **Setup:** connects AnalyserNode to stereoMerger (or instrumentalGain fallback) on playback start
- **FFT config:** fftSize=256, smoothingTimeConstant=0.8, 128 bins
- **Frequency bands:** bass=0-10%, mid=10-40%, high=40-100%
- **Beat detection:** bass > 0.6 threshold, with decay (0.85) for smooth falloff
- **Known issues:** None (healthy participant)

### Node: stemReactiveBridge (scheduler participant)

- **Role:** per-stem RMS + hit detection for Visual Mixer cards
- **Registers with scheduler:**
  - `stem-reactive-detector` — reads audioEngine.getStemMeterLevel per stem, applies reactivity profiles
  - `stem-reactive-writer` — publishes per-stem CSS vars: `--bl-stem-{id}-energy`, `--bl-stem-{id}-hit`
- **Phase A (Hit Detection):** runs EVERY tick (60Hz), no throttle
  - Drums: uses KICK BAND (50-150 Hz, bins 2-7) for hit detection
  - Other stems: RMS-based hit (rms > prev * 1.5 && rms > 0.02)
  - Hit decay per role profile (default 0.85)
- **Phase B (Energy):** throttled by performance tier (default 30fps = every 2nd tick)
  - EMA smoothing per role profile (music: 0.7, vocal: 0.6, backing: 0.65, effect: 0.7)
  - Sensitivity gain per stem (STEM_SENSITIVITY map)
- **Recording-safe:** publishes zeros during recording (isRecording check)
- **Independent scheduler start:** starts scheduler if not running (workaround for triggerBridge ownership gap)
- **Known issues:** 
  - ⚠️ Dual scheduler lifecycle (triggerBridge + stemReactiveBridge both call start()) — potential race

### Node: WordHighlightLine.tsx

- **Role:** React component rendering word spans with FX/state classes
- **Inputs:** lineIndex, text, fx (progress/neon/underline/bounce), focus (off/soft/strong), blockType
- **Reads from stores:** 
  - triggerStore.activeWordId (which word is active)
  - triggerStore.triggerLineIndex (which line is active)
  - wordSyncStore.status (ready/missing/etc.)
  - performance.hooks.useResolvedTrailDepth (scene/line/off)
- **Word states:** `active` (current word), `settled` (past words on active/past lines), `undefined` (idle words)
- **Line roles:** `active`, `past`, `idle` — controls wrapper data-line-role attribute
- **FX/focus application:** only on active line or past lines (in 'scene' trail depth mode)
- **Renders:** `<span className="bl-word-line" data-word-fx data-word-focus data-block-type data-line-role>` wrapper + `<span className="bl-word bl-word--active" data-word-state>` per word
- **Known issues:** None (healthy consumer)

### Node: word-effects.css

- **Role:** CSS FX families with performance tier + recording clamps
- **CSS vars consumed (from triggerBridge at 60Hz):**
  - `--bl-word-active` (0|1) — gate for active word
  - `--bl-word-progress` (0-1) — progress through current word
  - `--bl-line-active` (0|1) — gate for active line
- **4 FX families:**
  1. **Progress:** `linear-gradient(90deg, active-color 0%, active-color progress%, dim-color progress%, dim-color 100%)` with background-clip: text
  2. **Neon:** multi-layer text-shadow with `--bl-neon-color` (block-type routed)
  3. **Underline:** `background-image: linear-gradient(active-color)` with `background-size: progress% 3px`
  4. **Bounce:** `@keyframes bl-word-bounce` (0.35s ease-out, scale 0.85→1.12→1.04)
- **3 Focus levels:** off (minimal), soft (default), strong (enhanced glow/scale)
- **4 Performance tiers:** lite (cheapest), balanced, max, ultra (richest)
- **Recording clamps:**
  - Bounce: `animation: none` (disable motion)
  - Neon: hard-clamp to color-only (single 2px glow, no transform)
  - Settled trail: calmer opacity (0.4-0.55)
  - Underline/Progress: functional but no extra richness
- **Block-type color routing:** Neon FX reads `--bl-block-{verse/chorus/bridge/etc.}` for per-block neon color
- **Accessibility:** `prefers-reduced-motion: reduce` disables all animations, minimizes transitions
- **Known issues:** None (comprehensive tier/clamp coverage)

### Node: performanceStore + performanceClamp

- **Role:** tier detection + recording budget clamps
- **Tier detection:** auto-detect (device heuristics) or manual selection
- **Persistence:** localStorage `belive-performance` (tier + autoDetect only, detectedTier recomputed)
- **VisualBudget structure:**
  - `word`: maxCueWords, allowBounce, allowHeavyNeon
  - `line`: allowPreviewHandoff, allowBlockAwareColor, allowPreviewGlow
  - `visualMixer`: enabled, maxCards, cardUpdateFps, allowPulsation, allowCardGlow, allowHitFlash, allowWaveform, maxPulseIntensity, allowScenarios
- **Recording clamp (performance.clamp.ts):**
  - word: maxTrailDepth='off', allowBounce=false, allowHeavyNeon=false, maxCueWords=0
  - line: allowPreviewHandoff=false
  - visualMixer: all effects disabled, cardUpdateFps capped at 10
- **DOM publication:** `data-visual-tier` attribute on `<html>`, 5 CSS vars for budget values
- **Known issues:** None (healthy pattern)

### Node: cssVarBatch (runtime/visual/css-var-batch.ts)

- **Role:** batched CSS var writes (avoids layout thrashing from multiple setProperty calls)
- **API:** `queueCssVar(name, value)` — queues var for next flush, `flushQueuedCssVars()` — single batched setProperty call, `clearQueuedCssVars()` — clears pending queue
- **Scheduler integration:** scheduler owns flush phase (calls flushQueuedCssVars after all writers)
- **Performance:** N queue calls → 1 DOM write per frame (instead of N DOM writes)
- **Known issues:** None (healthy optimization)

## 🔵 Observability Points

| Node | What to observe | How | Priority |
|------|----------------|-----|----------|
| triggerBridge | Scheduler start/stop | CSS vars update at 60Hz during play | P0 (visual heartbeat) |
| wordLineDetector | Fill vs cue split | Progress FX matches exact word timing | P1 (sync accuracy) |
| wordSyncStore | Confidence gating | Lines < 0.55 confidence have NO word highlight | P1 (display quality) |
| lyricsBridge | Line detector accuracy | Active line matches audio position within 50ms | P1 (lyrics sync) |
| audioReactiveBridge | FFT analysis stability | Bass/mid/high/beat values don't spike erratically | P2 (visual quality) |
| stemReactiveBridge | Per-stem RMS + hit detection | Drums kick-band triggers on real hits | P2 (visual mixer) |
| WordHighlightLine | Word span rendering | Active word gets bl-word--active class | P2 (UX correctness) |
| performanceClamp | Recording mode clamps | Bounce/Neon disabled during recording | P2 (capture stability) |

## 🔗 Cross-References

- System overview → [SYSTEM-TOPOLOGY](SYSTEM-TOPOLOGY.md)
- Bridge events → [BRIDGE-EVENT-MATRIX](BRIDGE-EVENT-MATRIX.md)
- Sync architecture → [sync-system](../architecture/sync-system.md)
- Reactive lyrics → [reactive-lyrics-foundation](../architecture/reactive-lyrics-foundation.md) *(TODO: проверить существует ли)*
- Performance budgets → [performance-quality-system](../architecture/performance-quality-system.md) *(TODO: проверить существует ли)*
- Word sync types → [word-sync/types](../../src/sync/word-sync/types.ts)
- Trigger types → [trigger.types](../../src/triggers/trigger.types.ts)
- Playback visual types → [playback-visual.types](../../src/playback/playback-visual.types.ts)
