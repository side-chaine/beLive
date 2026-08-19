// ============================================================
// src/audio/engine-v3/monitor/MonitorRouter.ts
// Static Output Bus — AETHER V3 (TC-2C)
//
// 0 disconnect() в runtime. Все ноды в constructor, живут вечно.
// Все переключения через linearRampToValueAtTime(0|1, 20ms).
//
// ═══ ГРАФ ═══════════════════════════════════════════════════
// stem.outputNode ──→ [ProgramMixGain (gain=1.0 ALWAYS)]
//   ├→ [DefaultBranchGain] ─→ ctx.destination
//   ├→ [MainBranchGain] ─→ MainDelayNode ─→ MainStreamDest
//   ├→ [CaptureGain] ─→ CaptureDest (pre-split, FR-008)
//   └→ [MonitorMasterGain] ─→ MonitorStreamDest
//
// vocals.outputNode ──→ [VocalHallGain] ─→ MainDelayNode
// Mic (future) ──────→ [MicDelayNode] ─→ [MonitorGain] ─→ MonitorStreamDest
// ============================================================

export class MonitorRouter {
  // ── Static inputs (Orchestrator подключает stems сюда) ──
  readonly programInput: GainNode
  readonly vocalHallInput: GainNode
  readonly micInput: GainNode

  // ── Stream endpoints ──
  readonly captureStream: MediaStreamAudioDestinationNode
  readonly monitorStream: MediaStreamAudioDestinationNode
  readonly mainStream: MediaStreamAudioDestinationNode

  // ── Internal routing nodes ──
  private readonly _defaultBranch: GainNode
  private readonly _mainBranch: GainNode
  private readonly _mainDelay: DelayNode
  private readonly _micDelay: DelayNode
  private readonly _monitorGain: GainNode
  private readonly _monitorMaster: GainNode
  private readonly _hallMaster: GainNode
  private readonly _musicGain: GainNode
  private readonly _vocalHallGain: GainNode
  private readonly _captureGain: GainNode

  constructor(ctx: AudioContext) {
    // ── Create all nodes ──
    this.programInput = ctx.createGain()
    this.programInput.gain.value = 1.0 // FR-002: bus = summing point, gain=1.0 ALWAYS

    this._defaultBranch = ctx.createGain()
    this._defaultBranch.gain.value = 1.0

    this._mainBranch = ctx.createGain()
    this._mainBranch.gain.value = 0.0

    this._mainDelay = ctx.createDelay(1.0) // iOS maxDelay 1.0s
    this._mainDelay.delayTime.value = 0

    this._micDelay = ctx.createDelay(1.0)
    this._micDelay.delayTime.value = 0

    this._monitorGain = ctx.createGain()
    this._monitorGain.gain.value = 0.0 // mic off by default

    this._monitorMaster = ctx.createGain()
    this._monitorMaster.gain.value = 1.0

    this._hallMaster = ctx.createGain()
    this._hallMaster.gain.value = 1.0

    this._musicGain = ctx.createGain()
    this._musicGain.gain.value = 0.0 // music in monitor off by default

    this._vocalHallGain = ctx.createGain()
    this._vocalHallGain.gain.value = 0.0

    this._captureGain = ctx.createGain()
    this._captureGain.gain.value = 1.0

    this.mainStream = ctx.createMediaStreamDestination()
    this.monitorStream = ctx.createMediaStreamDestination()
    this.captureStream = ctx.createMediaStreamDestination()

    this.vocalHallInput = ctx.createGain()
    this.vocalHallInput.gain.value = 1.0

    this.micInput = ctx.createGain()
    this.micInput.gain.value = 1.0

    // ── Static graph (НЕ перестраивается, 0 disconnect) ──
    // ProgramMix → Default + Main branches
    this.programInput.connect(this._defaultBranch)
    // _defaultBranch → destination (постоянное соединение)
    this._defaultBranch.connect(ctx.destination)

    this.programInput.connect(this._mainBranch)
    this._mainBranch.connect(this._mainDelay)
    this._mainDelay.connect(this._hallMaster)
    this._hallMaster.connect(this.mainStream)

    // Capture — pre-split, pre-delay (FR-008)
    this.programInput.connect(this._captureGain)
    this._captureGain.connect(this.captureStream)

    // Music tap to monitor
    this.programInput.connect(this._musicGain)
    this._musicGain.connect(this._monitorMaster)
    this._monitorMaster.connect(this.monitorStream)

    // Vocal hall — after MainDelay (shared delay)
    this.vocalHallInput.connect(this._mainDelay)

    // Mic path — own delay (for monitor compensation)
    this.micInput.connect(this._micDelay)
    this._micDelay.connect(this._monitorGain)
    this._monitorGain.connect(this._monitorMaster)

    // 🔬 RECON-3: начальное состояние роутера
    this.dumpState('constructor');
  }

