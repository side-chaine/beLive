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
          blockType = b.type ?? null
          break
        }
      }
    }

    if (!blockType) return

    // Fuzzy match — "verse 1" → verse
    let matchedConfig: BlockConfig | null = null
    for (const bt of BLOCK_TYPES) {
      if (blockType.includes(bt) && this._config[bt]?.on) {
        matchedConfig = this._config[bt]
        break
      }
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
