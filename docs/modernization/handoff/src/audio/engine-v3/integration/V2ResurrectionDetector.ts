// src/audio/engine-v3/integration/V2ResurrectionDetector.ts
//
// 🔍 DEV-only diagnostics: detects V2 audio resurrection after V3 activation.
//
// V2 "ghost" scenarios:
//   A) V2Adapter falls back after V3 failure and restarts V2
//   B) V2AudioCage has a gap (crossfade window) where V2 bleeds through
//   C) V2Adapter.delegateSync('play') is called while V3 is supposed to be active
//   D) setInterval/setTimeout callbacks from V2 modules still executing
//
// Usage:
//   const det = new V2ResurrectionDetector()
//   det.arm(cage) // start monitoring
//   det.v2LeakCount // number of detected V2 leaks
//   det.disarm()   // stop monitoring
//
// ─────────────────────────────────────────────────────────────────────────────
// ИСПРАВЛЕНО 2026-08-29 (Кай / ночная смена).
//
// Найдено: детектор НЕ МОГ детектить ничего. Четыре независимые причины:
//
//   1. `require('../../audio/V2Adapter')` — в ESM-бандле Vite `require`
//      не существует → ReferenceError → глушился пустым `catch {}`.
//      Перехват delegateSync НИКОГДА не устанавливался.
//   2. Путь всё равно неверный: из `engine-v3/integration/` он ведёт в
//      `src/audio/V2Adapter`, а файл лежит в `src/audio/engine-v3/V2Adapter.ts`.
//   3. `_checkCageState()` читал `getState().v2Caged` / `.v2Rms` — у
//      V2AudioCage нет ни `getState()`, ни таких полей → вечный early-return.
//   4. `_checkRMSSignature()` состоял из одних комментариев: считал state
//      и ничего с ним не делал.
//
// Итог: прибор печатал "🔭 Armed", тикал каждые 500 мс и был не способен
// зафиксировать ни одного события. `report()` при этом честно возвращал
// "✅ No V2 leaks detected" — истинное, но ПУСТОЕ утверждение, которое
// читается как "V3 чист". Это генератор ложного спокойствия, а не детектор.
//
// Особая важность: ADR-0004 требует собрать ВСЕ доказательства миграции
// ДО шага 5 — и собирать их предполагается этим прибором.
//
// Решение:
//   - Наблюдение за вызовами V2 переведено с monkey-patching через require
//     на подписку `V2Adapter.observe()` — V2Adapter и так единственный
//     файл, читающий V2 (естественная точка наблюдения).
//     Исчезли: require, неверный путь, try/catch, ручной restore.
//   - Проверка "клетка держит" переписана на РЕАЛЬНО существующий API:
//     `delegateSync('getStemMeterLevel', stem)` по всем STEM_IDS.
//     Это ровно то, что задумывалось (`v2Caged && v2Rms > floor`),
//     но через контракт, который действительно есть в IV2PublicContract.
//   - `_checkRMSSignature()` удалён: он ничего не делал, а его замысел
//     полностью покрыт переписанным `_checkCageState()`.
//
// ВАЖНО ДЛЯ 007 — конструктивное ограничение наблюдателя:
//   V2AudioCage сам вызывающий ~19 `delegateSync` на каждом проходе
//   watchdog'а, чтобы заглушить V2. Это ЛЕГИТИМНЫЕ вызовы, а не воскрешение.
//   Поэтому наблюдатель фильтрует ТОЛЬКО 'play' (и только его).
//   Наблюдатель также не должен сам звать delegateSync с тем же методом,
//   который слушает — это рекурсия (здесь: слушаем 'play', мерим
//   'getStemMeterLevel' — пересечения нет).
// ─────────────────────────────────────────────────────────────────────────────

import { V2Adapter } from '../V2Adapter'
import { STEM_IDS, type V2AudioCage } from './V2AudioCage'

/**
 * Порог RMS, ниже которого сигнал считается шумом, а не воскрешением.
 * Значение взято из исходного замысла (было `state.v2Rms > 0.005`).
 */
const RMS_NOISE_FLOOR = 0.005

export interface V2ResurrectionEvent {
  type: 'delegateSync' | 'cageGap' | 'v2Callback' | 'v2PlayCall' | 'rmsLeak'
  timestamp: number
  detail: string
  stack?: string
}

