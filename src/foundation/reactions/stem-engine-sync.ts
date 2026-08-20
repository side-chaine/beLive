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
import { useAudioStore } from '../../stores/audio.store'
import { V2Adapter, getTransport } from '../../audio/engine-v3'

const V2_POLL_INTERVAL = 200 // ms — как часто проверять готовность V2

// ═══ Module-level mutable ref для diffAndApply ═══
let _prevSnapshot: EngineStateSnapshot | null = null

/** V3 мастер если pipeline есть и есть стемы — даже если transport.state === 'idle' (ждут play) */
function isV3Master(): boolean {
  const t3 = getTransport()
  // 009: __v3Active — pipeline активен, orchestrator.all() может быть пуст (MP-23)
  return !!(t3 && ((window as any).__v3Active || t3.orchestrator.all().length > 0))
}

/** Music stems (excl. instrumental + vocals) muted by default per FR-014 */
const MUSIC_STEMS = new Set(['drums', 'bass', 'keys', 'guitar', 'backing', 'other'])

/** Вычислить effective gain для применения к V3 стему */
function effectiveGain(state: EngineStateSnapshot, id: string): number {
  if (!state.stemsEnabled && MUSIC_STEMS.has(id)) {
    if (id === 'instrumental') console.log(`[RECON-7] ${performance.now().toFixed(0)} instrumental MUTED by FR-014 | stemsEnabled:${state.stemsEnabled}`);
    return 0
  }

  const hasSolo = Object.values(state.stemSolos).some(Boolean)
  if (hasSolo) {
    const result = state.stemSolos[id] ? state.stemVolumes[id] ?? 1 : 0
    if (id === 'instrumental') console.log(`[RECON-7] ${performance.now().toFixed(0)} instrumental SOLO | solos:${JSON.stringify(state.stemSolos)} | vol:${state.stemVolumes[id]} | result:${result}`);
    return result
  }

  const result = state.stemMutes[id] ? 0 : (state.stemVolumes[id] ?? 1)
  if (id === 'instrumental') console.log(`[RECON-7] ${performance.now().toFixed(0)} instrumental MUTE/VOL | muted:${state.stemMutes[id]} | vol:${state.stemVolumes[id]} | result:${result}`);
  return result
}

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
  _prevSnapshot = snapshot() // инициализация module-level ref
  let pollTimer: ReturnType<typeof setInterval> | null = null

  const unsub = useStemStore.subscribe((state) => {
    const current: EngineStateSnapshot = {
      stemVolumes: state.stemVolumes,
      stemMutes: state.stemMutes,
      stemSolos: state.stemSolos,
      stemPans: state.stemPans,
      stemsEnabled: state.stemsEnabled,
    }
    diffAndApply(current, _prevSnapshot ?? current)
    _prevSnapshot = current
  })

  const unsubRate = useAudioStore.subscribe((state, prev) => {
    if (state.playbackRate === prev.playbackRate) return
    const t3 = isV3Master() ? getTransport() : null
    if (t3) {
      t3.setPlaybackRate(state.playbackRate)
    } else if (isV2Ready(v2)) {
      safeDelegate(v2, 'setPlaybackRate', state.playbackRate)
    }
  })

  if (!isV2Ready(v2)) {
    pollTimer = setInterval(() => {
      if (isV2Ready(v2)) {
        coldSync(v2)
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
      }
    }, V2_POLL_INTERVAL)
  } else {
    coldSync(v2)
  }

  return () => {
    unsub()
    unsubRate()
    if (pollTimer) clearInterval(pollTimer)
  }
}

// ─── Private ───────────────────────────────────────────────

function isV2Ready(v2: V2Adapter): boolean {
  return v2.getV2Engine() !== null
}

function coldSync(v2: V2Adapter): void {
  const state = useStemStore.getState()
  const current: EngineStateSnapshot = {
    stemVolumes: { ...state.stemVolumes },
    stemMutes: { ...state.stemMutes },
    stemSolos: { ...state.stemSolos },
    stemPans: { ...state.stemPans },
    stemsEnabled: state.stemsEnabled,
  }
  applyAll(v2, current)
  _prevSnapshot = current
}

