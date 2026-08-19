// src/audio/engine-v3/diagnostics/DropoutDetector.ts
// DR-077 Gate 2: reads dropout counts from stretch instance instrumentation
// Reports to console — NO DSP changes, NO graph modification

import { StretchInstancePool } from '../pipeline/StretchInstancePool'

export interface DropoutReport {
  totalDropouts: number
  byStem: Record<string, number>
  maxGapDetected: boolean
  underrunFree: boolean
}

export class DropoutDetector {
  private readonly _pool: StretchInstancePool
  private _intervalId: ReturnType<typeof setInterval> | null = null
  private _previousCounts: Map<string, number> = new Map()
  private _peakDropoutRate = 0

  constructor(pool: StretchInstancePool) {
    this._pool = pool
  }

  /**
   * Читает dropoutCount из инструментированных stretch-инстансов
   * Должно вызываться после включения instrumentation на нодах
   */
  async readAll(): Promise<DropoutReport> {
    const byStem: Record<string, number> = {}
    let total = 0
    let maxGap = false

    const stems = ['vocals', 'bass', 'drums', 'guitar', 'other', 'keys']
    for (const stemId of stems) {
      const inst = this._pool['get'](stemId) as any
      if (inst?._node && typeof inst._node.getInstrumentMetrics === 'function') {
        try {
          const m = await inst._node.getInstrumentMetrics()
          const d = m.dropoutCount ?? 0
          byStem[stemId] = d
          total += d
          if (d > 0) maxGap = true
        } catch {
          byStem[stemId] = -1 // error reading
        }
      }
    }

    return {
      totalDropouts: total,
      byStem,
      maxGapDetected: maxGap,
      underrunFree: total === 0,
    }
  }

  /**
   * Запускает polling — каждые N ms читает dropout и логирует изменения
   */
  startPolling(intervalMs = 2000): void {
    if (this._intervalId) return
    console.log('[DropoutDetector] ▶️ Polling started every', intervalMs, 'ms')

    this._intervalId = setInterval(async () => {
      const report = await this.readAll()

      // Сравнить с предыдущим замером
      let newDropouts = 0
      for (const [stemId, count] of Object.entries(report.byStem)) {
        const prev = this._previousCounts.get(stemId) ?? 0
        if (count > prev) {
          newDropouts += count - prev
        }
        this._previousCounts.set(stemId, count)
      }

      if (newDropouts > 0) {
        const rate = newDropouts / (intervalMs / 1000)
        if (rate > this._peakDropoutRate) this._peakDropoutRate = rate
        console.warn(
          `[DropoutDetector] ⚠️ ${newDropouts} new dropouts ` +
          `(total: ${report.totalDropouts}, peak rate: ${this._peakDropoutRate.toFixed(1)}/s)`,
          report.byStem,
        )
      }

      if (report.underrunFree && newDropouts === 0) {
        // Всё чисто — ничего не логируем каждый раз
      }
    }, intervalMs)
  }

  stopPolling(): void {
    if (this._intervalId) {
      clearInterval(this._intervalId)
      this._intervalId = null
      console.log('[DropoutDetector] ⏹ Polling stopped')
    }
  }

  getPeakDropoutRate(): number {
    return this._peakDropoutRate
  }

  reset(): void {
    this._previousCounts.clear()
    this._peakDropoutRate = 0
  }
}

/**
 * Включает instrumentation на всех стемах в пуле + запускает dropout detector
 */
export async function enableInstrumentation(pool: StretchInstancePool): Promise<DropoutDetector> {
  const stems = ['vocals', 'bass', 'drums', 'guitar', 'other', 'keys']
  let enabled = 0
  for (const stemId of stems) {
    const inst = (pool as any)['get'](stemId) as any
    if (inst?._node && typeof inst._node.setInstrumentation === 'function') {
      try {
        await inst._node.setInstrumentation(true)
        enabled++
      } catch {}
    }
  }
  console.log(`[DropoutDetector] ✅ Instrumentation enabled on ${enabled}/${stems.length} instances`)

  const detector = new DropoutDetector(pool)
  detector.startPolling(2000)
  return detector
}

/**
 * Выключает instrumentation на всех стемах
 */
export async function disableInstrumentation(detector: DropoutDetector, pool: StretchInstancePool): Promise<void> {
  detector.stopPolling()

  const stems = ['vocals', 'bass', 'drums', 'guitar', 'other', 'keys']
  for (const stemId of stems) {
    const inst = (pool as any)['get'](stemId) as any
    if (inst?._node && typeof inst._node.setInstrumentation === 'function') {
      try {
        await inst._node.setInstrumentation(false)
      } catch {}
    }
  }
  console.log('[DropoutDetector] ✅ Instrumentation disabled')

  // Финальный отчёт
  const final = await detector.readAll()
  console.log('[DropoutDetector] 📊 Final report:', JSON.stringify(final, null, 2))
}
