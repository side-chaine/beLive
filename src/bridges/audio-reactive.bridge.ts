let analyser: AnalyserNode | null = null;
let dataArray: Uint8Array | null = null;
let rafId: number | null = null;
let prevBeat = 0;

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

function tick() {
  if (!analyser || !dataArray) {
    rafId = null;
    return;
  }

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

  const energy = totalSum / len;
  const bass = bassEnd > 0 ? bassSum / bassEnd : 0;
  const mid = midEnd - bassEnd > 0 ? midSum / (midEnd - bassEnd) : 0;
  const high = len - midEnd > 0 ? highSum / (len - midEnd) : 0;

  const beatThreshold = 0.6;
  const beat = bass > beatThreshold ? Math.min((bass - beatThreshold) / (1 - beatThreshold) * 2, 1) : 0;
  const decay = 0.85;
  const smoothBeat = beat > prevBeat ? beat : prevBeat * decay;
  prevBeat = smoothBeat;

  const root = document.documentElement;
  root.style.setProperty('--bl-audio-energy', energy.toFixed(3));
  root.style.setProperty('--bl-audio-bass', bass.toFixed(3));
  root.style.setProperty('--bl-audio-mid', mid.toFixed(3));
  root.style.setProperty('--bl-audio-high', high.toFixed(3));
  root.style.setProperty('--bl-audio-beat', smoothBeat.toFixed(3));

  rafId = requestAnimationFrame(tick);
}

function start() {
  if (rafId !== null) return;
  if (!setup()) return;
  prevBeat = 0;
  rafId = requestAnimationFrame(tick);
  document.documentElement.setAttribute('data-reactive', 'subtle');
}

function stop() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  const root = document.documentElement;
  root.style.setProperty('--bl-audio-energy', '0');
  root.style.setProperty('--bl-audio-bass', '0');
  root.style.setProperty('--bl-audio-mid', '0');
  root.style.setProperty('--bl-audio-high', '0');
  root.style.setProperty('--bl-audio-beat', '0');
}

export function initAudioReactiveBridge() {
  window.addEventListener('playback-state-changed', (e: Event) => {
    const d = (e as CustomEvent).detail;
    if (d?.isPlaying) start();
    else stop();
  });
}
