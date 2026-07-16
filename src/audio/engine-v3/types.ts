// ============================================================
// src/audio/engine-v3/types.ts
// V3-01: scaffold — TransportState, V3Event, V3EventPayload, StemData
// ============================================================

export type TransportState = 'idle' | 'loading' | 'playing' | 'paused' | 'error'
export type V3Event = 'state-change' | 'time-update' | 'load-progress' | 'error'

export interface V3EventPayload {
  'state-change': { state: TransportState; prevError?: { message: string; code?: number } }
  'time-update': { currentTime: number; duration: number }
  'load-progress': { loaded: number; total: number }
  'error': { message: string; code?: number }
}

export interface StemData {
  id: string
  url: string
  volume?: number
  muted?: boolean
}
