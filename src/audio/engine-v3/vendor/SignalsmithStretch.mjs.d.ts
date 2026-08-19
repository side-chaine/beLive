/** Minimal type declarations for signalsmith-stretch vendor copy */
declare module '../vendor/SignalsmithStretch.mjs' {
  interface StretchNode extends AudioWorkletNode {
    inputTime: number
    configure: (config: { blockMs: number; intervalMs: number }) => Promise<void>
    latency: () => Promise<number>
    addBuffers: (channels: Float32Array[]) => Promise<number>
    dropBuffers: (toSeconds?: number) => Promise<{ start: number; end: number }>
    start: (opts: {
      input?: number
      rate?: number
      semitones?: number
      active?: boolean
    }) => Promise<void>
    schedule: (opts: {
      input?: number
      rate?: number
      semitones?: number
      active?: boolean
      loopStart?: number
      loopEnd?: number
    }) => Promise<void>
    stop: () => Promise<void>
    setUpdateInterval: (seconds: number, callback?: (time: number) => void) => Promise<void>
  }

  export default function SignalsmithStretch(
    audioContext: AudioContext,
    options: { numberOfInputs: number; outputChannelCount: number[] }
  ): Promise<StretchNode>
}
