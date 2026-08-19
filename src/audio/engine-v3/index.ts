// ============================================================
// src/audio/engine-v3/index.ts
// AETHER v3.0 — FINAL (Sonnet)
// ============================================================

// Core
export { HybridClock } from './core/HybridClock'
export { TransportV3 } from './core/TransportV3'
export { StemOrchestrator } from './core/StemOrchestrator'
export type { StemId, TransportState } from './core/types'

// Stems
export { StemPlayerV3 } from './stems/StemPlayerV3'

// Pipeline — 4+3 Hybrid Per-Stem (Phase D)
export { HybridPipelineService } from './pipeline/HybridPipelineService'
export { StretchInstancePool } from './pipeline/StretchInstancePool'
export { StemChain } from './pipeline/StemChain'
export type { IPipelineController, BusType } from './pipeline/IPipelineController'

// Integration
export { V3StatePublisher } from './integration/V3StatePublisher'
export { V3DataInterceptor } from './integration/V3DataInterceptor'
export { DuckGuardV3Native } from './integration/DuckGuardV3Native'
export { findZeroCrossing, computeCanonicalLoop } from './integration/LoopEngineV3'
export type { ZeroCrossingOptions, CanonicalLoop } from './integration/LoopEngineV3'
export { AudioCrashModal } from './integration/AudioCrashModal'
export { useAudioContextHealth } from './integration/useAudioContextHealth'

// Legacy singleton factory — for backward compat (MonitorMixPanel, TakesPanel, etc.)
// Returns null if AudioContext not yet available (must be called after user gesture)
import { TransportV3 as _TransportV3 } from './core/TransportV3'
import { V3StatePublisher as _V3StatePublisher } from './integration/V3StatePublisher'
import { getAudioContext } from '../core/audioContext'
let _sharedTransport: _TransportV3 | null = null
export function getTransport(): _TransportV3 | null {
  if (!_sharedTransport) {
    try {
      const ctx = getAudioContext()
      _sharedTransport = new _TransportV3(ctx, 'instrumental')
    } catch { return null }
  }
  return _sharedTransport
}

// Publisher singleton — for UI components to call publishSeek() after seek actions
let _sharedPublisher: _V3StatePublisher | null = null
export function setStatePublisher(p: _V3StatePublisher | null): void {
  _sharedPublisher = p
}
export function getStatePublisher(): _V3StatePublisher | null {
  return _sharedPublisher
}

// Monitor — Static Output Bus (TC-2C)
export { MonitorRouter } from './monitor/MonitorRouter'

// Legacy — retained for frozen V2 access
export { V2Adapter } from './V2Adapter'