  // 🔬 RECON-3: временный метод диагностики
  public dumpState(label: string): void {
    console.log(`[RECON-3] ${label} | programInput:${this.programInput.gain.value.toFixed(4)} | defaultBranch:${this._defaultBranch.gain.value.toFixed(4)} | mainBranch:${this._mainBranch.gain.value.toFixed(4)} | vocalHallInput:${this.vocalHallInput.gain.value.toFixed(4)}`);
  }

  // ── Routing control ──

  /** Default ↔ Main crossfade (SPLIT toggle) */
  setRouteMain(on: boolean): void {
    const now = this.programInput.context.currentTime
    const ramp = now + 0.02
    this._defaultBranch.gain.cancelScheduledValues(now)
    this._mainBranch.gain.cancelScheduledValues(now)
    this._defaultBranch.gain.setValueAtTime(this._defaultBranch.gain.value, now)
    this._mainBranch.gain.setValueAtTime(this._mainBranch.gain.value, now)
    this._defaultBranch.gain.linearRampToValueAtTime(on ? 0 : 1, ramp)
    this._mainBranch.gain.linearRampToValueAtTime(on ? 1 : 0, ramp)
    // 🔬 RECON-3: логируем переключение
    this.dumpState(`setRouteMain(${on})`);
  }

  /** Music level in monitor mix */
  setMusicLevel(v: number): void {
    const now = this.programInput.context.currentTime
    this._musicGain.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), now, 0.015)
  }

  /** Vocal hall level (AutoMix target) */
  setVocalHallLevel(v: number): void {
    const now = this.programInput.context.currentTime
    this._vocalHallGain.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), now, 0.015)
  }

  /** Enable/disable vocal → main hall */
  setVocalToMain(on: boolean): void {
    const now = this.programInput.context.currentTime
    const ramp = now + 0.02
    this._vocalHallGain.gain.cancelScheduledValues(now)
    this._vocalHallGain.gain.setValueAtTime(this._vocalHallGain.gain.value, now)
    this._vocalHallGain.gain.linearRampToValueAtTime(on ? 1 : 0, ramp)
  }

  /** Monitor master volume */
  setMonitorVolume(v: number): void {
    this._monitorMaster.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), this.programInput.context.currentTime, 0.015)
  }

  /** Hall master volume */
  setHallVolume(v: number): void {
    this._hallMaster.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), this.programInput.context.currentTime, 0.015)
  }

  /** Delay compensation — main or monitor path. Clamp 0..1000ms (iOS) */
  setDelayMs(ms: number): void {
    const v = Math.max(0, Math.min(1000, ms)) / 1000
    this._mainDelay.delayTime.value = v
    this._micDelay.delayTime.value = 0
  }

  /** Which path gets delay — monitor or main */
  setCompensateTarget(t: 'monitor' | 'main'): void {
    if (t === 'monitor') {
      this._mainDelay.delayTime.value = 0
    } else {
      this._micDelay.delayTime.value = 0
    }
  }

  /** Connect mic (V2Adapter.enableMicrophone calls this) */
  setMicEnabled(on: boolean): void {
    const now = this.programInput.context.currentTime
    const ramp = now + 0.02
    this._monitorGain.gain.cancelScheduledValues(now)
    this._monitorGain.gain.setValueAtTime(this._monitorGain.gain.value, now)
    this._monitorGain.gain.linearRampToValueAtTime(on ? 1 : 0, ramp)
  }

  /** Capture bus (FR-008, pre-split tap) */
  attachProgramSource(node: AudioNode, _opts: { kind: string }): void {
    // stem.outputNode → ProgramMixGain уже есть. Это для внешних источников (mic preview)
    node.connect(this._captureGain)
  }
}
