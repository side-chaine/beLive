# 🎵 N-Stem Architecture — beLive Audio Engine

**Status:** ✅ IMPLEMENTED (production-ready, all waves complete)
**Last Updated:** April 23, 2026
**Owner:** beLive Audio Team
**Related:** `audio-engine.md`, `architecture-map-2.1.md`

---

## 📋 TABLE OF CONTENTS

1. [Overview](#overview)
2. [Core Concepts](#core-concepts)
3. [Stem Registry (BUILTIN_STEMS)](#stem-registry-builtin_stems)
4. [Routing Architecture](#routing-architecture)
5. [Data Flow Pipeline](#data-flow-pipeline)
6. [ZIP Classification (W6)](#zip-classification-w6)
7. [AudioEngineV2 N-Stem Loading](#audioenginev2-n-stem-loading)
8. [Volume Control Architecture](#volume-control-architecture)
9. [Mode Volume Policies](#mode-volume-policies)
10. [Metering Infrastructure (W5)](#metering-infrastructure-w5)
11. [MixerPanel UI](#mixerpanel-ui)
12. [State Management](#state-management)
13. [Known Issues](#known-issues)
14. [Implementation Waves](#implementation-waves)
15. [Frozen Decisions](#frozen-decisions)

---

## 1. OVERVIEW

beLive supports **N audio stems** per track, extending beyond the original 2-stem (instrumental + vocals) architecture. Each stem has:

- A **semantic role** (`master`, `music`, `vocal`, `backing`, `effect`) that determines automatic routing
- **Independent volume, mute, solo, and pan** controls
- **Per-stem metering** via parallel AnalyserNode taps
- **Mode-aware volume policies** (Karaoke, Concert, Rehearsal, Live)

### Key Design Principles

- **Role-based routing**: Stems are automatically routed to buses based on their role via `ROLE_ROUTING` table
- **Master clock invariant**: The instrumental stem (`master` role) NEVER pauses — `getCurrentTime()` depends on it
- **Parallel bus taps**: Bus gainNodes are connected as parallel taps from stem gainNodes (NOT in the primary signal path)
- **Effective gain formula**: `stemVolume × busVolume × (muted ? 0 : 1)` applied at each stem's `gainNode.gain`
- **Clean-slate classification**: ZIP upload uses a residual principle — the file with NO stem keyword = instrumental
- **Tumbler/Button split**: `stemsMode` (tumbler) controls loading and fader visibility; `stemsEnabled` (button) controls playback mute/unmute. They are separate concerns.
- **Progressive loading**: Two-phase load (Phase 1 = instrumental, Phase 2 = vocals + stems) when stemsMode=true. Instrumental plays normally until Phase 2 completes.
- **Boot vs Switch**: IDB `stemsMode` restores only on page reload (boot). Track switches preserve user's current state from store.

---

## 2. CORE CONCEPTS

### StemRole

```typescript
type StemRole = 'master' | 'music' | 'vocal' | 'backing' | 'effect';
```

| Role | Description | Routing Target | Examples |
|------|-------------|----------------|----------|
| `master` | Master clock stem — NEVER muted | `master-bus` | instrumental |
| `music` | Music group stems | `music-bus` | drums, bass, keys, guitar |
| `vocal` | Lead vocal stem | `vocal-bus` | vocals |
| `backing` | Backing vocal stems | `vocal-bus` | backing |
| `effect` | Future: FX sends | `fx-bus` | (reserved) |

### RoutingTarget

```typescript
type RoutingTarget = 'master-bus' | 'music-bus' | 'vocal-bus' | 'fx-bus';
```

Each bus is a `GainNode` with `gain = 1.0` (unity summing point). Stems connect to their bus as **parallel taps**, meaning the stem's `gainNode` has multiple outputs:

```
stem.gainNode ──┬──→ VocalMix merger (primary path — stereo separation)
                └──→ bus.gainNode  (parallel tap — for bus-level control)
```

### ROLE_ROUTING Table

```typescript
const ROLE_ROUTING = {
  master:  'master-bus',   // instrumental — always plays (clock invariant)
  music:   'music-bus',    // drums, bass, keys, guitar
  vocal:   'vocal-bus',    // lead vocal
  backing: 'vocal-bus',    // backing vocal (same bus, different role)
  effect:  'fx-bus',       // future: reverb sends, etc.
} as const;
```

❄️ **FROZEN**: Master bus is SEPARATE from music bus. Muting music-bus must NOT affect the master clock.

---

## 3. STEM REGISTRY (BUILTIN_STEMS)

**File:** `src/stem/stemTypes.ts`

The registry defines all known stem slots with their roles, labels, colors, and display properties:

```typescript
const BUILTIN_STEMS = {
  instrumental: { id: 'instrumental', role: 'master',  label: 'Instrumental', shortLabel: 'Inst', color: '#e06060' },
  vocals:       { id: 'vocals',       role: 'vocal',   label: 'Vocal',        shortLabel: 'Vox',  color: '#4f8bff' },
  drums:        { id: 'drums',        role: 'music',   label: 'Drums',        shortLabel: 'Drm',  color: '#ff9f43' },
  bass:         { id: 'bass',         role: 'music',   label: 'Bass',         shortLabel: 'Bas',  color: '#ee5a24' },
  keys:         { id: 'keys',         role: 'music',   label: 'Keys',         shortLabel: 'Key',  color: '#a29bfe' },
  guitar:       { id: 'guitar',       role: 'music',   label: 'Guitar',       shortLabel: 'Gtr',  color: '#fdcb6e' },
  backing:      { id: 'backing',      role: 'backing', label: 'Back Vocal',   shortLabel: 'BVox', color: '#81ecec' },
  other:        { id: 'other',        role: 'music',   label: 'Other',        shortLabel: 'Oth',  color: '#b2bec3' },
} as const;
```

### Display Order

```typescript
const DEFAULT_ROLE_ORDER = {
  master:  0,    // instrumental — always first
  music:   1,    // drums, bass, keys, guitar — by load order
  vocal:   100,  // lead vocal — after all music
  backing: 101,  // backing vocal — immediately after lead
  effect:  200,  // future
} as const;
```

---

## 4. ROUTING ARCHITECTURE

### Audio Graph (per stem)

```
┌─────────────────────────────────────────────────────────────────┐
│                         Stem: drums                              │
│                                                                   │
│  audio element ──→ sourceNode ──→ gainNode ──┬──→ VocalMix       │
│                                              │     merger ──→ spk │
│                                              │                     │
│                                              ├──→ music-bus ──┐   │
│                                              │                │   │
│                                              └──→ Program ────┤   │
│                                                       Capture │   │
└─────────────────────────────────────────────────────────────────┘
                                                                 │
┌─────────────────────────────────────────────────────────────────┐
│                         Stem: instrumental (master)              │
│                                                                   │
│  audio element ──→ sourceNode ──→ gainNode ──→ masterVolumeGain  │
│                                               (clock tap)         │
│                                              ──→ master-bus ──┤   │
│                                              ──→ Program ─────┤   │
│                                              ──→ VocalMix ────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Key Invariants

1. **`bus.gainNode.gain = 1.0` ALWAYS** — bus is a summing point, not a gain stage
2. **Instrumental NEVER pauses** — mute is implemented via `masterVolumeGain.gain = 0`, not `audio.pause()`
3. **Program Capture reads from buses** — NOT from VocalMix merger, so V-Mix stereo transform doesn't affect recording

---

## 5. DATA FLOW PIPELINE

```
┌─────────────────────────────────────────────────────────────────┐
│                    ZIP Upload → Track Loading                     │
│                                                                   │
│  ZIP file                                                          │
│    ↓                                                               │
│  classifyStemFromFilename()  [W6: residual principle]              │
│    ↓                                                               │
│  uploadSession.additionalStems  { drums, guitar, keys }            │
│    ↓                                                               │
│  saveTrack() → IDB                                                 │
│    ├─ saveTrack(trackData)           → TrackRecord                 │
│    └─ updateTrackField(id, {stemsData}) → patches stemsData        │
│    └─ savedTrack.stemsData = stemsData  → patches in-memory ref    │
│    └─ trackCatalog.tracks.push(savedTrack)                         │
│    ↓                                                               │
│  loadTrack() from catalog click                                      │
│    ↓                                                               │
│  track.orchestrator.ts                                               │
│    ├─ getTrackFromIDB(track.id)        → fresh read with stemsData  │
│    ├─ tc.tracks[index] = freshTrack    → patch in-memory catalog    │
│    ├─ Create Blob URLs for each stem in stemsData                   │
│    ├─ Resolve role from BUILTIN_STEMS, default 'music'              │
│    └─ ae.loadTrack(iUrl, vUrl, additionalStems)                     │
│    ↓                                                               │
│  patchV1.ts  [W5fix: forwards 3rd param]                            │
│    v1.loadTrack = (i, v?, additionalStems?) =>                      │
│      v2.loadTrack(i, v ?? null, additionalStems)                    │
│    ↓                                                               │
│  AudioEngineV2.loadTrack(instrumentalUrl, vocalsUrl, additional)    │
│    ├─ Register stem URLs + roles                                    │
│    ├─ Load instrumental (master clock) first                        │
│    ├─ Load other stems in parallel (Promise.allSettled)             │
│    ├─ _rebuildFullRouting()                                         │
│    │   ├─ Create bus gainNodes (master-bus, music-bus, vocal-bus)   │
│    │   ├─ Route stems to buses by ROLE_ROUTING                      │
│    │   ├─ _reconnectBusTaps()                                       │
│    │   ├─ _reconnectAnalysers()  [W5: metering]                     │
│    │   └─ _applyEffectiveGain() for each stem                       │
│    ├─ _reconnectProgramBus()                                        │
│    └─ _notifyTrackLoaded(loadedStems, hasVocals)                    │
│    ↓                                                               │
│  audio.bridge.ts  [track-loaded event]                              │
│    useStemStore.getState().initStems(loadedStems)                   │
│    ↓                                                               │
│  MixerPanel.tsx  [reacts to loadedStems]                            │
│    Renders ChannelStrip for each stem in sorted order               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. ZIP CLASSIFICATION (W6)

**File:** `src/services/upload.service.ts`

### Residual Principle

Instrumentals are named after the track (e.g., `"Linkin Park - In the End.flac"`), they never contain stem keywords like `"drums"`, `"vocals"`, etc. So the classification is:

**File with NO stem keyword match = instrumental**

### Keyword Map

```typescript
const STEM_CLASSIFICATION_KEYWORDS = {
  vocals:  ['_vocals_', '_vocal', 'vocals', 'vocal', '_vox_', ' vox', 'lead_vox', 'lead_vocal'],
  drums:   ['drums', 'drum', 'drm'],
  bass:    ['bass', 'bass_'],
  keys:    ['keys', 'key_', '_key', 'piano', 'kys', 'synth'],
  guitar:  ['guitar', 'gtr', 'guit'],
  backing: ['back_voc', 'bgvoc', 'bvoc', 'backing_vocal', '_bv', 'bv_', 'back_vox', 'backing'],
};
```

### Classification Flow

1. Check backing vocal patterns FIRST (avoid false lead-vocal match)
2. Check all stem slots in order
3. If no keyword matches → `null` = instrumental
4. Duplicate slots: first file wins, subsequent go to `backing` (for vocals) or are skipped

### Example

```
ZIP contents:
  drums.mp3              → classifyStemFromFilename('drums') = 'drums'
  guitar.mp3             → classifyStemFromFilename('guitar') = 'guitar'
  In the End_vocals_.mp3 → classifyStemFromFilename('In the End_vocals_') = 'vocals'
  In the End.flac        → classifyStemFromFilename('In the End') = null → INSTRUMENTAL
  piano.mp3              → classifyStemFromFilename('piano') = 'keys'

Result:
  instrumental: In the End.flac
  vocals: In the End_vocals_.mp3
  additionalStems: { drums, guitar, keys }
```

---

## 7. AUDIOENGINEV2 N-STEM LOADING

**File:** `src/audio/core/AudioEngineV2.ts`

### loadTrack() Signature

```typescript
async loadTrack(
  instrumentalUrl: string,
  vocalsUrl: string | null = null,
  additionalStems?: StemLoadMap
): Promise<{ duration: number; loadedStems: string[]; hasVocals: boolean }>
```

### StemLoadMap

```typescript
interface StemLoadMap {
  [stemId: string]: {
    url: string;       // Blob URL or remote URL
    role: StemRole;    // 'master' | 'music' | 'vocal' | 'backing' | 'effect'
  };
}
```

### Loading Sequence

1. **Reset state**: Clear all stems, buses, analysers, volume state
2. **Register URLs**: Store instrumental, vocals, additional stems with their roles
3. **Load instrumental first** (master clock — serial, not parallel)
4. **Create `_masterVolumeGain`** (mute invariant A2.25)
5. **Load all other stems in parallel** (`Promise.allSettled`)
6. **`_rebuildFullRouting()`** — disconnect everything, reconnect based on ROLE_ROUTING
7. **`_reconnectBusTaps()`** — parallel taps to bus gainNodes
8. **`_reconnectAnalysers()`** — parallel taps for metering
9. **`_applyEffectiveGain()`** — set each stem's gainNode.gain
10. **`_reconnectProgramBus()`** — bus gainNodes → program capture destination
11. **`_notifyTrackLoaded(loadedStems, hasVocals)`** — emit `track-loaded` event

### Load Generation Tracking

```typescript
const gen = ++this._loadGeneration;  // unique per loadTrack() call
```

If a new `loadTrack()` is called before the previous one finishes, the old load is aborted by checking `gen !== this._loadGeneration` at each checkpoint.

---

## 8. VOLUME CONTROL ARCHITECTURE

### Effective Gain Formula

```
effectiveGain = stemVolume × busVolume × (muted ? 0 : 1)
```

Applied at each stem's `gainNode.gain`, NOT at the bus level.

```typescript
private _applyEffectiveGain(stemId: string): void {
  const stem = this.stems.get(stemId);
  if (!stem) return;

  const stemVol = this._stemVolumes[stemId] ?? 1;
  const role = this._stemRoles[stemId];
  const busId: RoutingTarget = role ? ROLE_ROUTING[role] : 'music-bus';
  const busVol = this._busVolumes[busId] ?? 1;
  const muted = this._stemMutes[stemId] ?? false;

  const effectiveGain = stemVol * busVol * (muted ? 0 : 1);
  stem.gainNode.gain.setValueAtTime(effectiveGain, ctx.currentTime);
}
```

### State Storage (AudioEngineV2)

```typescript
private _stemVolumes: Record<string, number> = {};   // per-stem volume (0-1)
private _busVolumes: Record<string, number> = {};    // per-bus volume (0-1)
private _stemMutes: Record<string, boolean> = {};    // per-stem mute
private _stemSolos: Record<string, boolean> = {};    // per-stem solo
```

### API

| Method | Description |
|--------|-------------|
| `setStemVolume(id, vol)` | Set stem volume, recompute effective gain |
| `setBusVolume(busId, vol)` | Set bus volume, recompute ALL stems in that bus |
| `setStemMute(id, mute)` | Toggle mute (effective gain = 0 or restored) |
| `setStemSolo(id, solo)` | Toggle solo (solo logic: mute all non-solo stems) |

### Master Mute Invariant (A2.25)

```
instrumental.audio ──→ sourceNode ──→ gainNode (clock tap, gain=1 ALWAYS)
                                       ──→ masterVolumeGain (gain=user volume, 0 when muted)
                                       ──→ master-bus
```

`gainNode.gain` is ALWAYS 1.0 for the instrumental stem. Mute is implemented via `masterVolumeGain.gain = 0`.

---

## 9. MODE VOLUME POLICIES

**File:** `src/stem/stemTypes.ts`

### Policy Table

```typescript
const MODE_STEM_POLICIES = {
  karaoke:   { musicGroup: 1, leadVocal: 0, backingVocal: 0, mic: 'off', vMix: 'off' },
  concert:   { musicGroup: 1, leadVocal: 0, backingVocal: 0, mic: 'off', vMix: 'off' },
  rehearsal: { musicGroup: 1, leadVocal: 1, backingVocal: 1, mic: 'on',  vMix: 'user' },
  live:      { musicGroup: 1, leadVocal: 0, backingVocal: 0, mic: 'on',  vMix: 'on' },
} as const;
```

### Role → Policy Mapping

```typescript
function getRolePolicyVolume(role: StemRole, policy: ModeStemPolicy): number {
  switch (role) {
    case 'master':  return policy.musicGroup;    // instrumental follows music
    case 'music':   return policy.musicGroup;
    case 'vocal':   return policy.leadVocal;
    case 'backing': return policy.backingVocal;
    case 'effect':  return policy.musicGroup;    // default
  }
}
```

### Mode Switch Flow

1. **Switching FROM Rehearsal**: Save current volumes to localStorage (`bl-rehearsal-volumes`)
2. **Switching TO Rehearsal**: Restore from localStorage (or use policy defaults)
3. **Switching TO Karaoke/Concert/Live**: Apply MODE_STEM_POLICIES per stem role

### Two-Path Architecture

| Path | Component | Responsibility |
|------|-----------|----------------|
| **Command path** | `mode-switch.bridge.ts` | Save rehearsal volumes, apply new mode, emit `mode-changed` |
| **Observer path** | `mode.bridge.ts` | Listen to `mode-changed`, apply volume policy with 100ms delay |

---

## 10. METERING INFRASTRUCTURE (W5)

**File:** `src/audio/core/AudioEngineV2.ts`

### Parallel AnalyserNode Architecture

```
stem.gainNode ──┬──→ merger (primary path)
                ├──→ bus.gainNode (parallel tap)
                └──→ analyserNode (parallel tap — READ ONLY)
```

AnalyserNodes are **NOT in the signal path**. They are read-only taps that consume audio data without modifying it.

### Implementation

```typescript
// State
private _analysers: Map<string, AnalyserNode> = new Map();

// Read RMS level
getStemMeterLevel(stemId: string): number {
  const analyser = this._analysers.get(stemId);
  if (!analyser) return 0;
  const data = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(data);
  let sum = 0;
  for (let i = 0; i < data.length; i++) { sum += data[i] * data[i]; }
  return Math.sqrt(sum / data.length);
}

// Reconnect after routing changes
private _reconnectAnalysers(): void {
  const ctx = getAudioContext();
  this._analysers.forEach(a => { try { a.disconnect(); } catch (_) {} });
  this._analysers.clear();
  this.stems.forEach((stem, id) => {
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.8;
    this._analysers.set(id, analyser);
    if (id === 'instrumental' && this._masterVolumeGain) {
      try { this._masterVolumeGain.connect(analyser); } catch (_) {}
    } else {
      try { stem.gainNode.connect(analyser); } catch (_) {}
    }
  });
}
```

### Exposed on patchV1

```typescript
v1.getStemMeterLevel = (stemId: string) => v2.getStemMeterLevel(stemId);
```

---

## 11. MIXERPANEL UI

**File:** `src/components/MixerPanel.tsx`, `src/components/MixerPanel.module.css`

### Architecture

- **MixerPanel** component reads `loadedStems` from `useStemStore`
- Sorts stems by `DEFAULT_ROLE_ORDER` via `sortStemsForDisplay()`
- Renders **ChannelStrip** sub-component for each stem
- **Stems mode visibility** (TC-10.7): Music stem faders visible only when `stemsMode=true`. Instrumental and vocals always visible.
- **Staggered animation** (TC-10.7): Faders appear with 50ms delay between each (`transitionDelay: ${index * 0.05}s`)
- **Volume sync** (TC-10.7): Button toggle updates BOTH engine (`ae.setStemVolume`) AND store (`st.setStemVolume`) so faders display correct positions
- **Stems toggle button**: Controls `stemsEnabled` (playback), not `stemsMode` (visibility)
- Polls meter levels via `audioEngine.getStemMeterLevel(stemId)` at tier-dependent FPS

### ChannelStrip Components

| Element | Source |
|---------|--------|
| Label | `BUILTIN_STEMS[stemId].shortLabel` |
| Color accent | `BUILTIN_STEMS[stemId].color` |
| Fader | `useStemStore(s => s.stemVolumes[stemId])` → `audioEngine.setStemVolume()` |
| M button | `useStemStore(s => s.stemMutes[stemId])` → `audioEngine.setStemMute()` |
| S button | `useStemStore(s => s.stemSolos[stemId])` → `audioEngine.setStemSolo()` |
| Meter | CSS-only fill, height from `getStemMeterLevel()` converted to dB% |

### Meter Conversion

```typescript
const meterPercent = level > 0
  ? Math.min(100, (20 * Math.log10(level) + 60) / 60 * 100)
  : 0;
// Maps 0.001 (-60dB) → 0%, 1.0 (0dB) → 100%
```

### Performance Tiers

```typescript
const STEM_CAPACITY_BY_TIER = {
  lite:     { maxStems: 4,  meterFps: 10, meterStyle: 'solid' },
  balanced: { maxStems: 6,  meterFps: 20, meterStyle: 'solid' },
  max:      { maxStems: 8,  meterFps: 30, meterStyle: 'gradient' },
  ultra:    { maxStems: 16, meterFps: 60, meterStyle: 'gradient-peak' },
};
```

### Module Registration

```typescript
registerModule({
  id: 'mixer',
  label: 'Mixer',
  order: 28,
  modes: ['rehearsal'],  // rehearsal-only for now
  load: () => import('../components/MixerPanel').then(m => ({ default: m.MixerPanel })),
});
```

---

## 12. STATE MANAGEMENT

### stem.store.ts (Zustand)

```typescript
interface StemState {
  loadedStems: string[];                    // Currently loaded stem IDs
  stemVolumes: Record<string, number>;      // Per-stem volume (0-1)
  stemMutes: Record<string, boolean>;       // Per-stem mute
  stemSolos: Record<string, boolean>;       // Per-stem solo
  stemPans: Record<string, number>;         // Per-stem pan (-1 to 1)

  /** Stems mode preference (tumbler state) — true = load & show stem faders */
  stemsMode: boolean;                       // W10: Tumbler ON/OFF

  /** Stems playback state (button state) — true = stems playing NOW */
  stemsEnabled: boolean;                    // W10: Button ON/OFF

  /** On-demand stems loading state */
  stemsLoading: boolean;                    // TC-8.6A

  /** True after first IDB restore — prevents IDB override on track switch */
  _stemsBootRestored: boolean;              // TC-10.12

  stemDisplayOrder: StemDisplayOrder[] | null;
  stemAutomation: StemAutomationData | null;
  _lastSnapshot: StemSnapshot | null;
}
```

### Initialization Flow

```
audio.bridge.ts listens to 'track-loaded' event
  ↓
event.detail.loadedStems = ['instrumental', 'vocals', 'drums', 'guitar', 'keys']
  ↓
useStemStore.getState().initStems(loadedStems)
  ↓
Sets: loadedStems, stemVolumes (all 1), stemMutes (all false),
      stemSolos (all false), stemPans (all 0)
      stemsEnabled: preserved from get().stemsEnabled (TC-10.9)
      stemsMode: preserved from get().stemsMode (TC-10.6)
      _stemsBootRestored: preserved from get()._stemsBootRestored (TC-10.12)
  ↓
audio.bridge.ts: IDB restore logic (TC-10.12)
  ├─ Boot (first load): effectiveEnabled = currentEnabled || savedMode
  │   → _stemsBootRestored = true
  └─ Track switch: effectiveEnabled = currentEnabled (preserve user choice)
```

### Tumbler vs Button Semantics (W10)

| Control | State Field | Purpose | UI Location |
|---------|-------------|---------|-------------|
| **Tumbler** | `stemsMode` | Load stems + show/hide faders | QuickActions menu |
| **Button** | `stemsEnabled` | Mute/unmute stems playback | MixerPanel header |

**Workflow:**
1. Tumbler ON → `stemsMode=true` → stems load on-demand → faders appear → `stemsEnabled=false` → stems muted
2. Button click → `stemsEnabled=true` → instrumental muted, stems unmute → button glows
3. Button click → `stemsEnabled=false` → instrumental unmute, stems mute → button dims
4. Tumbler OFF → `stemsMode=false` → faders hidden → if playing, stems muted

**Loading path decision (TC-10.15):**
`shouldLoadStems = stemsMode || stemsEnabled`
If true → progressive path (load stems). If false → non-progressive (inst + voc only).

### Snapshot System

```typescript
captureSnapshot(): StemSnapshot     // Save current state for mode transitions
restoreSnapshot(snapshot): void     // Restore state (rehearsal mode return)
```

---

## 13. KNOWN ISSUES

### Active Issues

| Issue | Status | Notes |
|-------|--------|-------|
| **Hard resync drift (bass: 209-586ms)** | 📋 Tracked | Progressive path hot-plug seeks during playback. Fix: await seeked before play(). See [track-load-optimization-dec-01-02.md](./track-load-optimization-dec-01-02.md). |
| **GUARD CRITICAL log spam** | ✅ Fixed (TC-10.14) | Throttled to 1 log per track instead of 60fps |

### Resolved Issues

- ~~M/S Buttons Not Working~~ → ✅ Fixed in W8
- ~~Sync drift on N-stem tracks~~ → ✅ Fixed in W9-DRIFT (tier-based mutex + post-resync await)
- ~~Stems summation bug (instrumental + stems playing simultaneously)~~ → ✅ Fixed in W10 (TC-10.5 + TC-10.1)
- ~~Faders appear abruptly~~ → ✅ Fixed in W10 (TC-10.7 stagger animation)
- ~~Tumbler and Button conflated~~ → ✅ Fixed in W10 (TC-10.6 + TC-10.8)

### Diagnostic Logs Present

Current implementation includes verbose console logs (`[Orchestrator] W5:`, `[Upload] W6:`, `[SYNC] Hard resync:`). These should be removed or made configurable before production.

---

## 14. IMPLEMENTATION WAVES

| Wave | Feature | Status | Files |
|------|---------|--------|-------|
| **W0** | Type registry, routing contracts, stem.store | ✅ FROZEN | `stemTypes.ts`, `stem.store.ts` |
| **W1** | StemPlayer, ROLE_ROUTING, loadTrack additionalStems | ✅ FROZEN | `AudioEngineV2.ts` |
| **W1a** | Three-method routing decomposition | ✅ FROZEN | `AudioEngineV2.ts` |
| **W2** | Group bus architecture (_buses, bus gainNodes) | ✅ FROZEN | `AudioEngineV2.ts` |
| **W3** | Parallel bus taps, _reconnectBusTaps() | ✅ FROZEN | `AudioEngineV2.ts` |
| **W3.2** | Volume control (_stemVolumes, effective gain formula) | ✅ FROZEN | `AudioEngineV2.ts` |
| **W3.4** | Program Capture from buses (not VocalMix merger) | ✅ FROZEN | `AudioEngineV2.ts` |
| **W3min** | N-stem loading from IDB stemsData | ✅ FROZEN | `track.orchestrator.ts` |
| **W4a** | Store generalization (remove audio.store volume duplication) | ✅ FROZEN | `audio.store.ts`, `audio.bridge.ts` |
| **W4b** | Bridge generalization (MODE_STEM_POLICIES per role) | ✅ FROZEN | `mode-switch.bridge.ts`, `mode.bridge.ts`, `patchV1.ts` |
| **W5** | MixerPanel UI + metering infrastructure | ✅ FROZEN | `AudioEngineV2.ts`, `MixerPanel.tsx`, `MixerPanel.module.css`, `modules.ts` |
| **W5fix** | patchV1 loadTrack wrapper forwards 3rd param | ✅ FROZEN | `patchV1.ts` |
| **W6** | ZIP stem classification (residual principle) | ✅ FROZEN | `upload.service.ts` |
| **W6.2** | Residual classification: file with NO keyword = instrumental | ✅ FROZEN | `upload.service.ts` |
| **W7** | MVSEP ZIP upload fix + auto-mute instrumental | ✅ FROZEN | `upload.service.ts` |
| **W7.1** | overrideTitle + ZIP name capture | ✅ FROZEN | `upload.service.ts` |
| **W7.2** | Keywords fix + instrum detection (other explicit, instrum priority) | ✅ FROZEN | `upload.service.ts` |
| **W7.3** | ~~Auto-mute instrumental~~ + title extension fix | ❄️ FROZEN | `upload.service.ts` |
| **W8** | M/S buttons bridge (setStemMute/setStemSolo in patchV1) | ❄️ FROZEN | `patchV1.ts` |
| **W9-UX** | Lyrics paste modal + ZIP stems export/re-import | ❄️ FROZEN | `upload.service.ts`, `CatalogLayout.tsx`, `UploadPanel.tsx`, `SyncEditorPanel.tsx` |
| **W9-DRIFT-001** | Tier-based concurrent soft resync mutex (Set→Map) | ❄️ FROZEN | `AudioEngineV2.ts` |
| **W9-DRIFT-002** | Post-resync alignment await + _firstSeekDone in play() | ❄️ FROZEN | `AudioEngineV2.ts` |
| **W9-DRIFT-003** | Soft resync rateDelta 0.002→0.005, hardThreshold 40→80ms | ❄️ FROZEN | `stemTypes.ts` |
| **W10-001** | stemsEnabled state + stemsMode IDB field | ❄️ FROZEN | `stem.store.ts`, `idb.service.ts` |
| **W10-001-FIX** | Semantic stem detection for W7.3 auto-mute sync | ❄️ FROZEN | `audio.bridge.ts` |
| **W10-002** | MixerPanel Stems toggle button + CSS toolbar | ❄️ FROZEN | `MixerPanel.tsx`, `MixerPanel.module.css` |
| **W10-003** | Remove W7.3 auto-mute + stems mode initialization | ❄️ FROZEN | `AudioEngineV2.ts`, `audio.bridge.ts` |
| **W10** | Stems Polish & Progressive Loading | ✅ FROZEN | Multiple files (see below) |
| **W11** | Per-stem pan controls | 📋 PLANNED | `AudioEngineV2.ts`, `stem.store.ts`, `patchV1.ts`, `MixerPanel.tsx` |
| **W12** | Soft resync diagnostic logging | 📋 PLANNED | `AudioEngineV2.ts` |
| **W13** | Initial sync stabilization (post-load) | 📋 PLANNED | `AudioEngineV2.ts` |
| **TC-DEC-01** | skipDecode for instrumental — 7x load speedup | ✅ COMPLETE | `AudioEngineV2.ts` line 319 |
| **TC-DEC-02** | Fix instrumentation — accurate metrics | ✅ COMPLETE | `track.orchestrator.ts` lines 194, 250, 259, 290, 299 |

**W10 Details — Stems Polish & Progressive Loading (Center 10)**

| TC | What | Key Files |
|----|------|-----------|
| TC-10.5 | Remove TC-10.4 immediate mute — instrumental plays during Phase 2 | `AudioEngineV2.ts` |
| TC-10.6 | Add `stemsMode` (tumbler preference) to stem.store | `stem.store.ts` |
| TC-10.7 | MixerPanel button = stemsEnabled, faders by stemsMode, stagger animation | `MixerPanel.tsx`, `stem.store.ts` |
| TC-10.8 | QuickActions tumbler = stemsMode, NOT stemsEnabled | `QuickActions.tsx` |
| TC-10.9 | Preserve stemsEnabled in initStems + IDB restore | `stem.store.ts`, `track.orchestrator.ts`, `audio.bridge.ts` |
| TC-10.10 | onFullyLoaded volume sync to store | `audio.bridge.ts` |
| TC-10.11 | effectiveEnabled = currentEnabled \|\| savedMode | `audio.bridge.ts` |
| TC-10.12 | _stemsBootRestored flag — IDB restore only at boot | `stem.store.ts`, `track.orchestrator.ts`, `audio.bridge.ts` |
| TC-10.13 | Fix _stemsBootRestored setState (was mutating snapshot) | `audio.bridge.ts` |
| TC-10.14 | GUARD CRITICAL throttle — 1 log per track | `lyrics.bridge.ts` |
| TC-10.15 | Loading path uses stemsMode, not just stemsEnabled | `track.orchestrator.ts` |

---

## 15. FROZEN DECISIONS

| ID | Decision | Rationale |
|----|----------|-----------|
| **❄️ FR-001** | Master bus is separate from music bus | Muting music-bus must NOT affect master clock (instrumental). `getCurrentTime()` depends on `instrumental.audio` always playing. |
| **❄️ FR-002** | `bus.gainNode.gain = 1.0` ALWAYS | Bus is a summing point for program capture. Volume control is at the stem level via effective gain. |
| **❄️ FR-003** | Effective gain = stemVol × busVol × (muted ? 0 : 1) | Single source of truth for what each stem actually outputs. Applied at stem.gainNode.gain. |
| **❄️ FR-004** | Instrumental mute via `masterVolumeGain`, not `audio.pause()` | `getCurrentTime()` reads `instrumental.audio.currentTime`. Pausing freezes currentTime → transport breaks. |
| **❄️ FR-005** | AnalyserNodes are parallel taps (NOT in signal path) | Meters should not affect audio signal. Same architecture as bus taps. |
| **❄️ FR-006** | Residual classification: file with NO keyword = instrumental | Instrumentals are named after the track, not after a stem type. Catalog title comes from instrumental filename. |
| **❄️ FR-007** | ROLE_ROUTING table is immutable at runtime | Role determines routing automatically. Not configurable per-track. |
| **❄️ FR-008** | Program Capture reads from bus gainNodes, not VocalMix merger | V-Mix stereo separation is a monitor comfort transform, NOT program truth. Recording must capture clean stems. |
| **❄️ FR-009** | Rehearsal volumes saved to localStorage before mode switch | Command path (`mode-switch.bridge.ts`) owns save/restore. Observer path (`mode.bridge.ts`) only applies policies. |
| **❄️ FR-010** | Soft resync mutex is tier-based (Map<string, Set<string>>) | Replaced shared mutex (1 per bus) with tier-based concurrent limit: ≤4 stems→1, ≤6→2, ≤8→4, >8→8. Prevents drift accumulation from mutex blocking. |
| **❄️ FR-011** | Post-resync alignment MUST await seeked event | `stem.setCurrentTime()` is async — must await `_waitForSeeked()` before resetting `_lastSeekTime`. Fire-and-forget caused vocals drift 145ms. |
| **❄️ FR-012** | `_firstSeekDone` set in both play() and _atomicResumeFromSeek() | If user plays without seeking, `_firstSeekDone` must still be set to transition from 800ms to 500ms blackout. |
| **❄️ FR-013** | Stems mode toggle controls instrumental vs music stems | Button toggles between: (OFF) instrumental+vocals play, music stems muted → (ON) instrumental muted, vocals+music stems play. Vocals ALWAYS active, never muted by stems mode. |
| **❄️ FR-014** | Music stems muted by default at track load | instrumental=1, vocals=1, music stems (bass/drums/guitar/keys/other)=0. User must enable Stems button to hear music stems. |
| **❄️ FR-015** | W7.3 auto-mute removed, replaced by stems mode | W7.3's `instrumental=0` auto-mute superseded by explicit user control via Stems toggle button. Instrumental plays at full volume by default. |
| **❄️ FR-016** | Tumbler/Button split — separate concerns | `stemsMode` (tumbler) controls loading and fader visibility. `stemsEnabled` (button) controls playback mute/unmute. They must not be conflated. |
| **❄️ FR-017** | Loading path decision uses stemsMode | `shouldLoadStems = stemsMode \|\| stemsEnabled`. If tumbler is ON (stemsMode=true), stems MUST load even if button is OFF (stemsEnabled=false). This ensures faders are visible and stems are ready for instant playback. |
| **❄️ FR-018** | _stemsBootRestored prevents IDB override on track switch | IDB `stemsMode` restore happens ONLY on first load (page reload). Track switches preserve user's current `stemsEnabled` and `stemsMode` from store. Direct assignment on Zustand snapshot doesn't work — must use `setState()`. |
| **❄️ FR-019** | GUARD logs throttled to once per track | rAF-based detectors must not log every frame. Throttle state resets on `before-track-change`. |

---

## 📎 RELATED DOCUMENTS

- [audio-engine.md](audio-engine.md) — Core AudioEngineV2 architecture
- [architecture-map-2.1.md](architecture-map-2.1.md) — Ownership matrix, file authority
- [monitor-mix-v2.md](monitor-mix-v2.md) — Monitor mix panel (different from MixerPanel)

---


## Visual Mixer Reactive Pipeline

`stem-reactive.bridge.ts` implements a 60Hz reactive pipeline for the Visual Mixer:

- Registers detector + writer with `PlaybackVisualScheduler`
- Publishes CSS vars per stem: `--bl-stem-{id}-energy` (0.000–1.000) and `--bl-stem-{id}-hit` (0|1)
- Applies `REACTIVITY_PROFILES` — per-role hit detection, smoothing, scale multiplier, decay
- Drums use kick-band detection (frequency bins 2–7, 50–150Hz) instead of RMS
- `STEM_SENSITIVITY` overrides per stem ID for visual amplification of quiet instruments
- Lifecycle: starts scheduler independently; zeroes vars during recording; cleans up on track change
- Display order: `VISUAL_MIXER_DISPLAY_ORDER` differs from `DEFAULT_ROLE_ORDER`

CSS var contract:

- `--bl-stem-{id}-energy` — continuous energy level, updated every frame
- `--bl-stem-{id}-hit` — binary hit signal (0 or 1), decays after hit
- Both vars cleared on track change, zeroed during recording

*This document is LIVING — update it as new waves are implemented. Do NOT mark as frozen until the entire N-stem system is production-ready.*
