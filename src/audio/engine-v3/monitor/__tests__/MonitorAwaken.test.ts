// B04 batch-1 · MonitorAwaken — регресс P0 `.stream`-бага + in-flight + restore + гейт тапа.
// RED-доказательство: на коде до батча кейсы 1-2 падают (srcObject=нода; 2 элемента),
// кейсы 3-5 падают отсутствием API (ensureMainPlaying/setLocalTapEnabled/restore).
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { MonitorRouter } from '../MonitorRouter'
import { MonitorEngine } from '../MonitorEngine'
import { DeviceManager } from '../DeviceManager'

// ── Мок-стенд ──
interface MockGain {
  gain: { value: number; setValueAtTime: Mock; cancelScheduledValues: Mock; linearRampToValueAtTime: Mock; setTargetAtTime: Mock }
  connect: Mock
  context: { currentTime: number }
}
function makeGain(gains: MockGain[]): MockGain {
  const g: MockGain = {
    gain: { value: 1, setValueAtTime: vi.fn(), cancelScheduledValues: vi.fn(), linearRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn() },
    connect: vi.fn(),
    context: { currentTime: 0 },
  }
  gains.push(g)
  return g
}
function makeCtx(gains: MockGain[]) {
  return {
    createGain: vi.fn(() => makeGain(gains)),
    createDelay: vi.fn(() => ({ delayTime: { value: 0 }, connect: vi.fn() })),
    createMediaStreamDestination: vi.fn(() => ({ stream: { getAudioTracks: () => [{}] } })),
    createChannelMerger: vi.fn(() => ({ connect: vi.fn() })),
    destination: {},
    currentTime: 0,
    state: 'running' as AudioContextState,
    resume: vi.fn().mockResolvedValue(undefined),
  } as unknown as AudioContext
}
let playMock: Mock
let sinkMock: Mock
beforeEach(() => {
  playMock = vi.fn().mockResolvedValue(undefined)
  sinkMock = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { value: playMock, writable: true, configurable: true })
  Object.defineProperty(HTMLMediaElement.prototype, 'setSinkId', { value: sinkMock, writable: true, configurable: true })
  localStorage.clear()
})
afterEach(() => {
  document.body.innerHTML = ''
  localStorage.clear()
  vi.restoreAllMocks()
  Reflect.deleteProperty(HTMLMediaElement.prototype, 'setSinkId')
})
function boot() {
  const gains: MockGain[] = []
  const ctx = makeCtx(gains)
  const router = new MonitorRouter(ctx)
  const dm = new DeviceManager(
    router.monitorStream as unknown as MediaStreamAudioDestinationNode,
    router.mainStream as unknown as MediaStreamAudioDestinationNode,
  )
  return { gains, ctx, router, dm }
}

describe('MonitorAwaken · batch-1', () => {
  it('К-1: el.srcObject === stream (P0 `.stream`-баг)', async () => {
    const { router, dm } = boot()
    const ok = await dm.setOutputDevice('spk1', 'monitor')
    expect(ok).toBe(true)
    const el = document.querySelector('audio')
    expect(el).not.toBeNull()
    expect(el!.srcObject).toBe((router.monitorStream as unknown as { stream: unknown }).stream)
    expect(sinkMock).toHaveBeenCalledWith('spk1')
  })
  it('К-2: 2 конкурентных ensure → 1 элемент (in-flight)', async () => {
    const { dm } = boot()
    const [a, b] = await Promise.all([dm.ensureMonitorPlaying(), dm.ensureMonitorPlaying()])
    expect(a).toBe(b)
    expect(document.querySelectorAll('audio').length).toBe(1)
  })
  it('К-3: restore sinkId из localStorage', async () => {
    localStorage.setItem('monitor:deviceId', 'bt99')
    const { dm } = boot()
    const sink = await dm.ensureMonitorPlaying()
    expect(sink).toBe('bt99')
    expect(sinkMock).toHaveBeenCalledWith('bt99')
  })
  it('К-4: restore NotFoundError → "" без падения', async () => {
    localStorage.setItem('monitor:deviceId', 'dead-id')
    sinkMock.mockRejectedValueOnce(new Error('NotFoundError'))
    const { dm } = boot()
    const sink = await dm.ensureMonitorPlaying()
    expect(sink).toBe('')
  })
  it('К-5: retry play() на том же элементе', async () => {
    playMock.mockRejectedValueOnce(new Error('NotAllowedError'))
    const { dm } = boot()
    await dm.ensureMonitorPlaying()
    await dm.ensureMonitorPlaying()
    expect(playMock).toHaveBeenCalledTimes(2)
    expect(document.querySelectorAll('audio').length).toBe(1)
  })
  it('К-6: гейт тапа (дефолт ON → setLocalTapEnabled OFF/ON)', () => {
    const { gains, router } = boot()
    const tap = gains[6]
    expect(tap.gain.value).toBe(1)
    router.setLocalTapEnabled(false)
    expect(tap.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, expect.any(Number))
    router.setLocalTapEnabled(true)
    expect(tap.gain.linearRampToValueAtTime).toHaveBeenCalledWith(1, expect.any(Number))
  })
  it('К-7: enable() wires sink→_state (интеграция)', async () => {
    const { router, dm } = boot()
    const engine = new MonitorEngine()
    const ctx2 = makeCtx([])
    engine.setBackend(router, ctx2, dm)
    engine.setBackendMode('v3')
    localStorage.setItem('monitor:deviceId', 'bt7')
    localStorage.setItem('monitor:mainDeviceId', 'spk7')
    const seen: string[] = []
    document.addEventListener('monitor-state-changed', () => seen.push('x'), { once: true })
    await engine.enable({ skipMic: true })
    expect(engine.getState().enabled).toBe(true)
    expect(engine.getState().outputDeviceId).toBe('bt7')
    expect(engine.getState().mainDeviceId).toBe('spk7')
    expect(seen.length).toBe(1)
  })
})
