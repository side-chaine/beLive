# GPT Deep Research Pack: PhaseVocoder Pitch Preservation Bug

**Project:** beLive V3 Audio Engine
**Library:** SoundTouchJS v2.1.0 (11 packages)
**Problem:** PhaseVocoderNode pipeline math is correct (probe-confirmed) but user hears pitch change at rate=0.85

---

## 🎯 Mission for GPT

We need a **fresh pair of eyes** on our code + the entire SoundTouchJS library. Sonnet (Claude) already verified the library is clean but couldn't find the bug without runtime data. Now we have runtime probe data (pipeline values confirmed correct), but the audio still sounds wrong.

### What we need from you:

1. **Analyze SoundTouchJS library completely** — all relevant packages, the pipeline math, how `playbackRate` AudioParam interacts with source `playbackRate`
2. **Analyze our wrapper code** — all 7 source files + processor probes
3. **Identify why pitch sounds wrong** despite correct pipeline values
4. **Propose fix(es)** or tell us it's a fundamental limitation of phase vocoder at moderate ratios
5. **Check our root cause hypothesis:** is `source.playbackRate = rate` (same as PV.playbackRate) correct per library docs, or is it causing double-processing?

---

## 📦 Part 1: Our Project Context

### beLive V3 Audio Engine — Architecture

```
[AudioBuffer] → [SourceNode] (playbackRate=rate) 
    → [Gain (fader)] → [Gain (duck)] 
    → [PitchChain: Bus] → [PitchNode: WSOLA | PhaseVocoderNode] 
    → [MonitorRouter] → [ctx.destination]
```

**Option C** (WSOLA, production-ready):
- `rate < 1.0` → WSOLANode clamped to `Math.max(rate, 1.0) = 1.0` (passthrough)
- `source.playbackRate = rate` → varispeed: both speed AND pitch change naturally
- **Works correctly, sounds fine**

**Option D** (PhaseVocoder, experimental):
- `rate < 1.0` → PhaseVocoderNode gets `playbackRate = rate` (no clamp)
- `source.playbackRate = rate` → source ALSO slows down
- PV internally computes `_pipe.pitch = 1.0 / playbackRate = 1.17647` to compensate
- **Pipeline math correct per probes, but audio sounds wrong**

### Audio Context
- **Sample rate:** 44.1 kHz (standard)
- **Render quantum:** 128 frames
- **Stems:** 7 decoded AudioBuffers from IndexedDB
- **Rate range of interest:** 0.7–1.2 (user tempo slider)
- **Test trigger:** `__testOptionD(true, 0.85)` in browser console

### Frozen Zones (NEVER modify)
```
❄️ src/audio/core/AudioEngineV2.ts
❄️ src/audio/compat/patchV1.ts
❄️ src/bridges/*
❄️ src/services/track.orchestrator.ts
❄️ Private _* fields in processor.js
```

---

## 📄 Part 2: All Source Files (Complete)

### 2.1 PitchNode.ts — Node Factory & Registration

**Path:** `src/audio/engine-v3/pitch/PitchNode.ts` (113 lines)

```typescript
// Requires the real dependency: npm install @soundtouchjs/audio-worklet
// This file will not type-check until that package is present in node_modules.
//
// Dynamically imported INSIDE ensureSoundTouchRegistered — deliberately not a static
// top-level `import`. SoundTouchNode extends AudioWorkletNode at class-definition
// time, which throws immediately outside a browser — a static import would crash
// any test file that merely imports TransportV3, before a single test runs.

type SoundTouchNodeCtor = typeof import('@soundtouchjs/audio-worklet').SoundTouchNode;
type PhaseVocoderNodeCtor = typeof import('@soundtouchjs/phase-vocoder-worklet').PhaseVocoderNode;
type AnyPitchNode = InstanceType<SoundTouchNodeCtor> | InstanceType<PhaseVocoderNodeCtor>;

let SoundTouchNodeClass: SoundTouchNodeCtor | null = null;
let PhaseVocoderNodeClass: PhaseVocoderNodeCtor | null = null;
const registrations = new WeakMap<AudioContext, Promise<void>>();

/**
 * Per-context registration, memoized. Must return the SAME in-flight promise to
 * every caller until it settles — prepareForRestart() constructs two PitchNodes
 * back to back, and a version that returns early on a bare `has()` check resolves
 * on the next microtick instead of waiting for SoundTouchNodeClass to actually be
 * set, letting the second construction run before the class exists and throw.
 */
export function ensureSoundTouchRegistered(ctx: AudioContext): Promise<void> {
  let p = registrations.get(ctx);
  if (!p) {
    p = (async () => {
      const mod = await import('@soundtouchjs/audio-worklet');
      SoundTouchNodeClass = mod.SoundTouchNode;
      const url = new URL('./soundtouch-processor.js', import.meta.url).href;
      await mod.SoundTouchNode.register(ctx, url);
    })().catch((e) => {
      registrations.delete(ctx);
      throw e;
    });
    registrations.set(ctx, p);
  }
  return p;
}

// PV — best-effort, изолированная регистрация
// Не использует WeakMap — вызывается однократно при attachStems или явно
export async function ensurePhaseVocoderRegistered(ctx: AudioContext): Promise<boolean> {
  try {
    const mod = await import('@soundtouchjs/phase-vocoder-worklet');
    PhaseVocoderNodeClass = mod.PhaseVocoderNode;
    const url = new URL('./phase-vocoder-processor.js', import.meta.url).href;
    await mod.PhaseVocoderNode.register(ctx, url);
    return true;
  } catch (e) {
    console.warn('[PitchNode] PhaseVocoder registration failed — WSOLA fallback:', e);
    PhaseVocoderNodeClass = null;
    return false;
  }
}

export function isSoundTouchRegistered(ctx: AudioContext): boolean {
  return registrations.has(ctx);
}

export class PitchNode {
  private readonly node: AnyPitchNode;
  private readonly _type: 'wsola' | 'phase-vocoder';

  constructor(ctx: AudioContext, type: 'wsola' | 'phase-vocoder' = 'wsola', id?: string) {
    this._type = type;
    if (type === 'phase-vocoder') {
      if (!PhaseVocoderNodeClass) throw new Error('[PitchNode] PhaseVocoder not registered');
      this.node = new PhaseVocoderNodeClass({ context: ctx });
    } else {
      if (!SoundTouchNodeClass) throw new Error('[PitchNode] SoundTouch not registered');
      this.node = new SoundTouchNodeClass({ context: ctx });
    }
    this.node.onprocessorerror = (e: Event) => {
      console.error('[PitchNode' + (id ? ' ' + id : '') + '] processorerror', e);
    };
  }

  get audioNode(): AudioNode {
    return this.node;
  }

  /** 
   * Universal setter:
   * - WSOLA (rate≥1.0): clamp rate >= 1.0 → passthrough for rate<1.0 (varispeed via source)
   * - PhaseVocoder (rate<1.0): rate as-is → full time-stretch
   */
  setTempoPreservingPitch(rate: number): void {
    if (!isFinite(rate)) return;

    const safeRate = this._type === 'phase-vocoder' 
      ? rate                    // PhaseVocoder — all rates work
      : Math.max(rate, 1.0);    // WSOLA — clamp for Option C
    this.node.playbackRate.value = safeRate;
    this.node.pitch.value = 1.0;
  }

  get metrics(): { rms: number; peak: number; underruns: number } | null {
    const m = this.node.metrics;
    if (!m) return null;
    return { rms: m.outputRms, peak: m.outputPeak, underruns: m.underrunCount };
  }

  dispose(): void {
    try { this.node.disconnect(); } catch { /* noop */ }
  }
}
```

