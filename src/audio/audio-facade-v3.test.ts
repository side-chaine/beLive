/**
 * audio-facade-v3.test.ts — ARC-2d S3: контракт аудио-фасада V3 (22 кейса)
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

  it('21. пустышек нет: retired members отсутствуют на объекте (G-5)', () => {
    for (const m of ['enableVocalMix','disableVocalMix','setStemsEnabled','setStemPan','setStemsMode','detachProgramSource','disableMicrophone','ensureInstrumentalBuffer']) {
      expect(ae()[m]).toBeUndefined()
    }
  })

  it('21b. setMicrophoneVolume живой: маршрутизирует в monitorRouter.setMicVolume (006 D-0c-fix)', () => {
    const spy = vi.fn()
    mockBelive()
    ;(window as any).__belive.monitorRouter = { setMicVolume: spy }
    ae().setMicrophoneVolume(0.2)
    expect(spy).toHaveBeenCalledWith(0.2)
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
