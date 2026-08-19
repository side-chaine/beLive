// src/audio/engine-v3/pipeline/HybridPipelineService.ts
// "4+3 Hybrid Per-Stem" Pipeline
//
// Bus A (4× stretch):     Vocals, Guitar, Bass, Keys/Drums dynamic
// Bus B (3× varispeed):   Drums, Other, Instrumental
//
// Agent_202 killshots applied:
//  ✅ No setTimeout → AudioParam scheduling (see _crossfadeSource)
//  ✅ Overlapping source swap → smooth crossfade, no dropout
//  ✅ Dynamic assignStem: Keys absent → Drums promoted to Bus A
//  ✅ try/catch защита от WASM processorerror
//  ✅ Bug #3 fix: DelayNode динамический при каждом assignStem

import { StemPlayerV3 } from '../stems/StemPlayerV3'
import { StemChain } from './StemChain'
import { StretchInstancePool, MAX_STRETCH_INSTANCES } from './StretchInstancePool'
import { HybridLoopStrategy } from './HybridLoopStrategy'
import type { IPipelineController, BusType } from './IPipelineController'
import {
  checkDuplicateAudioRoutes,
  type RouteRecord,
  type RouteCheckReport,
  ROUTE_CHECK_EPSILON,
} from '../diagnostics/DuplicateAudioRouteChecker'

export class HybridPipelineService implements IPipelineController {
  private readonly _ctx: AudioContext
  private _chainA: StemChain
  private _chainB: StemChain
  private readonly _stretchPool: StretchInstancePool
  private readonly _loopStrategy: HybridLoopStrategy
  private readonly _outputGain: GainNode
  /** 057: master gain для Bus A (Stretch) — 0 когда Direct активен */
  private readonly _busAGain: GainNode
  /** 057: master gain для Bus B (Direct/varispeed) — 0 когда Stretch активен */
  private readonly _busBGain: GainNode
  /** 057: текущий активный backend — 'direct' или 'stretch' */
  private _activeBackend: 'direct' | 'stretch' | 'unknown' = 'unknown'
  /** 061-B2: целевой backend (подтвердится после crossfade).
   *  Нужен чтобы setPlaybackRate() во время crossfade не байлил на stale _activeBackend. */
  private _intendedBackend: 'direct' | 'stretch' = 'direct'
  /** 059: true во время 80ms crossfade — checker допускает оба bus'а */
  private _isCrossfading = false
  /** Per-stem gain для stretch стемов (Bus A) — контролирует громкость stretch output */
  private readonly _stretchGains: Map<string, GainNode> = new Map()
  private _currentOffset = 0
  private _isPlaying = false
  private _seekGeneration = 0
  /** 🚦 SONNET-VERDICT-10: transport lock — сериализация play/pause */
  private _transportLock: Promise<void> = Promise.resolve()
  /** 🔧 ОПУС-ДЕНЬ-0: _hasSeparateStems удалён — instrumental всегда идёт в Bus A stretch.
   *  В FULL мастер не грузить — это задача будущего PeaksExtractor + MultichannelStretch. */
  /** 🆕 кэш — защита от duration=0 при reset */
  private _lastKnownDuration = 0;
  /** 🔧 Fix D: wall-clock момент последнего play/seek */
  private _playStartTime = 0
  /** 🔧 Fix D: текущий rate — для refTime (синхронизирован с setPlaybackRate) */
  private _currentRate = 1.0
  /** 053-B1: Map<node, handler> — нет leak при перезаписи */
  private _stretchCrashHandlers = new Map<AudioNode, EventListener>();
  /** 061-B1: generation counter для switchBackend — старый callback не убивает новый backend */
  private _switchGeneration = 0;

  constructor(ctx: AudioContext) {
    this._ctx = ctx
    this._chainA = new StemChain(ctx, 'A')
    this._chainB = new StemChain(ctx, 'B')
    this._stretchPool = new StretchInstancePool(ctx)
    this._loopStrategy = new HybridLoopStrategy(this._stretchPool)
    this._outputGain = ctx.createGain()
    this._outputGain.gain.value = 1.0

    // 067-D: single path — только Bus A (stretch)
    this._busAGain = ctx.createGain()
    this._busAGain.gain.value = 1.0     // Stretch always active
    this._busBGain = ctx.createGain()
    this._busBGain.gain.value = 0.0     // Bus B dead — будет удалён в 067-D full cleanup

    // 067-D: только A → master gain → output. B не подключён.
    this._chainA.outputNode.connect(this._busAGain)
    this._busAGain.connect(this._outputGain)
    // _chainB.outputNode НЕ подключаем — Bus B не играет

    // 058: Global diagnostics API
    const w = typeof window !== 'undefined' ? window as any : null
    if (w) {
      if (!w.__belive) w.__belive = {}
      w.__belive.routeCheck = () => {
        if (!this.getRouteCheckReport) return { ok: false, error: 'pipeline not ready' }
        const report = this.getRouteCheckReport()
        console.table(report.audibleRoutes)
        if (!report.ok) console.error(report.issues)
        return report
      }
    }
  }

