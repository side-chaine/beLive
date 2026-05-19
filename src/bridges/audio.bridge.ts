import { useAudioStore } from '../stores/audio.store';
import { useStemStore } from '../stem/stem.store';
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
    if (d) {
      useAudioStore.setState({
        duration: d.duration ?? 0,
        hasVocals: !!(d.hasVocals || (window as any).audioEngine?.vocalsAudio?.src),
        currentTime: 0,
        isPlaying: false,
        // W4a: Volume state removed — stem.store.initStems() handles volume initialization
      });
      // W4a: Initialize stem.store with loaded stem IDs
      if (d.loadedStems && Array.isArray(d.loadedStems)) {
        useStemStore.getState().initStems(d.loadedStems);
        
      // TC-10.12: IDB restore ONLY on first load (boot).
      // On track switch: preserve current stemsMode/stemsEnabled from store.
      const tc = (window as any).trackCatalog;
      const currentTrack = tc?.tracks?.[tc?.currentTrackIndex];
      const savedMode = currentTrack?.stemsMode ?? false;
      const st = useStemStore.getState();
      const currentEnabled = st.stemsEnabled;

      let effectiveEnabled: boolean;
      if (st._stemsBootRestored) {
        // TRACK SWITCH: preserve user's explicit choice from store
        effectiveEnabled = currentEnabled;
        // stemsMode stays as-is (user's tumbler preference)
      } else {
        // FIRST LOAD (boot): restore from IDB
        effectiveEnabled = currentEnabled || savedMode;
        st.setStemsMode(savedMode);
        // Mark boot restore as done
        // TC-10.13: Must use setState() — direct assignment on snapshot doesn't update store!
        useStemStore.setState({ _stemsBootRestored: true });
      }

      st.setStemsEnabled(effectiveEnabled);
      const ae = (window as any).audioEngine;
      ae?.setStemsEnabled?.(effectiveEnabled);

      // TC-10.13: Read CURRENT stemsMode from store (not stale snapshot)
      const currentStemsMode = useStemStore.getState().stemsMode;
      if (effectiveEnabled && !currentStemsMode) {
        useStemStore.getState().setStemsMode(true);
      }

      const musicStems = d.loadedStems.filter(
        (id: string) => id !== 'instrumental' && id !== 'vocals'
      );

      if (effectiveEnabled) {
        // ═══ Stems should play ═══
        if (musicStems.length > 0) {
          // Stems already loaded (non-progressive or Phase 2 complete)
          ae?.setStemVolume?.('instrumental', 0);
          useStemStore.getState().setStemVolume('instrumental', 0);
          for (const id of musicStems) {
            ae?.setStemVolume?.(id, 1);
            useStemStore.getState().setStemVolume(id, 1);
          }
          ae?.setStemVolume?.('vocals', 1);
          useStemStore.getState().setStemVolume('vocals', 1);
        }

        // For progressive path: stems load AFTER track-loaded event
        // Register listener for track-fully-loaded to apply mute/unmute
        // Cleanup: remove previous listener to prevent leaks
        if ((window as any).__stemsMuteListener) {
          document.removeEventListener('track-fully-loaded', (window as any).__stemsMuteListener);
        }

        const applyStemsMute = () => {
          const ae2 = (window as any).audioEngine;
          const loadedIds = ae2?.stems ? [...ae2.stems.keys()] : [];
          const hasMusic = loadedIds.some((id: string) => id !== 'instrumental' && id !== 'vocals');
          if (hasMusic) {
            ae2?.setStemVolume?.('instrumental', 0);
            useStemStore.getState().setStemVolume('instrumental', 0);
            for (const id of loadedIds) {
              if (id !== 'instrumental' && id !== 'vocals') {
                ae2?.setStemVolume?.(id, 1);
                useStemStore.getState().setStemVolume(id, 1);
              }
            }
            ae2?.setStemVolume?.('vocals', 1);
            useStemStore.getState().setStemVolume('vocals', 1);
          } else {
            // No music stems loaded yet — unmute instrumental (fallback safety)
            ae2?.setStemVolume?.('instrumental', 1);
            useStemStore.getState().setStemVolume('instrumental', 1);
          }
          document.removeEventListener('track-fully-loaded', applyStemsMute);
          (window as any).__stemsMuteListener = null;
        };
        (window as any).__stemsMuteListener = applyStemsMute;
        document.addEventListener('track-fully-loaded', applyStemsMute);

      } else {
        // ═══ Instrumental should play ═══
        if (musicStems.length > 0) {
          // Mute music stems
          for (const id of musicStems) {
            ae?.setStemVolume?.(id, 0);
            useStemStore.getState().setStemVolume(id, 0);
          }
          ae?.setStemVolume?.('instrumental', 1);
          useStemStore.getState().setStemVolume('instrumental', 1);
          ae?.setStemVolume?.('vocals', 1);
          useStemStore.getState().setStemVolume('vocals', 1);
        }
      }
      }
    }
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

  // Progressive loading: stem-level updates
  const onStemReady = (e: Event) => {
    const { stemId } = (e as CustomEvent).detail;
    if (stemId === 'vocals') {
      useAudioStore.setState({ hasVocals: true });
    }
    useStemStore.getState().addStem(stemId);
  };
  document.addEventListener('track-stem-ready', onStemReady);

  // Progressive loading: full completion — safe merge (NOT initStems which resets user settings!)
  const onFullyLoaded = (e: Event) => {
    const d = (e as CustomEvent).detail;

    // TC-10.10: Sync volumes to store when stemsEnabled=true
    // TC-10.1 (Phase 2 complete) mutes instrumental and unmutes stems in ENGINE,
    // but doesn't update the STORE. This causes faders to show wrong positions.
    const st = useStemStore.getState();
    if (st.stemsEnabled) {
      const ae3 = (window as any).audioEngine;
      const allLoadedIds = d?.loadedStems || (ae3?.stems ? [...ae3.stems.keys()] : []);
      const hasMusicStems = allLoadedIds.some(
        (id: string) => id !== 'instrumental' && id !== 'vocals'
      );
      if (hasMusicStems) {
        st.setStemVolume('instrumental', 0);
        for (const id of allLoadedIds) {
          if (id !== 'instrumental' && id !== 'vocals') {
            st.setStemVolume(id, 1);
          }
        }
        st.setStemVolume('vocals', 1);
      }
    }

    if (d) {
      useAudioStore.setState({
        duration: d.duration ?? 0,
        hasVocals: !!d.hasVocals,
      });
      if (d.loadedStems && Array.isArray(d.loadedStems)) {
        const st = useStemStore.getState();
        // Мёржим новые стемы с текущими настройками, а не сбрасываем!
        const newVolumes = { ...st.stemVolumes };
        const newMutes = { ...st.stemMutes };
        const newSolos = { ...st.stemSolos };
        const newPans = { ...st.stemPans };

        for (const id of d.loadedStems) {
          if (!(id in newVolumes)) newVolumes[id] = 1;
          if (!(id in newMutes)) newMutes[id] = false;
          if (!(id in newSolos)) newSolos[id] = false;
          if (!(id in newPans)) newPans[id] = 0;
        }

        useStemStore.setState({
          loadedStems: d.loadedStems,
          stemVolumes: newVolumes,
          stemMutes: newMutes,
          stemSolos: newSolos,
          stemPans: newPans,
        });
      }
    }
  };
  document.addEventListener('track-fully-loaded', onFullyLoaded);

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
    document.removeEventListener('track-stem-ready', onStemReady);
    document.removeEventListener('track-fully-loaded', onFullyLoaded);
    document.removeEventListener('playback-rate-changed', onRate);
    document.removeEventListener('vocalmix-state-changed', onVocal);
    document.removeEventListener('microphone-state-changed', onMic);
    document.removeEventListener('audio-position-changed', onAudioPositionChanged);
    document.removeEventListener('timeupdate', onTimeUpdate);
  };
}
