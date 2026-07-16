// ============================================================
// src/audio/engine-v3/V2Adapter.ts
// V3-01: scaffold — Единственный файл, читающий V2.
// Линтер запрещает import из audio/core везде кроме этого файла.
// ============================================================

export class V2Adapter {
  private static instance: V2Adapter
  static getInstance(): V2Adapter {
    if (!this.instance) this.instance = new V2Adapter()
    return this.instance
  }

  getV2Engine(): any {
    return (window as any).audioEngine ?? null
  }

  getSync<T>(prop: string): T | undefined {
    return (this.getV2Engine() as any)?.[prop]
  }

  delegateSync(method: string, ...args: any[]): any {
    const v2 = this.getV2Engine()
    if (!v2) throw new Error('[V2Adapter] V2 not available')
    return (v2 as any)[method]?.(...args)
  }

  async delegateAsync(method: string, ...args: any[]): Promise<any> {
    const v2 = this.getV2Engine()
    if (!v2) throw new Error('[V2Adapter] V2 not available')
    const result = (v2 as any)[method]?.(...args)
    return result instanceof Promise ? result : Promise.resolve(result)
  }

  /** Set a property on V2 engine (замена прямой записи в audioEngine) */
  setProp(prop: string, value: any): void {
    const v2 = this.getV2Engine()
    if (v2) (v2 as any)[prop] = value
  }
}
