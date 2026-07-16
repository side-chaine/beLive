import { eventBus } from '../event-bus'
import { EventBusChannel, EventPayload } from '../types'

export const UIBus = {
  modeChanged(p: EventPayload<EventBusChannel.UI, 'mode-changed'>) { eventBus.publish(EventBusChannel.UI, 'mode-changed', p) },
  blockScenesLoaded(p: EventPayload<EventBusChannel.UI, 'block-scenes-loaded'>) { eventBus.publish(EventBusChannel.UI, 'block-scenes-loaded', p) },
  cameraPermissionResolved(p: EventPayload<EventBusChannel.UI, 'camera-permission-resolved'>) { eventBus.publish(EventBusChannel.UI, 'camera-permission-resolved', p) },
}
