// src/audio/engine-v3/pipeline/StretchInstancePool.ts
// Пул StretchInstance — максимум MAX_INSTANCES = 7 (FULL: 6 music stems + 1 instrumental)
// 🔧 ОПУС-ДЕНЬ-0: откат MP-29 — вернули 7 слотов, пока не готов MultichannelStretch
// Динамическое назначение стемов на слоты

import { StretchInstance } from './StretchInstance'

export const MAX_STRETCH_INSTANCES = 7
export type StretchSlot = 0 | 1 | 2 | 3 | 4 | 5 | 6
type SlotState = 'free' | 'assigned' | 'clearing'

/** Приоритет слотов: vocals > bass > guitar > keys > piano > other (Sonnet TC-план, Проблема 3) */
const STRETCH_PRIORITY: Record<string, number> = {
  instrumental: 0,
  vocals: 1,
  bass: 2,
  guitar: 3,
  keys: 4,
  piano: 5,
  other: 6,
}

export class StretchInstancePool {
  private readonly _instances: Map<StretchSlot, StretchInstance> = new Map()
  private readonly _assignedStems: Map<string, StretchSlot> = new Map()
  private readonly _assignedPriorities: Map<StretchSlot, number> = new Map()
  private readonly _slotStates: Map<StretchSlot, SlotState> = new Map()
  private readonly _slotToStem: Map<StretchSlot, string> = new Map()
  private readonly _ctx: AudioContext

  constructor(ctx: AudioContext) {
    this._ctx = ctx
  }

  async initAll(): Promise<void> {
    const promises: Promise<void>[] = []
    for (let i = 0; i < MAX_STRETCH_INSTANCES; i++) {
      const slot = i as StretchSlot
      const instance = new StretchInstance(`stretch-${slot}`, { ctx: this._ctx })
      this._instances.set(slot, instance)
      this._slotStates.set(slot, 'free')
      promises.push(instance.init().catch(e => {
        console.warn(`[StretchPool] Slot ${slot} init failed:`, e)
      }))
    }
    await Promise.allSettled(promises)
    const active = this.activeCount
    console.log(`[StretchPool] ✅ ${active}/${MAX_STRETCH_INSTANCES} instances active`)
  }

  get activeCount(): number {
    let count = 0
    for (const inst of this._instances.values()) {
      if (inst.isActive) count++
    }
    return count
  }

  /** Получить приоритет стема (65535 = нет в списке = низший) */
  private _priorityOf(stemId: string): number {
    return STRETCH_PRIORITY[stemId] ?? 65535
  }

  private _assignSlot(stemId: string, slot: StretchSlot): void {
    this._assignedStems.set(stemId, slot)
    this._slotToStem.set(slot, stemId)
    this._assignedPriorities.set(slot, this._priorityOf(stemId))
    this._slotStates.set(slot, 'assigned')
    const instance = this._instances.get(slot)
    if (instance) instance.stemId = stemId
  }

  private _findFreeSlot(): StretchSlot | null {
    for (const [slot, state] of this._slotStates) {
      if (state === 'free') return slot
    }
    return null
  }

  private _findEvictionCandidate(stemId: string): StretchSlot | null {
    const myPriority = this._priorityOf(stemId)
    let lowestSlot: StretchSlot | null = null
    let lowestPriority = -1
    for (const [slot, priority] of this._assignedPriorities) {
      if (priority > lowestPriority) {
        lowestPriority = priority
        lowestSlot = slot
      }
    }
    if (lowestSlot !== null && myPriority < lowestPriority) {
      return lowestSlot
    }
    return null
  }

  /**
   * Назначить стем на слот (только free slot — без eviction).
   * Eviction требует async (ensureSlot).
   */
  assign(stemId: string): StretchInstance | null {
    // Если уже назначен — возвращаем существующий
    const existingSlot = this._assignedStems.get(stemId)
    if (existingSlot !== undefined) {
      return this._instances.get(existingSlot) ?? null
    }
    // Ищем свободный слот
    const freeSlot = this._findFreeSlot()
    if (freeSlot !== null) {
      this._assignSlot(stemId, freeSlot)
      return this._instances.get(freeSlot)!
    }
    // Все заняты — eviction требует async (ensureSlot)
    return null
  }

  async ensureSlot(stemId: string): Promise<StretchInstance | null> {
    // 1. Если уже есть — возвращаем
    const existing = this.get(stemId)
    if (existing) return existing

    // 2. Пробуем sync assign (только free slot)
    const inst = this.assign(stemId)
    if (inst) return inst

    // 3. Все заняты → eviction кандидат
    const evict = this._findEvictionCandidate(stemId)
    if (evict === null) return null

    const evictedStemId = this._slotToStem.get(evict)
    const instance = this._instances.get(evict)!

    // Transactional: assigned → clearing
    this._slotStates.set(evict, 'clearing')

    // Асинхронная очистка (stop + dropBuffers)
    instance.stop()
    await instance.clearBuffers()

    // Очищаем старый mapping
    if (evictedStemId) {
      this._assignedStems.delete(evictedStemId)
    }
    this._slotToStem.delete(evict)
    this._assignedPriorities.delete(evict)
    this._slotStates.set(evict, 'free')

    // Назначаем новому stem'у
    this._assignSlot(stemId, evict)

    console.warn(`[StretchPool] 🔄 Evicted "${evictedStemId}" (async cleanup) → assigned "${stemId}"`)
    return instance
  }

