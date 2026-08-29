// ============================================================
// src/audio/engine-v3/V2Adapter.ts
// V3-01: scaffold — Единственный файл, читающий V2.
// Линтер запрещает import из audio/core везде кроме этого файла.
//
// TIER 1: только чтение публичного API через IV2PublicContract.
// `-префиксные ключи ЗАПРЕЩЕНЫ — Tier 1 breach → throw.
// setProp удалён — V2 read-only.
// ============================================================

import {
  type IV2PublicContract,
  PUBLIC_GETTERS,
  PUBLIC_METHODS,
  isPublicKey,
} from './IV2PublicContract'

/**
 * Наблюдатель за вызовами V2.
 * Получает имя метода и аргументы ДО того, как вызов дойдёт до V2.
 *
 * Контракт наблюдателя (важно):
 *  - наблюдатель НЕ имеет права ронять аудио — V2Adapter гасит его исключения;
 *  - наблюдатель НЕ должен сам вызывать delegateSync/delegateAsync для того же
 *    метода, который он слушает — это рекурсия.
 */
export type V2CallObserver = (method: string, args: unknown[]) => void

export class V2Adapter {
  private static instance: V2Adapter
  static getInstance(): V2Adapter {
    if (!this.instance) this.instance = new V2Adapter()
    return this.instance
  }

  private readonly _observers = new Set<V2CallObserver>()

  /**
   * Единственная точка, через которую можно наблюдать за обращениями к V2.
   *
   * Раньше наблюдатели (V2ResurrectionDetector) подменяли метод на инстансе
   * через require() + monkey-patching. Это не работает в ESM-бандле Vite
   * (require не существует → ReferenceError глушится catch) и требует
   * ручного restore. Подписка снимает обе проблемы конструктивно.
   *
   * @returns функция отписки
   */
  observe(fn: V2CallObserver): () => void {
    this._observers.add(fn)
    return () => {
      this._observers.delete(fn)
    }
  }

  private _notify(method: string, args: unknown[]): void {
    for (const fn of this._observers) {
      try {
        fn(method, args)
      } catch {
        // Наблюдатель не имеет права ронять аудио. Никогда.
      }
    }
  }

  /** Получить V2 engine, приведённый к публичному контракту */
  getV2Engine(): IV2PublicContract | null {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any — единственный as any
    return ((window as any).audioEngine as IV2PublicContract) ?? null
  }

  /**
   * Прочитать публичное свойство V2.
   * Доступ к `-префиксным полям ЗАПРЕЩЁН → throw.
   * Разрешены только геттеры из PUBLIC_GETTERS.
   */
  getSync<T = unknown>(prop: string): T | undefined {
    if (!isPublicKey(prop)) {
      throw new Error(`[V2Adapter] private access denied: ${prop}`)
    }
    if (!PUBLIC_GETTERS.has(prop)) {
      throw new Error(`[V2Adapter] unknown public getter: ${prop}`)
    }
    const v2 = this.getV2Engine()
    return (v2 as any)?.[prop] as T | undefined
  }

  /**
   * Вызвать публичный метод V2.
   * method проверяется против PUBLIC_METHODS.
   */
  delegateSync(method: string, ...args: any[]): any {
    if (!PUBLIC_METHODS.has(method)) {
      throw new Error(`[V2Adapter] unknown public method: ${method}`)
    }
    const v2 = this.getV2Engine()
    if (!v2) throw new Error('[V2Adapter] V2 not available')
    // Уведомляем ДО вызова: фиксируем намерение, а не результат.
    // Если V2 бросит исключение — факт обращения к нему всё равно зафиксирован.
    this._notify(method, args)
    return (v2 as any)[method]?.(...args)
  }

  async delegateAsync(method: string, ...args: any[]): Promise<any> {
    if (!PUBLIC_METHODS.has(method)) {
      throw new Error(`[V2Adapter] unknown public method: ${method}`)
    }
    const v2 = this.getV2Engine()
    if (!v2) throw new Error('[V2Adapter] V2 not available')
    this._notify(method, args)
    const result = (v2 as any)[method]?.(...args)
    return result instanceof Promise ? result : Promise.resolve(result)
  }
}
