import { EventBus } from './foundation/event-bus/types'

declare global {
  // @PR-1 build-sha: инжектируется через vite define (см. vite.config.ts)
  const __BUILD_SHA__: string
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