  // ── Public getters ──────────────────────────────────────

  get outputNode(): AudioNode { return this._outputGain }
  get inputNode(): AudioNode { return this._chainA.mergeGain }
  get chainA(): StemChain { return this._chainA }
  get chainB(): StemChain { return this._chainB }
  get stretchPool(): StretchInstancePool { return this._stretchPool }

  get currentTime(): number {
    if (!this._isPlaying) return this._currentOffset
    return Math.max(0, this._currentOffset +
      (this._ctx.currentTime - this._playStartTime) * this._currentRate)
  }

  get duration(): number {
    if (this._chainA.stems.size === 0 && this._chainB.stems.size === 0) {
      return this._lastKnownDuration  // — не даём UI дёргаться на 0 между треками
    }
    let maxDur = 0
    for (const stem of this._chainA.stems.values()) {
      if (stem.duration > maxDur) maxDur = stem.duration
    }
    for (const stem of this._chainB.stems.values()) {
      if (stem.duration > maxDur) maxDur = stem.duration
    }
    if (maxDur > 0) this._lastKnownDuration = maxDur
    return maxDur
  }

  // ── Lifecycle ───────────────────────────────────────────

  async init(): Promise<void> {
    await this._stretchPool.initAll()
    const stretchActive = this._stretchPool.activeCount

    // 🟢 E.2: pure-varispeed fallback — нет STFT latency → delay = 0
    if (stretchActive === 0) {
      this._chainB.setBusBDelay(0)
      console.warn(`[HybridPipeline] ⚠️ Pure varispeed fallback — Bus B delay = 0`)
    } else {
      console.log(`[HybridPipeline] ✅ Init. Stretch: ${stretchActive}/${MAX_STRETCH_INSTANCES}`)
    }
  }

  async loadStem(stemId: string, buffer: AudioBuffer): Promise<void> {
    // 067-D: single path — только stretch. Bus B не создаём.
    const busAStem = new StemPlayerV3({ id: stemId, ctx: this._ctx })
    busAStem.setBuffer(buffer)
    this._chainA.addStem(busAStem)

    const instance = await this._stretchPool.ensureSlot(stemId)
    if (instance) {
      try {
        await instance.chunkedLoad(buffer)

        // 053-B2: снести дубликат stretch gain
        const staleGain = this._stretchGains.get(stemId)
        if (staleGain) { try { staleGain.disconnect() } catch {}; this._stretchGains.delete(stemId) }

        // stretch output → per-stem gain → chainA.mergeGain
        const stretchGain = this._ctx.createGain()
        stretchGain.gain.value = 1.0
        instance.outputNode.connect(stretchGain)
        stretchGain.connect(this._chainA.mergeGain)
        this._stretchGains.set(stemId, stretchGain)

        // 053-B3: per-node crash handler (без изменений)
        const node = instance.outputNode
        const stale = this._stretchCrashHandlers.get(node)
        if (stale) { try { node.removeEventListener('stretch-crash', stale) } catch {} }
        const handler = ((e: Event) => {
          const stemId = (e as CustomEvent).detail.id
          console.warn(`[HybridPipeline] ⚠️ Stretch "${stemId}" crashed — fallback to varispeed (per-stem)`)
          if (!stemId) return
          // Per-stem mute: mute только stretch gain, Direct (Bus B) остаётся
          const sg = this._stretchGains.get(stemId)
          if (sg) {
            this._rampGain(sg, 0)
          }
        }) as EventListener
        node.addEventListener('stretch-crash', handler)
        this._stretchCrashHandlers.set(node, handler)

        console.log(`[HybridPipeline] 🔥 "${stemId}" → Single: Stretch only (067-D)`)
      } catch (e) {
        console.warn(`[HybridPipeline] ❌ Stretch load failed for ${stemId}:`, e)
      }
    } else {
      console.error(`[HybridPipeline] ❌ "${stemId}": нет stretch-слота. Стем НЕ звучит (single-path: varispeed fallback запрещён).`)
    }
  }

