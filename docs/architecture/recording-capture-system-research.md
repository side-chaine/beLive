# Recording/Capture System Research — Rec Reform

**Status:** Wave R1 — Doctrine & Architecture (In Progress)  
**Created:** 2026-04-08  
**Last Updated:** 2026-04-08  
**Owner:** Qoder (Primary Architect)  
**Team:** Qoder + VE Expert (pending) + Sonnet 4.6 (pending) + User (Hardware Tester)  
**Priority:** CRITICAL — User-facing, showcase-critical, future-live-critical

---

## §0. QUICK START — FOR NEW MODELS

**If you're reading this file for the first time, follow this exact sequence:**

### STEP 1: Read Rules
- Read `rules_beLive.md` (already loaded in system)
- Focus on sections **16-25** (Rec/Capture specific rules)

### STEP 2: Read This Document
- ✅ You are here — reading §0 now
- Check **current status** above (which wave is active)
- Read **§1. Executive Summary** (2 minutes)
- Jump to **§6. Change Log** (see what happened last session)

### STEP 3: Based on Current Wave, Read Relevant Code

| If working on | Read these files |
|--------------|------------------|
| Wave R1 (Doctrine) | No code changes yet — just architecture |
| Wave R2 (Engine) | `src/audio/core/AudioEngineV2.ts` (lines 585-603), `StemPlayer.ts` |
| Wave R3 (Preview) | `src/takes/hooks/useTakesPlayback.ts` (lines 130-195), `src/stores/recording.store.ts` |
| Wave R4 (Visual) | `src/performance/performance.recording.ts`, `src/triggers/word-effects.css` |
| Wave R5 (Testing) | User test results in §6 below |

### STEP 4: Read Related Docs (if needed)
- `docs/architecture/optimization-wave-1.md` — Foundation work completed
- `docs/architecture/audio-engine.md` — Transport architecture
- `контекст.md` — Full scan results (REC-01 through REC-08) if deep details needed

### STEP 5: Check §6 Change Log
- What was completed in last session?
- What did user test? What worked? What didn't?
- What are the next action items?
- Any blockers or decisions pending?

**⚠️ CRITICAL RULE:** NEVER start implementation without reading §0 and §6 first.

---

## §1. EXECUTIVE SUMMARY

### The Problem
beLive's recording function captures **engine stems only** (instrumental + vocals), but **NOT** preview/compare playback that users hear during exercise flows (Tempo Ladder, Takes comparison). This causes:
- **Bug:** Between-round compare audio "disappears" in recordings
- **User impact:** Recordings don't match what users hear live
- **Future risk:** Blocks livestreaming, teacher-student sessions, social clips

### The Root Cause (Verified by 8 Scans)
- **Preview path:** `useTakesPlayback` → `gain.connect(ctx.destination)` → speakers ONLY
- **Recording path:** `audioEngine.captureStream()` → stems ONLY
- **Mismatch:** Preview bypasses capture stream entirely

### The Solution: Program Capture Bus
Introduce **one canonical audio bus** in AudioEngineV2 that collects all app-authored audio:
- Stems (instrumental + vocals)
- Preview/compare playback (when part of exercise flow)
- Microphone (if enabled for recording)
- Future: quest cues, exercise prompts

MediaRecorder records this single bus → **recordings match program truth**

### Current Status
- ✅ Root cause identified (8 targeted scans completed)
- ✅ Architecture designed (Program Capture Bus)
- ⏳ Wave R1 in progress: Creating this document + defining API
- ⏳ Wave R2 pending: Engine implementation
- ❌ Wave R3-R5: Not started

---

## §2. CURRENT ARCHITECTURE (From Scans REC-01 through REC-08)

### 2.1 Recording Runtime Authority (REC-01)

**File:** `src/stores/recording.store.ts`

