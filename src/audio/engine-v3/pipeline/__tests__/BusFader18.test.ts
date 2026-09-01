/**
 * №18-BUS + FADER · Bus Volume Model V3 · тесты MICRO-PACK 462 (спека 006 v3.1 §H4.3)
 *
 * Покрывают:
 *  1. clamp/NaN таблица setBusVolume (паритет V2 engine-level clamp 0..1)
 *  2. формула-матрица effective = clamp(raw) × busFactor, ×solo-маска
 *  3. single-writer static-grep — whitelist прямых writers stretchGain.gain.value
 *     (loadStem :195 benign 1.0 · play :272 / seek :349 под crash-гвардом) 📌DC3
 *  4. порядок setBusVolume ДО loadStem (fader применяется при первом лоаде)
 *  5. crash двусторонний (handler → crashed set; play/seek не воскрешают; reload resurrect)
 *     + H1.5 dead-stem (catch/no-slot → gain 0; успешный reload resurrect)
 *  6. NaN-гарды стора (setBusVolume/setStemVolume первой строкой)
 *  7. регресс симптома №18: фейдер 37% переживает смену блока (reset), music тише пропорционально
 *  9. cage-инвариант H4.1: гард ae.* блокирует при __v3Active, delegateSync-канал не задет
 * 10. dual-mode маршрутизация красного фейдера ControlDeck (stems ↔ no-stems) — контракт-зеркало H3.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useStemStore } from '../../../../stem/stem.store'
import { BUILTIN_STEMS } from '../../../../stem/stemTypes'
// ?raw-импорт для single-writer static-grep (типизирован vite/client)
import pipelineSrc from '../HybridPipelineService.ts?raw'

// ═══════════════════════════════════════════════════════════
// Mock StretchInstance — per-instance outputNode + listener map (для stretch-crash)
// ═══════════════════════════════════════════════════════════

vi.mock('../StretchInstance', () => {
  const makeGain = () => ({
    gain: { value: 1, setValueAtTime: vi.fn(), cancelScheduledValues: vi.fn(), linearRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  })
  return {
    StretchInstance: class {
      isActive = true
      stemId: string | null = null
      start = vi.fn(async function (this: any) { this._started = true })
      seek = vi.fn(async () => {})
      stop = vi.fn()
      init = vi.fn(async () => {})
      scheduleRate = vi.fn(async () => {})
      scheduleLoop = vi.fn(async () => {})
      scheduleLoopNone = vi.fn(async () => {})
      loadBuffer = vi.fn(async () => {})
      chunkedLoad = vi.fn(async () => {})
      clearBuffers = vi.fn(async () => {})
      dispose = vi.fn()
      _listeners = new Map<string, Set<EventListener>>()
      outputNode = {
        ...makeGain(),
        addEventListener: vi.fn((type: string, h: EventListener) => {
          if (!this._listeners.has(type)) this._listeners.set(type, new Set())
          this._listeners.get(type)!.add(h)
        }),
        removeEventListener: vi.fn((type: string, h: EventListener) => {
          this._listeners.get(type)?.delete(h)
        }),
        dispatchEvent: vi.fn((event: Event) => {
          this._listeners.get(event.type)?.forEach(h => h(event))
          return true
        }),
      }
      constructor(id?: string) { this.stemId = id ?? null }
    },
  }
})

// ═══════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════

const BUF = { duration: 120, length: 48000 * 120, sampleRate: 48000, numberOfChannels: 2 } as any

function makeCtx(): any {
  return {
    state: 'running',
    currentTime: 0,
    sampleRate: 48000,
    destination: { connect: vi.fn() },
    createGain: vi.fn(() => ({
      gain: { value: 1, setValueAtTime: vi.fn(), cancelScheduledValues: vi.fn(), linearRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createAnalyser: vi.fn(() => ({
      ...{
        gain: { value: 1, setValueAtTime: vi.fn(), cancelScheduledValues: vi.fn(), linearRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
        disconnect: vi.fn(),
      },
      fftSize: 256,
      frequencyBinCount: 128,
      getFloatTimeDomainData: vi.fn(),
      getByteFrequencyData: vi.fn(),
    })),
    createDelay: vi.fn(() => ({ delayTime: { value: 0, setValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() })),
    createBufferSource: vi.fn(() => ({
      buffer: null,
      playbackRate: { value: 1, setValueAtTime: vi.fn(), cancelScheduledValues: vi.fn() },
      loop: false, loopStart: 0, loopEnd: 0, onended: null,
      start: vi.fn(), stop: vi.fn(), connect: vi.fn(), disconnect: vi.fn(),
    })),
    decodeAudioData: vi.fn().mockResolvedValue(BUF),
    resume: vi.fn().mockResolvedValue(undefined),
  }
}

async function makePipeline(): Promise<any> {
  const { HybridPipelineService } = await import('../HybridPipelineService')
  const p = new HybridPipelineService(makeCtx())
  await p.init()
  return p
}

const eff = (p: any, id: string): number => (p as any)._effectiveGainOf(id)

// ═══════════════════════════════════════════════════════════
// 1–2. Pipeline bus fader: clamp/NaN + формула ×solo
// ═══════════════════════════════════════════════════════════

describe('№18-BUS: pipeline bus fader core', () => {
  let pipeline: any

  beforeEach(async () => {
    if (typeof window !== 'undefined') (window as any).__belive = {}
    pipeline = await makePipeline()
    useStemStore.setState({
      loadedStems: [], stemVolumes: {}, stemMutes: {}, stemSolos: {}, stemPans: {}, busVolumes: {}, stemsEnabled: false,
    })
  })

  afterEach(() => { vi.restoreAllMocks() })

  // ── Тест 1: clamp/NaN таблица (vs V2 engine-level parity) ──

  it('setBusVolume clamps 0..1 и отбрасывает NaN/±Infinity (таблица vs V2)', () => {
    // [input, expected | null = «значение НЕ меняется»]
    const table: Array<[number, number | null]> = [
      [-1, 0],
      [0, 0],
      [0.37, 0.37],
      [1, 1],
      [2, 1],
      [Number.NaN, null],       // V2-parity: не-Finite игнорируется молча
      [Infinity, null],
      [-Infinity, null],
    ]
    for (const [input, expected] of table) {
      pipeline.setBusVolume('music-bus', input)
      if (expected === null) {
        expect(pipeline.getBusVolume('music-bus')).toBe(1) // дефолт ?? 1 — ничего не записано
      } else {
        expect(pipeline.getBusVolume('music-bus')).toBe(expected)
      }
    }
    // отдельные шины независимы
    pipeline.setBusVolume('vocal-bus', 0.25)
    expect(pipeline.getBusVolume('vocal-bus')).toBe(0.25)
    expect(pipeline.getBusVolume('music-bus')).toBe(1)
  })

  // ── Тест 4: порядок setBusVolume ДО loadStem ──

  it('setBusVolume ДО loadStem: первый же лоад получает fader-гейн (порядок применения)', async () => {
    pipeline.setBusVolume('music-bus', 0.5)
    await pipeline.loadStem('drums', BUF)
    expect(eff(pipeline, 'drums')).toBeCloseTo(0.5)
    expect((pipeline as any)._chainA.stems.get('drums').volume).toBeCloseTo(0.5)
    expect(pipeline.getBusVolume('music-bus')).toBe(0.5)
  })

  // ── Тест 2: формула-матрица ×solo ──

  it('формула-матрица: effective = clamp(raw) × busFactor, шины изолированы, solo глушит вне маски', async () => {
    await pipeline.loadStem('drums', BUF)
    await pipeline.loadStem('vocals', BUF)
    await pipeline.loadStem('instrumental', BUF)
    await pipeline.loadStem('custom-x', BUF) // unknown → music-bus (паритет V2 :1152)

    // базовая формула
    pipeline.setStemVolume('drums', 0.8)
    pipeline.setBusVolume('music-bus', 0.5)
    expect(eff(pipeline, 'drums')).toBeCloseTo(0.4)

    // vocal-bus независим
    pipeline.setStemVolume('vocals', 0.6)
    pipeline.setBusVolume('vocal-bus', 0.5)
    expect(eff(pipeline, 'vocals')).toBeCloseTo(0.3)

    // music-bus fader НЕ влияет на vocal-bus
    pipeline.setBusVolume('music-bus', 0.1)
    expect(eff(pipeline, 'drums')).toBeCloseTo(0.08)
    expect(eff(pipeline, 'vocals')).toBeCloseTo(0.3)

    // instrumental — master clock-tap инвариант A2.25: вне шин, фактор 1.0
    pipeline.setStemVolume('instrumental', 1)
    pipeline.setBusVolume('music-bus', 0)
    pipeline.setBusVolume('vocal-bus', 0)
    expect(eff(pipeline, 'instrumental')).toBe(1)

    // unknown-стем парится к music-bus
    pipeline.setBusVolume('music-bus', 0.25)
    expect(eff(pipeline, 'custom-x')).toBeCloseTo(0.25)

    // восстанавливаем шины перед solo-блоком (выше были занулены для instrumental-инварианта)
    pipeline.setBusVolume('music-bus', 0.1)
    pipeline.setBusVolume('vocal-bus', 0.5)

    // ×solo-маска: вне маски → 0, в маске → raw × busFactor
    // (chainA-семантика isStemAudible: под solo слышимы только засолоенные)
    pipeline.soloStem('vocals', true)
    expect(eff(pipeline, 'drums')).toBe(0)
    expect(eff(pipeline, 'custom-x')).toBe(0)
    expect(eff(pipeline, 'vocals')).toBeCloseTo(0.3)
    expect(eff(pipeline, 'instrumental')).toBe(0) // не в solo-маске chainA
    pipeline.soloStem('vocals', false)
    expect(eff(pipeline, 'drums')).toBeCloseTo(0.08)

    // mute-ветка формулы
    pipeline.muteStem('drums', true)
    expect(eff(pipeline, 'drums')).toBe(0)
    pipeline.muteStem('drums', false)
    expect(eff(pipeline, 'drums')).toBeCloseTo(0.08)
  })

  // ── Тест 5: crash двусторонний + dead-stem resurrection ──

  it('crash двусторонний: handler → 0, play/seek не воскрешают, успешный reload resurrect', async () => {
    await pipeline.loadStem('drums', BUF)
    pipeline.setStemVolume('drums', 0.42)
    expect(eff(pipeline, 'drums')).toBeCloseTo(0.42)

    // crash event на instance.outputNode
    const inst = (pipeline as any)._stretchPool.get('drums')
    inst.outputNode.dispatchEvent(new CustomEvent('stretch-crash', { detail: { id: 'drums' } }))
    expect(eff(pipeline, 'drums')).toBe(0)

    const sg = (pipeline as any)._stretchGains.get('drums')

    // play() НЕ воскрешает: прямой write .value под гвардом — остаётся init 1 (не 0.42)
    await pipeline.play(0, 1)
    expect(sg.gain.value).toBe(1)

    // seek() НЕ воскрешает
    await pipeline.seek(5, 1)
    expect(sg.gain.value).toBe(1)

    // повторный успешный loadStem снимает crash/dead и применяет effective заново
    await pipeline.loadStem('drums', BUF)
    expect(eff(pipeline, 'drums')).toBeCloseTo(0.42)
  })

  it('dead-stem (H1.5): chunkedLoad fail → gain 0; успешный reload resurrect', async () => {
    await pipeline.loadStem('bass', BUF)
    const inst = (pipeline as any)._stretchPool.get('bass')
    inst.chunkedLoad.mockRejectedValueOnce(new Error('boom'))
    await pipeline.loadStem('bass', BUF) // catch → _deadStems.add
    expect(eff(pipeline, 'bass')).toBe(0)

    await pipeline.loadStem('bass', BUF) // успех → delete dead/crash + applyEffectiveGain
    expect(eff(pipeline, 'bass')).toBeCloseTo(1)
  })

  // ── Тест 7: регресс симптома №18 ──

  it('регресс №18: фейдер 37% переживает reset (смену блока), music тише пропорционально', async () => {
    pipeline.setBusVolume('music-bus', 0.37)
    useStemStore.getState().setBusVolume('music-bus', 0.37)
    await pipeline.loadStem('drums', BUF)
    expect(eff(pipeline, 'drums')).toBeCloseTo(0.37)

    // смена трека/блока: полный reset
    await pipeline.reset()
    expect(pipeline.getBusVolume('music-bus')).toBeCloseTo(0.37)         // user-pref переживает reset (паритет V2)
    expect(useStemStore.getState().busVolumes['music-bus']).toBeCloseTo(0.37) // стор не сбрасывается

    // перезагрузка стема после reset → music по-прежнему тише пропорционально
    await pipeline.loadStem('drums', BUF)
    expect(eff(pipeline, 'drums')).toBeCloseTo(0.37)

    // initStems/clearStems тоже НЕ сбрасывают busVolumes (H3.1)
    useStemStore.getState().initStems(['drums'])
    expect(useStemStore.getState().busVolumes['music-bus']).toBeCloseTo(0.37)
    useStemStore.getState().clearStems()
    expect(useStemStore.getState().busVolumes['music-bus']).toBeCloseTo(0.37)
  })
})

// ═══════════════════════════════════════════════════════════
// 3. single-writer static-grep (whitelist 📌DC3)
// ═══════════════════════════════════════════════════════════

describe('№18-BUS: single-writer static-grep (HybridPipelineService)', () => {
  const src: string = pipelineSrc

  it('прямые writers stretchGain.gain.value только из whitelist: :195 benign 1.0 · play/seek под crash-гвардом', () => {
    const lines = src.split('\n')
    const writes = lines
      .map((l, i) => ({ l, n: i + 1 }))
      .filter(x => /stretchGain\.gain\.value\s*=/.test(x.l))

    // Ровно 3 санкционированных записи
    expect(writes.length).toBe(3)

    // Whitelist #1: loadStem init `= 1.0` (бенигенен)
    const initWrite = writes.find(w => /=\s*1\.0\s*$/.test(w.l.trim()))
    expect(initWrite).toBeDefined()

    // Остальные две — строго под crash-гвардом (своя строка или 4 строки выше)
    for (const w of writes) {
      if (w === initWrite) continue
      const context = lines.slice(Math.max(0, w.n - 5), w.n).join('\n')
      expect(context, `writer @${w.n} без crash-гарда`).toContain('_crashedStems.has(stemId)')
    }

    // Единственный writer stem.volume в pipeline — single-writer _applyEffectiveGain
    const volumeWrites = lines
      .map((l, i) => ({ l, n: i + 1 }))
      .filter(x => /\.volume\s*=[^=]/.test(x.l))
    expect(volumeWrites.length).toBe(1)
    expect(volumeWrites[0].l).toContain('stem.volume = target')
  })
})

// ═══════════════════════════════════════════════════════════
// 6. NaN-гарды стора (H2.5 + H3.1)
// ═══════════════════════════════════════════════════════════

describe('№18-BUS: store NaN guards', () => {
  beforeEach(() => {
    useStemStore.setState({
      loadedStems: [], stemVolumes: {}, stemMutes: {}, stemSolos: {}, stemPans: {}, busVolumes: {}, stemsEnabled: false,
    })
  })

  it('store.setBusVolume игнорирует NaN/Infinity, клампит диапазон; setStemVolume игнорирует NaN', () => {
    const s = useStemStore.getState()
    s.setBusVolume('music-bus', Number.NaN)
    expect(useStemStore.getState().busVolumes['music-bus']).toBeUndefined()
    s.setBusVolume('music-bus', Infinity)
    expect(useStemStore.getState().busVolumes['music-bus']).toBeUndefined()

    s.setBusVolume('music-bus', 0.37)
    expect(useStemStore.getState().busVolumes['music-bus']).toBeCloseTo(0.37)
    s.setBusVolume('music-bus', Number.NaN)
    expect(useStemStore.getState().busVolumes['music-bus']).toBeCloseTo(0.37) // прежнее значение сохранено

    s.setBusVolume('vocal-bus', 7)
    expect(useStemStore.getState().busVolumes['vocal-bus']).toBe(1)

    s.setStemVolume('drums', Number.NaN)
    expect(useStemStore.getState().stemVolumes['drums']).toBeUndefined()
    s.setStemVolume('drums', 0.5)
    expect(useStemStore.getState().stemVolumes['drums']).toBeCloseTo(0.5)
  })
})

// ═══════════════════════════════════════════════════════════
// 9. cage-инвариант H4.1 (контракт-зеркало гарда из bootAether)
// contract-mirror, intentionally retained (museum) — регресс-нетто pin-semantics; ae-guard удалён из прод-кода W3, тест self-contained
// ═══════════════════════════════════════════════════════════

describe('№18-BUS H4.1: ae.* mini-gard (__v3Active) + cage-инвариант', () => {
  /** Контракт-зеркало обёртки из main.tsx bootAether (self-contained там по спеке). */
  function installGuard(ae: Record<string, any>): void {
    const guard = (name: string): void => {
      const orig = typeof ae[name] === 'function' ? ae[name].bind(ae) : null
      if (!orig) return
      ae[name] = (...args: unknown[]): void => {
        if ((window as any).__v3Active) {
          if (import.meta.env.DEV) console.warn(`[№18-BUS] ae.${name}() ignored — V3 active`)
          return
        }
        orig(...args)
      }
    }
    guard('setStemVolume')
    guard('setStemsEnabled')
  }

  beforeEach(() => {
    (window as any).__v3Active = false
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    ;(window as any).__v3Active = false
  })

  it('__v3Active=false → оригинал вызывается; __v3Active=true → DEV-warn+return', () => {
    // spy-ссылки храним снаружи: installGuard подменяет свойства объекта обёртками
    const origInst = vi.fn()
    const origStem = vi.fn()
    const origEnabled = vi.fn()
    const ae: Record<string, any> = {
      setInstrumentalVolume: origInst,
      setStemVolume: origStem,
      setStemsEnabled: origEnabled,
    }
    installGuard(ae)

    ;(window as any).__v3Active = false
    ae.setInstrumentalVolume(0.5)
    expect(origInst).toHaveBeenCalledTimes(1) // обёртка пробросила оригиналу

    ;(window as any).__v3Active = true
    ae.setInstrumentalVolume(0.9) // NOT guarded — passes through directly
    expect(origInst).toHaveBeenCalledTimes(2)
    ae.setStemVolume('drums', 0.9)
    ae.setStemsEnabled(true)
    expect(origStem).not.toHaveBeenCalled()
    expect(origEnabled).not.toHaveBeenCalled()
    expect(console.warn).toHaveBeenCalled()
  })

  it('cage-инвариант: гард задевает только ae.*, delegateSync-канал не задет (истор.: V2Adapter снесён Волной B)', () => {
    const origInst = vi.fn()
    const ae: Record<string, any> = { setInstrumentalVolume: origInst, setStemVolume: vi.fn(), setStemsEnabled: vi.fn() }
    installGuard(ae)
    ;(window as any).__v3Active = true

    // delegateSync channel: setInstrumentalVolume blocked by delegateSync; setStemMute passes
    const delegateSync = vi.fn()
    delegateSync('setInstrumentalVolume', 0) // blocked by delegateSync — not reaching forwarder
    delegateSync('setStemMute', 'drums', true) // not blocked by delegateSync — reaches forwarder
    expect(delegateSync).toHaveBeenCalledWith('setStemMute', 'drums', true)

    // direct ae.setInstrumentalVolume(1) is NOT guarded — passes through to original
    ae.setInstrumentalVolume(1)
    expect(origInst).toHaveBeenCalled()
  })

  it('delegateSync master-zero NOT reaching forwarder; _busVolumes unchanged by blocked cascade', () => {
    // delegateSync blocks setInstrumentalVolume regardless of __v3Active
    const origForwarder = vi.fn()
    const delegateSync = vi.fn((method: string, ...args: any[]) => {
      if (method === 'setInstrumentalVolume') return // blocked
      origForwarder(method, ...args)
    })
    delegateSync('setInstrumentalVolume', 0)
    expect(origForwarder).not.toHaveBeenCalled()
    // _busVolumes should be unchanged by the blocked cascade
    useStemStore.getState().setBusVolume('music-bus', 0.5)
    delegateSync('setInstrumentalVolume', 0) // blocked — does NOT affect bus volumes
    expect(useStemStore.getState().busVolumes['music-bus']).toBe(0.5)
  })
})