### 2.2 PitchChain.ts — Node Lifecycle Manager

**Path:** `src/audio/engine-v3/pitch/PitchChain.ts` (105 lines)

```typescript
import { PitchNode, ensureSoundTouchRegistered } from './PitchNode'
import type { StemOrchestrator } from '../core/StemOrchestrator'

const MUSIC_STEM_IDS = ['instrumental', 'drums', 'bass', 'keys', 'guitar', 'backing', 'other']

export class PitchChain {
  private ctx: AudioContext | null = null
  private registered = false

  private musicBus: GainNode | null = null
  private vocalBus: GainNode | null = null
  private musicPitchNode: PitchNode | null = null
  private vocalPitchNode: PitchNode | null = null

  private programOut: AudioNode | null = null
  private vocalHall: AudioNode | null = null

  public usePhaseVocoder = false // OPTION D FLAG

  get musicPitchNodeMetrics() { return this.musicPitchNode?.metrics ?? null }
  get vocalPitchNodeMetrics() { return this.vocalPitchNode?.metrics ?? null }

  async attachStems(
    ctx: AudioContext,
    stems: StemOrchestrator,
    programOut: AudioNode,
    vocalHall?: AudioNode
  ): Promise<void> {
    if (!this.registered) {
      await ensureSoundTouchRegistered(ctx)
      this.registered = true
    }
    this.ctx = ctx
    this.programOut = programOut
    this.vocalHall = vocalHall ?? null

    this.musicBus = ctx.createGain()
    this.musicBus.gain.value = 1.0
    this.vocalBus = ctx.createGain()
    this.vocalBus.gain.value = 1.0

    for (const id of MUSIC_STEM_IDS) {
      const stem = stems.get(id)
      if (!stem) continue
      try { stem.outputNode.disconnect(programOut) } catch {}
      stem.outputNode.connect(this.musicBus)
    }
    const vocals = stems.get('vocals')
    if (vocals) {
      try { vocals.outputNode.disconnect(programOut) } catch {}
      vocals.outputNode.connect(this.vocalBus)
    }
  }

  prepareForRestart(rate: number = 1.0): void {
    if (!this.ctx || !this.musicBus || !this.vocalBus || !this.programOut) return

    const nodeType = (this.usePhaseVocoder && rate < 1.0) ? 'phase-vocoder' : 'wsola'
    console.log(`[PitchChain] prepareForRestart | rate:${rate} | nodeType:${nodeType} | usePhaseVocoder:${this.usePhaseVocoder}`)

    this.musicPitchNode?.dispose()
    this.vocalPitchNode?.dispose()
    try { this.musicBus.disconnect() } catch {}
    try { this.vocalBus.disconnect() } catch {}

    let musicNode: PitchNode
    let vocalNode: PitchNode
    try {
      musicNode = new PitchNode(this.ctx, nodeType, 'music')
      vocalNode = new PitchNode(this.ctx, nodeType, 'vocal')
    } catch (e) {
      console.warn(`[PitchChain] ${nodeType} construction failed — falling back to WSOLA:`, e)
      musicNode = new PitchNode(this.ctx, 'wsola', 'music')
      vocalNode = new PitchNode(this.ctx, 'wsola', 'vocal')
    }

    this.musicPitchNode = musicNode
    this.vocalPitchNode = vocalNode

    this.musicBus.connect(this.musicPitchNode.audioNode)
    this.musicPitchNode.audioNode.connect(this.programOut)
    this.vocalBus.connect(this.vocalPitchNode.audioNode)
    this.vocalPitchNode.audioNode.connect(this.programOut)
    try { if (this.vocalHall) this.vocalPitchNode.audioNode.connect(this.vocalHall) } catch {}
  }

  setRate(rate: number): void {
    this.musicPitchNode?.setTempoPreservingPitch(rate)
    this.vocalPitchNode?.setTempoPreservingPitch(rate)
  }

  dispose(): void {
    this.musicPitchNode?.dispose(); this.musicPitchNode = null
    this.vocalPitchNode?.dispose(); this.vocalPitchNode = null
    try { this.musicBus?.disconnect() } catch {}
    try { this.vocalBus?.disconnect() } catch {}
    this.musicBus = null; this.vocalBus = null
  }
}
```

