/**
 * audio-facade-v3.test.ts — ARC-2d S3: контракт аудио-фасада V3 (32 кейса; +9 /// В1 п.3 адаптеры 23-27c)
 *
 * Механика (прецедент BusFader18:22): ?raw-импорт исходника фасада → eval
 * через new Function в jsdom. Guard :81 (`if (!window.audioEngine)`) требует
 * delete window.audioEngine в beforeEach — иначе повторный eval молча не
 * переустанавливает фасад (кейс-22 ассертит сам этот инвариант).
 * Моки — plain objects (fakeTransport/fakePipeline/fakeAnalyser), никаких
 * реальных WebAudio-вызовов.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
// ?raw-импорт (типизирован vite/client; vite root='.' → ../../js/ валиден)
import facadeSrc from '../../js/audio-facade-v3.js?raw'

const fakeCtx = { sampleRate: 48000, currentTime: 0, state: 'running' }
const fakeAnalyser = { fftSize: 2048, getFloatTimeDomainData: vi.fn() }

function evalFacade(): void {
  // guard :81: без delete повторный eval молча не переустанавливает фасад
  delete (window as any).audioEngine
  ;(window as any).__belive = undefined
  new Function(facadeSrc)()
}

function mockBelive(): {
  transport: Record<string, unknown>
  pipeline: Record<string, unknown>
  monitorRouter: Record<string, unknown>
} {
  const transport = {
    play: vi.fn(() => Promise.resolve()),
    pause: vi.fn(() => Promise.resolve()),
    stop: vi.fn(),
    seek: vi.fn(),
    setPlaybackRate: vi.fn(),
    setLoop: vi.fn(),
    clearLoop: vi.fn(),
    playbackRate: 1.25,
    currentTime: 10.5,
  }
  const pipeline = {
    ctx: fakeCtx,
    setStemVolume: vi.fn(),
    setStemMuted: vi.fn(),
    soloStem: vi.fn(),
    getStemMeterLevel: vi.fn(() => 0.5),
    getStemAnalyser: vi.fn(() => fakeAnalyser),
  }
  const monitorRouter = { attachProgramSource: vi.fn() }
  ;(window as any).__belive = { transport, pipeline, monitorRouter, currentTime: 9.9 }
  return { transport, pipeline, monitorRouter }
}

const ae = () => (window as any).audioEngine

beforeEach(() => {
  evalFacade()
})

describe('ARC-2d: audio-facade-v3 contract (transport routing)', () => {
  it('1. play(offset) делегирует transport.play и возвращает resolved Promise', async () => {
    const { transport } = mockBelive()
    const p = ae().play(5)
    expect(transport.play).toHaveBeenCalledWith(5)
    await expect(p).resolves.toBeUndefined()
  })

  it('2. pause() делегирует transport.pause, возвращает resolved Promise', async () => {
    const { transport } = mockBelive()
    const p = ae().pause()
    expect(transport.pause).toHaveBeenCalled()
    await expect(p).resolves.toBeUndefined()
  })

  it('3. stop() делегирует transport.stop', () => {
    const { transport } = mockBelive()
    ae().stop()
    expect(transport.stop).toHaveBeenCalled()
  })

  it('4. seek-пара: seekTo(t) и setCurrentTime(t) — оба → transport.seek(t) (alias)', () => {
    const { transport } = mockBelive()
    ae().seekTo(42)
    ae().setCurrentTime(42)
    expect(transport.seek).toHaveBeenCalledWith(42)
    expect(transport.seek).toHaveBeenCalledTimes(2)
  })

  it('5. setPlaybackRate(r) делегирует transport.setPlaybackRate', () => {
    const { transport } = mockBelive()
    ae().setPlaybackRate(0.85)
    expect(transport.setPlaybackRate).toHaveBeenCalledWith(0.85)
  })

  it('6. rate-пара: getPlaybackRate() и свойство playbackRate → transport.playbackRate', () => {
    mockBelive()
    expect(ae().getPlaybackRate()).toBe(1.25)
    expect(ae().playbackRate).toBe(1.25)
  })

  it('7. свойство audioContext → строго pipeline.ctx (identity)', () => {
    mockBelive()
    expect(ae().audioContext).toBe(fakeCtx)
  })

  it('8. null-гейты «пустой мир» (без __belive): audioContext→null, playbackRate→1, getPlaybackRate→1, meter→0, analyser→null, captureStream→null', () => {
    // __belive уже undefined из beforeEach
    expect(ae().audioContext).toBe(null)
    expect(ae().playbackRate).toBe(1)
    expect(ae().getPlaybackRate()).toBe(1)
    expect(ae().getStemMeterLevel('x')).toBe(0)
    expect(ae().getStemAnalyser('x')).toBe(null)
    expect(ae().getProgramCaptureStream()).toBe(null)
  })

  it('9. setStemVolume(id, v) делегирует pipeline.setStemVolume', () => {
    const { pipeline } = mockBelive()
    ae().setStemVolume('drums', 0.3)
    expect(pipeline.setStemVolume).toHaveBeenCalledWith('drums', 0.3)
  })

  it('10. имя-мэппинг: setStemMute(id, m) → pipeline.setStemMuted (НЕ setStemMute)', () => {
    const { pipeline } = mockBelive()
    ae().setStemMute('drums', true)
    expect(pipeline.setStemMuted).toHaveBeenCalledWith('drums', true)
  })

  it('11. имя-мэппинг: setStemSolo(id, s) → pipeline.soloStem (НЕ setStemSolo)', () => {
    const { pipeline } = mockBelive()
    ae().setStemSolo('drums', false)
    expect(pipeline.soloStem).toHaveBeenCalledWith('drums', false)
  })

  it('12. шины-прокси: setInstrumentalVolume/setVocalsVolume → setStemVolume("instrumental"/"vocals", v)', () => {
    const { pipeline } = mockBelive()
    ae().setInstrumentalVolume(0.4)
    ae().setVocalsVolume(0.6)
    expect(pipeline.setStemVolume).toHaveBeenCalledWith('instrumental', 0.4)
    expect(pipeline.setStemVolume).toHaveBeenCalledWith('vocals', 0.6)
  })

  it('13. getStemMeterLevel(id) → pipeline.getStemMeterLevel (0.5)', () => {
    mockBelive()
    expect(ae().getStemMeterLevel('drums')).toBe(0.5)
  })

  it('14. getStemAnalyser(id) → fakeAnalyser (identity)', () => {
    mockBelive()
    expect(ae().getStemAnalyser('drums')).toBe(fakeAnalyser)
  })

  it('15. getCurrentTime-приоритет: transport.currentTime (10.5) побеждает кэш (9.9)', () => {
    mockBelive()
    expect(ae().getCurrentTime()).toBe(10.5)
  })

  it('16. getCurrentTime-fallback: без transport → кэш 9.9; без __belive вовсе → 0', () => {
    mockBelive()
    delete (window as any).__belive.transport
    expect(ae().getCurrentTime()).toBe(9.9)
    ;(window as any).__belive = undefined
    expect(ae().getCurrentTime()).toBe(0)
  })

  it('17. setLoop(s, e) → true + transport.setLoop(s, e)', () => {
    const { transport } = mockBelive()
    const r = ae().setLoop(1, 2)
    expect(r).toBe(true)
    expect(transport.setLoop).toHaveBeenCalledWith(1, 2)
  })

  it('18. clearLoop() → true + transport.clearLoop()', () => {
    const { transport } = mockBelive()
    const r = ae().clearLoop()
    expect(r).toBe(true)
    expect(transport.clearLoop).toHaveBeenCalled()
  })

  it('19. hijack-resolve-контракт: без __belive play()/pause() → resolved Promise (НЕ reject)', async () => {
    // __belive уже undefined из beforeEach
    const p1 = ae().play()
    const p2 = ae().pause()
    expect(typeof p1).toBe('object')
    expect(typeof p1.then).toBe('function')
    await expect(p1).resolves.toBeUndefined()
    await expect(p2).resolves.toBeUndefined()
  })

  it('20. attachProgramSource(node, {kind}) → monitorRouter.attachProgramSource (таке-превью в program-capture)', () => {
    const { monitorRouter } = mockBelive()
    const gain = { connect: vi.fn() }
    ae().attachProgramSource(gain, { kind: 'preview' })
    expect(monitorRouter.attachProgramSource).toHaveBeenCalledWith(gain, { kind: 'preview' })
  })

  it('21. пустышек нет: retired members отсутствуют на объекте (G-5; В1 п.3d ratchet-амендация: detachProgramSource выписан из пустышек — стал живым адаптером)', () => {
    for (const m of ['enableVocalMix','disableVocalMix','setStemsEnabled','setStemPan','setStemsMode','disableMicrophone','ensureInstrumentalBuffer']) {
      expect(ae()[m]).toBeUndefined()
    }
    // В1 п.3d: добавили симметричный detach — объект фасада больше НЕ пустышка по нему
    expect(typeof ae().detachProgramSource).toBe('function')
  })

  it('21b. setMicrophoneVolume живой: маршрутизирует в monitorRouter.setMicVolume (006 D-0c-fix)', () => {
    const spy = vi.fn()
    mockBelive()
    ;(window as any).__belive.monitorRouter = { setMicVolume: spy }
    ae().setMicrophoneVolume(0.2)
    expect(spy).toHaveBeenCalledWith(0.2)
  })

  // ── В1 п.3: фасад-адаптеры (6 шт) ─────────────────────────────────────────

  it('23. isPlaying/duration-адаптеры: источник transport.state / transport.duration', () => {
    const { transport } = mockBelive()
    ;(transport as any).state = 'playing'
    ;(transport as any).duration = 173.4
    expect(ae().isPlaying).toBe(true)
    expect(ae().duration).toBe(173.4)
    ;(transport as any).state = 'paused'
    expect(ae().isPlaying).toBe(false)
  })

  it('23b. isPlaying/duration fallback без транспорта: false / 0', () => {
    mockBelive()
    delete (window as any).__belive.transport
    expect(ae().isPlaying).toBe(false)
    expect(ae().duration).toBe(0)
  })

  it('24. stems → liveStems: pipeline.liveStems (п.1 геттер) с has()-семантикой без dead', () => {
    const { pipeline } = mockBelive()
    ;(pipeline as any).liveStems = ['drums', 'vocals', 'bass']
    expect(ae().liveStems).toEqual(['drums', 'vocals', 'bass'])
    expect(ae().stems.has('drums')).toBe(true)
    expect(ae().stems.has('guitar')).toBe(false)
  })

  it('24b. liveStems без pipeline → [] / has() → false', () => {
    mockBelive()
    delete (window as any).__belive.pipeline
    expect(ae().liveStems).toEqual([])
    expect(ae().stems.has('vocals')).toBe(false)
  })

  it('25. setVMix(on) → monitorRouter.setVMix (унификация enable/disableVocalMix)', () => {
    const spy = vi.fn()
    mockBelive()
    ;(window as any).__belive.monitorRouter = { setVMix: spy }
    ae().setVMix(true)
    ae().setVMix(false)
    expect(spy).toHaveBeenNthCalledWith(1, true)
    expect(spy).toHaveBeenNthCalledWith(2, false)
  })

  it('26. detachProgramSource(node) → monitorRouter.detachProgramSource (симметрично attach :20)', () => {
    const spy = vi.fn()
    mockBelive()
    ;(window as any).__belive.monitorRouter = { detachProgramSource: spy }
    const gain = { disconnect: vi.fn() }
    ae().detachProgramSource(gain)
    expect(spy).toHaveBeenCalledWith(gain)
  })

  it('27. loadAdditionalStems: decode → pipeline.loadStem (on-demand путь QuickActions/MixerPanel)', async () => {
    const loadStem = vi.fn((_id: string, _buf: unknown) => Promise.resolve())
    const pipeline = {
      ctx: { ...fakeCtx, decodeAudioData: vi.fn(async () => ({ duration: 4 })) },
      loadStem,
    }
    ;(window as any).__belive = { pipeline, transport: null, monitorRouter: null, currentTime: 0 }

    const r = await ae().loadAdditionalStems({ drums: { data: new ArrayBuffer(8), type: 'audio/mpeg' } })

    expect(loadStem).toHaveBeenCalledTimes(1)
    expect(loadStem.mock.calls[0][0]).toBe('drums')
    expect(r).toEqual(['drums'])
  })

  it('27b. loadAdditionalStems: уже-живой стем (liveStems) не пушит буфер дважды (дедуп HPS:713-715)', async () => {
    const loadStem = vi.fn(() => Promise.resolve())
    const pipeline = {
      liveStems: ['drums'],
      ctx: { ...fakeCtx, decodeAudioData: vi.fn(async () => ({ duration: 4 })) },
      loadStem,
    }
    ;(window as any).__belive = { pipeline, transport: null, monitorRouter: null, currentTime: 0 }

    const r = await ae().loadAdditionalStems({ drums: { data: new ArrayBuffer(8), type: 'audio/mpeg' } })

    expect(loadStem).not.toHaveBeenCalled()
    expect(r).toEqual([])
  })

  it('27c. loadAdditionalStems: generation-гард — устаревшая генерация не пушит свой decode', async () => {
    let resolveDrums!: (b: unknown) => void
    const loadStem = vi.fn((_id: string, _buf: unknown) => Promise.resolve())
    const pipeline = {
      liveStems: [],
      ctx: {
        ...fakeCtx,
        decodeAudioData: vi.fn()
          .mockImplementationOnce(() => new Promise((r) => { resolveDrums = r })) // drums — медленный decode
          .mockImplementationOnce(async () => ({ duration: 7 })),                // bass — быстрый
      },
      loadStem,
    }
    ;(window as any).__belive = { pipeline, transport: null, monitorRouter: null, currentTime: 0 }

    const p1 = ae().loadAdditionalStems({ drums: { data: new ArrayBuffer(8) } })
    const p2 = ae().loadAdditionalStems({ bass: { data: new ArrayBuffer(8) } })
    const r2 = await p2 // вторая генерация — текущая
    expect(loadStem).toHaveBeenCalledTimes(1)
    expect(loadStem.mock.calls[0][0]).toBe('bass')

    resolveDrums({ duration: 3 }) // первая генерация устарела
    const r1 = await p1
    expect(r1).toEqual([])
    expect(loadStem).toHaveBeenCalledTimes(1) // drums отброшен как stale
    expect(r2).toEqual(['bass'])
  })

  it('22. hijack-инвариант guard :81: занятый window.audioEngine НЕ затирается повторным eval; delete → свежий экземпляр', () => {
    // pre-patch: подменяем audioEngine «чужим» объектом (симуляция hijack) и пере-eval'им
    const patched = { marker: 'patched', getCurrentTime: () => 777 }
    ;(window as any).audioEngine = patched
    new Function(facadeSrc)()
    expect((window as any).audioEngine).toBe(patched) // guard :81 сохранил
    // симметрично: delete → eval → свежий экземпляр
    const oldRef = (window as any).audioEngine.getCurrentTime
    delete (window as any).audioEngine
    new Function(facadeSrc)()
    expect((window as any).audioEngine).not.toBe(patched)
    expect((window as any).audioEngine.getCurrentTime).not.toBe(oldRef)
  })
})