  /** Освободить слот */
  release(stemId: string): void {
    const slot = this._assignedStems.get(stemId)
    if (slot !== undefined) {
      this._slotStates.set(slot, 'free')
      this._slotToStem.delete(slot)
      this._assignedPriorities.delete(slot)
    }
    this._assignedStems.delete(stemId)
  }

  /** Получить StretchInstance по stemId */
  get(stemId: string): StretchInstance | null {
    const slot = this._assignedStems.get(stemId)
    if (slot === undefined) return null
    return this._instances.get(slot) ?? null
  }

  /** Загрузить буфер в инстанс для стема */
  async loadBuffer(stemId: string, buffer: AudioBuffer): Promise<void> {
    const inst = this.get(stemId)
    if (inst) await inst.loadBuffer(buffer)
  }

  /** 057: Старт всех активных stretch инстансов с позиции P.
   *  061-A: запускаем только assigned слоты — резервный stretch-6 без стема
   *  не стартует (буфер undefined → processorerror в WASM). */
  async startAll(offset: number, rate: number): Promise<void> {
    const assignedSlots = new Set(this._assignedStems.values())
    if (assignedSlots.size === 0) {
      console.warn('[StretchPool] startAll: no assigned slots — skipping')
      return
    }
    const promises: Promise<void>[] = []
    for (const [slot, inst] of this._instances) {
      if (inst.isActive && assignedSlots.has(slot)) {
        promises.push(inst.start(offset, rate))
      }
    }
    await Promise.allSettled(promises)
  }

  /** Применить rate ко всем активным */
  async scheduleRateAll(rate: number, semitones: number = 0): Promise<void> {
    const assignedSlots = new Set(this._assignedStems.values())
    if (assignedSlots.size === 0) return
    const promises: Promise<void>[] = []
    for (const [slot, inst] of this._instances) {
      if (inst.isActive && assignedSlots.has(slot)) {
        promises.push(inst.scheduleRate(rate, semitones))
      }
    }
    await Promise.allSettled(promises)
  }

  /** Применить loop ко всем активным */
  async scheduleLoopAll(start: number, end: number): Promise<void> {
    const assignedSlots = new Set(this._assignedStems.values())
    if (assignedSlots.size === 0) return
    const promises: Promise<void>[] = []
    for (const [slot, inst] of this._instances) {
      if (inst.isActive && assignedSlots.has(slot)) {
        promises.push(inst.scheduleLoop(start, end))
      }
    }
    await Promise.allSettled(promises)
  }

  /** Снять loop со всех активных (M2, Корень B) */
  async scheduleLoopNoneAll(): Promise<void> {
    const assignedSlots = new Set(this._assignedStems.values())
    if (assignedSlots.size === 0) return
    const promises: Promise<void>[] = []
    for (const [slot, inst] of this._instances) {
      if (inst.isActive && assignedSlots.has(slot)) {
        promises.push(inst.scheduleLoopNone().catch((e: unknown) =>
          console.warn(`[StretchPool] loop-none failed for slot ${slot}:`, e)))
      }
    }
    await Promise.allSettled(promises)
  }

  /** Seek всех к позиции */
  async scheduleSeekAll(time: number, rate: number): Promise<void> {
    const assignedSlots = new Set(this._assignedStems.values())
    if (assignedSlots.size === 0) return
    const promises: Promise<void>[] = []
    for (const [slot, inst] of this._instances) {
      if (inst.isActive && assignedSlots.has(slot)) {
        promises.push(inst.seek(time, rate))
      }
    }
    await Promise.allSettled(promises)
  }

  /** Стоп всех */
  stopAll(): void {
    for (const inst of this._instances.values()) {
      if (inst.isActive) inst.stop()
    }
  }

  /** 🧹 Очистить буферы ВСЕХ инстансов — вызывается при reset() */
  async clearAllBuffers(): Promise<void> {
    const promises: Promise<void>[] = []
    for (const inst of this._instances.values()) {
      promises.push(inst.clearBuffers())
    }
    await Promise.allSettled(promises)
    this._assignedStems.clear()
    this._slotToStem.clear()
    this._assignedPriorities.clear()
    this._slotStates.clear()
    for (let i = 0; i < MAX_STRETCH_INSTANCES; i++) {
      this._slotStates.set(i as StretchSlot, 'free')
    }
  }

  dispose(): void {
    this.stopAll()
    for (const inst of this._instances.values()) inst.dispose()
    this._instances.clear()
    this._assignedStems.clear()
    this._assignedPriorities.clear()
  }
}
