// ============================================================
// src/foundation/registry/initRegistry.ts
// Единый реестр HMR-safe инициализаций.
// Phase 2 (002/R2): единый lifecycle для всех wrapper'ов.
// ============================================================

export interface RegistryEntry {
  /** Уникальный идентификатор (идемпотентность по id) */
  id: string
  /** Функция инициализации. Возвращает cleanup (опционально). */
  init: () => (() => void) | void
}

interface InternalEntry {
  id: string
  init: () => void
  cleanup: (() => void) | null
  done: boolean
}

const _registry = new Map<string, InternalEntry>()
const _order: string[] = [] // FIFO order
let _initialized = false

/**
 * Зарегистрировать инициализацию.
 * Идемпотентно — повторная регистрация того же id игнорируется.
 */
export function registerInit(entry: RegistryEntry): void {
  if (_registry.has(entry.id)) return
  _registry.set(entry.id, {
    id: entry.id,
    init: entry.init as () => void,
    cleanup: null,
    done: false,
  })
  _order.push(entry.id)
}

/**
 * Удалить регистрацию (для HMR re-init без потери порядка).
 */
export function unregister(id: string): void {
  _registry.delete(id)
  const idx = _order.indexOf(id)
  if (idx !== -1) _order.splice(idx, 1)
}

/**
 * Запустить все зарегистрированные инициализации в порядке FIFO.
 * Возвращает cleanupAll — вызывает cleanup'ы в обратном порядке (LIFO).
 *
 * - continue-on-error: если один init упал — остальные продолжаются
 * - idempotent: повторный вызов runAll() не дублирует выполненные init'ы
 * - cleanupAll idempotent: повторный вызов безопасен
 */
export function runAll(): () => void {
  const errors: Array<{ id: string; error: unknown }> = []

  for (const id of _order) {
    const entry = _registry.get(id)
    if (!entry || entry.done) continue
    try {
      const cleanup = entry.init()
      if (typeof cleanup === 'function') {
        entry.cleanup = cleanup
      }
      entry.done = true
    } catch (e) {
      errors.push({ id, error: e })
      console.error(`[initRegistry] ${id} init failed:`, e)
    }
  }

  _initialized = true

  if (errors.length > 0) {
    console.warn(`[initRegistry] ${errors.length}/${_order.length} inits had errors`)
  }

  return (): void => {
    if (!_initialized) return
    _initialized = false
    // LIFO: cleanup в обратном порядке
    for (let i = _order.length - 1; i >= 0; i--) {
      const entry = _registry.get(_order[i])
      if (!entry || !entry.cleanup) continue
      try {
        entry.cleanup()
      } catch (e) {
        console.error(`[initRegistry] ${entry.id} cleanup failed:`, e)
      }
    }
  }
}

/**
 * Сбросить реестр (для тестов).
 */
export function _reset(): void {
  _registry.clear()
  _order.length = 0
  _initialized = false
}
