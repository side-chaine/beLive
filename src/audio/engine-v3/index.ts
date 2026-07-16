// ============================================================
// src/audio/engine-v3/index.ts
// V3-01: scaffold — barrel export
// ============================================================

export { V2Adapter } from './V2Adapter'
export { StemPlayerV3 } from './StemPlayerV3'
import { TransportV3 } from './TransportV3'
export { TransportV3 }
export { CrossfadeV3 } from './CrossfadeV3'
export type { TransportState, V3Event, V3EventPayload, StemData } from './types'
export { LoopEngineV3 } from './LoopEngineV3'
export type { LoopState } from './LoopEngineV3'
export { CaptureBusV3 } from './CaptureBusV3'
export { MeterNodeV3 } from './MeterNodeV3'
export type { MeterData } from './MeterNodeV3'
export { RateParamV3 } from './RateParamV3'
export { VocalMixV3 } from './VocalMixV3'
export type { VocalMixMode } from './VocalMixV3'
export { MicrophoneV3 } from './MicrophoneV3'
export { DuckGuardV3 } from './DuckGuardV3'

/** TransportV3 singleton (Phase 3 / A1) */
let _transport: TransportV3 | null = null

export function getTransport(): TransportV3 {
  if (!_transport) {
    _transport = new TransportV3()
    _transport.init().catch((e: unknown) => console.error('[V3] TransportV3 init failed', e))
  }
  return _transport
}
