# Split (Monitor Mix) — Subsystem Architecture

**Status:** Active boundary engine — documented, verified
**Version:** 2.0
**Date:** 2026-03-21
**Authors:** Centre 1.5 + Agent 007 + Куратор Соннет 4.6
**Based on:** SCAN-09 → SCAN-15 (v1.0) + F46-SCAN-30 + runtime verification 2026-03-21
**Supersedes:** monitor-mix.md v1.0 (2025-07-14)

---

## 1. Purpose

Split is beLive's **real-time audio routing engine for live performance**.

It solves a unique product problem:
> A singer opens beLive, presses one button (SPLIT),
> and the music goes to speakers — while their vocal is
> auto-mixed back to the hall per song section.

No audio interface. No cables. Just browser + BT headphones.

This is not a settings panel. This is a **real-time audio routing subsystem**.

---

## 2. Product Role — Split-First Truth

### Today (current hero workflow)

The primary current value is:
**sending music outward while keeping a reference amount with the singer.**

- **Split music output** — instrumental plays through separate device (speakers/hall)
- **Music with me** — optional instrumental tap into monitor headphones for reference
- **AutoMix** — vocal level to hall auto-adjusts per song block (6-block taxonomy)
- **BT latency compensation** — delay node compensates for wireless lag
- **Dual device routing** — independent output device selection

### Later (not current, not blocking)

- True mic self-monitoring (voice in headphones path)
- Back Vocal engine layer (Stage 2-3)
- Richer artist cue system

### One workflow

```
User opens beLive → presses SPLIT
  → music routes to speakers
  → AutoMix controls vocal level to hall per block
  → timing compensation active
```

Context varies (rehearsal room, stage, home). Workflow stays one.

---

## 3. Current Subsystem Architecture

### Ownership model

```
React UI (MonitorMixPanel — dock panel, 327 lines TSX)
  ↓
useMonitorStore (Zustand, 391 lines)
  ↓
monitor.bridge.ts (hydration + event sync, 142 lines)
  ↓
window.monitorMix (MonitorMix class, js/monitor-mix.js, ~420 lines)
  ↓
Web Audio graph + hidden HTMLAudioElement sinks
  ↓
Physical audio outputs (headphones + speakers)
```

### Classification

- **UI layer:** React-owned (MonitorMixPanel + store + bridge)
- **Engine layer:** Legacy JS boundary (`js/monitor-mix.js`)
- **Graph layer:** Imperative Web Audio (remains imperative by design)

### Singleton lifecycle

- Created once at boot when `window.audioEngine` exists
- Lives for entire app lifetime
- No `destroy()` method (acceptable for singleton)

### Tab / UI entry point

- Dock tab ID: `'monitor'` (internal)
- Dock tab label: `'Split'` (user-facing)
- Panel: lazy-loaded, 3-column grid (Route | Mix | Auto Mix)
- No modal. No overlay. Dock-owned only.

---

## 4. Current Surface Contract

The current dock panel exposes:

| Column | Contents |
|--------|----------|
| **Route** | Send music to selector + SPLIT CTA + Timing subsection |
| **Mix** | Music with me toggle + timing nudge |
| **Auto Mix** | 6 dual-lane rows (main vocal + Back Vocal UI per block) + master BV row |

The current panel intentionally does **NOT** expose:

- Old manual vocal master toggle (`vocalToMain`)
- True mic self-monitoring path (`In headphones` — removed, see Section 5)
- Back Vocal engine controls (UI-only Stage 1 preparation exists)

---

## 5. Split Activation Semantics

### `In headphones` — removed from current surface

The voice self-monitoring control (`In headphones`) was **removed from the current panel**.

Reason: split-first flow intentionally uses `enable({ skipMic: true })` — the mic path is not created. The control was misleading: it appeared functional but had no audio effect.

Returning true mic self-monitoring requires a dedicated future path such as `enableMicMonitor()`. This is backlogged, not lost.

### What happens when user presses SPLIT

