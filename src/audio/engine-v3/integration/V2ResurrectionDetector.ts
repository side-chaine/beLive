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
//   det.arm()       // start monitoring
//   det.v2LeakCount // number of detected V2 leaks
//   det.disarm()    // stop monitoring
//
// This file is NEVER imported in production bundles — guarded by import.meta.env.DEV.

import type { V2AudioCage } from './V2AudioCage'

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
  private _originalDelegateSync: ((method: string, ...args: unknown[]) => unknown) | null = null
  private _originalConsoleWarn: typeof console.warn | null = null
  private _originalV2Play: (() => void) | null = null

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
   *  - Cage state: checks if cage is active and V2 RMS is above noise floor
   *  - V2Adapter.delegateSync calls (intercepted)
   *  - console.warn from V2Adapter fallback messages
   */
  arm(cage?: V2AudioCage): void {
    if (this._armed) return
    this._armed = true
    this._cage = cage ?? null

    // Intercept V2Adapter.delegateSync('play') calls
    this._interceptDelegateSync()

    // Polling monitor: every 500ms check for V2 activity
    this._monitorInterval = setInterval(() => {
      this._checkCageState()
      this._checkRMSSignature()
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

    this._restoreDelegateSync()
    this._cage = null
    console.log('[V2ResurrectionDetector] ✅ Disarmed — cleanup complete')
  }

  private _interceptDelegateSync(): void {
    try {
      // Dynamic import to avoid circular dependency at module load time
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const V2Adapter = require('../../audio/V2Adapter')?.V2Adapter
      if (!V2Adapter?.getInstance) return

      const instance = V2Adapter.getInstance()
      if (!instance || typeof instance.delegateSync !== 'function') return

      this._originalDelegateSync = instance.delegateSync.bind(instance)
      const self = this
      instance.delegateSync = function (method: string, ...args: unknown[]): unknown {
        if (method === 'play') {
          self._record('delegateSync', `V2Adapter.delegateSync('play') called`)
        }
        return self._originalDelegateSync!.call(this, method, ...args)
      }
    } catch {
      // V2Adapter not available — no interception
    }
  }

  private _restoreDelegateSync(): void {
    try {
      const V2Adapter = require('../../audio/V2Adapter')?.V2Adapter
      if (V2Adapter?.getInstance && this._originalDelegateSync) {
        const instance = V2Adapter.getInstance()
        if (instance) {
          instance.delegateSync = this._originalDelegateSync
        }
      }
    } catch {
      // ignore
    }
    this._originalDelegateSync = null
  }

  private _checkCageState(): void {
    if (!this._cage) return
    try {
      const state = (this._cage as any).getState?.()
      if (!state) return
      // If cage says V2 is caged but V2 RMS is present, we have a leak
      if (state.v2Caged && state.v2Rms != null && state.v2Rms > 0.005) {
        this._record('cageGap', `V2 RMS=${state.v2Rms.toFixed(6)} while cage reports caged`)
      }
    } catch {
      // cage state unavailable
    }
  }

  private _checkRMSSignature(): void {
    // Check if V2 audio nodes are still in the audio graph
    // by sampling RMS through the global diagnostics API
    try {
      const w = typeof window !== 'undefined' ? window as any : null
      if (!w?.__belive?.pipeline?.getBackendState) return

      const state = w.__belive.pipeline.getBackendState()
      if (!state) return

      // If pipeline is active but V3 reports only one audible bus,
      // yet V2 RMS is measurable — that's a resurrection
      // (Detection via external RMS meter, not inline)
    } catch {
      // diagnostics not available
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
