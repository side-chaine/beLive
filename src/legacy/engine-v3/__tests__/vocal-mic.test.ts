import { describe, it, expect } from 'vitest'
import { VocalMixV3 } from '../VocalMixV3'
import { MicrophoneV3 } from '../MicrophoneV3'

describe('VocalMixV3', () => {
  it('init creates merger', () => {
    const ctx = {
      createChannelMerger: () => ({}) as ChannelMergerNode
    } as AudioContext
    const mix = new VocalMixV3()
    mix.init(ctx)
    expect(mix.merger).toBeDefined()
  })

  it('setEnabled updates state', () => {
    const mix = new VocalMixV3()
    mix.setEnabled(true)
    expect(mix.enabled).toBe(true)
    mix.setEnabled(false)
    expect(mix.enabled).toBe(false)
  })

  it('setSplitMode changes mode', () => {
    const mix = new VocalMixV3()
    mix.setSplitMode()
    expect(mix.mode).toBe('split')
  })
})

describe('MicrophoneV3', () => {
  it('initial state is disabled', () => {
    const mic = new MicrophoneV3()
    expect(mic.enabled).toBe(false)
    expect(mic.volume).toBe(1)
  })

  it('setVolume clamps between 0 and 1', () => {
    const mic = new MicrophoneV3()
    mic.setVolume(0.5)
    expect(mic.volume).toBe(0.5)
    mic.setVolume(2)
    expect(mic.volume).toBe(1) // clamped
  })

  it('setEnabled controls gain', () => {
    const mic = new MicrophoneV3()
    mic.setEnabled(true)
    expect(mic.enabled).toBe(true)
  })
})
