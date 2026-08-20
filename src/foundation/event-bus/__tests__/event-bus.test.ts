import { describe, it, expect } from 'vitest'
import { eventBus } from '../event-bus'
import { EventBusChannel } from '../types'

describe('EventBus', () => {
  // 1. publish → subscribe получает правильный payload
  it('delivers payload to subscribed listener', () => {
    const received: unknown[] = []
    const sub = eventBus.subscribe(EventBusChannel.Audio, 'track-loaded', (p) => { received.push(p) })
    eventBus.publish(EventBusChannel.Audio, 'track-loaded', { duration: 100, hasVocals: true, loadedStems: ['inst'] })
    expect(received).toHaveLength(1)
    expect(received[0]).toMatchObject({ duration: 100 })
    sub.unsubscribe()
  })

  // 2. unsubscribe — больше не получает
  it('stops delivery after unsubscribe', () => {
    let count = 0
    const sub = eventBus.subscribe(EventBusChannel.Track, 'before-change', () => { count++ })
    eventBus.publish(EventBusChannel.Track, 'before-change', { fromTrackId: 'a', toTrackId: 'b' })
    sub.unsubscribe()
    eventBus.publish(EventBusChannel.Track, 'before-change', { fromTrackId: 'c', toTrackId: 'd' })
    expect(count).toBe(1)
  })

  // 3. clear — все подписки удалены
  it('removes all listeners after clear', () => {
    let count = 0
    eventBus.subscribe(EventBusChannel.Catalog, 'track-saved', () => { count++ })
    eventBus.subscribe(EventBusChannel.Sync, 'blocks-applied', () => { count++ })
    eventBus.clear()
    eventBus.publish(EventBusChannel.Catalog, 'track-saved', { trackId: '1', title: 't', hasLyrics: false })
    eventBus.publish(EventBusChannel.Sync, 'blocks-applied', { trackId: '1', blocksCount: 3 })
    expect(count).toBe(0)
  })

  // 4. разные каналы — изолированы
  it('isolates different channels', () => {
    const audio: string[] = []
    const track: string[] = []
    eventBus.subscribe(EventBusChannel.Audio, 'track-loaded', () => { audio.push('a') })
    eventBus.subscribe(EventBusChannel.Track, 'before-change', () => { track.push('t') })
    eventBus.publish(EventBusChannel.Audio, 'track-loaded', { duration: 1, hasVocals: false, loadedStems: [] })
    expect(audio).toHaveLength(1)
    expect(track).toHaveLength(0)
    eventBus.clear()
  })

  // 5. subscribeChannel — получает все события канала
  it('channel-wide subscription receives all events in channel', () => {
    const receivedPayloads: unknown[] = []
    eventBus.subscribeChannel(EventBusChannel.UI, (payload) => { receivedPayloads.push(payload) })
    eventBus.publish(EventBusChannel.UI, 'mode-changed', { from: 'a', to: 'b' })
    eventBus.publish(EventBusChannel.UI, 'block-scenes-loaded', { trackId: '1', sceneCount: 2 })
    expect(receivedPayloads).toHaveLength(2)
    expect(receivedPayloads[0]).toMatchObject({ from: 'a' })
    expect(receivedPayloads[1]).toMatchObject({ trackId: '1' })
    eventBus.clear()
  })

  // 6. double subscribe — не дублирует listener
  it('does not deduplicate the same callback twice', () => {
    let count = 0
    const cb = () => { count++ }
    eventBus.subscribe(EventBusChannel.Practice, 'practice:state-changed', cb)
    eventBus.subscribe(EventBusChannel.Practice, 'practice:state-changed', cb)
    eventBus.publish(EventBusChannel.Practice, 'practice:state-changed', { type: 'completed' })
    expect(count).toBe(2)  // дважды вызван
    eventBus.clear()
  })

  // 7. publish без слушателей — не падает
  it('does not throw when publishing without listeners', () => {
    expect(() => {
      eventBus.publish(EventBusChannel.Audio, 'track-loaded', { duration: 1, hasVocals: false, loadedStems: [] })
    }).not.toThrow()
  })

  // 8. clearChannel — только один канал очищен
  it('clears only specified channel', () => {
    const audio: string[] = []
    const track: string[] = []
    eventBus.subscribe(EventBusChannel.Audio, 'track-loaded', () => { audio.push('a') })
    eventBus.subscribe(EventBusChannel.Track, 'before-change', () => { track.push('t') })
    eventBus.clearChannel(EventBusChannel.Audio)
    eventBus.publish(EventBusChannel.Audio, 'track-loaded', { duration: 1, hasVocals: false, loadedStems: [] })
    eventBus.publish(EventBusChannel.Track, 'before-change', { fromTrackId: 'a', toTrackId: 'b' })
    expect(audio).toHaveLength(0)
    expect(track).toHaveLength(1)
    eventBus.clear()
  })
})
