import { useEffect, useRef } from 'react';
import { useModeStore } from '../stores/mode.store';
import { useTrackStore } from '../stores/track.store';  // TC-COVER-04
import { usePlateStore } from '../stores/plate.store';
import { BACKGROUND_CONFIG } from '../backgrounds/backgroundConfig';
import { ConcertBackgroundManager } from '../backgrounds/ConcertBackground';
import { KaraokeBackgroundManager } from '../backgrounds/KaraokeBackground';
import { RehearsalBackgroundManager } from '../backgrounds/RehearsalBackground';
import { applyCoverTheme } from '../services/cover-theme-applicator';
import { initBlockScenePreload, revokeAllScenes, softReloadScenesForTrack } from '../services/block-scene.service';

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

  // ── Clear sceneMap on track switch (prevent revoked URL usage) ──
  useEffect(() => {
    const onBeforeTrackChange = () => {
      if (managersRef.current?.rehearsal) {
        managersRef.current.rehearsal.clearAllScenes();
      }
      useTrackStore.getState().setHasBlockScenes(false);
    };

    document.addEventListener('before-track-change', onBeforeTrackChange);
    return () => document.removeEventListener('before-track-change', onBeforeTrackChange);
  }, []);

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

      // Источник 1: trackCatalog (synchronous — актуальный сразу после track-loaded)
      // track.bridge.ts обновляет store с debounce 100ms — race condition
      let currentId: string | null = null;
      try {
        const tc = (window as any).trackCatalog;
        const idx = tc?.currentTrackIndex;
        if (typeof idx === 'number' && idx >= 0 && tc?.tracks?.[idx]) {
          const rawId = tc.tracks[idx].id;
          if (rawId != null) currentId = String(rawId);
        }
      } catch {}

      // Источник 2: fallback на store (debounced, но лучше чем ничего)
      if (currentId === null) {
        const storeId = useTrackStore.getState().currentTrack?.id;
        if (storeId != null) currentId = String(storeId);
      }

      if (!currentId || String(trackId) !== currentId) return;

      useTrackStore.getState().setHasBlockScenes(sceneCount > 0);

      // Убран sceneCount > 0 guard — defensive consistency с onTracksChanged
      // Пустой sceneMap тоже нужно применять (очистка при track без scenes)
      if (managersRef.current?.rehearsal) {
        managersRef.current.rehearsal.setBlockSceneMap(sceneMap || {
          blockScenes: new Map(),
          lineScenes: new Map(),
        });
      }
    };

    document.addEventListener('block-scenes-loaded', onScenesLoaded);
    return () => document.removeEventListener('block-scenes-loaded', onScenesLoaded);
  }, []);

  // ⚠️ Force soft reload on modal CRUD (tracks-changed)
  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout> | null = null;
    let revokeTimerId: ReturnType<typeof setTimeout> | null = null;

    const onTracksChanged = (e: Event) => {
      const source = (e as CustomEvent).detail?.source;

      // track-import/catalog/delete → doPreload обработит через track-loaded
      if (source === 'track-import' || source === 'catalog' || source === 'track-delete') {
        return;
      }
      // scene-crud или без source (backward compat) → softReload

      if (timerId) clearTimeout(timerId);

      const capturedTrackId = useTrackStore.getState().currentTrack?.id;
      if (!capturedTrackId) return;

      timerId = setTimeout(async () => {
        const currentNow = useTrackStore.getState().currentTrack?.id;
        if (String(capturedTrackId) !== String(currentNow)) return;

        const numId = Number(capturedTrackId);
        try {
          const { sceneMap, oldUrls } = await softReloadScenesForTrack(numId);

          // Second stale check — track may have switched during async IDB read
          const currentAfterAsync = useTrackStore.getState().currentTrack?.id;
          if (String(numId) !== String(currentAfterAsync)) {
            // Revoke newly created URLs — they won't be displayed
            oldUrls.forEach(url => { try { URL.revokeObjectURL(url); } catch {} });
            return;
          }

          const sceneCount = sceneMap.blockScenes.size + sceneMap.lineScenes.size;

          useTrackStore.getState().setHasBlockScenes(sceneCount > 0);

          // Когда scenes удалены → немедленно вернуть cover art в плашку
          if (sceneCount === 0 && managersRef.current?.rehearsal) {
            const ct = useTrackStore.getState().currentCoverTheme;
            const autoBg = usePlateStore.getState().useAutoBg;
            const hasCustom = !!useTrackStore.getState().currentTrack?.customBgUrl;
            managersRef.current.rehearsal.setCoverArtState(
              !!ct && autoBg,
              ct?.isDark,
              hasCustom,
            );
          }

          if (managersRef.current?.rehearsal) {
            if (sceneCount > 0) {
              managersRef.current.rehearsal.setBlockSceneMap(sceneMap);
            } else {
              managersRef.current.rehearsal.clearAllScenes();
            }
          }

          // NOTE: Multiple rapid CRUD operations create multiple pending revoke timers.
          // This is acceptable — each timer revokes URLs already off-screen.
          // We do NOT cancel previous timers to prevent URL memory leaks.
          revokeTimerId = setTimeout(() => {
            revokeTimerId = null;
            oldUrls.forEach(url => { try { URL.revokeObjectURL(url); } catch {} });
          }, 1000);
        } catch (e) {
          console.warn('[BgManagers] tracks-changed reload failed:', e);
        }
      }, 300);
    };

    document.addEventListener('tracks-changed', onTracksChanged);
    return () => {
      document.removeEventListener('tracks-changed', onTracksChanged);
      if (timerId) clearTimeout(timerId);
      if (revokeTimerId) clearTimeout(revokeTimerId);
    };
  }, []);
}
