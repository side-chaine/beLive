/**
 * beLive AudioEngine v2 — Full V1 Patch.
 * Patches ALL methods on existing v1 audioEngine object.
 * Cached refs (app.audioEngine, BLC.audioEngine) auto-see v2.
 */
import { AudioEngineV2 } from '../core/AudioEngineV2';
import { setAudioContext } from '../core/audioContext';

export function patchV1WithV2(v1: any): AudioEngineV2 {
  // 1. Inject v1 AudioContext → v2 singleton (one context for all)
  if (v1.audioContext) setAudioContext(v1.audioContext);

  // 2. Create v2 engine (uses injected context)
  const v2 = new AudioEngineV2();

  // 3. Transport
  v1.play = () => v2.play();
  v1.pause = () => v2.pause();
  v1.stop = () => v2.stop();
  v1.getCurrentTime = () => v2.getCurrentTime();
  v1.setCurrentTime = (t: number) => v2.setCurrentTime(t);
  v1.seekTo = (t: number) => v2.seekTo(t);
  v1.getDuration = () => v2.getDuration();
  v1.loadTrack = (i: string, v?: string | null, additionalStems?: any, options?: any) => v2.loadTrack(i, v ?? null, additionalStems, options);
  v1.reset = () => v2.stop();
  v1.cleanup = () => v2.dispose();

  // 4. Volume
  v1.setStemVolume = (id: string, vol: number) => v2.setStemVolume(id, vol); // W4b: N-stem generic
  v1.setStemMute = (id: string, mute: boolean) => v2.setStemMute(id, mute); // W8.1: M/S buttons
  v1.setStemSolo = (id: string, solo: boolean) => v2.setStemSolo(id, solo); // W8.1: M/S buttons
  v1.setInstrumentalVolume = (vol: number) => v2.setInstrumentalVolume(vol);
  v1.setVocalsVolume = (vol: number) => v2.setVocalsVolume(vol);
  v1.setMicrophoneVolume = (vol: number) => v2.setMicrophoneVolume(vol);

  // 5. Loop
  v1.setLoop = (s: number, e: number) => v2.setLoop(s, e);
  v1.clearLoop = () => v2.clearLoop();

  // 6. Playback rate
  v1.setPlaybackRate = (r: number) => v2.setPlaybackRate(r);
  v1.getPlaybackRate = () => v2.getPlaybackRate();

  // 7. Capture (NEW: Program Capture Bus — Wave R2)
  v1.captureStream = () => v2.captureStream(); // @deprecated wrapper
  v1.getProgramCaptureStream = () => v2.getProgramCaptureStream();
  v1.attachProgramSource = (node: AudioNode, opts: { kind: string }) => 
    v2.attachProgramSource(node, opts);
  v1.detachProgramSource = (node: AudioNode) => v2.detachProgramSource(node);
  v1.setCaptureMicEnabled = (enabled: boolean) => v2.setCaptureMicEnabled(enabled);

  // 8. Microphone
  v1.enableMicrophone = () => v2.enableMicrophone();
  v1.disableMicrophone = () => v2.disableMicrophone();
  v1.toggleMicrophone = () => v2.toggleMicrophone();
  v1.getMicrophoneState = () => v2.getMicrophoneState();
  v1.getMicrophoneStream = (k?: string) =>
    v2.getMicrophoneStream((k as any) || 'processed');

  // 9. VocalMix
  v1.enableVocalMix = () => v2.enableVocalMix();
  v1.disableVocalMix = () => v2.disableVocalMix();
  v1.toggleVocalMix = () => v2.toggleVocalMix();
  v1.getVocalMixState = () => v2.getVocalMixState();

  // 10. Events
  v1.onTrackLoaded = (cb: Function) => v2.onTrackLoaded(cb);
  v1.onPositionUpdate = (cb: Function) => v2.onPositionUpdate(cb);
  v1.onBothEnded = (cb: Function) => v2.onBothEnded(cb);
  v1.removeEventListener = (t: string, cb: Function) =>
    v2.removeEventListener(t, cb);

  // 11. Stubs (unused but safe)
  v1.hasVocals = () => v2.stems.has('vocals');
  v1.getAudioData = () => null;
  v1.getAudioBuffer = () =>
    v2.stems.get('instrumental')?.audioBuffer ?? null;
  v1.getVocalAudioBuffer = () =>
    v2.stems.get('vocals')?.audioBuffer ?? null;
  v1.awaitStemReady = (stemId: string, timeoutMs?: number) =>
    v2.awaitStemReady(stemId, timeoutMs);
  v1.getStemAudioBuffer = (stemId: string) =>
    v2.getStemAudioBuffer(stemId);
  v1.ensureInstrumentalBuffer = () => v2.ensureInstrumentalBuffer();
  v1.ensureVocalsBuffer = () => v2.ensureVocalsBuffer();

  // Expose stems Map for direct access (needed by stems.has() checks)
  Object.defineProperty(v1, 'stems', {
    get: () => v2.stems,
    configurable: true,
  });

  v1.getCacheStats = () => ({ hits: 0, misses: 0, size: 0 });
  v1.clearCache = () => {};

  // 12. Properties (getters/setters on EXISTING object)
  Object.defineProperties(v1, {
    duration: { get: () => v2.duration, configurable: true },
    isPlaying: {
      get: () => v2.isPlaying,
      set: (val: boolean) => { v2.isPlaying = val; },
      configurable: true,
    },
    loopActive: { get: () => v2.loopActive, configurable: true },
    loopStart: { get: () => v2.loopStart, configurable: true },
    loopEnd: { get: () => v2.loopEnd, configurable: true },
    instrumentalGain: {
      get: () => v2.stems.get('instrumental')?.gainNode ?? null,
      configurable: true,
    },
    vocalsGain: {
      get: () => v2.stems.get('vocals')?.gainNode ?? null,
      configurable: true,
    },
    vocalsSourceNode: {
      get: () => v2.getVocalSourceNode(),
      configurable: true,
    },
    instrumentalAudio: {
      get: () => v2.stems.get('instrumental')?.audio ?? null,
      configurable: true,
    },
    vocalsAudio: {
      get: () => v2.stems.get('vocals')?.audio ?? null,
      configurable: true,
    },
    microphoneStream: { get: () => v2.microphone.stream, configurable: true },
    microphoneEnabled: { get: () => v2.microphone.enabled, configurable: true },
    microphoneVolume: { get: () => v2.microphone.volume, configurable: true },
    microphoneGain: { get: () => v2.microphoneGain, configurable: true },
    microphone: { get: () => v2.microphone, configurable: true }, // Full mic manager object
    streamDestination: { get: () => v2.streamDestination, configurable: true },
    vocalMixEnabled: { get: () => v2.vocalMix.enabled, configurable: true },
    hybridEngine: {
      get: () => {
        const base = v2.hybridEngine;
        const inst = v2.stems.get('instrumental');
        const voc = v2.stems.get('vocals');
        return {
          instrumentalUrl: inst?.audio?.src ?? base.instrumentalUrl,
          vocalsUrl: voc?.audio?.src ?? base.vocalsUrl,
          originalInstrumentalUrl: base.instrumentalUrl,
          originalVocalsUrl: base.vocalsUrl,
        };
      },
      configurable: true,
    },
    // W5: Expose metering on v1 patch
    getStemMeterLevel: { value: (stemId: string) => v2.getStemMeterLevel(stemId), configurable: true },
    // TC-VM-002: Expose per-stem AnalyserNode for Visual Mixer canvas waveforms
    getStemAnalyser: { value: (stemId: string) => v2.getStemAnalyser(stemId), configurable: true },
    // TC-8.6B: Expose on-demand stem loading + stemsEnabled sync
    setStemsEnabled: { value: (enabled: boolean) => v2.setStemsEnabled(enabled), configurable: true },
    loadAdditionalStems: { value: (stems: any) => v2.loadAdditionalStems(stems), configurable: true },
  });

  // 13. Nullify v1-only nodes (force audio-reactive fallback)
  v1.stereoMerger = null;

  if (import.meta.env.DEV) console.log('✅ AudioEngine v1 fully patched → v2');
  return v2;
}