**Exact Flow:**
1. **Capture Profile:** Performance tier → bitrate/frameRate (line 29-30)
2. **Display Stream:** `getDisplayMedia()` → screen video only (line 32-35, `audio: false`)
3. **Audio Stream:** `window.audioEngine.captureStream()` → engine audio (line 41)
4. **Microphone:** Conditional connection `microphoneGain → streamDestination` (line 43-48)
5. **Combined Stream:** Video tracks + audio tracks merged (line 59-66)
6. **MediaRecorder:** Instantiated with combined stream + bitrate config (line 72-76)
7. **Recording:** Start (line 106), stop (line 124)
8. **Output:** WebM blob downloaded with timestamp filename (line 84-93)

**Final Blob Composition:** Screen video + engine audio (no separate recording modes)

---

### 2.2 Audio Capture Graph Truth (REC-02)

**File:** `src/audio/core/AudioEngineV2.ts` (lines 597-603)

```typescript
captureStream(): MediaStream {
  if (!this._streamDest) {
    this._streamDest = getAudioContext().createMediaStreamDestination();
    this.stems.forEach(s => { 
      try { s.gainNode.connect(this._streamDest!); } catch (_) {} 
    });
  }
  return this._streamDest.stream;
}
```

**What captureStream() Returns:**
- ✅ Instrumental stem (gainNode → streamDestination)
- ✅ Vocals stem (gainNode → streamDestination)
- ❌ Microphone (NOT included by default, connected manually by recording.store)
- ❌ Preview/compare playback (NOT connected)
- ❌ V-Mix output (NOT connected — goes to ctx.destination only)
- ❌ Monitor/Split (NOT connected — separate routing world)

**Audio Graph for Recording:**
```
Instrumental Stem → gainNode ──┐
                                ├─→ MediaStreamDestination → captureStream()
Vocals Stem → gainNode ────────┘

Microphone → gainNode ──→ (conditional connect to streamDestination)

VocalMix merger → ctx.destination (speakers ONLY, NOT capture)
```

**Public Getters Exposed:**
- `audioEngine.microphoneGain` → GainNode (for manual connection)
- `audioEngine.streamDestination` → MediaStreamAudioDestinationNode (for manual connection)
- `audioEngine.captureStream()` → MediaStream (stems only)

**Compat Surface (patchV1.ts):** Full v1 patch at lines 42, 109-110

---

### 2.3 Recording Performance Policy (REC-03)

**File:** `src/performance/performance.recording.ts`

**Recording-Safe Profiles (tier-based):**

| Tier | FrameRate | Video Bitrate | Audio Bitrate |
|------|-----------|---------------|---------------|
| lite | 18 fps | 2.0 Mbps | 128 kbps |
| balanced | 20 fps | 2.4 Mbps | 160 kbps |
| max | 24 fps | 3.0 Mbps | 192 kbps |
| ultra | 25 fps | 3.5 Mbps | 256 kbps |

**Policy Application:**
- Recording starts → reads `getEffectiveTier()` once (line 29 of recording.store.ts)
- Profile applied to MediaRecorder (line 72-76)
- No dynamic changes during recording
- No engine policy changes (audio engine unaffected)
- No visual policy changes (visual budget unaffected)

**Key Finding:** Recording is completely decoupled from engine/visual policies. It reads the current tier once and applies a fixed capture profile.

---

### 2.4 Tempo Ladder / Compare / V-Mix Runtime Path (REC-04)

**Files:** `src/exercises/exercise.recipes.ts`, `src/takes/hooks/useTakesPlayback.ts`

**Tempo Ladder Structure:**
```
Stage 1 (90%):  listen (90%) → record (90%) → [optional preview]
Stage 2 (95%):  listen (95%) → record (95%) → [optional preview]
Stage 3 (100%): listen (100%) → record (100%)
```

**Preview Node Chain (useTakesPlayback.ts lines 141-155):**
```typescript
const source = ctx.createBufferSource();
source.buffer = audioBuffer;
const gain = ctx.createGain();
source.connect(gain);

if (options?.pan !== undefined && typeof ctx.createStereoPanner === 'function') {
  const panner = ctx.createStereoPanner();
  panner.pan.value = options.pan;
  gain.connect(panner);
  panner.connect(ctx.destination);  // ← SPEAKERS ONLY
} else {
  gain.connect(ctx.destination);  // ← SPEAKERS ONLY
}
```