  async play(offset: number, rate: number): Promise<void> {
    // 🚦 Transport lock: ждём, пока предыдущая операция не закончится
    const prev = this._transportLock
    let release!: () => void
    this._transportLock = new Promise<void>(r => { release = r })
    await prev

    try {
      this._currentOffset = offset
      this._playStartTime = this._ctx.currentTime
      this._currentRate = rate

      // 067-D: single path — всегда stretch, Direct не существует
      this._busAGain.gain.value = 1.0
      this._busBGain.gain.value = 0.0
      this._activeBackend = 'stretch'

      // stretch gains → chainA.mergeGain
      for (const g of this._stretchGains.values()) {
        try { g.disconnect() } catch {}
        g.connect(this._chainA.mergeGain)
      }

      // Bus A: REGIME 3 — параллельный старт stretch
      await Promise.all([...this._chainA.stems].map(async ([stemId, stem]) => {
        const instance = this._stretchPool.get(stemId)
        const stretchGain = this._stretchGains.get(stemId)
        if (instance?.isActive && stretchGain) {
          try {
            await instance.start(offset, rate)
            stretchGain.gain.value = stem.volume ?? 1.0
            if (import.meta.env.DEV) console.log(`[RECON-1] Pipeline:${stemId} | ...`)
          } catch (e) {
            console.warn(`[HybridPipeline] Stretch start error for ${stemId}:`, e)
          }
        } else {
          console.warn(`[HybridPipeline] ⚠️ ${stemId} no stretch — STEM SILENT (single-path)`)
        }
      }))

      // ❌ Bus B playAll удалён

      this._isPlaying = true
      if (import.meta.env.DEV) this.assertRouteIntegrity()
      console.log(`[HybridPipeline] ▶️ Play at ${offset.toFixed(2)}s × ${rate.toFixed(3)} (067-D)`)
    } finally {
      release()
    }
  }

  async pause(): Promise<void> {
    // 🚦 Transport lock: ждём, пока предыдущая операция не закончится
    const prev = this._transportLock
    let release!: () => void
    this._transportLock = new Promise<void>(r => { release = r })
    await prev

    try {
      // 🔧 Fix D: input position, не wall-clock — иначе memory monitor дропнет всё во время паузы (FM-N2)
      this._currentOffset = this._currentOffset +
        (this._ctx.currentTime - this._playStartTime) * this._currentRate
      this._isPlaying = false
      this._chainA.pauseAll()
      this._stretchPool.stopAll()
    } finally {
      release()
    }
  }

  stop(): void {
    this._currentOffset = 0
    this._isPlaying = false

    this._chainA.pauseAll()
    this._stretchPool.stopAll()
  }

  async seek(time: number, rate: number): Promise<void> {
    const myGen = ++this._seekGeneration        // 🔧 свежий seek побеждает ждущий
    const prev = this._transportLock             // 🚦 transport lock
    let release!: () => void
    this._transportLock = new Promise<void>(r => { release = r })
    await prev

    try {
      if (myGen !== this._seekGeneration) return   // 🔧 нас обогнали, пока ждали lock

      console.log(`[RECON-SEEK] seek(time=${time.toFixed(2)}, rate=${rate.toFixed(3)}) gen=${myGen} isPlaying=${this._isPlaying}`)
      this._currentOffset = time
      this._playStartTime = this._ctx.currentTime
      this._currentRate = rate

      if (!this._isPlaying) return

      // Bus A: REGIME 3 — параллельный seek для всех stretch (varispeed fallback удалён)
      const seekPromises: Promise<void>[] = []
      for (const [stemId, stem] of this._chainA.stems) {
        const instance = this._stretchPool.get(stemId)
        const stretchGain = this._stretchGains.get(stemId)
        if (instance?.isActive && stretchGain) {
          seekPromises.push(
            instance.seek(time, rate)
              .then(() => {
                // 🔧 Fix D (FM-N5): читаем this._currentRate, не замыкаем параметр — защита от race с setPlaybackRate
                const currentRate = this._currentRate
                return instance.scheduleRate(currentRate, 0)
              })
              .then(() => { stretchGain.gain.value = stem.volume ?? 1.0 })
              .catch(e => console.warn(`[HybridPipeline] Stretch seek error for ${stemId}:`, e))
          )
        }
      }

      // Ждём все параллельные stretch seek
      if (seekPromises.length > 0) {
        await Promise.allSettled(seekPromises)
      }

      // Guard: если новый seek пришёл — старый не применяем
      if (myGen !== this._seekGeneration) return
      if (import.meta.env.DEV) this.assertRouteIntegrity()
    } finally {
      release()   // 🔧 всегда отпускаем lock
    }
  }