### 2.3 TransportV3.ts — Orchestration & Restart

**Path:** `src/audio/engine-v3/core/TransportV3.ts` (224 lines)

```typescript
import { HybridClock } from './HybridClock';
import { StemOrchestrator } from './StemOrchestrator';
import type { TransportState } from './types';
import { PitchChain } from '../pitch/PitchChain';

export interface TransportStateChangeDetail { state: TransportState; }

const RENDER_QUANTUM_SAMPLES = 128;
const START_SAFETY_MARGIN_MS = 5;

export class TransportV3 extends EventTarget {
  private readonly ctx: AudioContext;
  private readonly clock: HybridClock;
  private readonly stems: StemOrchestrator;
  private _state: TransportState = 'idle';
  private _seekGeneration = 0;
  private _pitchChain: PitchChain | null = null;

  constructor(ctx: AudioContext, masterClockStemId: string) {
    super();
    this.ctx = ctx;
    this.clock = new HybridClock(ctx, {
      onResumeFailed: () => this.dispatchEvent(new Event('audioglitch')),
    });
    this.stems = new StemOrchestrator({
      ctx, masterClockStemId,
      onTrackEnded: () => this._handleTrackEnded(),
    });
  }

  get state(): TransportState { return this._state; }
  get currentTime(): number { return this.clock.getCurrentTime(); }
  get duration(): number { return this.stems.duration; }
  get orchestrator(): StemOrchestrator { return this.stems; }
  get playbackRate(): number { return this.clock.playbackRate; }

  private _setState(s: TransportState): void {
    this._state = s;
    this.dispatchEvent(new CustomEvent<TransportStateChangeDetail>('statechange', { detail: { state: s } }));
  }

  private _nextRenderQuantumTime(marginMs = START_SAFETY_MARGIN_MS): number {
    const quantumSec = RENDER_QUANTUM_SAMPLES / this.ctx.sampleRate;
    return Math.ceil((this.ctx.currentTime + marginMs / 1000) / quantumSec) * quantumSec;
  }

  async play(initialOffset?: number): Promise<void> {
    if (this._state === 'idle' || this._state === 'ended') {
      this.clock.seek(initialOffset ?? 0);
      this._setState('ready');
    }
    if (this._state !== 'ready' && this._state !== 'paused') return;
    const resumed = await this.clock.ensureResumed();
    if (!resumed) { this.dispatchEvent(new Event('audioglitch')); return; }
    const offset = this.clock.getCurrentTime();
    const rate = this.clock.playbackRate;
    const targetStart = this._nextRenderQuantumTime();
    this._restartStemsAt(targetStart, offset, rate);
    this.clock.start(offset);
    this._setState('playing');
  }

  pause(): void {
    if (this._state !== 'playing') return;
    this.clock.pause();
    this.stems.pauseAll();
    this._setState('paused');
  }

  stop(): void {
    if (this._state === 'idle') return;
    this.stems.pauseAll();
    this.clock.stop();
    this._setState('idle');
  }

  async seek(time: number): Promise<void> {
    if (this._state !== 'playing' && this._state !== 'paused') return;
    const wasPlaying = this._state === 'playing';
    const myGeneration = ++this._seekGeneration;
    this.stems.pauseAll();
    this.clock.seek(time);
    if (!wasPlaying) { this._setState('paused'); return; }
    const resumed = await this.clock.ensureResumed();
    if (myGeneration !== this._seekGeneration) return;
    if (!resumed) { this.dispatchEvent(new Event('audioglitch')); return; }
    const rate = this.clock.playbackRate;
    const targetStart = this._nextRenderQuantumTime();
    this._restartStemsAt(targetStart, time, rate);
    this.clock.start(time);
    this._setState('playing');
  }

  setPlaybackRate(rate: number): void {
    this.clock.setPlaybackRate(rate);
    if (this._state === 'playing') {
      const offset = this.clock.getCurrentTime();
      this.stems.pauseAll();
      const targetStart = this._nextRenderQuantumTime();
      this._restartStemsAt(targetStart, offset, rate);
      this.clock.start(offset);
    }
  }

  async setLoop(start: number, end: number): Promise<void> {
    this.stems.setLoopOnAllStems(start, end);
    if (this._state === 'playing') await this.seek(this.clock.getCurrentTime());
  }

  clearLoop(): void { this.stems.clearLoopOnAllStems(); }

  private _handleTrackEnded(): void {
    this.stems.pauseAll();
    this.clock.pause();
    this._setState('ended');
  }

  attachPitchChain(chain: PitchChain): Promise<void> {
    this._pitchChain = chain;
    const programOut = this.stems.programOut ?? this.ctx.destination;
    return chain.attachStems(this.ctx, this.stems, programOut, this.stems.vocalHall ?? undefined).then(() => {
      if (this._state === 'playing') {
        const offset = this.clock.getCurrentTime();
        const rate = this.clock.playbackRate;
        this.stems.pauseAll();
        this._restartStemsAt(this._nextRenderQuantumTime(), offset, rate);
        this.clock.start(offset);
      }
    });
  }

  /** 🔴 KEY FUNCTION: all restarts flow through here */
  private _restartStemsAt(targetStart: number, offset: number, rate: number): void {
    this._pitchChain?.prepareForRestart(rate);     // 1. Create PV/WSOLA node
    this._pitchChain?.setRate(rate);                // 2. Set PV node.playbackRate = rate
    this.stems.playAllAt(targetStart, offset, rate); // 3. Set source.playbackRate = rate ← SAME rate!
  }

  dispose(): void {
    this._pitchChain?.dispose();
    this._pitchChain = null;
    this.stems.disposeAll();
    this.clock.dispose();
  }
}
```

