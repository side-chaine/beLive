import { eventBus } from '../event-bus'
import { EventBusChannel, EventPayload } from '../types'

export const CatalogBus = {
  trackSaved(p: EventPayload<EventBusChannel.Catalog, 'track-saved'>) { eventBus.publish(EventBusChannel.Catalog, 'track-saved', p) },
  tracksChanged(p: EventPayload<EventBusChannel.Catalog, 'tracks-changed'>) { eventBus.publish(EventBusChannel.Catalog, 'tracks-changed', p) },
  catalogClose() { eventBus.publish(EventBusChannel.Catalog, 'catalog-close', {}) },
  catalogCleared() { eventBus.publish(EventBusChannel.Catalog, 'catalog-cleared', {}) },
}
