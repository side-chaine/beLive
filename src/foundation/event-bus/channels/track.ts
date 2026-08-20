import { eventBus } from '../event-bus'
import { EventBusChannel, EventPayload } from '../types'

export const TrackBus = {
  beforeChange(p: EventPayload<EventBusChannel.Track, 'before-change'>) { eventBus.publish(EventBusChannel.Track, 'before-change', p) },
  loadFailed(p: EventPayload<EventBusChannel.Track, 'load-failed'>) { eventBus.publish(EventBusChannel.Track, 'load-failed', p) },
}
