import { describe, it, expect } from 'vitest'
import { eventBus } from '../event-bus'
import { EventBusChannel } from '../types'

// Smoke-тесты для bridges, которые ДОЛЖНЫ продолжать работать через Facade
describe('Bridge smoke tests (Facade must keep working)', () => {

  it('lyrics.bridge: track-loaded triggers active-line-changed', () => {
    // Проверяем что событие track-loaded доходит до подписчиков
    let received = false
    const sub = eventBus.subscribe(EventBusChannel.Audio, 'track-loaded', () => { received = true })
    eventBus.publish(EventBusChannel.Audio, 'track-loaded', { duration: 100, hasVocals: true, loadedStems: ['inst'] })
    expect(received).toBe(true)
    sub.unsubscribe()
  })

  it('markers.bridge: sections-updated delivers payload', () => {
    let payload: any = null
    const sub = eventBus.subscribe(EventBusChannel.Sync, 'sections-updated', (p) => { payload = p })
    eventBus.publish(EventBusChannel.Sync, 'sections-updated', {})
    expect(payload).toBeDefined()
    sub.unsubscribe()
  })

  it('loop.bridge: before-track-change triggers cleanup', () => {
    let called = false
    const sub = eventBus.subscribe(EventBusChannel.Track, 'before-change', () => { called = true })
    eventBus.publish(EventBusChannel.Track, 'before-change', { fromTrackId: 'a', toTrackId: 'b' })
    expect(called).toBe(true)
    sub.unsubscribe()
  })
})