**Critical Finding:** Preview connects ONLY to `ctx.destination` (speakers). It does NOT connect to `streamDestination` (capture). This is the root cause of missing audio in recordings.

**Between-Round Transitions:**
- `advanceToNextStep()` called (line 210 of exercise.store.ts)
- `activateCurrentStep()` determines next phase (line 102 of exercise.store.ts)
- Phase changes: listening → pre-recording → listening (next round)
- **NO V-Mix changes during transitions**
- **NO context/solo changes during transitions**

**Recording vs Preview Paths:**
```
RECORDING PATH:
  Engine stems (instrumental + vocals)
    ↓
  Capture stream (MediaStreamAudioDestinationNode)
    ↓
  MediaRecorder
    ↓
  Blob → Take asset

PREVIEW PATH (Compare/Listen):
  Decoded take blob (AudioBuffer)
    ↓
  AudioBufferSourceNode
    ↓
  GainNode
    ↓
  ctx.destination (speakers) ← ONLY HERE, NOT CAPTURE
    ↓
  Heard audio
```

---

### 2.5 Monitor / Split Interaction With Recording (REC-05)

**Files:** `js/monitor-mix.js`, `src/bridges/monitor.bridge.ts`

**Audio Node Architecture:**
```
Engine Stems (instrumental + vocals)
  ↓
  ├─→ VocalMix.merger → ctx.destination (speakers)
  │
  ├─→ captureStream() → MediaStreamAudioDestinationNode → MediaRecorder (RECORDING)
  │
  └─→ Monitor taps:
      ├─→ instrumentalGain → musicGain → this.dest → <audio> (monitor headphones)
      └─→ vocalsSourceNode → vocalToMainGain → mainDelayNode → this.mainDest → <audio> (main speakers)
```

**Key Findings:**
- ✅ Monitor/Split is Architecturally Separate (uses own MediaStreamDestination nodes)
- ✅ Recording Cannot Include Monitor/Split (monitor taps downstream of capture)
- ✅ Monitor is Purely Live (routed to `<audio>` elements with device sinkId)
- ✅ Separation is Complete (two independent audio paths)

**Conclusion:** Monitor/split is a **red herring** — it's a completely separate live routing system that has zero impact on recording.

---

### 2.6 Microphone-In-Recording Truth (REC-06)

**Files:** `src/stores/recording.store.ts`, `src/audio/core/MicrophoneManager.ts`

**Exact Microphone Path:**
```
getUserMedia (mic hardware)
  ↓
MicrophoneManager._sourceNode (MediaStreamAudioSourceNode)
  ↓
MicrophoneManager.gainNode (GainNode with volume control)
  ↓
AudioEngineV2.streamDestination (MediaStreamAudioDestinationNode) ← CONDITIONAL CONNECT
  ↓
captureStream() MediaStream
  ↓
MediaRecorder
  ↓
Final recording blob
```

**Connection Logic (recording.store.ts lines 43-48):**
```typescript
if (ae?.microphoneGain && ae?.streamDestination) {
  try {
    ae.microphoneGain.connect(ae.streamDestination);
  } catch (e) {
    // already connected, ignore
  }
}
```

**Vulnerability:** Microphone connection is conditional and can drop if:
1. `streamDestination` becomes null during state changes
2. `microphoneGain` becomes null
3. Connection fails and is not retried (no retry logic)

**Listener Re-connects (lines 52-57):**
```typescript
micListener = () => {
  if (!get().isRecording || !ae?.streamDestination || !ae?.microphoneGain) return;
  try {
    ae.microphoneGain.connect(ae.streamDestination);
  } catch (e) { /* already connected */ }
};
document.addEventListener('microphone-state-changed', micListener);
```

---

### 2.7 V-Mix / VocalMix Truth (REC-07)

**File:** `src/audio/core/VocalMix.ts`

**VocalMix Architecture:**
```typescript
// When V-Mix ENABLED (stereo separation):
Music (instrumental) → Left channel + Right channel
Vocals → Left channel only
Microphone → Right channel only
Result: Reference vocal in left ear, user's voice in right ear

// When V-Mix DISABLED (standard routing):
Music → Left channel + Right channel
Vocals → Left channel + Right channel
Microphone → Left channel + Right channel
Result: All audio in both channels (mono mix)
```

