/**
 * C1–C3 (PR-2): тесты логики деградации стемов.
 *
 * Примечание: vitest/jsdom делает `window` обычным Object-прокси, НЕ реальным
 * EventTarget (window instanceof EventTarget === false), поэтому кастомные
 * события не доходят до слушателей. Поэтому здесь тестируем:
 *   1) чистые функции перехода состояния (дедуп, C2-флаг) — напрямую;
 *   2) факт подписки хука на нужные события (C1 before-track-change, C2 окна) —
 *      через spy на addEventListener (не требует dispatch).
 * Сами слушатели проверяются интеграцией (реальный браузер/телефон).
 */

import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import {
  useStemDegradation,
  addDegradedStem,
  mergeTrackLoadFailed,
} from '../useStemDegradation'

const STEM_EVENT = 'belive:stem-degraded'
const TRACK_FAIL_EVENT = 'belive:track-load-failed'
const TRACK_CHANGE_EVENT = 'before-track-change'

function Harness() {
  const state = useStemDegradation()
  return (
    <div>
      <span data-testid="stems">{state.degradedStems.map((s) => s.stemId).join(',')}</span>
      <span data-testid="failed">{state.trackLoadFailed ? 'yes' : 'no'}</span>
    </div>
  )
}

describe('useStemDegradation — чистая логика', () => {
  it('1. addDegradedStem: добавляет; дедуп по stemId', () => {
    let list = addDegradedStem([], 'vocals', 'boom')
    expect(list).toEqual([{ stemId: 'vocals', error: 'boom' }])
    list = addDegradedStem(list, 'vocals', 'boom') // повтор — без дубля
    expect(list).toHaveLength(1)
    list = addDegradedStem(list, 'bass', 'x')
    expect(list.map((s) => s.stemId)).toEqual(['vocals', 'bass'])
  })

  it('2. mergeTrackLoadFailed (C2): флаг true + стемы; дедуп', () => {
    const r1 = mergeTrackLoadFailed([], ['drums'])
    expect(r1.trackLoadFailed).toBe(true)
    expect(r1.degradedStems.map((s) => s.stemId)).toEqual(['drums'])

    const base = [{ stemId: 'drums', error: 'decode failed' }]
    const r2 = mergeTrackLoadFailed(base, ['drums', 'bass'])
    expect(r2.degradedStems.map((s) => s.stemId)).toEqual(['drums', 'bass'])

    const r3 = mergeTrackLoadFailed([], [])
    expect(r3.trackLoadFailed).toBe(true)
    expect(r3.degradedStems).toHaveLength(0)
  })
})

describe('useStemDegradation — подписка на события (C1/C2)', () => {
  afterEach(() => cleanup())

  it('3. монтируется → слушает stem-degraded + track-load-failed (window) и before-track-change (document, C1)', () => {
    const addWin = vi.spyOn(window, 'addEventListener')
    const addDoc = vi.spyOn(document, 'addEventListener')
    render(<Harness />)

    const winTypes = addWin.mock.calls.map((c) => c[0])
    const docTypes = addDoc.mock.calls.map((c) => c[0])
    expect(winTypes).toContain(STEM_EVENT)
    expect(winTypes).toContain(TRACK_FAIL_EVENT)
    expect(docTypes).toContain(TRACK_CHANGE_EVENT) // C1: сброс на смену трека

    addWin.mockRestore()
    addDoc.mockRestore()
  })

  it('4. анмаунт → слушатели снимаются', () => {
    const rmWin = vi.spyOn(window, 'removeEventListener')
    const rmDoc = vi.spyOn(document, 'removeEventListener')
    const { unmount } = render(<Harness />)
    unmount()

    const winTypes = rmWin.mock.calls.map((c) => c[0])
    const docTypes = rmDoc.mock.calls.map((c) => c[0])
    expect(winTypes).toContain(STEM_EVENT)
    expect(winTypes).toContain(TRACK_FAIL_EVENT)
    expect(docTypes).toContain(TRACK_CHANGE_EVENT)

    rmWin.mockRestore()
    rmDoc.mockRestore()
  })
})
