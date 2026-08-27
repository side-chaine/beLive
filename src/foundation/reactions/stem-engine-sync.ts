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
import { getTransport } from '../../audio/engine-v3'

const V2_POLL_INTERVAL = 200 // ms — как часто проверять готовность V2

// ═══ Module-level mutable ref для diffAndApply ═══
let _prevSnapshot: EngineStateSnapshot | null = null

/** V3 мастер если pipeline есть и есть стемы — даже если transport.state === 'idle' (ждут play) */
function isV3Master(): boolean {
  const t3 = getTransport()
  // 009: __v3Active — pipeline активен, orchestrator.all() может быть пуст (MP-23)
  return !!(t3 && ((window as any).__v3Active || t3.orchestrator.all().length > 0))
}

// №18-BUS: MUSIC_STEMS временно удалён в GROUP 2 (потребитель effectiveGain() мёртв,
// noUnusedLocals) — пере-введён в GROUP 3 для H3.3/H3.3b mute-циклов.

// №18-BUS: MUSIC_STEMS пере-введён в GROUP 3 для H3.3/H3.3b mute-циклов
// (в GROUP 2 был удалён вместе с effectiveGain() как мёртвый код).
/** Music stems (excl. instrumental + vocals) muted by default per FR-014 */
const MUSIC_STEMS = new Set(['drums', 'bass', 'keys', 'guitar', 'backing', 'other'])

// E11-E13 (SURFACE): pan not supported by any engine (FR-007) — warn once per session
let _panWarned = false
function warnPanUnsupported(): void {
  if (_panWarned) return
  _panWarned = true
  console.warn('[StemEngineSync] stem pan not supported by any engine (FR-007) — fader is inert')
}

interface EngineStateSnapshot {
  stemVolumes: Record<string, number>
  stemMutes: Record<string, boolean>
  stemSolos: Record<string, boolean>
  stemPans: Record<string, number>
  /** №18-BUS H3.2: bus faders V3 */
  busVolumes: Record<string, number>
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
  _prevSnapshot = snapshot() // инициализация module-level ref
  let pollTimer: ReturnType<typeof setInterval> | null = null

  const unsub = useStemStore.subscribe((state) => {
    const current: EngineStateSnapshot = {
      stemVolumes: state.stemVolumes,
      stemMutes: state.stemMutes,
      stemSolos: state.stemSolos,
      stemPans: state.stemPans,
      busVolumes: state.busVolumes,
      stemsEnabled: state.stemsEnabled,
    }
    diffAndApply(current, _prevSnapshot ?? current)
    _prevSnapshot = current
  })

  const unsubRate = useAudioStore.subscribe((state, prev) => {
    if (state.playbackRate === prev.playbackRate) return
    const t3 = getTransport()
    if (t3 && isV3Master()) {
      t3.setPlaybackRate(state.playbackRate)
    }
  })

  if (!isV3Master()) {
    pollTimer = setInterval(() => {
      if (isV3Master()) {
        coldSync()
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
      }
    }, V2_POLL_INTERVAL)
  } else {
    coldSync()
  }

  return () => {
    unsub()
    unsubRate()
    if (pollTimer) clearInterval(pollTimer)
  }
}

// ─── Private ───────────────────────────────────────────────

function coldSync(): void {
  const state = useStemStore.getState()
  const current: EngineStateSnapshot = {
    stemVolumes: { ...state.stemVolumes },
    stemMutes: { ...state.stemMutes },
    stemSolos: { ...state.stemSolos },
    stemPans: { ...state.stemPans },
    busVolumes: { ...state.busVolumes },
    stemsEnabled: state.stemsEnabled,
  }
  applyAll(current)
  _prevSnapshot = current
}

function diffAndApply(current: EngineStateSnapshot, prev: EngineStateSnapshot): void {
  // Определяем активный engine
  const t3 = isV3Master() ? getTransport() : null

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
        // ⚠️ fallback-путь: no-op в V3 (orchestrator пуст, MP-23). Защита гейна — в pipeline single-writer (пак A).
        if (stem) stem.volume = current.stemVolumes[id]
      }
    }
  }

  // №18-BUS H3.2: BusVolumes — bus faders (V3 pipeline / V2 delegate)
  for (const busId of Object.keys(current.busVolumes)) {
    if (current.busVolumes[busId] !== prev.busVolumes[busId]) {
      if (t3) {
        const pipeline = (window as any).__belive?.pipeline
        if (pipeline?.setBusVolume) pipeline.setBusVolume(busId, current.busVolumes[busId])
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
      // Solo-маска применяется в pipeline (single-writer effectiveGain, пак A) — re-apply не нужен
    }
  }

  // StemPans — FR-007: pan not supported by any engine — warn once (E11/SURFACE)
  for (const id of Object.keys(current.stemPans)) {
    if (current.stemPans[id] !== prev.stemPans[id]) {
      warnPanUnsupported()
    }
  }

  // StemsEnabled — V3: mute/unmute music stems
  if (current.stemsEnabled !== prev.stemsEnabled) {
    if (t3) {
      // №18-BUS H3.3: V3-ветка реализована — глушим music+backing стемы через pipeline.
      // vocals/instrumental не трогаются (instrumental = master clock-tap, A2.25).
      const pipeline = (window as any).__belive?.pipeline
      if (pipeline?.setStemMuted) {
        for (const id of Object.keys(current.stemMutes)) {
          if (MUSIC_STEMS.has(id)) pipeline.setStemMuted(id, !current.stemsEnabled)
        }
      }
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

function applyAll(state: EngineStateSnapshot): void {
  const t3 = isV3Master() ? getTransport() : null

  if (t3) {
    // V3 path — применяем RAW volume ко всем стемам.
    // №18-BUS H2.1 (009-fix#1): пишем RAW, НЕ effectiveGain — pipeline сам считает
    // effective (solo/mute/busFactor). Запись effective→raw была отравителем raw-слота.
    // 🧹 Fix 389: cold-start тоже применяет к pipeline напрямую (MP-23)
    const pipeline = (window as any).__belive?.pipeline
    for (const id of Object.keys(state.stemVolumes)) {
      if (pipeline?.setStemVolume) pipeline.setStemVolume(id, state.stemVolumes[id])
      const stem = t3.orchestrator.get(id)
      if (stem) stem.volume = state.stemVolumes[id]
    }
    // №18-BUS H3.3b (📌DC3 INFO-страховка): cold-load применяет текущий stemsEnabled сразу —
    // иначе V3 cold-load при stemsEnabled=false оставит music слышимыми до первого переключения.
    if (pipeline?.setStemMuted) {
      for (const id of Object.keys(state.stemMutes)) {
        if (MUSIC_STEMS.has(id)) pipeline.setStemMuted(id, !state.stemsEnabled)
      }
    }
  }
}

function snapshot(): EngineStateSnapshot {
  const s = useStemStore.getState()
  return {
    stemVolumes: { ...s.stemVolumes },
    stemMutes: { ...s.stemMutes },
    stemSolos: { ...s.stemSolos },
    stemPans: { ...s.stemPans },
    busVolumes: { ...s.busVolumes },
    stemsEnabled: s.stemsEnabled,
  }
}

// №18-BUS H2.2 (009-fix#1): resyncV3 удалён целиком — мёртвый код по верификации 009
// (grep живых вызовов: 0). Он писал effective→raw (двойной writer, отравление raw-слота).
// effectiveGain()/MUSIC_STEMS удалены вместе с ним — единственные потребители исчезли.
// A2-closure см. пак-файл 462-MICRO-PACK-№18-BUS-FADER.md (H4.2).
