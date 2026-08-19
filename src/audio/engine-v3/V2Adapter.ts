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

export class V2Adapter {
  private static instance: V2Adapter
  static getInstance(): V2Adapter {
    if (!this.instance) this.instance = new V2Adapter()
    return this.instance
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
    return (v2 as any)[method]?.(...args)
  }

  async delegateAsync(method: string, ...args: any[]): Promise<any> {
    if (!PUBLIC_METHODS.has(method)) {
      throw new Error(`[V2Adapter] unknown public method: ${method}`)
    }
    const v2 = this.getV2Engine()
    if (!v2) throw new Error('[V2Adapter] V2 not available')
    const result = (v2 as any)[method]?.(...args)
    return result instanceof Promise ? result : Promise.resolve(result)
  }
}