**Connection Point (AudioEngineV2.ts lines 171-176):**
```typescript
this.vocalMix.updateRouting(
  musicGains,
  vocalsGain,
  this.microphone.enabled ? this.microphone.gainNode : null,
  ctx.destination  // ← SPEAKERS ONLY, NOT CAPTURE
);
```

**Key Findings:**
- ✅ V-Mix is a Live-Hearing Transform (routes to ctx.destination only)
- ✅ Capture Bypasses V-Mix (stems connect directly to streamDestination, line 600)
- ✅ V-Mix State Changes Don't Affect Recording

**Conclusion:** V-Mix is a **red herring** — it's a purely live-hearing transform that has zero impact on recording.

---

### 2.8 Preview-to-Capture Wiring Feasibility (REC-08)

**File:** `src/takes/hooks/useTakesPlayback.ts`

**Current Preview Node Chain:**
```
AudioBufferSourceNode (source)
  ↓
GainNode (gain) ← SAFEST TEE POINT
  ↓
[StereoPannerNode (panner)] ← optional
  ↓
ctx.destination (speakers)
```

**Safest Node to Tee Into streamDestination:** **GainNode**
- Has volume control applied
- Before panning (captures mono mix)
- Can connect to streamDestination without affecting speaker output
- Already stored in `previewGainRef.current`

**Proposed Wiring (Tactical, NOT final architecture):**
```typescript
// In handlePlayTake, after gain.connect(ctx.destination)
const recordingStore = useRecordingStore.getState();
if (recordingStore.isRecording && ae?.streamDestination) {
  try {
    gain.connect(ae.streamDestination);
  } catch (e) {
    // already connected, ignore
  }
}
```

**Why This Works:**
- GainNode can connect to multiple destinations
- Recording state is cleanly gated
- Existing cleanup handles both connections
- No changes to speaker output
- Minimal code footprint

**BUT:** This is a tactical patch, not the proper architecture. We're going with **Program Capture Bus** instead.

---

## §3. PROBLEM ANALYSIS

### 3.1 Main Bug: Tempo Ladder Audio Loss

**Symptom:** Between-round compare/preview audio "disappears" in recordings

**Root Cause:** Preview path bypasses capture stream
- Preview: `gain.connect(ctx.destination)` → speakers only
- Recording: `captureStream()` → stems only
- Result: User hears preview, but MediaRecorder doesn't capture it

**Impact:**
- High — core exercise functionality broken in recordings
- User-facing — directly affects product quality
- Future-critical — blocks livestreaming, teacher-student sessions

---

### 3.2 Secondary Bug: Microphone Drop Vulnerability

**Symptom:** Microphone audio can disappear during state changes

**Root Cause:** Conditional connection with no retry logic
- Line 43-48: `if (ae?.microphoneGain && ae?.streamDestination)`
- If either becomes null during round transitions, mic disconnects
- Listener tries to reconnect (line 52-57), but may fail if nodes temporarily unavailable

**Impact:**
- Medium — affects recordings that include user voice
- Intermittent — depends on timing of state changes

---

### 3.3 Visual Performance Concerns

**Symptom:** Recording may stutter when using word effects (neon/bounce)

**Current State:**
- Recording-safe profiles exist (tier-based fps/bitrate)
- Word effects have recording-safe CSS clamps
- `performance.bridge` publishes `data-recording-active`

**Unknown:**
- Is current clamp sufficient for screen capture load?
- Are there other expensive surfaces not yet optimized?
- How does it perform on MacBook Pro 2013 (target hardware)?

**Action:** Requires VE Expert validation (Wave R4)

---

## §4. TARGET ARCHITECTURE: PROGRAM CAPTURE BUS

### 4.1 Recording Doctrine

> **beLive Rec records Program Audition Truth, not raw stems only and not hardware device routing truth.**

**What this means:**
- Record what beLive presents as session content (stems, preview, cues)
- Do NOT record device-specific routing (V-Mix stereo, Split hardware)
- Engine owns capture graph, NOT recording.store
- Explicit source registration, NO ad-hoc graph surgery