```
store.enable({ skipMic: true })
  → monitor-mix.js enable(opts)
  → if (this.enabled) return true   ← early return guard
  → skipMic=true → mic path NOT created
  → this.monitorGain.connect(this.dest)
  → this._connectVocalToMain()      ← AutoMix route gate
  → await this.ensureMainEl()       ← hidden <audio> for speakers
  → await this.mainEl.play()
  → await this.ensureOutputEl()     ← hidden <audio> for headphones
  → this.enabled = true
  → _persist()
  → dispatch 'monitor-state-changed'
```

### Route gate logic (post TC-036)

The critical historical gap was that AutoMix blocks could not open the vocal route independently — only `vocalToMain=true` could. TC-036 corrected this.

```javascript
_connectVocalToMain() {
  const allowVocalRoute = this.vocalToMain || this._hasAnyAutoMixEnabled();
  if (!allowVocalRoute) return;
  // connect vocalToMainGain → mainDest
}

_hasAnyAutoMixEnabled() {
  return !!(
    this.autoIntroOn || this.autoVerseOn || this.autoPreChorusOn ||
    this.autoChorusOn || this.autoBridgeOn || this.autoOutroOn
  );
}
```

**Before TC-036:** only `vocalToMain=true` opened route.
**After TC-036:** any AutoMix block ON opens route independently.

### Split OFF → ON resilience

Confirmed via runtime trace: a race condition exists between `enable()` completion and `routeMainEnabled` state update. Compensated by multiple `_setupRouting()` calls. Works in practice. Not guaranteed under rapid repeated toggling.

---

## 6. Engine Topology — Signal Flow

```
═══════════════════════════════════════════════════════════
PATH A: MICROPHONE → MONITOR HEADPHONES
⚠️ DORMANT — intentionally skipped (skipMic=true in split-first)
═══════════════════════════════════════════════════════════

Microphone (getUserMedia)
  → micSource [NULL in split-first mode]
  → delayNode (0-1000ms, compensateOn='monitor')
  → monitorGain (GainNode, fixed unity)
  → dest (MediaStreamDestination)
  → outputEl (<audio> hidden, setSinkId=headphones)
  → 🎧 HEADPHONES

═══════════════════════════════════════════════════════════
PATH B: INSTRUMENTAL → MONITOR HEADPHONES (music tap)
✅ ACTIVE when includeMusic=true ("Music with me")
═══════════════════════════════════════════════════════════

instrumentalGain (from AudioEngineV2 via patchV1)
  → musicGain (GainNode, 0-1.0)
  → dest (SAME MediaStreamDestination as Path A)
  → outputEl (<audio> hidden, setSinkId=headphones)
  → 🎧 HEADPHONES

═══════════════════════════════════════════════════════════
PATH C: INSTRUMENTAL → MAIN/HALL SPEAKERS
✅ PRIMARY ACTIVE PATH — activated on SPLIT
═══════════════════════════════════════════════════════════

instrumentalGain
  ├→ defaultBranchGain → ctx.destination (system default)
  └→ mainBranchGain → mainDelayNode → mainDest
     → mainEl (<audio> hidden, setSinkId=speakers)
     → 🔊 SPEAKERS/HALL

  Crossfade: routeMain ON  → default=0, main=1
             routeMain OFF → default=1, main=0

═══════════════════════════════════════════════════════════
PATH D: VOCALS → MAIN/HALL (AutoMix)
⚠️ GATE FIXED (TC-036) — source connection pending
═══════════════════════════════════════════════════════════

vocalsSourceNode [source connection pending — see Open Seams]
  → vocalToMainGain (GainNode — controlled by AutoMix, WORKING)
  → mainDelayNode (if compensateOn='main')
    OR mainDest (direct)
  → mainEl → 🔊 SPEAKERS/HALL

Runtime verified (2026-03-21):
  - _connectVocalToMain() is called correctly ✅
  - _updateAutoVocalGainForLine() fires on block transitions ✅
  - gain changes per block type ✅
  - AutoMix blocks (Verse/Pre-chorus/Chorus) verified working ✅
  - vocalToMainGain.gain value: 0 at rest, active during playback ✅

═══════════════════════════════════════════════════════════
PATH E: TEST PULSE → BOTH OUTPUTS
✅ ACTIVE — calibration tool
═══════════════════════════════════════════════════════════

OscillatorNode (1kHz, 60ms)
  → GainNode (2ms attack, 60ms decay)
  → dest (monitor headphones, always)
  → mainDest or ctx.destination (conditional)

═══════════════════════════════════════════════════════════
PATH F: BACK VOCAL → MAIN/HALL
🔵 UI PREPARED (Stage 1) — engine not yet wired
═══════════════════════════════════════════════════════════

[Future Stage 3] backVocalSource
  → backVocalGain (per-block, delta-scaled)
  → mainDest → 🔊 SPEAKERS/HALL
```

