// ============================================================
// src/audio/engine-v3/monitor/AutoMixController.ts
// Block-based vocal gain automation (TC-2C-3)
//
// Подписка на EventBus Sync 'active-line-changed'.
// Fuzzy match block type → VocalHallGain ramp.
// cancelScheduledValues перед каждым ramp.
// ============================================================

import { eventBus, EventBusChannel } from '../../../foundation/event-bus'
import type { MonitorRouter } from './MonitorRouter'

const BLOCK_TYPES = ['verse', 'chorus', 'bridge', 'intro', 'preChorus', 'outro'] as const
export type BlockType = typeof BLOCK_TYPES[number]

interface BlockConfig {
  on: boolean
  level: number
}

export class AutoMixController {
  private _router: MonitorRouter
  private _config: Record<string, BlockConfig> = {}
  private _unsub: (() => void) | null = null
  private _resolver: ((lineIndex: number) => string | null) | null = null

  constructor(router: MonitorRouter) {
    this._router = router
    for (const bt of BLOCK_TYPES) {
      this._config[bt] = { on: false, level: 0.3 }
    }
  }

  /** Задать resolver для определения типа блока по lineIndex */
  setBlockResolver(fn: (lineIndex: number) => string | null): void {
    this._resolver = fn
  }

  /** Конфигурация per-block */
  setConfig(block: BlockType, on: boolean, level: number): void {
    if (this._config[block]) {
      this._config[block] = { on, level }
    }
  }

  /** Текущий конфиг блока (для on/level сеттеров без потери второй половины) */
  getConfig(block: BlockType): BlockConfig | undefined {
    return this._config[block]
  }

  start(): void {
    if (this._unsub) return
    this._unsub = eventBus.subscribe(
      EventBusChannel.Sync,
      'active-line-changed',
      (payload: any) => {
        const lineIndex = payload?.newLineIndex ?? payload?.lineIndex ?? 0
        this._applyForLine(lineIndex)
      }
    ).unsubscribe
  }

  /** Применить automix для строки по типу блока */
  applyForLine(lineIndex: number): void {
    this._applyForLine(lineIndex)
  }

  private _applyForLine(lineIndex: number): void {
    // Если хотя бы один блок включён — automix активен
    const hasAutoMix = BLOCK_TYPES.some(bt => this._config[bt]?.on)

    if (!hasAutoMix) return // ручное управление — ничего не делаем

    // Определяем тип блока
    let blockType: string | null = null
    if (this._resolver) {
      blockType = this._resolver(lineIndex)
    } else {
      // Fallback: читаем из legacy lyricsDisplay
      const ld = (window as any).lyricsDisplay
      const blocks: any[] = ld?.textBlocks ?? []
      for (const b of blocks) {
        if (b.lineIndices?.includes(lineIndex)) {
          const t = (b.type ?? '').toLowerCase()
          if (t === 'chorus' || t === 'bridge' || t === 'verse') { blockType = t; break }
          if (t === 'prechorus' || t === 'pre-chorus') { blockType = 'prechorus'; break }
          if (t === 'intro') { blockType = 'intro'; break }
          if (t === 'outro') { blockType = 'outro'; break }
          // Unknown block type → strict zero (TC-065, legacy monitor-mix.js:447-448)
          blockType = null
          break
        }
      }
    }

    if (!blockType) return

    // R6: exact-match (parity legacy TC-065) — "verse 1" НЕ матчится → strict zero
    let matchedConfig: BlockConfig | null = null
    if (blockType) {
      const exact = this._config[blockType as BlockType]
      if (exact?.on) matchedConfig = exact
    }

    const targetLevel = matchedConfig ? matchedConfig.level : 0
    const now = this._router.programInput.context.currentTime
    const vocalGain = this._router.vocalHallInput.gain

    // cancelScheduledValues + ramp
    vocalGain.cancelScheduledValues(now)
    vocalGain.setValueAtTime(vocalGain.value, now)
    vocalGain.setTargetAtTime(targetLevel, now, 0.015)
  }

  stop(): void {
    if (this._unsub) { this._unsub(); this._unsub = null }
  }

  dispose(): void { this.stop() }
}
