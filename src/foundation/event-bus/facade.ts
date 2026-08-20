// ============================================================
// src/foundation/event-bus/facade.ts
// Bridges → EventBus Facade (Strangler Fig)
// 
// Phase A: Structural — Symbol, singleton, drain, destroy
// Phase B: Semantic — unroute by type, signal, capture
// Phase C: Architectural — dual-publish, once guard
// Phase D: Cosmetic — subscribeOnce without as any
// ============================================================

import { eventBus } from './event-bus'
import { EventBusChannel } from './types'

// Каждое событие, которое Facade перехватывает.
// Ключ = имя legacy CustomEvent, значение = EventBus канал + новое имя события.
export const LEGACY_EVENT_MAP: Record<string, { channel: EventBusChannel; event: string }> = {
  // AUDIO (9)
  'track-loaded':              { channel: EventBusChannel.Audio, event: 'track-loaded' },
  'track-fully-loaded':        { channel: EventBusChannel.Audio, event: 'track-fully-loaded' },
  'track-stem-ready':          { channel: EventBusChannel.Audio, event: 'track-stem-ready' },
  'playback-state-changed':    { channel: EventBusChannel.Audio, event: 'playback-state-changed' },
  'playback-rate-changed':     { channel: EventBusChannel.Audio, event: 'playback-rate-changed' },
  'vocalmix-state-changed':    { channel: EventBusChannel.Audio, event: 'vocalmix-state-changed' },
  'microphone-state-changed':  { channel: EventBusChannel.Audio, event: 'microphone-state-changed' },
  'monitor-state-changed':     { channel: EventBusChannel.Audio, event: 'monitor-state-changed' },
  'monitor-route-changed':     { channel: EventBusChannel.Audio, event: 'monitor-route-changed' },

  // TRACK (2)
  'before-track-change':       { channel: EventBusChannel.Track, event: 'before-change' },
  'track-load-failed':         { channel: EventBusChannel.Track, event: 'load-failed' },

  // CATALOG (4)
  'track-saved':               { channel: EventBusChannel.Catalog, event: 'track-saved' },
  'tracks-changed':            { channel: EventBusChannel.Catalog, event: 'tracks-changed' },
  'catalog-close':             { channel: EventBusChannel.Catalog, event: 'catalog-close' },
  'catalog-cleared':           { channel: EventBusChannel.Catalog, event: 'catalog-cleared' },

  // SYNC (8 — sync-editor-closed ИСКЛЮЧЕНО как RESIDUE)
  'blocks-applied':            { channel: EventBusChannel.Sync, event: 'blocks-applied' },
  'active-line-changed':       { channel: EventBusChannel.Sync, event: 'active-line-changed' },
  'lyrics-rendered':           { channel: EventBusChannel.Sync, event: 'lyrics-rendered' },
  'save-track-markers':        { channel: EventBusChannel.Sync, event: 'save-track-markers' },
  'loop-set':                  { channel: EventBusChannel.Sync, event: 'loop-set' },
  'loop-cleared':              { channel: EventBusChannel.Sync, event: 'loop-cleared' },
  'loopcompleted':             { channel: EventBusChannel.Sync, event: 'loopcompleted' },
  'sections-updated':          { channel: EventBusChannel.Sync, event: 'sections-updated' },

  // UI (3)
  'mode-changed':              { channel: EventBusChannel.UI, event: 'mode-changed' },
  'block-scenes-loaded':       { channel: EventBusChannel.UI, event: 'block-scenes-loaded' },
  // FIXME(STUB-MIGRATION): live-mode.stub.ts ещё шлёт CustomEvent.
  // Удалить, когда stub заменится на typed publisher.
  'camera-permission-resolved':{ channel: EventBusChannel.UI, event: 'camera-permission-resolved' },

  // PRACTICE (6 → 1 объединённое)
  'practice:started':          { channel: EventBusChannel.Practice, event: 'practice:state-changed' },
  'practice:completed':        { channel: EventBusChannel.Practice, event: 'practice:state-changed' },
  'practice:completed-kept':   { channel: EventBusChannel.Practice, event: 'practice:state-changed' },
  'practice:cancelled':        { channel: EventBusChannel.Practice, event: 'practice:state-changed' },
  'practice:auto-paused':      { channel: EventBusChannel.Practice, event: 'practice:state-changed' },
  'practice:pass-complete':    { channel: EventBusChannel.Practice, event: 'practice:state-changed' },
}