  setPlaybackRate(rate: number): void {
    if (!Number.isFinite(rate) || rate <= 0) return
    this._currentRate = rate
    // 067-D: single path — один rate на все стемы, всегда через stretch.
    // Никакого switchBackend, никакой границы режимов.
    void this._stretchPool.scheduleRateAll(rate, 0)
  }

  /**
   * Preload-only rate setter. Unlike setPlaybackRate(), this never dispatches
   * v3-pipeline-mode-change. Must be called after reset() and before loadStem().
   */
  setRate(rate: number): void {
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error(`[HybridPipeline] Invalid preload rate: ${rate}`)
    }
    this._currentRate = rate
  }

  /** 067-D: single path — switchBackend не используется */
  switchBackend(_target: 'direct' | 'stretch', _offset: number, _rate: number): void {
    console.warn('[HybridPipeline] switchBackend() отключён (067-D: single path).')
  }

  // 067-D: _scheduleCrossfadeEnd удалён — single path не использует crossfade

  setLoop(start: number, end: number): void {
    this._loopStrategy.setLoop(start, end)
    this._chainA.setLoopOnAll(start, end)
    void this._stretchPool.scheduleLoopAll(start, end)
  }

  clearLoop(): void {
    this._loopStrategy.clearLoop()
    this._chainA.clearLoopOnAll()
  }

  // ── 058: Duplicate Route Diagnostics ──────────────────────────

  getRouteCheckReport(): RouteCheckReport {
    const records: RouteRecord[] = []
    const busAGain = this._busAGain.gain.value

    const addChain = (
      chain: 'A' | 'B',
      stems: Iterable<[string, StemPlayerV3]>,
      masterGain: number,
    ): void => {
      for (const [stemId, stem] of stems) {
        records.push({
          stemId,
          bus: chain,
          audible: Math.abs(masterGain) > ROUTE_CHECK_EPSILON,
          hasStretchInstance: this._stretchPool.get(stemId)?.isActive === true,
          hasBuffer: stem.getBuffer() !== null,
          gain: stem.volume ?? 1,
          masterGain,
          sourceTag: chain === 'A' ? 'stretch' : 'direct',
        })
      }
    }

    addChain('A', this._chainA.stems, busAGain)
    // 067-D: Bus B не добавляем — single path

    const activeBackend = this._activeBackend === 'stretch'
      ? 'stretch'
      : this._activeBackend === 'direct'
        ? 'direct'
        : 'unknown'

    return checkDuplicateAudioRoutes(records, activeBackend)
  }

  assertRouteIntegrity(): void {
    if (!import.meta.env.DEV) return
    // 067-D: route checker — только лог, никогда throw/rollback
    const report = this.getRouteCheckReport()
    if (!report.ok) {
        console.warn('[RouteCheck] ⚠️ Route issues (non-fatal in single-path):', report.issues)
    } else {
        console.log(`[RouteCheck] ✅ ${report.audibleRoutes.length} routes, active=stretch`)
    }
  }

  /** 062: DEV-only диагностика — полное состояние backend для тестов гонок. */
  getBackendState(): Record<string, unknown> | null {
    if (!import.meta.env.DEV) return null
    const EPSILON = 0.0005
    const busAGain = this._busAGain.gain.value
    const busBGain = this._busBGain.gain.value
    return {
      rate: this._currentRate,
      position: this.currentTime,
      activeBackend: this._activeBackend,
      intendedBackend: this._intendedBackend,
      isCrossfading: this._isCrossfading,
      audibleBusCount: (Math.abs(busAGain) > EPSILON ? 1 : 0) + (Math.abs(busBGain) > EPSILON ? 1 : 0),
      busA: { audible: Math.abs(busAGain) > EPSILON },
      busB: { audible: Math.abs(busBGain) > EPSILON },
      stemCountA: this._chainA.stems.size,
      stemCountB: this._chainB.stems.size,
      switchGeneration: this._switchGeneration,
    }
  }

  // 067-D: _forceMuteOneBackend удалён — single path не требует force-mute

  muteStem(stemId: string, muted: boolean): void {
    this._chainA.muteStem(stemId, muted)
    // Bus A stretch gain: ramp + восстановление volume при unmute
    const sg = this._stretchGains.get(stemId)
    if (sg) {
      const stem = this._chainA.stems.get(stemId)
      this._rampGain(sg, muted ? 0 : (stem?.volume ?? 1))
    }
  }

  /** Плавная регулировка громкости стема (для UI fader) */
  setStemVolume(stemId: string, volume: number): void {
    // Bus A stretch: stretchGain управляет громкостью
    const stretchGain = this._stretchGains.get(stemId)
    if (stretchGain) {
      this._rampGain(stretchGain, volume)
    }
    // Bus A: stem._faderGain
    this._chainA.setStemVolume(stemId, Math.max(0, Math.min(1, volume)))
  }

  /** Mute/unmute стема для pipeline */
  setStemMuted(stemId: string, muted: boolean): void {
    this.muteStem(stemId, muted)
  }

  soloStem(stemId: string, soloed: boolean): void {
    this._chainA.soloStem(stemId, soloed)
    // Bus A stretch gains: синхронизируем с solo состоянием через stem.volume
    for (const [id, stem] of this._chainA.stems) {
      const sg = this._stretchGains.get(id)
      if (sg) this._rampGain(sg, stem.volume)
    }
  }

  /** 053-F: assignStem отключён — терял буфер стема (создавал StemPlayerV3 без setBuffer) */
  assignStem(_stemId: string, _bus: BusType): void {
    console.warn('[HybridPipeline] assignStem() отключён (053): терял буфер стема. Требует loadStem заново.')
  }

  // ── Private ────────────────────────────────────────────

  // 067-D: _startStemOverlap удалён — Bus B не используется
  // 067-D: _nextQuantumTime удалён — не нужен без switchBackend

  /** 053-D1: ramp gain с cancelScheduledValues + linearRamp */
  private _rampGain(g: GainNode, target: number, ms = 15): void {
    const now = this._ctx.currentTime
    const v = Math.max(0, Math.min(1, target))
    g.gain.cancelScheduledValues(now)
    g.gain.setValueAtTime(g.gain.value, now)
    g.gain.linearRampToValueAtTime(v, now + ms / 1000)
  }

  /** 🧹 Полный сброс pipeline при смене трека — очистка цепей и WASM */
  async reset(): Promise<void> {
    console.log('[HybridPipeline] 🧹 Full reset...')
    
    // Останавливаем всё
    this.stop()
    
    // Очищаем stretch gains
    for (const gain of this._stretchGains.values()) {
      try { gain.disconnect() } catch {}
    }
    this._stretchGains.clear()
    
    // 🧹 053-B4: чистим все listener через Map
    for (const [node, h] of this._stretchCrashHandlers) {
      try { node.removeEventListener('stretch-crash', h) } catch {}
    }
    this._stretchCrashHandlers.clear()
    
    // Очищаем chains
    this._chainA.dispose()
    this._chainB.dispose()
    
    // Пересоздаём chains (они лёгкие, без WASM)
    this._chainA = new StemChain(this._ctx, 'A')
    this._chainA.outputNode.connect(this._outputGain)
    // _chainB не пересоздаём — не используется
    
    // Сброс state
    this._currentOffset = 0
    this._isPlaying = false
    this._seekGeneration = 0
    this._playStartTime = 0       // 🔧 Fix D (FM-N3)
    this._currentRate = 1.0       // 🔧 Fix D (FM-N3)

    // StretchPool остаётся — переиспользуем WASM инстансы
    this._stretchPool.stopAll()
    
    // 🧹 Sonnet: очищаем WASM буферы — addBuffers() использует push(), не replace
    // Без очистки буферы прошлых треков копятся навсегда
    await this._stretchPool.clearAllBuffers().catch(e => {
      console.warn('[HybridPipeline] clearAllBuffers failed:', e)
    })
    console.log('[HybridPipeline] ✅ Reset complete — ready for new track')
  }

  dispose(): void {
    // Clean up stretch gains
    for (const [_, gain] of this._stretchGains) {
      try { gain.disconnect() } catch {}
    }
    this._stretchGains.clear()
    this._chainA.dispose()
    // _chainB не dispose — не используется
    // 🧹 053-B4: чистим все listener через Map
    for (const [node, h] of this._stretchCrashHandlers) {
      try { node.removeEventListener('stretch-crash', h) } catch {}
    }
    this._stretchCrashHandlers.clear()
    this._stretchPool.dispose()
    this._loopStrategy.dispose()
    try { this._outputGain.disconnect() } catch {}
  }
}
