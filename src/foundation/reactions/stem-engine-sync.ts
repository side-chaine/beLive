// ============================================================
// src/foundation/reactions/stem-engine-sync.ts
// Central Bridge: Zustand subscribe → V2Adapter.delegateSync
//
// Sonnet C: одно место вместо 6 копий dual-call.
// Ручной diff (вместо subscribeWithSelector) + cold-start sync.
//
// ❄️ Frozen: 0 задето. Не импортит bridges, не меняет wrappers.
// ============================================================

import { useStemStore } from '../../stem/stem.store'
import { V2Adapter } from '../../audio/engine-v3/V2Adapter'

const V2_POLL_INTERVAL = 200 // ms — как часто проверять готовность V2

interface EngineStateSnapshot {
  stemVolumes: Record<string, number>
  stemMutes: Record<string, boolean>
  stemSolos: Record<string, boolean>
  stemPans: Record<string, number>
  stemsEnabled: boolean
}

/**
 * Central Bridge: реактивный слой Store → Engine.
 *
 * - Подписывается на stem.store через Zustand subscribe (basic, без middleware)
 * - Ручной diff: сравнивает prevVolumes/prevMutes/etc — idempotent guard (A1)
 * - Cold-start sync: при появлении window.audioEngine пушит всё текущее состояние
 * - HMR-safe: import.meta.hot.dispose вызывает cleanup
 * - Silent catch c console.warn (не пустой catch)
 */
export function initStemEngineSync(): () => void {
  const v2 = V2Adapter.getInstance()
  const shared = { prev: snapshot() } // mutable ref — accessible from coldSync
  let pollTimer: ReturnType<typeof setInterval> | null = null

  // --- Subscribe на stem.store (basic, один аргумент-callback) ---
  const unsub = useStemStore.subscribe((state) => {
    const current: EngineStateSnapshot = {
      stemVolumes: state.stemVolumes,
      stemMutes: state.stemMutes,
      stemSolos: state.stemSolos,
      stemPans: state.stemPans,
      stemsEnabled: state.stemsEnabled,
    }

    diffAndApply(current, shared.prev)
    shared.prev = current
  })

  // --- Cold-start sync: ждём появления V2 ---
  if (!isV2Ready(v2)) {
    pollTimer = setInterval(() => {
      if (isV2Ready(v2)) {
        coldSync(v2, shared)
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
      }
    }, V2_POLL_INTERVAL)
  } else {
    coldSync(v2, shared)
  }

  // HMR cleanup handled by initRegistry — internal dispose removed (Phase 5)

  return () => {
    unsub()
    if (pollTimer) clearInterval(pollTimer)
  }
}

// ─── Private ───────────────────────────────────────────────

function isV2Ready(v2: V2Adapter): boolean {
  return v2.getV2Engine() !== null
}

function coldSync(v2: V2Adapter, shared: { prev: EngineStateSnapshot }): void {
  const state = useStemStore.getState()
  const current: EngineStateSnapshot = {
    stemVolumes: { ...state.stemVolumes },
    stemMutes: { ...state.stemMutes },
    stemSolos: { ...state.stemSolos },
    stemPans: { ...state.stemPans },
    stemsEnabled: state.stemsEnabled,
  }

  // Push all current state to engine
  applyAll(v2, current)
  shared.prev = current
}

function diffAndApply(current: EngineStateSnapshot, prev: EngineStateSnapshot): void {
  const v2 = V2Adapter.getInstance()
  if (!isV2Ready(v2)) return

  // StemVolumes
  for (const id of Object.keys(current.stemVolumes)) {
    if (current.stemVolumes[id] !== prev.stemVolumes[id]) {
      safeDelegate(v2, 'setStemVolume', id, current.stemVolumes[id])
    }
  }

  // StemMutes
  for (const id of Object.keys(current.stemMutes)) {
    if (current.stemMutes[id] !== prev.stemMutes[id]) {
      safeDelegate(v2, 'setStemMute', id, current.stemMutes[id])
    }
  }

  // StemSolos
  for (const id of Object.keys(current.stemSolos)) {
    if (current.stemSolos[id] !== prev.stemSolos[id]) {
      safeDelegate(v2, 'setStemSolo', id, current.stemSolos[id])
    }
  }

  // StemPans
  for (const id of Object.keys(current.stemPans)) {
    if (current.stemPans[id] !== prev.stemPans[id]) {
      safeDelegate(v2, 'setStemPan', id, current.stemPans[id])
    }
  }

  // StemsEnabled
  if (current.stemsEnabled !== prev.stemsEnabled) {
    safeDelegate(v2, 'setStemsEnabled', current.stemsEnabled)
  }
}

function applyAll(v2: V2Adapter, state: EngineStateSnapshot): void {
  for (const [id, vol] of Object.entries(state.stemVolumes)) {
    safeDelegate(v2, 'setStemVolume', id, vol)
  }
  for (const [id, mute] of Object.entries(state.stemMutes)) {
    safeDelegate(v2, 'setStemMute', id, mute)
  }
  for (const [id, solo] of Object.entries(state.stemSolos)) {
    safeDelegate(v2, 'setStemSolo', id, solo)
  }
  for (const [id, pan] of Object.entries(state.stemPans)) {
    safeDelegate(v2, 'setStemPan', id, pan)
  }
  safeDelegate(v2, 'setStemsEnabled', state.stemsEnabled)
}

function snapshot(): EngineStateSnapshot {
  const s = useStemStore.getState()
  return {
    stemVolumes: { ...s.stemVolumes },
    stemMutes: { ...s.stemMutes },
    stemSolos: { ...s.stemSolos },
    stemPans: { ...s.stemPans },
    stemsEnabled: s.stemsEnabled,
  }
}

function safeDelegate(v2: V2Adapter, method: string, ...args: unknown[]): void {
  try {
    v2.delegateSync(method, ...args)
  } catch (e) {
    console.warn(`[StemEngineSync] delegateSync('${method}') failed:`, e)
  }
}