// ---------------------------------------------------------------------------
// SubRecord — запись о перехваченной подписке
// ---------------------------------------------------------------------------
interface SubRecord {
  legacyType: string
  listener: EventListenerOrEventListenerObject
  options?: AddEventListenerOptions | boolean
}

// ---------------------------------------------------------------------------
// BridgeFacade
// ---------------------------------------------------------------------------
export class BridgeFacade {
  // Module-level singleton registry (HMR-safe через globalThis)
  static getSingleton(): BridgeFacade {
    const g = globalThis as any
    if (!g.__beliveBridgeFacade) {
      g.__beliveBridgeFacade = new BridgeFacade()
    }
    return g.__beliveBridgeFacade as BridgeFacade
  }

  // Храним ВСЕ перехваченные подписки: WeakMap<listener, Map<legacyType, SubRecord>>
  private _subs = new WeakMap<EventListenerOrEventListenerObject, Map<string, SubRecord>>()

  // Strong-ref Set для подписок, которые иначе GC съел бы
  private _strongRefs = new Set<SubRecord>()

  // Оригинальные методы prototype
  private _origAdd: ((type: string, listener: EventListenerOrEventListenerObject, options?: AddEventListenerOptions | boolean) => void) | null = null
  private _origRemove: ((type: string, listener: EventListenerOrEventListenerObject, options?: AddEventListenerOptions | boolean) => void) | null = null
  private _origDispatch: ((event: Event) => boolean) | null = null

  private _initialized = false

  // -----------------------------------------------------------------------
  // init() — monkey-patch EventTarget.prototype
  // -----------------------------------------------------------------------
  init(): void {
    if (this._initialized) return
    this._initialized = true

    const proto = EventTarget.prototype

    this._origAdd = proto.addEventListener
    this._origRemove = proto.removeEventListener
    this._origDispatch = proto.dispatchEvent

    const self = this

    // --- Phase C: patched addEventListener ---
    proto.addEventListener = function (
      this: EventTarget,
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: AddEventListenerOptions | boolean,
    ): void {
      // Фильтр target: маршрутизируем только document/window
      if (this === document || this === window) {
        self.#route(type, listener, options)
      }
      // Вызываем оригинал (нативный { once: true } сам отписывается)
      self._origAdd!.call(this, type, listener, options)
    }

    // --- Phase B + C: patched removeEventListener ---
    proto.removeEventListener = function (
      this: EventTarget,
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: AddEventListenerOptions | boolean,
    ): void {
      // Phase B: unroute передаёт type
      self.#unroute(listener, type)

      // Вызываем оригинал
      self._origRemove!.call(this, type, listener, options)
    }

    // --- Phase C: patched dispatchEvent ---
    proto.dispatchEvent = function (this: EventTarget, event: Event): boolean {
      // Фильтруем: только document/window — не трогаем кастомные EventTarget (Worker, AudioContext, WebSocket и т.д.)
      if (event instanceof CustomEvent && (this === document || this === window)) {
        const mapping = LEGACY_EVENT_MAP[event.type]
        if (mapping) {
          let detail = event.detail ?? {}
          // Баг #3: для practice-канала обогащаем payload полем type из имени legacy-события
          if (mapping.channel === EventBusChannel.Practice && event.type.startsWith('practice:')) {
            detail = { ...detail, type: event.type.replace('practice:', '') }
          }
          (eventBus.publish as any)(mapping.channel, mapping.event, detail)
        }
      }
      // Потом оригинальный dispatch (НЕ return true!)
      return self._origDispatch!.call(this, event)
    }
  }

