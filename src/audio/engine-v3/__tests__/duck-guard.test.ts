import { describe, it, expect } from 'vitest'
import { DuckGuardV3 } from '../DuckGuardV3'

describe('DuckGuardV3', () => {
  it('is singleton', () => {
    expect(DuckGuardV3.getInstance()).toBe(DuckGuardV3.getInstance())
  })

  it('isDuckSafe returns false when not playing', () => {
    const dg = DuckGuardV3.getInstance()
    // V2Adapter.getSync вернёт undefined — isPlaying = false
    expect(dg.isDuckSafe()).toBe(false)
  })

  it('onHotPlug sets cooldown', () => {
    const dg = DuckGuardV3.getInstance()
    dg.onHotPlug()
    // Сразу после вызова — isDuckSafe должен быть false
    expect(dg.isDuckSafe()).toBe(false)
  })

  it('duck without safe flag does nothing (no crash)', () => {
    const dg = DuckGuardV3.getInstance()
    dg.duck(['instrumental'], 0.3)
    // Не должно упасть — guards просто return
    expect(true).toBe(true)
  })

  it('restore without duck does nothing', () => {
    const dg = DuckGuardV3.getInstance()
    dg.restore()
    expect(true).toBe(true)
  })

  it('multiple instances return same reference', () => {
    const a = DuckGuardV3.getInstance()
    const b = DuckGuardV3.getInstance()
    expect(a).toBe(b)
  })
})
