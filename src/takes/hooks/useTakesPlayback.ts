import React from 'react';
import { useTakesStore } from '../takes.store';
import { useAudioStore } from '../../stores/audio.store';
import { takeAssets } from '../takes.assets';

interface UseTakesPlaybackOptions {
  activeBlockId: string;
  timeRange: { startTime: number; endTime: number };
  previewMode: string;
}

interface UseTakesPlaybackReturn {
  handlePlayTake: (takeId: string, options?: { pan?: number; forceContext?: boolean }) => Promise<void>;
  stopPreview: (options?: { pauseEngine?: boolean }) => void;
  playingTakeId: string | null;
  setPlayingTakeId: (id: string | null) => void;
}

export function useTakesPlayback({
  activeBlockId,
  timeRange,
  previewMode,
}: UseTakesPlaybackOptions): UseTakesPlaybackReturn {
  const [playingTakeId, setPlayingTakeId] = React.useState<string | null>(null);

  // Preview refs
  const previewSourceRef = React.useRef<AudioBufferSourceNode | null>(null);
  const previewGainRef = React.useRef<GainNode | null>(null);
  const previewPannerRef = React.useRef<StereoPannerNode | null>(null);
  const previewGenRef = React.useRef(0);
  const previewTempoRateRef = React.useRef<number | null>(null);
  const soloActiveRef = React.useRef(false);
  const forceContextRef = React.useRef(false);
  const referenceContextActiveRef = React.useRef(false);

  const instrumentalVolume = useAudioStore((s) => s.instrumentalVolume);
  const vocalsVolume = useAudioStore((s) => s.vocalsVolume);

  const applySoloMute = React.useCallback(() => {
    const ae = (window as any).audioEngine;
    if (!ae) return;
    ae.setInstrumentalVolume?.(0);
    ae.setVocalsVolume?.(0);
    soloActiveRef.current = true;
  }, []);

  const restoreVolumes = React.useCallback(() => {
    const ae = (window as any).audioEngine;
    if (!ae) return;

    if (!soloActiveRef.current && !referenceContextActiveRef.current) return;

    const { instrumentalVolume, vocalsVolume } = useAudioStore.getState();
    ae.setInstrumentalVolume?.(instrumentalVolume);
    ae.setVocalsVolume?.(vocalsVolume);

    soloActiveRef.current = false;
    referenceContextActiveRef.current = false;
  }, [instrumentalVolume, vocalsVolume]);

  const stopPreview = React.useCallback((options?: { pauseEngine?: boolean }) => {
    previewGenRef.current++;
    
    // 1. Stop source
    try { previewSourceRef.current?.stop(); } catch (_) {}
    
    // 2. Detach from Program Bus BEFORE disconnect (detach handles disconnect internally)
    const ae = (window as any).audioEngine;
    if (previewGainRef.current) {
      ae?.detachProgramSource?.(previewGainRef.current);
    }
    
    // 3. Panner disconnect (not in Program Bus, detach doesn't touch it)
    try { previewPannerRef.current?.disconnect(); } catch (_) {}
    
    // 4. Nullify refs
    previewSourceRef.current = null;
    previewGainRef.current = null;
    previewPannerRef.current = null;
    
    setPlayingTakeId(null);
    
    // Restore volumes if solo was active
    restoreVolumes();
    
    // Restore playback rate if tempo-aware playback was active
    if (previewTempoRateRef.current !== null) {
      if (ae && typeof ae.setPlaybackRate === 'function') {
        ae.setPlaybackRate(1);
      }
      previewTempoRateRef.current = null;
    }
    
    // Clear forceContext flag
    forceContextRef.current = false;
    
    if (options?.pauseEngine) {
      if (ae?.isPlaying) ae.pause();
    }
  }, [restoreVolumes]);

  const handlePlayTake = React.useCallback(async (takeId: string, options?: { pan?: number; forceContext?: boolean }) => {
    const ae = (window as any).audioEngine;
    if (!ae) return;
    stopPreview();
    const gen = ++previewGenRef.current;
    let audioBuffer = takeAssets.getAudioBuffer(takeId);
    if (!audioBuffer) {
      const blob = takeAssets.getBlob(takeId);
      if (!blob) return;
      try {
        const ab = await blob.arrayBuffer();
        if (gen !== previewGenRef.current) return;
        const ctx: AudioContext = ae.audioContext ?? ae._audioContext;
        audioBuffer = await ctx.decodeAudioData(ab);
        if (gen !== previewGenRef.current) return;
        const { generatePeaks } = await import('../../sync/canvas/peaks');
        const ch = audioBuffer.getChannelData(0);
        const peaks = generatePeaks(ch, 0, ch.length, 200);
        const pv = new Float32Array(peaks.length);
        for (let i = 0; i < peaks.length; i++) pv[i] = peaks[i][1];
        takeAssets.cacheDecoded(takeId, audioBuffer, pv);
        useTakesStore.getState().bumpAssetRevision();
      } catch (err) {
        console.error('[Takes] Decode failed:', err);
        stopPreview();
        return;
      }
    }
    if (gen !== previewGenRef.current) return;
    try {
      const ctx: AudioContext = ae.audioContext ?? ae._audioContext;
      if (!ctx) return;
      const parts = takeId.split('-');
      const slot = parseInt(parts[parts.length - 1], 10);
      const btBlockId = parts.slice(1, -1).join('-');
      const bt = useTakesStore.getState().getBlockTakes(btBlockId);
      const takeMeta = bt.takes[slot];
      const trimStart = takeMeta?.trimStartSec ?? 0;
      
      // Apply tempo context for training takes
      const tempoRate = takeMeta?.tempoRate;
      const takeKind = takeMeta?.takeKind;
      if (tempoRate && takeKind === 'training') {
        if (typeof ae.setPlaybackRate === 'function') {
          ae.setPlaybackRate(tempoRate);
          previewTempoRateRef.current = tempoRate;
        }
      }
      
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      const gain = ctx.createGain();
      source.connect(gain);
      
      // NEW: Connect to Program Bus BEFORE panner (Wave R3)
      ae?.attachProgramSource?.(gain, { kind: 'preview' });
      
      // Support optional panning
      if (options?.pan !== undefined && typeof ctx.createStereoPanner === 'function') {
        const panner = ctx.createStereoPanner();
        panner.pan.value = options.pan;
        gain.connect(panner);
        panner.connect(ctx.destination);
        previewPannerRef.current = panner;
      } else {
        gain.connect(ctx.destination);
      }
      
      previewSourceRef.current = source;
      previewGainRef.current = gain;
      ae.setCurrentTime(timeRange.startTime);
      
      // Store forceContext flag
      if (options?.forceContext) {
        forceContextRef.current = true;
      }
      
      // Apply preview mode: mute both stems in solo mode (unless forceContext is true)
      if (previewMode === 'solo' && !forceContextRef.current) {
        applySoloMute();
      }
      
      // Deterministic play start — wait for engine sync instead of fixed 200ms drift
      const playResult = ae.play?.();
      if (playResult && typeof playResult.then === 'function') {
        try {
          await playResult;
        } catch (_) {
          // preserve previous tolerance: no throw if play promise rejects
        }
      }
      if (gen !== previewGenRef.current) return;
      
      const engineOffsetSec = Math.max(0,
        (ae.getCurrentTime?.() ?? timeRange.startTime) - timeRange.startTime);
      
      source.start(ctx.currentTime + 0.01, trimStart + engineOffsetSec);
      setPlayingTakeId(takeId);
      source.onended = () => {
        if (gen !== previewGenRef.current) return;
        stopPreview({ pauseEngine: true });
      };
    } catch (err) {
      console.error('[Takes] Playback failed:', err);
      stopPreview();
    }
  }, [timeRange, stopPreview, previewMode, applySoloMute]);

  // Live switching during active take preview
  React.useEffect(() => {
    if (!playingTakeId) return;
    if (previewMode === 'solo') {
      applySoloMute();
    } else {
      restoreVolumes();
    }
  }, [previewMode, playingTakeId, applySoloMute, restoreVolumes]);

  // Compat exposure: attach preview functions to store for hidden consumers
  // (takes.bridge and TakesPanel previous-take compare path)
  React.useEffect(() => {
    const store = useTakesStore as any;
    store.__stopPreviewFn = stopPreview;
    store.__playTakeFn = handlePlayTake;

    return () => {
      // Cleanup: only remove if still pointing to same functions
      if (store.__stopPreviewFn === stopPreview) {
        delete store.__stopPreviewFn;
      }
      if (store.__playTakeFn === handlePlayTake) {
        delete store.__playTakeFn;
      }
    };
  }, [stopPreview, handlePlayTake]);

  return {
    handlePlayTake,
    stopPreview,
    playingTakeId,
    setPlayingTakeId,
  };
}
