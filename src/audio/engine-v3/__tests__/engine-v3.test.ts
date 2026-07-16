import { describe, it, expect } from 'vitest'
import { LoopEngineV3 } from '../LoopEngineV3'
import { CaptureBusV3 } from '../CaptureBusV3'
import { MeterNodeV3 } from '../MeterNodeV3'
import { RateParamV3 } from '../RateParamV3'

describe('LoopEngineV3', () => {
  it('setLoop activates loop and returns start on jump', () => {
    const loop = new LoopEngineV3()
    loop.setLoop(10, 20)
    expect(loop.isLooping).toBe(true)
    expect(loop.checkJump(20)).toBe(10)   // jump
    expect(loop.checkJump(15)).toBe(null) // inside — no jump
  })

  it('clearLoop deactivates loop', () => {
    const loop = new LoopEngineV3()
    loop.setLoop(0, 10)
    loop.clearLoop()
    expect(loop.isLooping).toBe(false)
    expect(loop.checkJump(15)).toBe(null)
  })

  it('generation guard works', () => {
    const loop = new LoopEngineV3()
    const gen1 = loop.getGeneration()
    loop.setLoop(0, 10)
    expect(loop.isGenerationValid(gen1)).toBe(false) // old gen invalid
    expect(loop.isGenerationValid(loop.getGeneration())).toBe(true)
  })
})

describe('CaptureBusV3', () => {
  it('init creates destination', () => {
    const ctx = {
      createMediaStreamDestination: () => ({ stream: {} as MediaStream })
    } as AudioContext
    const capture = new CaptureBusV3()
    capture.init(ctx)
    expect(capture.destination).toBeDefined()
    expect(capture.stream).toBeDefined()
  })
})

describe('MeterNodeV3', () => {
  it('creates analyser with default fftSize', () => {
    const ctx = {
      createAnalyser: () => {
        const data = new Float32Array(128)
        const analyser = {
          fftSize: 256,
          frequencyBinCount: 128,
          getFloatTimeDomainData: (arr: Float32Array) => {
            arr.set(data)
          },
          connect: () => {},
          disconnect: () => {}
        }
        return analyser as unknown as AnalyserNode
      }
    } as AudioContext
    const meter = new MeterNodeV3(ctx)
    expect(meter.fftSize).toBe(256)
    const result = meter.read()
    expect(typeof result.rms).toBe('number')
    expect(typeof result.peak).toBe('number')
  })
})

describe('RateParamV3', () => {
  it('setImmediate sets rate instantly', () => {
    const rate = new RateParamV3()
    rate.setImmediate(1.5)
    expect(rate.currentRate).toBe(1.5)
    expect(rate.targetRate).toBe(1.5)
  })

  it('setTarget sets future rate without changing current', () => {
    const rate = new RateParamV3()
    rate.setTarget(2)
    expect(rate.targetRate).toBe(2)
    expect(rate.currentRate).toBe(1) // unchanged
  })
})