### 2.4 StemPlayerV3.ts — Source Node Wrapper

**Path:** `src/audio/engine-v3/stems/StemPlayerV3.ts` (209 lines)

```typescript
import { DuckGuardV3Native } from '../integration/DuckGuardV3Native';
import type { StemId } from '../core/types';

export interface StemPlayerOptions {
  id: StemId;
  ctx: AudioContext;
  isMasterClock?: boolean;
  onNaturalEnd?: (id: StemId) => void;
}

export class StemPlayerV3 {
  readonly id: StemId;
  private readonly ctx: AudioContext;
  private readonly isMasterClock: boolean;
  private readonly onNaturalEnd?: (id: StemId) => void;

  private _buffer: AudioBuffer | null = null;
  private _source: AudioBufferSourceNode | null = null;
  private _isDisposing = false;

  private readonly _faderGain: GainNode;
  private readonly _duckGain: GainNode;
  private readonly _analyser: AnalyserNode;
  private readonly _duck: DuckGuardV3Native;

  private _loopActive = false;
  private _loopStart = 0;
  private _loopEnd = 0;

  constructor(opts: StemPlayerOptions) {
    this.id = opts.id;
    this.ctx = opts.ctx;
    this.isMasterClock = opts.isMasterClock ?? false;
    this.onNaturalEnd = opts.onNaturalEnd;
    this._faderGain = this.ctx.createGain();
    this._duckGain = this.ctx.createGain();
    this._faderGain.connect(this._duckGain);
    this._analyser = this.ctx.createAnalyser();
    this._analyser.fftSize = 256;
    this._duckGain.connect(this._analyser);
    this._duck = new DuckGuardV3Native(this._duckGain.gain);
  }

  get outputNode(): GainNode { return this._duckGain; }
  get analyserNode(): AnalyserNode { return this._analyser; }
  get duration(): number { return this._buffer?.duration ?? 0; }
  get volume(): number { return this._faderGain.gain.value; }
  set volume(v: number) { this._faderGain.gain.value = v; }

  setBuffer(buffer: AudioBuffer): void { this._buffer = buffer; }
  getBuffer(): AudioBuffer | null { return this._buffer; }
  shouldPlayAt(offsetSec: number): boolean { return this._buffer !== null && offsetSec < this.duration; }

  setLoop(canonicalStart: number, canonicalEnd: number): void {
    this._loopActive = true;
    this._loopStart = canonicalStart;
    this._loopEnd = canonicalEnd;
    if (this._source) this._applyLoopToSource(this._source);
  }

  clearLoop(): void {
    this._loopActive = false;
    if (this._source) this._source.loop = false;
    this._duck.cancel(this.ctx.currentTime, 1.0);
  }

  private _applyLoopToSource(source: AudioBufferSourceNode): void {
    if (!this._loopActive || !this._buffer) return;
    if (this._buffer.duration < this._loopEnd) return;
    source.loop = true;
    source.loopStart = this._loopStart;
    source.loopEnd = this._loopEnd;
  }

  private _scheduleLoopDucks(startedAtCtxTime: number, startedAtOffset: number, rate: number, coverSeconds = 120): void {
    if (!this._loopActive || !this._buffer || rate <= 0) return;
    const loopPeriodCtx = (this._loopEnd - this._loopStart) / rate;
    if (loopPeriodCtx <= 0) return;
    const distanceToFirstEnd = (this._loopEnd - startedAtOffset) / rate;
    if (distanceToFirstEnd <= 0) return;
    const firstWrapAt = startedAtCtxTime + distanceToFirstEnd;
    const wrapCount = Math.max(1, Math.ceil(coverSeconds / loopPeriodCtx));
    this._duck.scheduleLoopWrapDucks({
      baseGain: 1.0, ctxNow: this.ctx.currentTime, firstWrapAt, wrapPeriodSec: loopPeriodCtx, wrapCount,
    });
  }

  /** 🔴 KEY FUNCTION: source.playbackRate = rate */
  startAt(targetStartCtxTime: number, offsetSec: number, rate: number): void {
    if (!this.shouldPlayAt(offsetSec)) return;
    this._killSourceSafe();

    const source = this.ctx.createBufferSource();
    source.buffer = this._buffer;
    source.playbackRate.value = rate;  // <-- THE SUSPECT
    this._applyLoopToSource(source);

    source.connect(this._faderGain);

    source.onended = () => {
      if (this._isDisposing) return;
      this._source = null;
      if (this.isMasterClock) this.onNaturalEnd?.(this.id);
    };

    source.start(targetStartCtxTime, offsetSec);
    this._source = source;
    if (this._loopActive) this._scheduleLoopDucks(targetStartCtxTime, offsetSec, rate);
  }

  pause(): void { this._killSourceSafe(); }

  private _killSourceSafe(): void {
    if (!this._source) return;
    this._isDisposing = true;
    const s = this._source;
    s.onended = null;
    try { s.stop(); } catch { /* Safari guard */ }
    try { s.disconnect(); } catch { /* already disconnected */ }
    this._source = null;
    this._isDisposing = false;
  }

  dispose(): void {
    this._killSourceSafe();
    try { this._faderGain.disconnect(); } catch {}
    try { this._analyser.disconnect(); } catch {}
    try { this._duckGain.disconnect(); } catch {}
    this._buffer = null;
  }
}
```

