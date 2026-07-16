import { eventBus } from '../event-bus'
import { EventBusChannel, EventPayload } from '../types'

export const AudioBus = {
  trackLoaded(p: EventPayload<EventBusChannel.Audio, 'track-loaded'>) { eventBus.publish(EventBusChannel.Audio, 'track-loaded', p) },
  trackFullyLoaded(p: EventPayload<EventBusChannel.Audio, 'track-fully-loaded'>) { eventBus.publish(EventBusChannel.Audio, 'track-fully-loaded', p) },
  trackStemReady(p: EventPayload<EventBusChannel.Audio, 'track-stem-ready'>) { eventBus.publish(EventBusChannel.Audio, 'track-stem-ready', p) },
  playbackStateChanged(p: EventPayload<EventBusChannel.Audio, 'playback-state-changed'>) { eventBus.publish(EventBusChannel.Audio, 'playback-state-changed', p) },
  playbackRateChanged(p: EventPayload<EventBusChannel.Audio, 'playback-rate-changed'>) { eventBus.publish(EventBusChannel.Audio, 'playback-rate-changed', p) },
  vocalmixStateChanged(p: EventPayload<EventBusChannel.Audio, 'vocalmix-state-changed'>) { eventBus.publish(EventBusChannel.Audio, 'vocalmix-state-changed', p) },
  microphoneStateChanged(p: EventPayload<EventBusChannel.Audio, 'microphone-state-changed'>) { eventBus.publish(EventBusChannel.Audio, 'microphone-state-changed', p) },
  monitorStateChanged() { eventBus.publish(EventBusChannel.Audio, 'monitor-state-changed', {}) },
  monitorRouteChanged() { eventBus.publish(EventBusChannel.Audio, 'monitor-route-changed', {}) },
  seekPositionChanged(p: EventPayload<EventBusChannel.Audio, 'seek-position-changed'>) { eventBus.publish(EventBusChannel.Audio, 'seek-position-changed', p) },
}
