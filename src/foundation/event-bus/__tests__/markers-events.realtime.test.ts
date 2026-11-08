import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { initMarkersEvents } from '../wrappers/markers-events'
import { eventBus } from '../event-bus'
import { EventBusChannel } from '../types'
import { useMarkersStore } from '../../../stores/markers.store'
import { useLyricsStore } from '../../../stores/lyrics.store'

const MM_EVENTS = ['markerAdded', 'markerUpdated', 'markerDeleted', 'markersReset'] as const

interface FakeMM {
  markers: any[]
  sections: any[]
  trackDuration: number
  subscribers: Record<string, Array<(data: any) => void>>
  subscribe?: (event: string, callback: (data: any) => void) => () => void
  _notifySubscribers: (event: string, data: any) => void
  setMarkers: (markers: any[]) => void
}

// Контракт js/marker-manager.js:19-24 — subscribers = 4 массива.
// Фабрика стартует БЕЗ subscribe (прод: патч появляется только в DOMContentLoaded).
function makeFakeMM(): FakeMM {
  const mm: FakeMM = {
    markers: [],
    sections: [],
    trackDuration: 0,
    subscribers: {
      markerAdded: [],
      markerUpdated: [],
      markerDeleted: [],
      markersReset: [],
    },
    _notifySubscribers(event, data) {
      ;(mm.subscribers[event] || []).forEach((cb) => cb(data))
    },
    setMarkers(markers) {
      mm.markers = markers
    },
  }
  return mm
}

// Контракт main.tsx:446-455 — subscribe возвращает unsub-фильтр (НЕ Subscription).
function patchSubscribe(mm: FakeMM): void {
  mm.subscribe = (event: string, callback: (data: any) => void): (() => void) => {
    if (!mm.subscribers[event]) {
      console.error('Invalid event type:', event)
      return () => {}
    }
    mm.subscribers[event].push(callback)
    return () => {
      mm.subscribers[event] = mm.subscribers[event].filter((cb: any) => cb !== callback)
    }
  }
}

function m1(lineIndex: number, time: number, id = `m1-${lineIndex}-${time}`) {
  return { id, lineIndex, time, text: `line-${lineIndex}`, markerType: 'M1' as const }
}

function m2(time: number, id = `m2-${time}`) {
  return { id, lineIndex: -1, time, text: '', markerType: 'M2' as const }
}

function counts(mm: FakeMM): number[] {
  return MM_EVENTS.map((ev) => mm.subscribers[ev].length)
}

let cleanup: (() => void) | null = null

beforeEach(() => {
  vi.useFakeTimers()
  cleanup = null
  useMarkersStore.setState({ markers: [], sections: [], trackDuration: 0 })
  // lyricsReady=true обязателен: FOUC-gate в lyrics.store при false стирает lines и арм-ит watchdog.
  useLyricsStore.setState({ lines: ['a', 'b'], lyricsReady: true })
  ;(window as any).audioEngine = { awaitStemReady: () => Promise.resolve() }
})

afterEach(() => {
  vi.useRealTimers()
  if (cleanup) {cleanup()}
  cleanup = null
  delete (window as any).markerManager
  delete (window as any).audioEngine
  vi.restoreAllMocks()
})

