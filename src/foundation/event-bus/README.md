# 🕸️ EventBus — beLife Starbase 2.0

## Architecture
6 channels, 27 typed events.
Replaces 24 legacy bridges via BridgeFacade (Strangler Fig).

## Channels

| Channel | Events | Payloads |
|---------|--------|----------|
| audio | 9 | track-loaded, track-fully-loaded, track-stem-ready, playback-state-changed, playback-rate-changed, vocalmix-state-changed, microphone-state-changed, monitor-state-changed, monitor-route-changed |
| track | 2 | before-change, load-failed |
| catalog | 4 | track-saved, tracks-changed, catalog-close, catalog-cleared |
| sync | 8 | blocks-applied, active-line-changed, lyrics-rendered, save-track-markers, loop-set, loop-cleared, loopcompleted, sections-updated |
| ui | 3 | mode-changed, block-scenes-loaded, camera-permission-resolved |
| practice | 1 | practice:state-changed |

## Usage

```typescript
import { eventBus, AudioBus, EventBusChannel } from './foundation/event-bus'

// Subscribe
const sub = eventBus.subscribe(EventBusChannel.Audio, 'track-loaded', (payload) => {
  console.log('Track loaded:', payload.duration)
})

// Unsubscribe
sub.unsubscribe()

// Publish (via typed helper)
AudioBus.trackLoaded({ duration: 100, hasVocals: true, loadedStems: ['instrumental'] })

// Publish (raw)
eventBus.publish(EventBusChannel.Track, 'before-change', { fromTrackId: '1', toTrackId: '2' })

// Channel-wide subscription
eventBus.subscribeChannel(EventBusChannel.UI, (event, payload) => {
  console.log(`UI event: ${event}`, payload)
})

// Clear
eventBus.clearChannel(EventBusChannel.Audio)
eventBus.clear()
```

## BridgeFacade

BridgeFacade (src/foundation/event-bus/facade.ts) — Strangler Fig.
When initialized, it intercepts legacy document CustomEvents and re-publishes them on EventBus.
Bridges continue to work unchanged.

## Frozen Zones

ZERO TOUCH:
- src/audio/core/AudioEngineV2.ts ❄️
- src/audio/compat/patchV1.ts ❄️
- src/bridges/* ❄️
- src/services/track.orchestrator.ts ❄️
- js/*.js ❄️