---

### 4.2 Architecture Diagram

**CURRENT STATE:**
```
┌─────────────────────────────────────────────────┐
│                 AUDIO ENGINE V2                  │
│                                                   │
│  stems (instrumental + vocals)                    │
│    ├─→ gainNode ──→ VocalMix.merger ──→ ctx.dest │ ← HEARD
│    └─→ gainNode ──→ _streamDest                  │ ← CAPTURE (stems only)
│                                                   │
│  mic.gainNode ──→ VocalMix.merger (live)          │ ← HEARD
│               └─→ _streamDest (conditional)       │ ← CAPTURE (if connected)
│                                                   │
│  Preview (useTakesPlayback):                      │
│    source → gain → ctx.destination                │ ← HEARD ONLY ❌
└─────────────────────────────────────────────────┘

MediaRecorder gets: stems + mic (conditional)
DOES NOT get: preview, compare, exercise cues

BUG: Tempo Ladder round transitions → preview plays → user hears it
     but recording doesn't capture it → "audio disappears"
```

**TARGET STATE:**
```
┌─────────────────────────────────────────────────────────┐
│                   AUDIO ENGINE V2                        │
│                                                           │
│  ┌──────────────────────────────────────────────┐        │
│  │        PROGRAM CAPTURE BUS (NEW)              │        │
│  │                                                │        │
│  │  _programCaptureDest: MediaStreamDestination   │        │
│  │  _programSources: Map<AudioNode, {kind}>       │        │
│  │                                                │        │
│  │  ALWAYS CONNECTED:                             │        │
│  │    ├─ stems (instrumental + vocals)            │        │
│  │    ├─ mic (if enabled for recording)           │        │
│  │    └─ registered program sources:              │        │
│  │         ├─ preview/compare playback            │        │
│  │         ├─ exercise cue playback               │        │
│  │         └─ future: quest prompts               │        │
│  └──────────────────────────────────────────────┘        │
│                      ↓                                     │
│         getProgramCaptureStream()                          │
│                      ↓                                     │
│              MediaRecorder                                 │
│                                                           │
│  ┌──────────────────────────────────────────────┐        │
│  │        LIVE PLAYBACK ROUTING                  │        │
│  │                                                │        │
│  │  stems → VocalMix.merger → ctx.destination    │        │
│  │  preview → ctx.destination                    │        │
│  │  monitor/split → separate audio elements      │        │
│  └──────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────┘
```

---

### 4.3 API Design

```typescript
// In AudioEngineV2 (engine-owned, NOT recording.store-owned)

/**
 * Get the Program Capture Bus MediaStream.
 * This is the canonical audio source for MediaRecorder.
 * Replaces ad-hoc captureStream() calls.
 */
getProgramCaptureStream(): MediaStream

/**
 * Register an audio source as part of the Program Capture Bus.
 * Use this for preview/compare playback, exercise cues, etc.
 * 
 * @param node - The AudioNode to connect (typically a GainNode)
 * @param opts.kind - Type of source: 'preview' | 'compare' | 'cue' | 'other'
 */
attachProgramSource(node: AudioNode, opts: {kind: string}): void

/**
 * Remove a previously registered source from the Program Capture Bus.
 * Call this during cleanup (e.g., when preview stops).
 * 
 * @param node - The AudioNode to disconnect
 */
detachProgramSource(node: AudioNode): void

/**
 * Enable/disable microphone in the Program Capture Bus.
 * Replaces manual microphoneGain.connect(streamDestination) calls.
 * 
 * @param enabled - Whether mic should be included in capture
 */
setCaptureMicEnabled(enabled: boolean): void
```

---

### 4.4 What Belongs in Program Capture Bus

**IN (Program Audition Truth):**
- ✅ Instrumental stem
- ✅ Vocals stem
- ✅ Microphone (if enabled for recording)
- ✅ Preview/compare playback (when part of exercise flow)
- ✅ Tempo Ladder between-round compare
- ✅ Future: quest cue playback
- ✅ Future: exercise prompt audio

