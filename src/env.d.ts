import { EventBus } from './foundation/event-bus/types'

declare global {
  interface Window {
    __eventBus?: EventBus
  }
}

declare module 'signalsmith-stretch' {
  const SignalsmithStretch: {
    (ctx: AudioContext, opts?: { outputChannelCount?: number[] }): Promise<AudioWorkletNode>
  }
  export default SignalsmithStretch
}