  // -----------------------------------------------------------------------
  // destroy() — полная деактивация Facade
  // -----------------------------------------------------------------------
  destroy(): void {
    if (!this._initialized) return
    this._initialized = false

    // Phase A: drain — очищаем все подписки
    this.#drainSubs()

    // Восстанавливаем оригинальные методы prototype
    const proto = EventTarget.prototype
    if (this._origAdd) proto.addEventListener = this._origAdd
    if (this._origRemove) proto.removeEventListener = this._origRemove
    if (this._origDispatch) proto.dispatchEvent = this._origDispatch

    this._origAdd = null
    this._origRemove = null
    this._origDispatch = null
    this._strongRefs.clear()
  }

  // -----------------------------------------------------------------------
  // #route — регистрирует подписку в Facade
  // -----------------------------------------------------------------------
  #route(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions | boolean,
  ): void {
    if (!LEGACY_EVENT_MAP[type]) return // не наше событие — пропускаем

    let typeMap = this._subs.get(listener)
    if (!typeMap) {
      typeMap = new Map()
      this._subs.set(listener, typeMap)
    }

    if (!typeMap.has(type)) {
      const rec: SubRecord = { legacyType: type, listener, options }
      typeMap.set(type, rec)
      this._strongRefs.add(rec)
    }

    // Phase B: options.signal — вешаем abort-handler
    if (typeof options === 'object' && options?.signal) {
      // Баг #5: если signal уже aborted — unroute сразу
      if (options.signal.aborted) {
        this.#unroute(listener, type)
        return
      }
      options.signal.addEventListener('abort', () => {
        this.#unroute(listener, type)
      }, { once: true })
    }
  }

  // -----------------------------------------------------------------------
  // #unroute — удаляет регистрацию подписки
  // -----------------------------------------------------------------------
  #unroute(listener: EventListenerOrEventListenerObject, legacyType?: string): void {
    const typeMap = this._subs.get(listener)
    if (!typeMap) return

    if (legacyType) {
      // Phase B: удаляем только по type
      const rec = typeMap.get(legacyType)
      if (rec) {
        this._strongRefs.delete(rec)
        typeMap.delete(legacyType)
      }
    } else {
      // Удаляем все подписки этого listener
      for (const rec of typeMap.values()) {
        this._strongRefs.delete(rec)
      }
      typeMap.clear()
    }

    // Если у listener больше нет подписок — удаляем из WeakMap
    if (typeMap.size === 0) {
      this._subs.delete(listener)
    }
  }

  // -----------------------------------------------------------------------
  // #drainSubs — очищает все зарегистрированные подписки
  // -----------------------------------------------------------------------
  #drainSubs(): void {
    // WeakMap чистить не нужно (GC), но strong-refs — обязательно
    this._strongRefs.clear()
    this._subs = new WeakMap()
  }

  // -----------------------------------------------------------------------
  // subscribeOnce — разовая подписка на EventBus (Phase D)
  // -----------------------------------------------------------------------
  subscribeOnce<C extends EventBusChannel, E extends keyof (import('./types').EventMap)[C] & string>(
    channel: C,
    event: E,
    callback: (payload: (import('./types').EventMap)[C][E]) => void,
  ): void {
    // Баг #2: правильный паттерн — отписаться ДО вызова callback
    const sub = eventBus.subscribe(channel, event as never, ((payload: unknown) => {
      sub.unsubscribe()
      callback(payload as any)
    }) as never)
  }
}

// HMR-safe: при hot-reload корректно пересоздаём singleton
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    bridgeFacade.destroy()
  })
}

// --- Singleton ---
export const bridgeFacade = BridgeFacade.getSingleton()