### 2.5 StemOrchestrator.ts — PlayAllAt Dispatcher

**Path:** `src/audio/engine-v3/core/StemOrchestrator.ts` (112 lines)

```typescript
import { StemPlayerV3 } from '../stems/StemPlayerV3';
import { computeCanonicalLoop } from '../integration/LoopEngineV3';
import type { StemId } from './types';

export interface StemOrchestratorOptions {
  ctx: AudioContext;
  masterClockStemId: StemId;
  onTrackEnded: () => void;
}

export class StemOrchestrator {
  private readonly ctx: AudioContext;
  private readonly masterClockStemId: StemId;
  private readonly onTrackEnded: () => void;
  private readonly stems = new Map<StemId, StemPlayerV3>();
  private _programOut: AudioNode | null = null;
  private _vocalHall: AudioNode | null = null;

  constructor(opts: StemOrchestratorOptions) {
    this.ctx = opts.ctx;
    this.masterClockStemId = opts.masterClockStemId;
    this.onTrackEnded = opts.onTrackEnded;
  }

  setOutputRouting(programMix: AudioNode, vocalHall?: AudioNode): void {
    if (this._programOut) { console.warn('[Orchestrator] setOutputRouting already called — noop'); return; }
    this._programOut = programMix;
    this._vocalHall = vocalHall ?? null;
  }

  addStem(id: StemId, buffer: AudioBuffer): StemPlayerV3 {
    this.stems.get(id)?.dispose();
    const stem = new StemPlayerV3({
      id, ctx: this.ctx,
      isMasterClock: id === this.masterClockStemId,
      onNaturalEnd: () => this.onTrackEnded(),
    });
    stem.setBuffer(buffer);
    stem.outputNode.connect(this._programOut ?? this.ctx.destination);
    if (id === 'vocals' && this._vocalHall) stem.outputNode.connect(this._vocalHall);
    this.stems.set(id, stem);
    return stem;
  }

  get(id: StemId): StemPlayerV3 | undefined { return this.stems.get(id); }
  all(): StemPlayerV3[] { return Array.from(this.stems.values()); }

  get duration(): number { return this.stems.get(this.masterClockStemId)?.duration ?? 0; }

  /** 🔴 Dispatches rate to ALL stems */
  playAllAt(targetStartCtxTime: number, offset: number, rate: number): void {
    for (const stem of this.stems.values()) {
      if (stem.shouldPlayAt(offset)) {
        stem.startAt(targetStartCtxTime, offset, rate);
      }
    }
  }

  get programOut(): AudioNode | null { return this._programOut; }
  get vocalHall(): AudioNode | null { return this._vocalHall; }

  pauseAll(): void { for (const stem of this.stems.values()) stem.pause(); }

  setLoopOnAllStems(requestedStart: number, requestedEnd: number): void { /* loop logic */ }
  clearLoopOnAllStems(): void { for (const stem of this.stems.values()) stem.clearLoop(); }

  disposeAll(): void {
    for (const stem of this.stems.values()) stem.dispose();
    this.stems.clear();
  }
}
```

### 2.6 main.tsx — Boot & __testOptionD (lines 1-170 relevant)

**Path:** `src/main.tsx` (1191 lines total, relevant excerpt below)

