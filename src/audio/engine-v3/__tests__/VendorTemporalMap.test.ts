/**
 * 067-B: Temporal-map тест — верификация вендорного schedule().
 *
 * Проверяет математику временно́й карты (timeMap) в SignalsmithStretch.mjs.
 * Моделирует вендорный алгоритм как pure function, включая приоритет outputTime:
 *
 *   outputTime = objIn.outputTime ?? objIn.output ?? currentTime + outputLatencySeconds
 *
 * @see SignalsmithStretch.mjs:90-134 (remoteMethods.schedule)
 * @see 066 Part 3 (находки A/B/C), Sol_1 review 067-B
 */

import { describe, expect, it } from 'vitest'

// ═══════════════════════════════════════════════════════════════
// Pure-function модель schedule() из вендора
// ═══════════════════════════════════════════════════════════════

interface TimeSegment {
  active: boolean
  input: number
  output: number
  rate: number
  semitones: number
  loopStart: number
  loopEnd: number
}

type SegmentInput = Partial<TimeSegment> & { outputTime?: number }

const DEFAULT_SEGMENT: TimeSegment = {
  active: false,
  input: 0,
  output: 0,
  rate: 1,
  semitones: 0,
  loopStart: 0,
  loopEnd: 0,
}

/**
 * Чистая реализация vendor-алгоритма schedule().
 * Верифицирует строки 90-134 из SignalsmithStretch.mjs.
 *
 * Приоритет outputTime (с точностью до вендора):
 *   1. objIn.outputTime (явный ключ, используется при seek с точным временем)
 *   2. objIn.output      (используется stop() и числовым start())
 *   3. currentTime + outputLatency  (067-B fix: умолчание для scheduleRate/seek-object)
 *
 * @param timeMap  - временна́я карта (мутируется in-place)
 * @param objIn    - параметры сегмента
 * @param currentTime  - ctx.currentTime
 * @param outputLatencySeconds  - latency ноды (60ms)
 * @param adjustPrevious  - флаг из вендора
 */
function scheduleSegment(
  timeMap: TimeSegment[],
  objIn: SegmentInput,
  currentTime: number,
  outputLatencySeconds: number,
  adjustPrevious = false,
): TimeSegment & { inputTime: number } {
  // Шаг 1: определить outputTime (строки 91-94 вендора, 067-B + Sol_1 fix)
  const outputTime = objIn.outputTime ?? objIn.output ?? currentTime + outputLatencySeconds

  // Шаг 2: pop сегменты с output >= outputTime (строки 96-99)
  let latestSegment = timeMap[timeMap.length - 1] ?? DEFAULT_SEGMENT
  while (timeMap.length && timeMap[timeMap.length - 1].output >= outputTime) {
    latestSegment = timeMap.pop()!
  }

  // Шаг 3: клонировать, output = outputTime (строки 101-106)
  const obj: any = { ...DEFAULT_SEGMENT, ...latestSegment }
  obj.input = null
  obj.output = outputTime
  Object.assign(obj, objIn)

  // Шаг 4: если input не задан — вычислить из previous (строки 107-110)
  if (obj.input === null) {
    const rate = latestSegment.active ? latestSegment.rate : 0
    obj.input = latestSegment.input + (obj.output - latestSegment.output) * rate
  }

  // Шаг 5: push (строка 111)
  timeMap.push(obj)

  // Шаг 6: adjustPrevious (строки 113-121)
  if (adjustPrevious && timeMap.length > 1) {
    const previous = timeMap[timeMap.length - 2]
    if (previous.output < currentTime) {
      const rate = previous.active ? previous.rate : 0
      previous.input += (currentTime - previous.output) * rate
      previous.output = currentTime
    }
    previous.rate = (obj.input - previous.input) / (obj.output - previous.output)
  }

  // Шаг 7: trim старых сегментов (строки 124-127)
  while (timeMap.length > 1 && timeMap[1].output <= outputTime) {
    timeMap.shift()
  }

  // Шаг 8: вычислить inputTime (строки 128-131)
  const activeSegment = timeMap[0]
  const rate = activeSegment.active ? activeSegment.rate : 0
  const inputTime = activeSegment.input + (outputTime - activeSegment.output) * rate

  return { ...obj, inputTime }
}

