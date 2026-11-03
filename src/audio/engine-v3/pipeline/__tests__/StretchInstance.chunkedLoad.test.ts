/**
 * PR-2 (Bug Y): StretchInstance.chunkedLoad must stream PCM chunks to
 * addBuffers WITH a transfer-list (0-copy). The original code called
 * addBuffers(channels) without a transfer list, forcing a full structured
 * clone of the whole PCM buffer → DataCloneError "out of memory" on 32-bit J8.
 *
 * Mutation proof: reverting to `addBuffers(channels)` (no transfer list)
 * makes every assertion below fail — so the test can't pass on the buggy code.
 *
 * Note: runs in jsdom (app project). The vendor worklet node is fully mocked,
 * so there is no cross-realm ArrayBuffer issue (that concern applies only to
 * the real worklet realm). A node env is unnecessary here.
 */
import { describe, expect, it, vi } from 'vitest'
import { StretchInstance } from '../StretchInstance'

// StretchInstance statically imports the vendor worklet module; mock it so the
// test runs without a real AudioContext/worklet.
vi.mock('../../vendor/SignalsmithStretch.mjs', () => ({
  default: async () => ({}) as unknown as AudioWorkletNode,
}))

function makeMockCtx(): AudioContext {
  const makeGain = () => ({
    gain: { value: 1, setValueAtTime: () => {}, linearRampToValueAtTime: () => {} },
    connect: () => {},
    disconnect: () => {},
  })
  return {
    createGain: () => makeGain(),
  } as unknown as AudioContext
}

function makeFakeBuffer(seconds: number, channels = 2, sampleRate = 48000): AudioBuffer {
  const length = Math.floor(seconds * sampleRate)
  return {
    numberOfChannels: channels,
    length,
    sampleRate,
    duration: seconds,
    copyFromChannel: (target: Float32Array) => target.fill(0),
    getChannelData: () => new Float32Array(length),
  } as unknown as AudioBuffer
}

function makeMockNode() {
  // addBuffers is provided by the signalsmith wrapper on the real node; capture
  // both the payload and the transfer list so we can prove the 0-copy contract.
  const calls: Array<{ piece: unknown; transfer?: unknown }> = []
  const node = {
    addBuffers: (piece: unknown, transfer?: unknown) => {
      calls.push({ piece, transfer })
      return Promise.resolve()
    },
    port: { postMessage: () => {}, addEventListener: () => {} },
  } as unknown as AudioWorkletNode
  return { node, calls }
}

describe('StretchInstance.chunkedLoad — chunked + transfer (Bug Y fix)', () => {
  it('sends every chunk with a non-empty transfer list (no whole-buffer clone)', async () => {
    const inst = new StretchInstance('vocals', { ctx: makeMockCtx() })
    const { node, calls } = makeMockNode()
    ;(inst as any)._node = node
    ;(inst as any)._active = true

    // 20s buffer → 2 chunks of 15s (chunkLen = 15 * 48000)
    await inst.chunkedLoad(makeFakeBuffer(20))

    expect(calls.length).toBe(2)
    for (const call of calls) {
      const transfer = call.transfer
      expect(Array.isArray(transfer)).toBe(true)
      expect((transfer as unknown[]).length).toBe(2) // one ArrayBuffer per channel
      for (const t of transfer as ArrayBuffer[]) {
        expect(t).toBeInstanceOf(ArrayBuffer)
      }
    }
  })

  it('never posts the whole buffer as a single untransferred clone', async () => {
    const inst = new StretchInstance('vocals', { ctx: makeMockCtx() })
    const { node, calls } = makeMockNode()
    ;(inst as any)._node = node
    ;(inst as any)._active = true

    await inst.chunkedLoad(makeFakeBuffer(3))

    expect(calls.length).toBe(1)
    // Mutation proof: buggy code passed `addBuffers(channels)` → transfer === undefined
    expect(calls[0].transfer).toBeDefined()
    expect(Array.isArray(calls[0].transfer)).toBe(true)
  })
})
