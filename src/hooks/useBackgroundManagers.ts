import { useEffect, useRef } from 'react';
import { useModeStore } from '../stores/mode.store';
import { useTrackStore } from '../stores/track.store';  // TC-COVER-04
import { BACKGROUND_CONFIG } from '../backgrounds/backgroundConfig';
import { ConcertBackgroundManager } from '../backgrounds/ConcertBackground';
import { KaraokeBackgroundManager } from '../backgrounds/KaraokeBackground';
import { RehearsalBackgroundManager } from '../backgrounds/RehearsalBackground';

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
  const prevModeRef = useRef<string | null>(null);
  const mode = useModeStore((s) => s.mode);
  const coverTheme = useTrackStore((s) => s.currentCoverTheme);  // TC-COVER-04

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
    if (!managersRef.current || !mode || mode === prevModeRef.current) return;
    prevModeRef.current = mode;
    startForMode(managersRef.current, mode);
  }, [mode]);

  // TC-COVER-04: Update dimming when coverTheme changes
  useEffect(() => {
    if (!managersRef.current?.rehearsal) return;
    managersRef.current.rehearsal.setCoverArtState(!!coverTheme, coverTheme?.isDark);
  }, [coverTheme]);
}
