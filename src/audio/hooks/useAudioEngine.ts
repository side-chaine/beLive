/**
 * beLive AudioEngine v2 — React Hook.
 * Provides access to AudioEngineV2 instance and Zustand state.
 */

import { useCallback } from 'react';
import { useAudioStoreV2 } from '../store/audioStore';

/**
 * Returns audio state from Zustand store.
 * Engine methods are accessed via window.audioEngine (legacy shim).
 */
export function useAudioEngine() {
  const state = useAudioStoreV2();

  const play = useCallback(() => {
    (window as any).audioEngine?.play();
  }, []);

  const pause = useCallback(() => {
    (window as any).audioEngine?.pause();
  }, []);

  const seekTo = useCallback((time: number) => {
    (window as any).audioEngine?.seekTo(time);
  }, []);

  const setVolume = useCallback((stem: string, value: number) => {
    const ae = (window as any).audioEngine;
    if (!ae) return;
    if (stem === 'instrumental') ae.setInstrumentalVolume(value);
    else if (stem === 'vocals') ae.setVocalsVolume(value);
    else if (stem === 'microphone') ae.setMicrophoneVolume(value);
  }, []);

  return {
    ...state,
    play,
    pause,
    seekTo,
    setVolume,
  };
}