---

## 7. AutoMix Semantics

### Mechanism

```
document event 'active-line-changed'
  → _updateAutoVocalGainForLine(lineIndex)
  → window.lyricsDisplay.textBlocks → find block for current line
  → map block.type → target gain
  → vocalToMainGain.gain.value = target  ← instant, no fade
```

### Block type resolution

```javascript
const type = (block.type || 'verse').toLowerCase();
if (type.includes('verse'))   → autoVerseLevel
if (type.includes('chorus'))  → autoChorusLevel
if (type.includes('bridge'))  → autoBridgeLevel
if (type.includes('intro'))   → autoIntroLevel
if (type.includes('pre'))     → autoPreChorusLevel
if (type.includes('outro'))   → autoOutroLevel
// no match → targetLevel = 0
```

### Conflict resolution

- All auto OFF + vocalToMain=false → route closed, gain=0
- Any auto ON → auto level wins (instant change)
- vocalToMain=true + auto OFF → vocalHallLevel wins
- ⚠️ No smooth transition — potential audio clicks at block boundaries

---

## 8. Six-Block Taxonomy

| Block | Engine On field | Engine Level field | Default |
|-------|----------------|-------------------|---------|
| Intro | `autoIntroOn` | `autoIntroLevel` | 0.3 |
| Verse | `autoVerseOn` | `autoVerseLevel` | 0.3 |
| Pre-chorus | `autoPreChorusOn` | `autoPreChorusLevel` | 0.3 |
| Chorus | `autoChorusOn` | `autoChorusLevel` | 0.3 |
| Bridge | `autoBridgeOn` | `autoBridgeLevel` | 0.3 |
| Outro | `autoOutroOn` | `autoOutroLevel` | 0.3 |

**v1.0 taxonomy:** only Verse/Chorus/Bridge — Intro/Pre-chorus/Outro collapsed to Verse.
**v2.0 taxonomy (current):** all 6 blocks independent. Engine updated in TC-025.

### localStorage keys

| Key | Default |
|-----|---------|
| `monitor:autoIntroOn` / `autoIntroLevel` | false / 0.3 |
| `monitor:autoVerseOn` / `autoVerseLevel` | false / 0.3 |
| `monitor:autoPreChorusOn` / `autoPreChorusLevel` | false / 0.3 |
| `monitor:autoChorusOn` / `autoChorusLevel` | false / 0.3 |
| `monitor:autoBridgeOn` / `autoBridgeLevel` | false / 0.3 |
| `monitor:autoOutroOn` / `autoOutroLevel` | false / 0.3 |

---

## 9. Store / Bridge / Panel Contract

### monitor.store.ts (391 lines)

**Engine-mirrored state (synced via bridge):**
- `enabled`, `routeMainEnabled`, `includeMusic`, `musicLevel`
- `vocalToMain`, `vocalHallLevel`, `delayMs`, `compensateOn`
- `outputDeviceId`, `mainDeviceId`
- 6-block AutoMix: On/Level pairs (12 fields)

**UI-only state (not in bridge/engine):**
- `open` — panel visibility
- `hallVolume`, `monitorVolume` — UI sliders
- 14 Back Vocal fields (Stage 1 — see Section 10)

**Key actions:**
- `enable({ skipMic })` — async, creates audio path
- `setAutoVerse/Chorus/Bridge/Intro/PreChorus/Outro` — engine setters
- `setBackVocalMaster` — groups all BV blocks ON/OFF (UI-only)
- `setBackVocalMasterLevel` — stores value only, delta applied in TSX

### monitor.bridge.ts (142 lines)