function diffAndApply(current: EngineStateSnapshot, prev: EngineStateSnapshot): void {
  // Определяем активный engine
  const t3 = isV3Master() ? getTransport() : null
  const v2 = V2Adapter.getInstance()
  const isV2 = !t3 && isV2Ready(v2)

  // StemVolumes
  for (const id of Object.keys(current.stemVolumes)) {
    if (current.stemVolumes[id] !== prev.stemVolumes[id]) {
      if (t3) {
        // 🔥 V3 STATE GATE: применяем raw volume, НЕ effectiveGain.
        // effectiveGain учитывает solo/mute — V2 солоит vocals, что глушит 6/7 стемов.
        // V3 управляет gain напрямую, solo/mute V2 игнорируются.
        // 🧹 Fix 389: volume применяется к pipeline НАПРЯМУЮ (как mute/solo).
        // Ранее блокировалось `if (stem)` из t3.orchestrator.get(id) — orchestrator
        // пуст в V3-режиме (MP-23), поэтому setStemVolume не доходил до pipeline.
        const pipeline = (window as any).__belive?.pipeline
        if (pipeline?.setStemVolume) pipeline.setStemVolume(id, current.stemVolumes[id])
        const stem = t3.orchestrator.get(id)
        if (stem) stem.volume = current.stemVolumes[id]
      } else if (isV2) {
        safeDelegate(v2, 'setStemVolume', id, current.stemVolumes[id])
      }
    }
  }

  // StemMutes — влияет на effective gain для V3
  for (const id of Object.keys(current.stemMutes)) {
    if (current.stemMutes[id] !== prev.stemMutes[id]) {
      if (t3) {
        // V3: mute через pipeline.muteStem() (359: ветка была пустой — mute не доходил)
        const pipeline = (window as any).__belive?.pipeline
        if (pipeline?.muteStem) pipeline.muteStem(id, current.stemMutes[id])
      } else if (isV2) {
        safeDelegate(v2, 'setStemMute', id, current.stemMutes[id])
      }
    }
  }

  // StemSolos — влияет на ВСЕ каналы (solo semantic)
  if (hasSoloChange(current, prev)) {
    if (t3) {
      // V3: solo через pipeline.soloStem() (359: ветка была пустой — solo не доходил)
      for (const id of Object.keys(current.stemSolos)) {
        if (current.stemSolos[id] !== prev.stemSolos[id]) {
          const pipeline = (window as any).__belive?.pipeline
          if (pipeline?.soloStem) pipeline.soloStem(id, current.stemSolos[id])
        }
      }
    } else if (isV2) {
      for (const id of Object.keys(current.stemSolos)) {
        if (current.stemSolos[id] !== prev.stemSolos[id]) {
          safeDelegate(v2, 'setStemSolo', id, current.stemSolos[id])
        }
      }
    }
  }

  // StemPans — V3 пока не поддерживает pan (FR-007 immutable routing)
  for (const id of Object.keys(current.stemPans)) {
    if (current.stemPans[id] !== prev.stemPans[id]) {
      if (isV2) safeDelegate(v2, 'setStemPan', id, current.stemPans[id])
    }
  }

  // StemsEnabled — V3: mute/unmute music stems
  if (current.stemsEnabled !== prev.stemsEnabled) {
    if (t3) {
      // 🔥 V3 STATE GATE: V2 stemsEnabled не применяется к V3.
      // V3 управляет музыкальными стемами через pipeline.
    } else if (isV2) {
      safeDelegate(v2, 'setStemsEnabled', current.stemsEnabled)
    }
  }
}

/** Проверить, изменилось ли solo состояние (требует пересчёта всех каналов) */
function hasSoloChange(current: EngineStateSnapshot, prev: EngineStateSnapshot): boolean {
  const keys = Object.keys(current.stemSolos)
  if (keys.length !== Object.keys(prev.stemSolos).length) return true
  for (const id of keys) {
    if (current.stemSolos[id] !== prev.stemSolos[id]) return true
  }
  return false
}

function applyAll(v2: V2Adapter, state: EngineStateSnapshot): void {
  const t3 = isV3Master() ? getTransport() : null

  if (t3) {
    // V3 path — применяем effective gain ко всем стемам
    // 🧹 Fix 389: cold-start тоже применяет к pipeline напрямую (MP-23)
    const pipeline = (window as any).__belive?.pipeline
    for (const id of Object.keys(state.stemVolumes)) {
      const vol = effectiveGain(state, id)
      if (pipeline?.setStemVolume) pipeline.setStemVolume(id, vol)
      const stem = t3.orchestrator.get(id)
      if (stem) stem.volume = vol
    }
  } else {
    // V2 path — оригинальная логика
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

/**
 * Mode Switch → V3 arbiter entry point.
 * Принудительная ре-синхронизация stem store → V3 engine.
 * Вызывается после transport.play() в __switchToV3().
 * 
 * Использует module-level _prevSnapshot для консистентности diffAndApply.
 * Silently skip если V3 не активен или стемы не загружены.
 */
export function resyncV3(): void {
  try {
    const t3 = isV3Master() ? getTransport() : null
    if (!t3) return

    const state = useStemStore.getState()
    const current: EngineStateSnapshot = {
      stemVolumes: { ...state.stemVolumes },
      stemMutes: { ...state.stemMutes },
      stemSolos: { ...state.stemSolos },
      stemPans: { ...state.stemPans },
      stemsEnabled: state.stemsEnabled,
    }

    // Применяем effectiveGain ко всем V3 стемам
    for (const id of Object.keys(current.stemVolumes)) {
      const stem = t3.orchestrator.get(id)
      if (stem) {
        stem.volume = effectiveGain(current, id)
        // Pipeline sync (если активен)
        const pipeline = (window as any).__belive?.pipeline
        if (pipeline) pipeline.setStemVolume(id, stem.volume)
      }
    }

    // Обновляем _prevSnapshot для консистентности следующих diffAndApply
    _prevSnapshot = current
  } catch (e) {
    console.warn('[StemEngineSync] resyncV3() failed:', e)
  }
}
