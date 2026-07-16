import { EventBus } from './foundation/event-bus/types'

declare global {
  interface Window {
    __eventBus?: EventBus
  }
}