describe('markers-events realtime bind (B08)', () => {
  it('1. bind-all-four: немедленный bind, без дублей, таймеры сняты', () => {
    const mm = makeFakeMM()
    patchSubscribe(mm)
    ;(window as any).markerManager = mm

    cleanup = initMarkersEvents()

    expect(counts(mm)).toEqual([1, 1, 1, 1])
    vi.advanceTimersByTime(1000)
    expect(counts(mm)).toEqual([1, 1, 1, 1])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('2. retry-late-patch: bind появляется после DOMContentLoaded-патча', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const mm = makeFakeMM()
    ;(window as any).markerManager = mm

    cleanup = initMarkersEvents()

    vi.advanceTimersByTime(250)
    expect(counts(mm)).toEqual([0, 0, 0, 0])
    expect(err).not.toHaveBeenCalled()

    patchSubscribe(mm)
    vi.advanceTimersByTime(100)

    expect(counts(mm)).toEqual([1, 1, 1, 1])
    expect(err).not.toHaveBeenCalled()
  })

  it('3. deadline: ровно один console.error с B08, retry остановлен', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const mm = makeFakeMM()
    ;(window as any).markerManager = mm

    cleanup = initMarkersEvents()

    vi.advanceTimersByTime(5000)
    expect(err).toHaveBeenCalledTimes(1)
    expect(String(err.mock.calls[0][0])).toContain('B08')

    vi.advanceTimersByTime(5000)
    expect(err).toHaveBeenCalledTimes(1)
  })

  it('4. markerAdded parity: store получает lineIndex/time', () => {
    const mm = makeFakeMM()
    patchSubscribe(mm)
    ;(window as any).markerManager = mm

    cleanup = initMarkersEvents()

    const marker = m1(0, 3.5)
    mm.markers.push(marker)
    mm._notifySubscribers('markerAdded', marker)

    const stored = useMarkersStore.getState().markers
    expect(stored).toHaveLength(1)
    expect(stored[0].lineIndex).toBe(0)
    expect(stored[0].time).toBe(3.5)
  })

  it('5. markerUpdated + markerDeleted: store следует за mm.markers', () => {
    const mm = makeFakeMM()
    patchSubscribe(mm)
    ;(window as any).markerManager = mm

    cleanup = initMarkersEvents()

    const marker = m1(0, 1)
    mm.markers.push(marker)
    mm._notifySubscribers('markerAdded', marker)

    mm.markers[0].time = 2
    mm._notifySubscribers('markerUpdated', mm.markers[0])
    expect(useMarkersStore.getState().markers[0].time).toBe(2)

    mm.markers.splice(0, 1)
    mm._notifySubscribers('markerDeleted', marker)
    expect(useMarkersStore.getState().markers).toHaveLength(0)
  })

  it('6. gap-sync: маркер, созданный до bind, попадает в store без notify', () => {
    const mm = makeFakeMM()
    ;(window as any).markerManager = mm

    cleanup = initMarkersEvents()

    const early = m1(1, 7)
    mm.markers.push(early)

    patchSubscribe(mm)
    vi.advanceTimersByTime(100)

    expect(counts(mm)).toEqual([1, 1, 1, 1])
    const stored = useMarkersStore.getState().markers
    expect(stored).toHaveLength(1)
    expect(stored[0].id).toBe(early.id)
  })

  it('7. M1/M2 фильтр: невалидный M1 отброшен, M2 сохранён', () => {
    const mm = makeFakeMM()
    patchSubscribe(mm)
    ;(window as any).markerManager = mm

    cleanup = initMarkersEvents()

    const invalidM1 = m1(-1, 1, 'invalid')
    const validM1 = m1(1, 2, 'valid')
    const closing = m2(3, 'closing')
    mm.markers = [invalidM1, validM1, closing]
    mm._notifySubscribers('markerAdded', validM1)

    const stored = useMarkersStore.getState().markers
    expect(stored).toHaveLength(2)
    expect(stored.map((m) => m.id).sort()).toEqual(['closing', 'valid'])
  })

  it('8. teardown: retry снят, mm-unsub снят, шина мертва', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})

    // (а) bind не состоялся → cleanup отменяет и interval, и deadline
    const mmA = makeFakeMM()
    ;(window as any).markerManager = mmA
    const cleanupA = initMarkersEvents()
    cleanupA()

    const subscribeSpy = vi.fn()
    mmA.subscribe = subscribeSpy
    vi.advanceTimersByTime(6000)

    expect(subscribeSpy).not.toHaveBeenCalled()
    expect(err).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)

    // (б) bind состоялся → cleanup снимает 4 mm-подписки и шинные подписки
    const mmB = makeFakeMM()
    patchSubscribe(mmB)
    ;(window as any).markerManager = mmB
    cleanup = initMarkersEvents()

    expect(counts(mmB)).toEqual([1, 1, 1, 1])
    cleanup()
    expect(counts(mmB)).toEqual([0, 0, 0, 0])

    const sentinel = m1(0, 9, 'sentinel')
    useMarkersStore.setState({ markers: [sentinel] })
    eventBus.publish(EventBusChannel.Audio, 'track-loaded', {
      duration: 100,
      hasVocals: false,
      loadedStems: [],
    })
    expect(useMarkersStore.getState().markers).toHaveLength(1)
    expect(useMarkersStore.getState().markers[0].id).toBe('sentinel')
  })

  it('9. retry переживает sections-updated', () => {
    const mm = makeFakeMM()
    ;(window as any).markerManager = mm

    cleanup = initMarkersEvents()

    vi.advanceTimersByTime(250)
    expect(counts(mm)).toEqual([0, 0, 0, 0])

    eventBus.publish(EventBusChannel.Sync, 'sections-updated', {})

    patchSubscribe(mm)
    vi.advanceTimersByTime(100)

    expect(counts(mm)).toEqual([1, 1, 1, 1])
  })

  it('10. markersReset: store заменяется новыми маркерами', () => {
    const mm = makeFakeMM()
    patchSubscribe(mm)
    ;(window as any).markerManager = mm

    cleanup = initMarkersEvents()

    const next = [m1(0, 1, 'reset-m1'), m2(2, 'reset-m2')]
    mm.setMarkers(next)
    mm._notifySubscribers('markersReset', [])

    const stored = useMarkersStore.getState().markers
    expect(stored).toHaveLength(2)
    expect(stored.map((m) => m.id).sort()).toEqual(['reset-m1', 'reset-m2'])
  })
})
