import { eventBus } from '../event-bus'
import { EventBusChannel, EventPayload } from '../types'

export const SyncBus = {
  blocksApplied(p: EventPayload<EventBusChannel.Sync, 'blocks-applied'>) { eventBus.publish(EventBusChannel.Sync, 'blocks-applied', p) },
  activeLineChanged(p: EventPayload<EventBusChannel.Sync, 'active-line-changed'>) { eventBus.publish(EventBusChannel.Sync, 'active-line-changed', p) },
  lyricsRendered() { eventBus.publish(EventBusChannel.Sync, 'lyrics-rendered', {}) },
  saveTrackMarkers(p: EventPayload<EventBusChannel.Sync, 'save-track-markers'>) { eventBus.publish(EventBusChannel.Sync, 'save-track-markers', p) },
  loopSet(p: EventPayload<EventBusChannel.Sync, 'loop-set'>) { eventBus.publish(EventBusChannel.Sync, 'loop-set', p) },
  loopCleared(p: EventPayload<EventBusChannel.Sync, 'loop-cleared'>) { eventBus.publish(EventBusChannel.Sync, 'loop-cleared', p) },
  loopcompleted(p: EventPayload<EventBusChannel.Sync, 'loopcompleted'>) { eventBus.publish(EventBusChannel.Sync, 'loopcompleted', p) },
  sectionsUpdated() { eventBus.publish(EventBusChannel.Sync, 'sections-updated', {}) },
}
