import { bridgeFacade } from '../foundation/event-bus';
import { initLoopEvents } from '../foundation/event-bus/wrappers/loop-events';
import { initExerciseEvents } from '../foundation/event-bus/wrappers/exercise-events';
import { initTrackEvents } from '../foundation/event-bus/wrappers/track-events';
import { initCoverEvents } from '../foundation/event-bus/wrappers/cover-events';
import { initPlateEvents } from '../foundation/event-bus/wrappers/plate-events';
import { initBlocksEvents } from '../foundation/event-bus/wrappers/blocks-events';
import { initMarkersEvents } from '../foundation/event-bus/wrappers/markers-events';
import { initLyricsEvents } from '../foundation/event-bus/wrappers/lyrics-events';
import { initMonitorEvents } from '../foundation/event-bus/wrappers/monitor-events';
import { initAudioReactiveEvents } from '../foundation/event-bus/wrappers/audio-reactive';
import { initStemReactiveEvents } from '../foundation/event-bus/wrappers/stem-reactive';
import { initTextStyleEvents } from '../foundation/event-bus/wrappers/text-style-events';
import { initTakesEvents } from '../foundation/event-bus/wrappers/takes-events';
import { initModeEvents } from '../foundation/event-bus/wrappers/mode-events';
import { initPositionSync } from '../foundation/event-bus/wrappers/position-sync';
import { initAudioEvents } from '../foundation/event-bus/wrappers/audio-events';
import { registerInit, runAll } from '../foundation/registry/initRegistry';
import { initStemEngineSync } from '../foundation/reactions/stem-engine-sync';
import { init } from '../services/practice-journal/init';

/**
 * Bridge facade + event-wrapper registry. Synchronous and DOM-free: wrappers
 * must exist before any legacy script can dispatch an event. Returns the
 * aggregate cleanup used by HMR disposal.
 */
export function initBridgeRegistry(): () => void {
void bridgeFacade.init()
registerInit({ id: 'exercise-events', init: initExerciseEvents })
registerInit({ id: 'stem-engine-sync', init: initStemEngineSync })
// === wrapper-init registry · эталон: bridge-manifest.json ===
registerInit({ id: 'track-events', init: initTrackEvents })
registerInit({ id: 'cover-events', init: initCoverEvents })
registerInit({ id: 'plate-events', init: initPlateEvents })
registerInit({ id: 'blocks-events', init: initBlocksEvents })
registerInit({ id: 'markers-events', init: initMarkersEvents })
registerInit({ id: 'lyrics-events', init: initLyricsEvents })
registerInit({ id: 'monitor-events', init: initMonitorEvents })
registerInit({ id: 'audio-reactive', init: initAudioReactiveEvents })
registerInit({ id: 'stem-reactive', init: initStemReactiveEvents })
registerInit({ id: 'takes-events', init: initTakesEvents })
registerInit({ id: 'text-style-events', init: initTextStyleEvents })
registerInit({ id: 'mode-events', init: initModeEvents })
registerInit({ id: 'position-sync', init: initPositionSync })
registerInit({ id: 'audio-events', init: initAudioEvents })
registerInit({ id: 'loop-events', init: initLoopEvents })
registerInit({ id: 'practice-journal', init })
  return runAll();
}