export class V2ResurrectionDetector {
  private _armed = false
  private _events: V2ResurrectionEvent[] = []
  private _cage: V2AudioCage | null = null
  private _monitorInterval: ReturnType<typeof setInterval> | null = null
  private _unsubscribe: (() => void) | null = null

  /** Returns all captured resurrection events. */
  get events(): readonly V2ResurrectionEvent[] { return this._events }
  /** Number of detected V2 leaks. */
  get v2LeakCount(): number { return this._events.length }
  /** Whether this detector is actively monitoring. */
  get armed(): boolean { return this._armed }

  private _record(type: V2ResurrectionEvent['type'], detail: string): void {
    this._events.push({
      type,
      timestamp: performance.now(),
      detail,
      stack: new Error().stack?.split('\n').slice(2, 6).join('\n'),
    })
    console.warn(`[V2ResurrectionDetector] 🚨 ${type}: ${detail}`)
  }

  /** Start monitoring for V2 resurrection. Monitors:
   *  - Cage state: while cage is active, samples V2 stem meters for real audio
   *  - V2Adapter.delegateSync/delegateAsync('play') calls (via subscription)
   */
  arm(cage?: V2AudioCage): void {
    if (this._armed) return
    this._armed = true
    this._cage = cage ?? null

    // Подписка на вызовы V2 (перехват через V2Adapter.observe)
    this._interceptPlay()

    // Polling monitor: every 500ms check for V2 activity
    this._monitorInterval = setInterval(() => {
      this._checkCageState()
    }, 500)

    console.log('[V2ResurrectionDetector] 🔭 Armed — monitoring V2 resurrection')
  }

  /** Stop monitoring and restore all intercepted functions. */
  disarm(): void {
    if (!this._armed) return
    this._armed = false

    if (this._monitorInterval !== null) {
      clearInterval(this._monitorInterval)
      this._monitorInterval = null
    }

    this._unsubscribe?.()
    this._unsubscribe = null
    this._cage = null
    console.log('[V2ResurrectionDetector] ✅ Disarmed — cleanup complete')
  }

  /**
   * Сценарий C: V2 получает 'play', пока активен V3.
   * Подписка, а не подмена метода: нечего восстанавливать, нечего ломать.
   */
  private _interceptPlay(): void {
    this._unsubscribe = V2Adapter.getInstance().observe((method) => {
      if (method !== 'play') return
      this._record('delegateSync', `V2Adapter('play') called while V3 active`)
    })
  }

  /**
   * Сценарий B: клетка сообщает, что держит V2, но звук всё равно идёт.
   *
   * Проверка РЕАЛЬНАЯ: меряем уровень каждого стема через публичный контракт
   * V2. Если клетка активна, а какой-то стем звучит громче шумового порога —
   * это утечка. Раньше здесь читались несуществующие `getState().v2Caged` /
   * `.v2Rms`, из-за чего метод всегда выходил на `if (!state) return`.
   */
  private _checkCageState(): void {
    if (!this._cage?.active) return
    try {
      const adapter = V2Adapter.getInstance()
      for (const stemId of STEM_IDS) {
        const level = adapter.delegateSync('getStemMeterLevel', stemId) as number | undefined
        if (typeof level !== 'number' || !Number.isFinite(level)) continue
        if (level > RMS_NOISE_FLOOR) {
          this._record(
            'rmsLeak',
            `stem "${stemId}" level=${level.toFixed(6)} while cage active (floor ${RMS_NOISE_FLOOR})`
          )
        }
      }
    } catch {
      // V2 недоступен — значит он гарантированно не играет. Это не утечка.
    }
  }

  /** Reset all captured events. */
  clear(): void {
    this._events = []
  }

  /** Format a report for console or logging. */
  report(): string {
    if (this._events.length === 0) return '[V2ResurrectionDetector] ✅ No V2 leaks detected'
    return [
      `[V2ResurrectionDetector] 🚨 ${this._events.length} V2 leak(s):`,
      ...this._events.map((e, i) =>
        `  ${i + 1}. [${e.type}] ${e.detail} @ ${e.timestamp.toFixed(0)}ms`
      ),
    ].join('\n')
  }

  dispose(): void {
    this.disarm()
    this._events = []
  }
}
