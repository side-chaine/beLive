import { V2Adapter } from './V2Adapter'

export type VocalMixMode = 'off' | 'split' | '3d'

export class VocalMixV3 {
  private _enabled = false
  private _mode: VocalMixMode = 'off'
  private _merger: ChannelMergerNode | null = null

  get enabled(): boolean { return this._enabled }
  get mode(): VocalMixMode { return this._mode }

  /** Инициализация: создать ChannelMergerNode (L/R) */
  init(ctx: AudioContext): void {
    this._merger = ctx.createChannelMerger(2)
  }

  /** Включить/выключить VocalMix */
  setEnabled(v: boolean): void {
    this._enabled = v
    try { V2Adapter.getInstance().delegateSync('setVocalMixEnabled', v) } catch {}
  }

  /** Split: vocals → L, microphone → R, music → both */
  setSplitMode(): void {
    this._mode = 'split'
  }

  /** 3D: spatial audio routing */
  set3DMode(): void {
    this._mode = '3d'
  }

  /** Получить merger для подключения */
  get merger(): ChannelMergerNode | null { return this._merger }

  dispose(): void {
    this._merger = null
    this._enabled = false
  }
}
