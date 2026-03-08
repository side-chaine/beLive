import { useAudioStore } from '../stores/audio.store';
import { useLyricsStore } from '../stores/lyrics.store';

export function initAudioBridge(): () => void {
  const onPlaybackState = (e: Event) => {
    const d = (e as CustomEvent).detail;
    if (d) useAudioStore.setState({
      isPlaying: !!d.isPlaying,
      currentTime: d.currentTime ?? useAudioStore.getState().currentTime,
      duration: d.duration ?? useAudioStore.getState().duration,
    });
  };
  const onTrackLoaded = (e: Event) => {
    const d = (e as CustomEvent).detail;
    if (d) useAudioStore.setState({
      duration: d.duration ?? 0,
      hasVocals: !!(d.hasVocals || (window as any).audioEngine?.vocalsAudio?.src),
      currentTime: 0,
      isPlaying: false,
    });
  };
  const onRate = (e: Event) => {
    const d = (e as CustomEvent).detail;
    if (d) useAudioStore.setState({ playbackRate: d.rate ?? 1 });
  };
  const onVocal = (e: Event) => {
    const d = (e as CustomEvent).detail;
    if (d) useAudioStore.setState({ vocalMixEnabled: !!d.enabled });
  };
  const onMic = (e: Event) => {
    const d = (e as CustomEvent).detail;
    if (d) {
      const updates: Partial<ReturnType<typeof useAudioStore.getState>> = {
        micEnabled: !!d.enabled,
      };
      if (d.volume !== undefined) {
        (updates as any).micVolume = d.volume;
      }
      useAudioStore.setState(updates as any);
    }
  };

  const onAudioPositionChanged = (e: Event) => {
    const d = (e as CustomEvent).detail;
    if (d && typeof d.newTime === 'number') {
      useAudioStore.setState({ currentTime: d.newTime });
    }
  };

  const onTimeUpdate = (e: Event) => {
    const d = (e as CustomEvent).detail;
    if (d && typeof d.currentTime === 'number') {
      useAudioStore.setState({ currentTime: d.currentTime });
    }
  };

  window.addEventListener('playback-state-changed', onPlaybackState);
  document.addEventListener('track-loaded', onTrackLoaded);
  document.addEventListener('playback-rate-changed', onRate);
  document.addEventListener('vocalmix-state-changed', onVocal);
  document.addEventListener('microphone-state-changed', onMic);
  document.addEventListener('audio-position-changed', onAudioPositionChanged);
  document.addEventListener('timeupdate', onTimeUpdate);

  let unpatch: null | (() => void) = null;

  const patchSeek = () => {
    const ae = (window as any).audioEngine;
    if (!ae) return false;
    if (unpatch) return true; // already patched

    const originalSetCurrentTime = typeof ae.setCurrentTime === 'function'
      ? ae.setCurrentTime.bind(ae)
      : null;

    const originalSeekTo = typeof ae.seekTo === 'function'
      ? ae.seekTo.bind(ae)
      : null;

    if (!originalSetCurrentTime && !originalSeekTo) return false;

    // Optimistic line index: find last marker where time <= t
    const computeLineIndex = (t: number): number => {
      const markers = (window as any).markerManager?.getMarkers?.() ?? [];
      let bestLine = -1;
      let bestTime = -Infinity;
      for (const m of markers as any[]) {
        if (m.time <= t && m.time > bestTime) {
          bestTime = m.time;
          bestLine = m.lineIndex;
        }
      }
      return bestLine;
    };

    if (originalSetCurrentTime) {
      ae.setCurrentTime = (t: number) => {
        originalSetCurrentTime(t);
        useAudioStore.setState({ currentTime: t });
        const line = computeLineIndex(t);
        if (line >= 0) {
          useLyricsStore.setState({ activeLineIndex: line });
        }
      };
    }

    if (originalSeekTo) {
      ae.seekTo = (t: number) => {
        originalSeekTo(t);
        useAudioStore.setState({ currentTime: t });
        const line = computeLineIndex(t);
        if (line >= 0) {
          useLyricsStore.setState({ activeLineIndex: line });
        }
      };
    }

    unpatch = () => {
      const eng = (window as any).audioEngine;
      if (!eng) return;
      if (originalSetCurrentTime) eng.setCurrentTime = originalSetCurrentTime;
      if (originalSeekTo) eng.seekTo = originalSeekTo;
    };

    return true;
  };

  // Try now + retry once (engine might not be ready yet)
  patchSeek();
  const patchTimer = setTimeout(patchSeek, 500);

  return () => {
    clearTimeout(patchTimer);
    unpatch?.();
    window.removeEventListener('playback-state-changed', onPlaybackState);
    document.removeEventListener('track-loaded', onTrackLoaded);
    document.removeEventListener('playback-rate-changed', onRate);
    document.removeEventListener('vocalmix-state-changed', onVocal);
    document.removeEventListener('microphone-state-changed', onMic);
    document.removeEventListener('audio-position-changed', onAudioPositionChanged);
    document.removeEventListener('timeupdate', onTimeUpdate);
  };
}