**OUT (Device Routing Truth):**
- ❌ V-Mix stereo separation (live-only hearing transform)
- ❌ Monitor/Split hardware routing (device-specific)
- ❌ BT/speaker routing quirks
- ❌ Audio element sinks (separate live world)

---

### 4.5 Implementation Principles

1. **Engine-Owned:** Program Capture Bus lives in AudioEngineV2, NOT in recording.store
2. **Explicit Registration:** Sources must call `attachProgramSource()` / `detachProgramSource()`
3. **Single API:** recording.store simplifies to `ae.getProgramCaptureStream()`
4. **Additive:** Does not break existing `captureStream()` (deprecate gradually)
5. **Future-Proof:** Scales to livestreaming, teacher-student sessions, exports

---

## §5. IMPLEMENTATION WAVES (R1-R5)

### Wave R1 — Doctrine & Architecture ⏳ IN PROGRESS
**Goal:** Fix recording-capture-system-research.md, define Program Capture Bus API shape

**Tasks:**
- ✅ Create this document
- ⏳ Define API shape (done in §4.3)
- ⏳ Document current vs target architecture (done in §2 and §4)
- ❌ Add skeleton methods to AudioEngineV2 (prepare for R2)

**Files to Modify:**
- None yet (architecture phase only)

**Deliverables:**
- This document (complete)
- Team alignment on architecture
- Ready for Wave R2 implementation

**Status:** 90% complete (waiting for user review)

---

### Wave R2 — Engine Changes ❌ PENDING
**Goal:** Introduce Program Capture Bus in AudioEngineV2

**Tasks:**
- Add `_programCaptureDest: MediaStreamAudioDestinationNode | null`
- Add `_programSources: Map<AudioNode, {kind: string}>`
- Implement `getProgramCaptureStream()`
- Implement `attachProgramSource()`
- Implement `detachProgramSource()`
- Implement `setCaptureMicEnabled()`
- Migrate stem connections to Program Bus (optional: keep legacy captureStream() for compatibility)

**Files to Modify:**
- `src/audio/core/AudioEngineV2.ts` (main changes)
- `src/audio/core/StemPlayer.ts` (verify disconnect behavior)

**Risks:**
- Medium — touching core engine
- Must ensure `_connectRouting()` doesn't disconnect from Program Bus
- Must preserve backward compatibility during transition

**Verification:**
- Code review (Qoder)
- User test: recording still works with stems
- User test: mic can be enabled/disabled

---

### Wave R3 — Preview/Compare Integration ❌ PENDING
**Goal:** Wire useTakesPlayback preview into Program Capture Bus

**Tasks:**
- Import `useRecordingStore` in useTakesPlayback
- After creating gainNode, check if recording active
- If recording: `audioEngine.attachProgramSource(gain, {kind: 'preview'})`
- In cleanup: `audioEngine.detachProgramSource(gain)`
- Simplify recording.store mic connection logic
- Replace `ae.captureStream()` with `ae.getProgramCaptureStream()`

**Files to Modify:**
- `src/takes/hooks/useTakesPlayback.ts`
- `src/stores/recording.store.ts`
- Potentially `src/exercises/exercise.store.ts` (if it triggers preview)

**Risks:**
- Medium — preview path is exercised heavily
- Must handle cleanup correctly (disconnect from BOTH ctx.destination and Program Bus)
- Must verify Tempo Ladder round transitions work

**Verification:**
- User test: Record Tempo Ladder exercise
- User test: Verify between-round compare audio captured
- User test: Verify mic captured consistently (no drops)

---

### Wave R4 — Visual Performance ❌ PENDING
**Goal:** Validate recording-safe clamp adequacy with VE Expert

**Tasks:**
- Review `performance.recording.ts` tier profiles
- Review `word-effects.css` recording-safe clamps
- Review `performance.bridge.ts` `data-recording-active` publication
- Identify any expensive surfaces still active during recording
- Optimize word FX (neon/bounce) under screen capture load
- Test on MacBook Pro 2013

**Team:** VE Expert + Qoder

**Files to Audit:**
- `src/performance/performance.recording.ts`
- `src/triggers/word-effects.css`
- `src/performance/performance.bridge.ts`
- `src/backgrounds/` (background rendering cost)