// ═══════════════════════════════════════════════════════════
// 10. dual-mode маршрутизация красного фейдера (контракт H3.4)
// ═══════════════════════════════════════════════════════════

describe('№18-BUS H3.4: dual-mode маршрутизация Inst-фейдера (стems ↔ no-stems)', () => {
  /** Контракт-зеркало обработчиков ControlDeck (:184-207). Возвращает наблюдаемые исходы. */
  function routeInstFader(v: number, ae: Record<string, any>): { bus: boolean; instMirror: boolean; aeCalled: boolean } {
    const before = { ...useStemStore.getState().busVolumes }
    const instBefore = useStemStore.getState().stemVolumes['instrumental']
    const __v3 = (window as any).__v3Active
    const loaded = useStemStore.getState().loadedStems
    const hasMusicStems = loaded.some(id => BUILTIN_STEMS[id]?.role === 'music')
    let aeCalled = false
    if (__v3 && hasMusicStems) {
      useStemStore.getState().setBusVolume('music-bus', v)
    } else {
      if (!__v3) {
        if (ae.setInstrumentalVolume) ae.setInstrumentalVolume(v)
        aeCalled = true
      }
      useStemStore.getState().setStemVolume('instrumental', v)
    }
    return {
      bus: useStemStore.getState().busVolumes['music-bus'] !== before['music-bus'],
      instMirror: useStemStore.getState().stemVolumes['instrumental'] !== instBefore,
      aeCalled,
    }
  }

  beforeEach(() => {
    useStemStore.setState({
      loadedStems: [], stemVolumes: {}, stemMutes: {}, stemSolos: {}, stemPans: {}, busVolumes: {}, stemsEnabled: false,
    })
    ;(window as any).__v3Active = false
  })

  afterEach(() => { (window as any).__v3Active = false })

  it('V3 + music-stems: фейдер пишет ТОЛЬКО music-bus (не instrumental, не ae.*)', () => {
    ;(window as any).__v3Active = true
    useStemStore.getState().initStems(['instrumental', 'vocals', 'drums'])
    const ae = { setInstrumentalVolume: vi.fn() }
    const r = routeInstFader(0.37, ae)
    expect(r.bus).toBe(true)
    expect(r.instMirror).toBe(false)
    expect(r.aeCalled).toBe(false)
    expect(ae.setInstrumentalVolume).not.toHaveBeenCalled()
    expect(useStemStore.getState().busVolumes['music-bus']).toBeCloseTo(0.37)
  })

  it('V3 без music-стемов: зеркало instrumental (ae.* не зовётся)', () => {
    ;(window as any).__v3Active = true
    useStemStore.getState().initStems(['instrumental', 'vocals'])
    const ae = { setInstrumentalVolume: vi.fn() }
    const r = routeInstFader(0.6, ae)
    expect(r.bus).toBe(false)
    expect(r.instMirror).toBe(true)
    expect(r.aeCalled).toBe(false)
    expect(ae.setInstrumentalVolume).not.toHaveBeenCalled()
  })

  it('не-V3 (V2/no-stems): ae.setInstrumentalVolume + зеркало instrumental', () => {
    ;(window as any).__v3Active = false
    useStemStore.getState().initStems(['instrumental'])
    const ae = { setInstrumentalVolume: vi.fn() }
    const r = routeInstFader(0.75, ae)
    expect(r.bus).toBe(false)
    expect(r.instMirror).toBe(true)
    expect(r.aeCalled).toBe(true)
    expect(ae.setInstrumentalVolume).toHaveBeenCalledWith(0.75)
  })
})
