// ============================================================
// src/foundation/event-bus/types.ts
// ============================================================

// --- Каналы ---
export enum EventBusChannel {
  Audio   = 'audio',
  Track   = 'track',
  Catalog = 'catalog',
  Sync    = 'sync',
  UI      = 'ui',
  Practice= 'practice',
}

// --- Payload'ы ---
export type AudioEvents = {
  'track-loaded': { duration: number; hasVocals: boolean; loadedStems: string[] }
  'track-fully-loaded': { duration: number; loadedStems: string[]; hasVocals: boolean }
  'track-stem-ready': { stemId: string; role: string }
  'playback-state-changed': { isPlaying: boolean; currentTime: number; duration: number }
  'playback-rate-changed': { rate: number }
  'vocalmix-state-changed': { enabled: boolean }
  'microphone-state-changed': { enabled: boolean; volume: number }
  'monitor-state-changed': Record<string, never>
  'monitor-route-changed': Record<string, never>
  'seek-position-changed': { currentTime: number; duration: number }
}

export type TrackEvents = {
  'before-change': { fromTrackId?: string; toTrackId?: string }
  'load-failed': { error: string }
}

export type CatalogEvents = {
  'track-saved': { trackId: string; title: string; hasLyrics: boolean }
  'tracks-changed': { source: string }
  'catalog-close': Record<string, never>
  'catalog-cleared': Record<string, never>
}

export type SyncEvents = {
  'blocks-applied': { trackId: string; blocksCount: number }
  'active-line-changed': { lineIndex: number }
  'lyrics-rendered': Record<string, never>
  'save-track-markers': { trackId: string; markers: unknown }
  'loop-set': { startTime: number; endTime: number }
  'loop-cleared': { time: number; wasActive: boolean }
  'loopcompleted': { previousTime: number; newTime: number; loopStart: number; loopEnd: number }
  'sections-updated': Record<string, never>
}

export type UIEvents = {
  'mode-changed': { from: string; to: string }
  'block-scenes-loaded': { trackId: string; sceneCount: number }
  'camera-permission-resolved': { allowed: boolean }
}

export type PracticeEvents = {
  'practice:state-changed': {
    type: 'started' | 'completed' | 'completed-kept' | 'cancelled' | 'auto-paused' | 'pass-complete'
    detail?: unknown
  }
}

// --- EventMap ---
export interface EventMap {
  [EventBusChannel.Audio]:    { [K in keyof AudioEvents]: AudioEvents[K] }
  [EventBusChannel.Track]:    { [K in keyof TrackEvents]: TrackEvents[K] }
  [EventBusChannel.Catalog]:  { [K in keyof CatalogEvents]: CatalogEvents[K] }
  [EventBusChannel.Sync]:     { [K in keyof SyncEvents]: SyncEvents[K] }
  [EventBusChannel.UI]:       { [K in keyof UIEvents]: UIEvents[K] }
  [EventBusChannel.Practice]: { [K in keyof PracticeEvents]: PracticeEvents[K] }
}

// --- Utility types ---
export type ChannelEvents<C extends EventBusChannel> = EventMap[C]
export type EventName<C extends EventBusChannel> = keyof ChannelEvents<C> & string
export type EventPayload<C extends EventBusChannel, E extends EventName<C>> = ChannelEvents<C>[E]

// --- Callback ---
export type EventCallback<C extends EventBusChannel = EventBusChannel, E extends EventName<C> = EventName<C>> = 
  (payload: EventPayload<C, E>) => void

// --- Subscription ---
export interface Subscription {
  unsubscribe(): void
  readonly channel: EventBusChannel
  readonly event: string
}