**Risks:**
- Low — validation + optimization, no architecture changes
- May require additional clamp rules

**Verification:**
- VE Expert review
- User test: Record with max visual FX (neon/bounce)
- User test: Verify smooth playback on MacBook Pro 2013

---

### Wave R5 — Testing & Validation ❌ PENDING
**Goal:** Manual test plan executed by user

**Test Scenarios:**
1. Record Tempo Ladder exercise with V-Mix enabled
2. Verify between-round compare audio captured
3. Verify mic captured consistently (no drops)
4. Test visual smoothness with neon/bounce FX + recording
5. Stress test on MacBook Pro 2013
6. Compare heard vs recorded audio fidelity

**Success Criteria:**
- ✅ Tempo Ladder round transitions: audio present in recording
- ✅ Mic stable throughout exercise
- ✅ No visual stutter during recording
- ✅ Runs smooth on weak hardware (MacBook Pro 2013)

**Team:** User (hardware testing) + Sonnet 4.6 (test plans)

**Deliverables:**
- Test results documented in §6 Change Log
- Any bug fixes documented with TC-XXX references
- Final verdict: Rec system ready for production?

---

## §6. CHANGE LOG (ЭСТАФЕТА)

**This section is updated after every session. Each entry = checkpoint for next chat.**

---

### [2026-04-08] Session 2 — Wave R2 Implementation ✅ COMPLETE

**Completed:**
- ✅ Added Program Capture Bus to AudioEngineV2
  - `_programCaptureDest` + `_programSources` state
  - `getProgramCaptureStream()` - auto-creates bus + connects stems
  - `attachProgramSource()` - with dedup check
  - `detachProgramSource()` - silent ignore on cleanup
  - `setCaptureMicEnabled()` - with auto-init guard
- ✅ Updated `_connectRouting()` - reconnect Program Bus LAST (after vocalMix)
- ✅ Made `captureStream()` thin wrapper + @deprecated
- ✅ Updated patchV1.ts - exposed new Program Bus APIs to v1 interface
- ✅ Migrated recording.store.ts:
  - Replaced `captureStream()` → `getProgramCaptureStream()`
  - Replaced manual mic connect → `setCaptureMicEnabled(true)`
  - Added auto-enable mic hardware on recording start
  - Removed micListener (no longer needed)
- ✅ Fixed disconnect error - silent ignore when mic not connected
- ✅ Removed debug logs from production code

**User Test Results (Nikita):**
- ✅ Stems recorded (instrumental + vocals) - WORKS
- ✅ Microphone recorded - WORKS (auto-enabled on recording start)
- ✅ No errors in console
- ⚠️ Preview/compare audio NOT captured - EXPECTED (Wave R3 task)

**Key Fixes During Implementation:**
1. patchV1.ts missing Program Bus methods - added all 4 new APIs
2. `ae.microphone` not exposed on v1 interface - added property getter
3. Mic auto-enable not triggering - condition check fixed
4. Disconnect error on stop - wrapped in try-catch with silent ignore

**Next:** Wave R3 — Preview/Compare Integration

**Blockers:**
- None

**User Test Results:**
- Not yet (waiting for Wave R3 implementation)

---

**[FUTURE ENTRIES GO HERE — Update after each session]**

---

## §7. OPEN QUESTIONS & DECISIONS NEEDED

### 7.1 Exercise System Preview Triggers ⚠️ NEEDS SCAN
**Question:** How exactly does Tempo Ladder trigger preview between rounds?

**What we know:**
- `exercise.recipes.ts` → `tempoLadderGenerator` creates stages
- `exercise.store.ts` → `activateCurrentStep()` determines phase
- Preview path: `useTakesPlayback.handlePlayTake()`

**What we don't know:**
- Where exactly is `handlePlayTake` called during round transitions?
- Are there other preview sources (quest cues, guided exercises)?

**Action:** Scan exercise system to map all preview trigger points

**Impact:** Needed for Wave R3 to ensure ALL preview sources connect to Program Bus

---

### 7.2 `_connectRouting()` Side Effects ⚠️ NEEDS VERIFICATION
**Question:** When `_connectRouting()` is called (line 157), does it disconnect stems from Program Bus?