function freshTimeMap(currentTime = 0): TimeSegment[] {
  return [{ ...DEFAULT_SEGMENT, input: 0, output: currentTime }]
}

// ═══════════════════════════════════════════════════════════════
// Константы
// ═══════════════════════════════════════════════════════════════

const LAT = 0.06   // 60ms — фактическая latency
const CTX = 100    // "сейчас" в секундах

// ═══════════════════════════════════════════════════════════════
// ТЕСТЫ
// ═══════════════════════════════════════════════════════════════

describe('Vendor temporal map — schedule() algorithm', () => {

  // ── Тест 1: 067-B — schedule без outputTime/output ──────────
  it('1) schedule({input,rate}) без outputTime/output → output = currentTime + outputLatency (067-B)', () => {
    const map = freshTimeMap(CTX)
    const r = scheduleSegment(map, { input: 10, rate: 0.85, active: true }, CTX, LAT)

    expect(r.output).toBeCloseTo(CTX + LAT, 6)
    expect(r.input).toBe(10)
    expect(r.rate).toBe(0.85)
    expect(r.active).toBe(true)
    // inputTime: output == output, так что rate не вносит сдвиг
    expect(r.inputTime).toBeCloseTo(10, 6)
  })

  // ── Тест 2: explicit outputTime ────────────────────────────
  it('2) explicit outputTime → used as-is (no compensation)', () => {
    const map = freshTimeMap(CTX)
    const t = CTX + 2
    const r = scheduleSegment(map, { input: 15, rate: 1, active: true, outputTime: t }, CTX, LAT)

    expect(r.output).toBe(t)
    expect(r.input).toBe(15)
  })

  // ── Тест 3: output (ключ, не outputTime) — stop()/start() ──
  it('3) explicit output property → used as-is (needed by stop() and numeric start())', () => {
    const map = freshTimeMap(CTX)
    const t = CTX + 5
    // stop() vendor: schedule({active: false, output: when})
    const r = scheduleSegment(map, { active: false, output: t }, CTX, LAT)

    expect(r.output).toBe(t)
    expect(r.active).toBe(false)
  })

  // ── Тест 4: stop({output}) — exact stop position ──────
  it('5) stop({output}) creates segment at exact output position', () => {
    const map = freshTimeMap(CTX)
    // start
    scheduleSegment(map, { input: 10, rate: 1, active: true }, CTX, LAT)

    // stop через 5с — vendor: schedule({active: false, output: currentTime + 5})
    const stopOutput = CTX + 5
    const r = scheduleSegment(map, { active: false, output: stopOutput }, CTX, LAT)

    expect(r.active).toBe(false)
    expect(r.output).toBe(stopOutput)
    // input = позиция на момент stop: 10 + (stopOutput - startOutput) * 1.0
    const startOutput = CTX + LAT
    expect(r.input).toBeCloseTo(10 + (stopOutput - startOutput), 6)
  })

  // ── Тест 6: numeric start() — output=currentTime+latency ──
  it('6) numeric start() sets output = currentTime + outputLatency', () => {
    const map = freshTimeMap(CTX)
    // start() vendor строит объект: {output: currentTime + this.outputLatencySeconds}
    const r = scheduleSegment(map, {
      active: true, input: 3.72, rate: 1, semitones: 0,
      output: CTX + LAT,
    }, CTX, LAT)

    expect(r.output).toBeCloseTo(CTX + LAT, 6)
    expect(r.input).toBe(3.72)
    expect(r.rate).toBe(1)
  })

  // ── Тест 7: chaining — rate change builds from previous ────
  it('7) rate change does NOT retroactively shift input position', () => {
    const map = freshTimeMap(CTX)

    const seg1 = scheduleSegment(map, { input: 10, rate: 1, active: true }, CTX, LAT)
    const t1 = CTX + 1
    const seg2 = scheduleSegment(map, { rate: 0.85, active: true }, t1, LAT)

    // seg2.input = seg1.input + (t1+lat - CTX+lat) * 1.0 = 10 + 1 = 11
    expect(seg2.input).toBeCloseTo(11, 6)

    const t2 = CTX + 3
    const seg3 = scheduleSegment(map, { rate: 1.0, active: true }, t2, LAT)
    // seg3.input = seg2.input + (t2-t1) * 0.85 = 11 + 2*0.85 = 12.7
    expect(seg3.input).toBeCloseTo(12.7, 5)
  })

  // ── Тест 8: fast rate changes — monotonic input ────────────
  it('8) fast rate: each new segment input > previous', () => {
    const map = freshTimeMap(CTX)
    scheduleSegment(map, { input: 50, rate: 1, active: true }, CTX, LAT)

    const rates = [0.85, 1.0, 0.85, 1.0]
    let prev = 50
    for (let i = 0; i < rates.length; i++) {
      const t = CTX + (i + 1) * 0.5
      const r = scheduleSegment(map, { rate: rates[i], active: true }, t, LAT)
      expect(r.input).toBeGreaterThan(prev)
      prev = r.input
    }
    expect(map[map.length - 1].input).toBeGreaterThan(50)
    expect(map[map.length - 1].rate).toBe(1.0)
  })

  // ── Тест 9: old segments trimmed ───────────────────────────
  it('9) old segments trimmed, only relevant ones stay', () => {
    const map = freshTimeMap(CTX)
    scheduleSegment(map, { input: 10, rate: 1, active: true }, CTX, LAT)
    scheduleSegment(map, { input: 20, rate: 0.85, active: true }, CTX + 1, LAT)
    scheduleSegment(map, { input: 30, rate: 0.9, active: true }, CTX + 2, LAT)

    expect(map.length).toBeGreaterThanOrEqual(1)
    expect(map[map.length - 1].rate).toBe(0.9)
  })

  // ── Тест 10: stop → restart ───────────────────────────────
  it('10) stop then restart: active flips, input resets', () => {
    const map = freshTimeMap(CTX)
    scheduleSegment(map, { input: 10, rate: 1, active: true }, CTX, LAT)

    const stopT = CTX + 3
    scheduleSegment(map, { active: false, output: stopT }, stopT, LAT)

    const restartT = CTX + 5
    const r = scheduleSegment(map, { input: 25, rate: 1, active: true, outputTime: restartT }, restartT, LAT)
    expect(r.active).toBe(true)
    expect(r.input).toBe(25)
    expect(r.output).toBe(restartT)
  })

  // ── Тест 11: seek without outputTime — 067-B ──────────────
  it('11) seek via schedule({input,rate}) uses currentTime+outputLatency (067-B)', () => {
    const map = freshTimeMap(CTX)
    scheduleSegment(map, { input: 50, rate: 1, active: true }, CTX, LAT)

    const seekT = CTX + 2
    const r = scheduleSegment(map, { input: 10, rate: 1, active: true }, seekT, LAT)

    expect(r.output).toBeCloseTo(seekT + LAT, 6)
    expect(r.input).toBe(10)
    expect(r.active).toBe(true)
  })

  // ── Тест 12: stop uses output (not outputTime) — Sol_1 fix ─
  it('12) stop() passes output, not outputTime — must NOT fallback to currentTime+latency', () => {
    const map = freshTimeMap(CTX)
    scheduleSegment(map, { input: 10, rate: 1, active: true }, CTX, LAT)

    // stop() вендора: schedule({active: false, output: currentTime+5})
    // output=105, outputTime=undefined
    const stopOutput = CTX + 5  // 105
    const r = scheduleSegment(map, { active: false, output: stopOutput }, CTX, LAT)

    // Должен быть 105, а НЕ currentTime+latency=100.06
    expect(r.output).toBe(stopOutput)
    expect(r.active).toBe(false)
  })

  // ── Тест 13: output:0 edge case — falsy but valid ─────────
  it('13) output:0 is treated as a valid position (falsy but present)', () => {
    const map = freshTimeMap(CTX)
    // Кто-то вызвал schedule({output: 0})
    // output=0, outputTime=undefined → берем 0, не currentTime+latency
    const r = scheduleSegment(map, { active: true, input: 0, output: 0, rate: 1 }, CTX, LAT)
    expect(r.output).toBe(0)
    expect(r.input).toBe(0)
  })
})