**Bridge role:** hydration of legacy `window.monitorMix` with v2.0 state functions + event sync.

**Patched methods on legacy engine:**
```
getState, _persist, setMusicLevel
setAutoVerse, setAutoVerseLevel
setAutoChorus, setAutoChorusLevel
setAutoBridge, setAutoBridgeLevel
setDelayMs
```

**On 6-block setters:** bridge hydration supports extended 6-block state. Store-to-engine direct calls handle the setter path for Intro/Pre-chorus/Outro. The bridge patch list is narrower than the full engine method surface — this is not currently blocking the UI path.

**Events listened:**
- `monitor-state-changed` → sync store from engine
- `monitor-route-changed` → sync routing state
- `devicechange` → refresh device list (only when panel open)

**Back Vocal:** bridge does NOT sync BV state — UI-only by design in Stage 1.

**Retry:** 30 attempts × 200ms = 6 seconds max.

### MonitorMixPanel.tsx (327 lines)

**Sub-components:**
- `DualAutoMixRow` — dual-lane row per block (lines 245-299)
- `ToggleSliderRow` — generic toggle + slider (lines 301-326)

**Column activation semantics:**
```typescript
splitActive    = st.enabled && st.routeMainEnabled
mixActive      = splitActive && st.includeMusic
autoMixActive  = st.autoVerseOn || st.autoChorusOn || ... (any of 6)
backVocalActive = st.backVocalMasterOn || any BV block On
```

---

## 10. Web Audio Node Inventory

### Eager nodes (constructor)

| Node | Type | Status |
|------|------|--------|
| `delayNode` | DelayNode (1.0s max) | ✅ Active |
| `monitorGain` | GainNode | ✅ Active |
| `musicGain` | GainNode | ✅ Active |
| `dest` | MediaStreamDestination | ✅ Active |
| `vocalToMainGain` | GainNode | ✅ Active (gain=0 at rest) |
| `mainDest` | MediaStreamDestination | ✅ Active |

### Lazy nodes (on demand)

| Node | Created when | Status |
|------|-------------|--------|
| `micSource` | enable() without skipMic | ⚠️ NULL in split-first (by design) |
| `mainDelayNode` | _setupRouting() | ✅ Created on Split |
| `defaultBranchGain` | _setupRouting() | ✅ Created on Split |
| `mainBranchGain` | _setupRouting() | ✅ Created on Split |

### Hidden HTML elements

| Element | Purpose | Status |
|---------|---------|--------|
| `outputEl` | Monitor sink (setSinkId=headphones) | ✅ Created on Split |
| `mainEl` | Main sink (setSinkId=speakers) | ✅ Created on Split |

---

## 11. Back Vocal — Staged Roadmap

### Stage 1 — UI-Only ✅ COMPLETE

- 14 store fields: master (On/Level) + 6 blocks × (On/Level)
- Dual-lane rows in Auto Mix — left=main vocal, right=BV per block
- Master toggle: groups all 6 BV blocks ON/OFF simultaneously
- Delta-based master level: preserves relative per-block differences
- Visual system: 3-state (inactive → active → hover)
- Master BV: visually dominant (dot 20px, slider 6px, label weight 600)
- No engine. No bridge. No localStorage. UI prototype only.

### Stage 2 — Parsing ⏳ PENDING

- Detect `(Back Vocal)` / `(Бэк Вокал)` pattern in lyrics text
- Render BV text with distinct color/style (distinct span + className)
- Legacy had red-highlight for BV lines — check if logic survives
- For line-sync tracks: whole line may mix main + BV text

### Stage 3 — Engine ⏳ PENDING

- New audio path for BV signal in `monitor-mix.js`
- New `backVocalGain` nodes per block
- Word-sync triggers: when BV word active → use BV gain
- Fallback for line-sync tracks: block-level BV gain
- Bridge extension for BV state sync

### Track persistence (backlog)

```
Future: save AutoMix + BV presets per track in belive-package.json
Load on track open if splitEnabled
Structure:
  autoMix: { verse: {on, level}, chorus: {on, level}, ... }
  backVocal: { master: {on, level}, verse: {on, level}, ... }
```

