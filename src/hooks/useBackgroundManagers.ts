import { useEffect, useRef } from 'react';
import { useModeStore } from '../stores/mode.store';
import { useTrackStore } from '../stores/track.store';  // TC-COVER-04
import { usePlateStore } from '../stores/plate.store';
import { BACKGROUND_CONFIG } from '../backgrounds/backgroundConfig';
import { ConcertBackgroundManager } from '../backgrounds/ConcertBackground';
import { KaraokeBackgroundManager } from '../backgrounds/KaraokeBackground';
import { RehearsalBackgroundManager } from '../backgrounds/RehearsalBackground';
import { applyCoverTheme } from '../services/cover-theme-applicator';
import { initBlockScenePreload, revokeAllScenes } from '../services/block-scene.service';

interface BgManagers {
  concert: ConcertBackgroundManager;
  karaoke: KaraokeBackgroundManager;
  rehearsal: RehearsalBackgroundManager;
}

function createManagers(): BgManagers {
  return {
    concert: new ConcertBackgroundManager(BACKGROUND_CONFIG.concert || [], 60000),
    karaoke: new KaraokeBackgroundManager(BACKGROUND_CONFIG.karaoke || []),
    rehearsal: new RehearsalBackgroundManager(BACKGROUND_CONFIG.rehearsal || [], 0),
  };
}

function stopAll(mgrs: BgManagers): void {
  mgrs.concert.stop();
  mgrs.karaoke.stop();
  mgrs.rehearsal.stop();
}

function startForMode(mgrs: BgManagers, mode: string): void {
  stopAll(mgrs);
  switch (mode) {
    case 'concert':
      mgrs.concert.start();
      break;
    case 'karaoke':
      mgrs.karaoke.start();
      break;
    case 'rehearsal':
      mgrs.rehearsal.start();
      try {
        const w = window as any;
        mgrs.rehearsal.bindToBlockChanges(
          w.lyricsDisplay || null,
          null,
          w.audioEngine || null
        );
      } catch { /* LD may not be ready */ }
      break;
  }
}

export function useBackgroundManagers(): void {
  const managersRef = useRef<BgManagers | null>(null);
  const mode = useModeStore((s) => s.mode);
  const coverTheme = useTrackStore((s) => s.currentCoverTheme);  // TC-COVER-04
  const useAutoBg = usePlateStore(s => s.useAutoBg);
  const customBgUrl = useTrackStore(s => s.currentTrack?.customBgUrl);
  const hasBlockScenes = useTrackStore(s => s.hasBlockScenes);

  useEffect(() => {
    const managers = createManagers();
    managersRef.current = managers;

    const bind = (): boolean => {
      const app = (window as any).app;
      if (!app) return false;
      app.concertBackgroundManager = managers.concert;
      app.karaokeBackgroundManager = managers.karaoke;
      app.rehearsalBackgroundManager = managers.rehearsal;
      return true;
    };

    let retryId: ReturnType<typeof setInterval> | undefined;
    if (!bind()) {
      retryId = setInterval(() => {
        if (bind()) clearInterval(retryId!);
      }, 200);
    }

    return () => {
      if (retryId) clearInterval(retryId);
      stopAll(managers);
      managersRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!managersRef.current || !mode) return;
    if (mode !== 'rehearsal') {
      applyCoverTheme(null);
    } else {
      applyCoverTheme(coverTheme);
    }
    startForMode(managersRef.current, mode);
  }, [mode]);

  // TC-BG-08: Cover art background only when user enabled it
  useEffect(() => {
    if (!managersRef.current?.rehearsal) return;
    const hasCustomBg = !!customBgUrl;
    // Block scenes override cover art dimming
    const coverArtActive = hasBlockScenes ? false : (!!coverTheme && useAutoBg);
    managersRef.current.rehearsal.setCoverArtState(
      coverArtActive || hasCustomBg,
      coverTheme?.isDark,
      hasCustomBg,
    );
  }, [coverTheme, useAutoBg, customBgUrl, hasBlockScenes]);

  // Custom background on body (Layer 1) — full screen
  useEffect(() => {
    if (!managersRef.current?.rehearsal) return;
    managersRef.current.rehearsal.setCustomBg(customBgUrl || null);
  }, [customBgUrl]);

  // Block scenes lifecycle
  useEffect(() => {
    const cleanupPreload = initBlockScenePreload();
    return () => {
      cleanupPreload();
      revokeAllScenes();
    };
  }, []);

  // Apply preloaded scenes to manager
  useEffect(() => {
    const onScenesLoaded = (e: Event) => {
      const { trackId, sceneCount, sceneMap } = (e as CustomEvent).detail;
      const currentId = useTrackStore.getState().currentTrack?.id;
      if (String(trackId) !== String(currentId)) return;

      useTrackStore.getState().setHasBlockScenes(sceneCount > 0);

      if (managersRef.current?.rehearsal && sceneCount > 0 && sceneMap) {
        managersRef.current.rehearsal.setBlockSceneMap(sceneMap);
      }
    };

    document.addEventListener('block-scenes-loaded', onScenesLoaded);
    return () => document.removeEventListener('block-scenes-loaded', onScenesLoaded);
  }, []);
}
