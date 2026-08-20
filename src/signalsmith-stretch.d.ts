declare module 'signalsmith-stretch' {
  interface StretchNode extends AudioWorkletNode {
    inputTime: number
    configure(config: { blockMs?: number; intervalMs?: number; preset?: string; splitComputation?: boolean }): Promise<void>
    latency(): Promise<number>
    schedule(config: {
      active?: boolean
      input?: number
      output?: number
      rate?: number
      semitones?: number
      loopStart?: number
      loopEnd?: number
    }): Promise<void>
    setUpdateInterval(seconds: number, callback?: (time: number) => void): Promise<void>
    addBuffers(buffers: Float32Array[]): Promise<number>
    dispose?(): void
  }

  interface SignalsmithStretch {
    (ctx: AudioContext, options?: { outputChannelCount?: number[]; numberOfInputs?: number; numberOfOutputs?: number }): Promise<StretchNode>
  }

  const signalsmithStretch: SignalsmithStretch
  export default signalsmithStretch
}