**What we know:**
- Line 163: `this.stems.forEach((stem, name) => { stem.disconnect(); ...`
- This disconnects ALL outputs from stem gainNode

**What we don't know:**
- Does `StemPlayer.disconnect()` disconnect from Program Bus?
- If yes, stems must be reconnected to Program Bus after `_connectRouting()`

**Action:** Scan `StemPlayer.ts` to understand disconnect behavior

**Impact:** Critical for Wave R2 — must ensure stems stay connected to Program Bus

---

### 7.3 Recording Cleanup Policy ✅ DECIDED
**Question:** When recording stops, should preview sources disconnect from Program Bus?

**Decision:** NO — preview lifecycle managed separately (attach/detach by playback state), not by recording state.

**Rationale:**
- Preview may continue after recording stops (user keeps exercising)
- Program Bus should always be ready for next recording
- Sources connect when playback starts, disconnect when playback stops

---

### 7.4 Visual Performance Adequacy ❓ NEEDS VE EXPERT
**Question:** Is current recording-safe visual clamp sufficient for screen capture?

**What we know:**
- Tier-based profiles exist (fps/bitrate)
- Word effects have recording-safe CSS clamps
- `data-recording-active` published to DOM

**What we don't know:**
- Are there other expensive surfaces (plate blur, backgrounds)?
- How does it perform on MacBook Pro 2013?
- Does screen capture add additional overhead beyond normal rendering?

**Action:** VE Expert validation needed (Wave R4)

**Impact:** May require additional performance optimizations

---

## §8. TEAM NOTES

### Qoder (Primary Architect)
- Conducted full 8-scan research (REC-01 through REC-08)
- Identified root cause with high confidence (95%)
- Designed Program Capture Bus architecture
- Defined implementation waves R1-R5
- Created this relay document for cross-session continuity
- **Key insight:** "Current capture truth ≠ current heard truth" — this is the core mismatch

### VE Expert (Pending)
- Not yet connected
- Will validate recording-safe visual policy (Wave R4)
- Will optimize word FX under screen capture load
- Will test on MacBook Pro 2013

### Sonnet 4.6 (Pending)
- Not yet connected
- Will create test plans (Wave R5)
- Will assist with implementation validation
- Will help with diff scans if needed

### User (Hardware Tester + Product Truth)
- Provided original problem description
- Provided 8 targeted scans via Architect 2.1
- Defined product vision: recordings, livestreams, teacher-student sessions
- Will test on real hardware (MacBook Pro 2013)
- Final arbiter of quality and user experience

**User's Core Requirement:**
> "нам нужно добиться того, чтобы на записи всё было точно так же передано, как и при воспроизведении"
> 
> Translation: "We need to achieve that in the recording everything is transmitted exactly as it is during playback"

---

## §9. RELATED DOCUMENTS

- `docs/architecture/optimization-wave-1.md` — Foundation work completed before Rec reform
- `docs/architecture/audio-engine.md` — Transport architecture (AudioEngineV2 internals)
- `docs/architecture/architecture-map-2.1.md` — Master architecture map (ownership matrix)
- `docs/architecture/takes-system.md` — Takes practice surface (preview/compare context)
- `docs/architecture/exercises-system.md` — Exercise execution (Tempo Ladder triggers)
- `контекст.md` — Full scan results (REC-01 through REC-08, 3157 lines)

---

## §10. FINAL SUMMARY

**Recording/Capture System Research has identified the root cause of audio fidelity mismatch in beLive recordings and designed a proper architectural solution (Program Capture Bus) that will:**

1. **Fix the bug:** Between-round compare audio will be captured in recordings
2. **Simplify the code:** recording.store becomes a thin wrapper around engine API
3. **Future-proof:** Scales to livestreaming, teacher-student sessions, exports
4. **Maintain doctrine:** Capture Program Audition Truth, not device routing truth

**Next action:** User reviews this document → approves architecture → Wave R2 implementation begins.

---

**END OF DOCUMENT**

*This is a relay document. Update §6 Change Log after every session.*
*Read §0 Quick Start when opening in a new chat session.*