```typescript
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// ... many imports ...
import { ensurePhaseVocoderRegistered } from './audio/engine-v3/pitch/PitchNode';
// ... more imports ...

// ═══ AETHER v3.0 Boot ═══

let _aetherPublisher: V3StatePublisher | undefined

function bootAether(): void {
  try {
    const transport = getTransport()
    if (!transport) return

    // MonitorRouter + MonitorEngine setup...
    const ctx = getAudioContext()
    // ...

    // 🟢 AUTO-INIT: PitchChain (SoundTouch WSOLA)
    ;(async () => {
      try {
        const { PitchChain } = await import('./audio/engine-v3/pitch/PitchChain')
        const chain = new PitchChain()
        await transport.attachPitchChain(chain)
        ;(window as any).__pitchChain = chain
        console.log('[AETHER] ✅ PitchChain active — SoundTouch WSOLA готов')
      } catch (e) {
        console.warn('[AETHER] PitchChain init skipped — varispeed fallback:', e)
      }
    })()

    // 🧪 OPTION D TEST
    window.__testOptionD = (enabled: boolean, rateHint?: number) => {
      try {
        const pc = (window as any).__pitchChain
        if (!pc) { console.warn('[OPTION D] PitchChain not found'); return }

        pc.usePhaseVocoder = enabled
        console.log(`[OPTION D] Phase Vocoder ${enabled ? '✅ ENABLED' : '❌ DISABLED'}`)

        const transport = getTransport()
        if (transport && transport.state === 'playing') {
          const currentRate = rateHint ?? transport.playbackRate
          transport.setPlaybackRate(currentRate)
          console.log(`[OPTION D] Restarted with rate=${currentRate}`)
        }
      } catch (e) {
        console.warn('[OPTION D] Failed:', e)
      }
    }

    ;(window as any).__getTransport = getTransport

    // 🧪 Best-effort preload PhaseVocoder (не блокирует boot)
    ensurePhaseVocoderRegistered(ctx).then(ok => {
      console.log(`[OPTION D] PhaseVocoder preload: ${ok ? '✅ ready' : '❌ unavailable — WSOLA fallback'}`)
    })

    // ... interceptor, __switchToV3, test functions ...
  } catch (e) {
    console.warn('[AETHER] Boot failed — V2 continues', e)
  }
}
bootAether()
```

### 2.7 Processor Probe Code (both processors)

**Path:** `src/audio/engine-v3/pitch/phase-vocoder-processor.js` (line 1941-1955)
**Path:** `src/audio/engine-v3/pitch/soundtouch-processor.js` (line 1941-1955)

Both processors share the SAME base class `SoundTouchProcessorBase.processCore()`. The ONLY difference is the stretch stage implementation (WSOLA vs PhaseVocoder FFT).

```javascript
// Identical code in BOTH processors:
this.beforePipeProcess(leftInput, rightInput, frameCount, parameters);
const pitch = parameters["pitch"][0];
const pitchSemitones = parameters["pitchSemitones"][0];
const playbackRate = parameters["playbackRate"][0];
this._pipe.pitch = pitch * Math.pow(2, pitchSemitones / 12) / playbackRate;
// 🧪 PROBE (throttled): первый блок + каждые 2000 блоков (~6с)
if (this._blockCount < 3 || this._blockCount % 2000 === 0) {
    console.log('[PVPROBE]', JSON.stringify({
        audioParams: { pitch, pitchSemitones, playbackRate },
        virtualPitch: this._pipe.virtualPitch,
        tempo: this._pipe._tempo,
        rate: this._pipe._rate,
        blockCount: this._blockCount,
    }));
}
// ... then inputBuffer.putSamples + _pipe.process() + outputBuffer extraction ...
```

---

## 🔧 Part 3: SoundTouchJS Library Source (Key Files)

### 3.1 SoundTouch.js — Core Pipeline (`@soundtouchjs/core`)

**Path:** `node_modules/@soundtouchjs/core/.dist/SoundTouch.js` (245 lines total)

This is the critical file. Full source below:

```javascript
/*
 * SoundTouch JS audio processing library
 * Copyright (c) Olli Parviainen, Ryan Berdeen, Jakub Fiala, Steve 'Cutter' Blades
 * Licensed under MPL-2.0
 */
import RateTransposer from './RateTransposer.js';
import { createCircularStretchInputBufferAdapter, 
         createFifoStretchInputBufferAdapter, default as Stretch } from './Stretch.js';
import CircularSampleBuffer from './CircularSampleBuffer.js';
import FifoSampleBuffer from './FifoSampleBuffer.js';
import { createCircularSampleBufferAdapter, createFifoSampleBufferAdapter } from './SampleBufferAdapter.js';
import isFloatDifferent from './testFloatEqual.js';

export default class SoundTouch {
    transposer;
    stretch;
    _sampleRate;
    _sampleBufferType;
    _sampleBufferFactory;
    _interpolationStrategy;
    _inputBuffer;
    _intermediateBuffer;
    _outputBuffer;
    _rate;
    _tempo;
    virtualPitch;

    constructor(options = {}) {
        this._sampleBufferType = options.sampleBufferType ?? 'circular';
        this._sampleBufferFactory = options.sampleBufferFactory ??
            (this._sampleBufferType === 'fifo'
                ? () => new FifoSampleBuffer()
                : () => new CircularSampleBuffer());
        // ... initialization ...
        this._rate = 0;
        this._tempo = 0;
        this.virtualPitch = 1.0;
        this.calculateEffectiveRateAndTempo();
    }

    // ... getter/setters ...

    set stretchFactory(factory) { /* allows swapping stretch implementation */ }
    get inputBuffer() { return this._inputBuffer; }
    get outputBuffer() { return this._outputBuffer; }

    set pitch(pitch) {
        this.virtualPitch = pitch;
        this.calculateEffectiveRateAndTempo();
    }

    set pitchOctaves(pitchOctaves) {
        this.pitch = Math.exp(0.69314718056 * pitchOctaves);
        this.calculateEffectiveRateAndTempo();
    }

    set pitchSemitones(pitchSemitones) {
        this.pitchOctaves = pitchSemitones / 12.0;
    }

    /** 🔴 THE KEY METHOD: derives _tempo and _rate from virtualPitch */
    calculateEffectiveRateAndTempo() {
        const previousTempo = this._tempo;
        const previousRate = this._rate;
        this._tempo = 1.0 / this.virtualPitch;
        this._rate = this.virtualPitch;
        if (isFloatDifferent(this._tempo, previousTempo)) {
            this.stretch.tempo = this._tempo;
        }
        if (isFloatDifferent(this._rate, previousRate)) {
            this.transposer.rate = this._rate;
        }
        // Pipeline order: when _rate > 1, Stretch→Transposer
        if (this._rate > 1.0) {
            this.stretch.inputBuffer = this._inputBuffer;
            this.stretch.outputBuffer = this._intermediateBuffer;
            this.transposer.inputBuffer = this._intermediateBuffer;
            this.transposer.outputBuffer = this._outputBuffer;
        } else {
            // When _rate <= 1, Transposer→Stretch (reversed)
            this.transposer.inputBuffer = this._inputBuffer;
            this.transposer.outputBuffer = this._intermediateBuffer;
            this.stretch.inputBuffer = this._intermediateBuffer;
            this.stretch.outputBuffer = this._outputBuffer;
        }
    }

    process() {
        if (this._rate > 1.0) {
            this.stretch.process();
            this.transposer.process();
        } else {
            this.transposer.process();
            this.stretch.process();
        }
    }
}
```