---

## 12. Open Seams

### 🟡 Remaining (not critical blockers)

| Seam | Impact | Status |
|------|--------|--------|
| `vocalsSourceNode` source connection | Path D gain works, source node pending | Next engine TC |
| Split OFF→ON race condition | Works in practice, not guaranteed under rapid toggle | Hardening |
| No smooth gain transition in AutoMix | Potential clicks at block boundaries | Enhancement |
| No devicechange listener in engine | No auto-recovery on BT disconnect | Enhancement |
| `microphoneSource` stream fallback | Duplicate source if mic path ever reactivated | Tolerable |
| Bridge patch list narrower than engine | Not blocking current UI path | Document only |

### 🟢 Low (singleton lifecycle)

| Seam | Impact | Status |
|------|--------|--------|
| No `destroy()` method | App-lifetime singleton | Document only |
| Hidden `<audio>` never removed | 2 max, not growing | Tolerable |
| `_autoMixHandler` never unsubscribed | Single subscription, app-lifetime | Tolerable |
| Back Vocal not in bridge | UI-only by design Stage 1 | Expected |

### ✅ Closed seams (historical)

| Seam | Closed by |
|------|-----------|
| AutoMix route gate — only `vocalToMain` could open route | TC-036 |
| 3-block taxonomy only (Intro/Pre-ch/Outro collapsed to Verse) | TC-025 |
| Modal overlay — panel not in dock | TC-016 through TC-023 |
| `In headphones` misleading dead control on surface | Removed in TC-037 |

---

## 13. localStorage Keys — Complete

| Key | Type | Default | Engine wired? |
|-----|------|---------|--------------|
| `monitor:delayMs` | number | 120 | ✅ |
| `monitor:compensateOn` | string | 'monitor' | ✅ |
| `monitor:includeMusic` | boolean | false | ✅ |
| `monitor:musicLevel` | number | 0.15 | ✅ |
| `monitor:deviceId` | string | '' | ✅ |
| `monitor:mainDeviceId` | string | '' | ✅ |
| `monitor:routeMain` | boolean | false | ✅ |
| `monitor:vocalToMain` | boolean | false | ✅ |
| `monitor:vocalHallLevel` | number | 0.2 | ✅ |
| `monitor:autoVerseOn/Level` | bool/num | false/0.3 | ✅ |
| `monitor:autoChorusOn/Level` | bool/num | false/0.3 | ✅ |
| `monitor:autoBridgeOn/Level` | bool/num | false/0.3 | ✅ |
| `monitor:autoIntroOn/Level` | bool/num | false/0.3 | ✅ |
| `monitor:autoPreChorusOn/Level` | bool/num | false/0.3 | ✅ |
| `monitor:autoOutroOn/Level` | bool/num | false/0.3 | ✅ |
| Back Vocal fields | — | — | ❌ UI-only, no localStorage yet |

---

## 14. Research Anchor — BT Sync Investigation

Next task for research branch:

**Question:** What is the best scenario for BT ↔ PC synchronization in split-first workflow?

**Known constraints:**
- BT headphones: 100-300ms latency (device-dependent)
- Current delay compensation: `delayNode` (monitor path) or `mainDelayNode` (hall path)
- Test pulse: 1kHz sine, 60ms, fires to both outputs simultaneously
- No auto-recovery on BT disconnect — user must manually re-select

**Nikita's test protocol:** to be provided separately by Nikita.

**Research branch anchor:** this document v2.0.

---

## 15. Why Not Rewrite Engine Now

Graph remains imperative Web Audio by design — not a React limitation.
Do NOT extract to TypeScript until ALL:

1. ✅ Split-first product contract frozen
2. ⏳ `vocalsSourceNode` source connection closed
3. ⏳ BV engine Stage 3 complete
4. ⏳ BT sync scenario research done
5. ⏳ Regression matrix documented

---

## 16. One-Line Summary

**Split is beLive's real-time audio routing engine: press one button, music goes to speakers, AutoMix controls 6-block vocal routing to hall — route gate is fixed, source connection is the next engine task, Back Vocal UI is prepared and waiting for engine Stage 3.**
