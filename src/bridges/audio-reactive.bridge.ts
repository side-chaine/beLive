import {
  queueCssVar,
} from '../runtime/visual/css-var-batch';
import {
  getPlaybackVisualScheduler,
  type PlaybackVisualFrameDetector,
  type PlaybackVisualFrameWriter,
} from '../playback';

let analyser: AnalyserNode | null = null;
let dataArray: Uint8Array | null = null;
let prevBeat = 0;

// Frame-scoped computed values (written by detector, read by writer)
let frameEnergy = 0;
let frameBass = 0;
let frameMid = 0;
let frameHigh = 0;
let frameBeat = 0;

function setup(): boolean {
  const ae = (window as any).audioEngine;
  if (!ae?.audioContext || analyser) return !!analyser;

  const ctx: AudioContext = ae.audioContext;
  analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.8;
  dataArray = new Uint8Array(analyser.frequencyBinCount);

  try {
    if (ae.stereoMerger) {
      ae.stereoMerger.connect(analyser);
    } else if (ae.instrumentalGain) {
      ae.instrumentalGain.connect(analyser);
    }
  } catch (e) {
    console.warn('[audio-reactive] connect failed:', e);
    return false;
  }

  return true;
}

function resetCssVars() {
  const root = document.documentElement;
  root.style.setProperty('--bl-audio-energy', '0');
  root.style.setProperty('--bl-audio-bass', '0');
  root.style.setProperty('--bl-audio-mid', '0');
  root.style.setProperty('--bl-audio-high', '0');
  root.style.setProperty('--bl-audio-beat', '0');
}

/**
 * Audio-Reactive Bridge
 *
 * Participates in the shared PlaybackVisualScheduler for visual hot-path publishing.
 * Scheduler lifecycle (start/stop) is currently owned by trigger bridge.
 */
export function initAudioReactiveBridge(): () => void {
  const scheduler = getPlaybackVisualScheduler();

  // Detector: compute audio analysis values
  const detector: PlaybackVisualFrameDetector = {
    id: 'audio-reactive-detector',
    detect() {
      if (!analyser || !dataArray) return;

      analyser.getByteFrequencyData(dataArray);
      const len = dataArray.length;

      const bassEnd = Math.floor(len * 0.1);
      const midEnd = Math.floor(len * 0.4);

      let bassSum = 0;
      let midSum = 0;
      let highSum = 0;
      let totalSum = 0;

      for (let i = 0; i < len; i++) {
        const v = dataArray[i] / 255;
        totalSum += v;
        if (i < bassEnd) bassSum += v;
        else if (i < midEnd) midSum += v;
        else highSum += v;
      }

      frameEnergy = totalSum / len;
      frameBass = bassEnd > 0 ? bassSum / bassEnd : 0;
      frameMid = midEnd - bassEnd > 0 ? midSum / (midEnd - bassEnd) : 0;
      frameHigh = len - midEnd > 0 ? highSum / (len - midEnd) : 0;

      const beatThreshold = 0.6;
      const beat = frameBass > beatThreshold
        ? Math.min((frameBass - beatThreshold) / (1 - beatThreshold) * 2, 1)
        : 0;
      const decay = 0.85;
      frameBeat = beat > prevBeat ? beat : prevBeat * decay;
      prevBeat = frameBeat;
    },
  };

  // Writer: queue CSS vars (scheduler will flush)
  const writer: PlaybackVisualFrameWriter = {
    id: 'audio-reactive-writer',
    write() {
      queueCssVar('--bl-audio-energy', frameEnergy.toFixed(3));
      queueCssVar('--bl-audio-bass', frameBass.toFixed(3));
      queueCssVar('--bl-audio-mid', frameMid.toFixed(3));
      queueCssVar('--bl-audio-high', frameHigh.toFixed(3));
      queueCssVar('--bl-audio-beat', frameBeat.toFixed(3));
    },
  };

  // Register with scheduler (trigger bridge owns scheduler lifecycle)
  scheduler.registerDetector(detector);
  scheduler.registerWriter(writer);

  // Playback state listener for setup/teardown only (not rAF loop)
  function onPlaybackState(e: Event) {
    const d = (e as CustomEvent).detail;
    if (d?.isPlaying) {
      if (setup()) {
        prevBeat = 0;
        document.documentElement.setAttribute('data-reactive', 'subtle');
      }
    } else {
      resetCssVars();
    }
  }

  window.addEventListener('playback-state-changed', onPlaybackState);

  return () => {
    resetCssVars();
    scheduler.unregister('audio-reactive-detector');
    scheduler.unregister('audio-reactive-writer');
    window.removeEventListener('playback-state-changed', onPlaybackState);
    // Disconnect analyser if connected
    if (analyser) {
      try {
        analyser.disconnect();
      } catch {
        // ignore disconnect errors
      }
      analyser = null;
    }
    dataArray = null;
  };
}