**Pipeline Math for rate=0.85, pitch=1.0:**
- `_pipe.pitch = 1.0 / 0.85 = 1.17647` ← set in processCore
- `virtualPitch = 1.17647` ← set by `this._pipe.pitch =`
- `_tempo = 1.0 / 1.17647 = 0.85`
- `_rate = 1.17647`
- Since `_rate > 1.0`: **Stretch(tempo=0.85) → Transposer(rate=1.17647)**

### 3.2 PhaseVocoderNode.js — PV Worklet Wrapper

**Path:** `node_modules/@soundtouchjs/phase-vocoder-worklet/.dist/PhaseVocoderNode.js`

```javascript
// Extends AudioWorkletNode
// Construction options:
// - fftSize: 512 | 1024 | 2048 | 4096 (default 2048)
// - overlapFactor: 2 | 4 | 8 (default 4)
// - interpolationStrategy: defaults to 'lanczos'
// - sampleBufferType: 'circular' | 'fifo' (default 'circular')
//
// AudioParams: pitch (k-rate), pitchSemitones (k-rate), playbackRate (k-rate)
//
// processorUrl: phase-vocoder-processor.js (registered at boot)
//
// stretchFactory: createPhaseVocoderFactory(fftSize, overlapFactor)
//   passed to SoundTouch constructor — replaces default WSOLA stretch
//   with FFT-based phase vocoder algorithm from @soundtouchjs/stretch-phase-vocoder
//
// Key note from docs:
// "Set playbackRate to MATCH the source node's playbackRate (k-rate)."
```

### 3.3 SoundTouchNode.js — WSOLA Worklet Wrapper

**Path:** `node_modules/@soundtouchjs/audio-worklet/.dist/SoundTouchNode.js`

```javascript
// The default WSOLA-based AudioWorkletNode wrapper
// Same AudioParams: pitch, pitchSemitones, playbackRate
// Uses WSOLA (Waveform Similarity Overlap-Add) for time-stretching
// stretchFactory: default (WSOLA) — not the PhaseVocoder variant
```

### 3.4 PhaseVocoder Stretch — FFT Algorithm

```javascript
// From @soundtouchjs/stretch-phase-vocoder
// createPhaseVocoderFactory(fftSize, overlapFactor) returns a factory
// that creates a phase vocoder stretch stage instead of the default WSOLA
//
// Algorithm:
// - Analysis window → FFT → phase unwrapping
// - expectedAdvance/delta for phase correction  
// - synthPhase = trueFreq * Hs
// - IFFT → OLA with Hermitian symmetry
// - Replaces StretchPipe in the pipeline: Stretch(tempo) → Transposer(rate)
```

---

## 📊 Part 4: Runtime Probe Data (from 50k-line log)

**Test:** `__testOptionD(true, 0.85)` while track playing with 7 stems

### WSPROBE (WSOLA, rate=1.0) — before PV activation
```json
{"audioParams":{"pitch":1,"pitchSemitones":0,"playbackRate":1},
 "virtualPitch":1, "tempo":1, "rate":1}
```

### PVPROBE (PhaseVocoder, rate=0.85) — 17,000 blocks stable
```json
{"audioParams":{"pitch":1,"pitchSemitones":0,"playbackRate":0.8500000238418579},
 "virtualPitch":1.1764705552361838, "tempo":0.8500000238418579, "rate":1.1764705552361838}
```

### Verification
```
virtualPitch × playbackRate = 1.17647 × 0.85 ≈ 1.0 ✅
```

### Event Sequence
```
[OPTION D] PhaseVocoder preload: ✅ ready
[PitchChain] prepareForRestart | rate:1 | nodeType:wsola | usePhaseVocoder:false
  ... 33,000 lines of WSPROBE (WSOLA passthrough at rate=1.0) ...
[OPTION D] Phase Vocoder ✅ ENABLED
[PitchChain] prepareForRestart | rate:0.85 | nodeType:phase-vocoder | usePhaseVocoder:true
[OPTION D] Restarted with rate=0.85
  ... 17,000 lines of PVPROBE (PhaseVocoder active, stable values) ...
```

