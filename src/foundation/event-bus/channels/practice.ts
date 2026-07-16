import { eventBus } from '../event-bus'
import { EventBusChannel, EventPayload } from '../types'

export const PracticeBus = {
  practiceStateChanged(p: EventPayload<EventBusChannel.Practice, 'practice:state-changed'>) { eventBus.publish(EventBusChannel.Practice, 'practice:state-changed', p) },
}