### Key Findings
1. Pipeline math is **correct** in both modes
2. `virtualPitch`, `_tempo`, `_rate` all calculated correctly from `playbackRate`
3. Compensated pitch: `virtualPitch × playbackRate = 1.17647 × 0.85 ≈ 1.0` ✅
4. Values are **stable** from blockCount=0 → blockCount=8707 (no race condition at startup)
5. The SAME `processCore()` formula is used for both WSOLA and PV — the only difference is the stretch stage implementation

---

## 🔍 Part 5: What We Need You to Investigate

### Question A: Is `source.playbackRate = PhaseVocoderNode.playbackRate` correct?

PhaseVocoderNode docs say: *"set playbackRate to MATCH the source node's playbackRate"*

But we hypothesize this creates double-processing:
1. Source plays buffer at 0.85x → pitch drops to 0.85x
2. PV receives audio already at 0.85x pitch
3. PV formula: `_pipe.pitch = 1.0 / 0.85 = 1.17647`
4. PV pipeline: Stretch(tempo=0.85) → Transposer(rate=1.17647)
5. Output pitch: `0.85 × 1.17647 ≈ 1.0` ✅ (mathematically correct)

**Is this correct or is there a subtlety we're missing?**

### Question B: Does the PhaseVocoder pipeline assume source plays at 1.0x?

If `source.playbackRate = 1.0` and `PV.playbackRate = 0.85`:
- Source: normal speed, normal pitch
- PV formula: `_pipe.pitch = 1.0 / 0.85 = 1.17647`
- PV pipeline would RAISE pitch by 1.17647x (wrong!)
- Duration: PV stretch(tempo=0.85) makes 1.176x longer, transpose(rate=1.176) compresses back

**Or should source.playbackRate = 1.0 AND PV.pitch = 0.85 (NOT PV.playbackRate)?**

### Question C: Analyze SoundTouch Pipeline Stage Order

When `_rate > 1.0`:
- Order: Stretch(tempo=0.85) → intermediate → Transposer(rate=1.176)
- Stretch: 128 input frames → ~151 output frames (tempo=0.85 → stretch by 1/0.85)
- Transposer: ~151 input frames → ~128 output frames (resample by 1/1.176)

But source at 0.85x means input to PV is already frequency-shifted. The Stretch stage operates on frames, not on time — so it stretches whatever audio it receives. The Transposer then resamples.

**Is the phase vocoder stretch algorithm (FFT-based) sensitive to the source being already pitch-shifted? Does it assume clean input?**

### Question D: Why does user hear pitch change despite correct pipeline math?

Possible causes to evaluate:
1. PhaseVocoder phasiness artifacts at 0.85 ratio perceived as pitch change
2. WSOLA→PV switch transient (stems killed and recreated — gap in audio)
3. Race condition between `source.start(targetStart)` and PV AudioParam settling
4. The `_blockCount` in our probe starts at 0 → first blocks may have stale param values
5. `k-rate` AudioParam vs `a-rate`: could first render quantum have default (1.0) before our .value assignment takes effect?
6. `source.start()` schedules start at `targetStart` in the future — does PV node process before source starts and produce garbage?

### Question E: Our proposed fix — correct or wrong?

```typescript
// TransportV3._restartStemsAt():
const sourceRate = (this._pitchChain?.usePhaseVocoder && rate < 1.0) ? 1.0 : rate;
this.stems.playAllAt(targetStart, offset, sourceRate);
```

This makes `source.playbackRate = 1.0` when PV is active. Is this correct per the library design, or would it break pitch compensation?

**Alternative fix:** Keep `source.playbackRate = rate` as documented, but add some other compensation?

---

## 📋 Part 6: Installed SoundTouchJS Packages (v2.1.0)

All 11 packages installed in `node_modules/@soundtouchjs/`:

```
📦 @soundtouchjs/core                  (2.1.0) — SoundTouch, pipeline, buffers
📦 @soundtouchjs/audio-worklet         (2.1.0) — SoundTouchNode + soundtouch-processor.js
📦 @soundtouchjs/phase-vocoder-worklet (2.1.0) — PhaseVocoderNode + phase-vocoder-processor.js
📦 @soundtouchjs/stretch-phase-vocoder (2.1.0) — FFT phase vocoder stretch implementation
📦 @soundtouchjs/formant-correction-worklet (2.1.0) — Formant correction for PV
📦 @soundtouchjs/worklet-base          (2.1.0) — Base AudioWorkletProcessor
📦 @soundtouchjs/interpolation-strategy-lanczos  (2.1.0)
📦 @soundtouchjs/interpolation-strategy-hann     (2.1.0)
📦 @soundtouchjs/interpolation-strategy-blackman (2.1.0)
📦 @soundtouchjs/interpolation-strategy-kaiser   (2.1.0)
📦 @soundtouchjs/interpolation-strategy-linear   (2.1.0)
```

---

## 📎 Part 7: Reference Links

- SoundTouchJS repo: https://github.com/cutterbl/soundtouchjs
- PhaseVocoderNode docs: https://github.com/cutterbl/soundtouchjs/blob/master/packages/phase-vocoder-worklet/README.md
- PhaseVocoder stretch: https://github.com/cutterbl/soundtouchjs/blob/master/packages/stretch-phase-vocader/README.md
- Context7 SoundTouchJS library: /cutterbl/soundtouchjs

---

*Packed by 007 for GPT Deep Research — 2026-07-23*
