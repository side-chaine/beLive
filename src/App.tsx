import { useEffect, useRef } from 'react';
import { AudioCrashModal, useAudioContextHealth, getTransport } from './audio/engine-v3';
// retired: audio.bridge → audio-events (main.tsx)
// retired: lyrics.bridge → lyrics-events in main.tsx
// retired: markers.bridge → markers-events
// retired: track.bridge → track-events
// retired: cover-theme.bridge → cover-events
// retired: stem-reactive.bridge → stem-reactive events in main.tsx
import { initTrackEventListeners } from './services/track.actions';
import { CatalogPanel } from './components/CatalogPanel';
import { Header } from './components/Header';
import { WagonTrain } from './components/WagonTrain';
import { RehearsalLyrics } from './components/RehearsalLyrics';
import { KaraokeLyricsBoard } from './components/KaraokeLyricsBoard';
import { LiveSubtitle } from './components/LiveSubtitle';
import { CameraPreview } from './components/CameraPreview';
import { LiveControls } from './components/LiveControls';
import { ControlDeck } from './components/ControlDeck';
import { BillyDock } from './components/BillyDock/BillyDock';
// TC-PITCH-04: Removed PianoOverlay import (now PitchTab in dock)

// retired: textStyle.bridge → text-style-events (main.tsx)

// retired: plate.bridge → plate-events
// retired: performance.bridge

import { initBillyBridge } from './billy/billy.service';
// retired: takes.bridge → takes-events in main.tsx

import { useSyncStore } from './sync/store/sync.store';
import BlockEditorModal from './blocks/components/BlockEditorModal';
import SyncEditorPanel from './sync/components/SyncEditorPanel';
import { SyncLyrics } from './sync/components/SyncLyrics';
// retired: sync.bridge → useSyncStore directly

// retired: time-sync
import { initTriggerVisualService } from './triggers/trigger-visual.service';
import { TriggerDebugOverlay } from './triggers/TriggerDebugOverlay';
import { PlaybackPerfOverlay } from './components/PlaybackPerfOverlay';
import { TrackInfoBoard } from './components/TrackInfoBoard/TrackInfoBoard';
import { useTrackInfoStore } from './stores/trackInfo.store';
import { useModeStore } from './stores/mode.store';
import { useBackgroundManagers } from './hooks/useBackgroundManagers';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { usePerformanceTier } from './hooks/usePerformanceTier';
import { tryActivateV2 } from './audio/featureFlag';
// retired: monitor.bridge → monitor-events (main.tsx)

import { AiSettingsModal } from './components/AiSettingsModal';
import { BlockScenesModal } from './components/BlockScenesModal';
import { useAiSettingsStore } from './stores/ai-settings.store';
import { useShowStore } from './stores/show.store';
import { ShowEditor } from './components/Show/ShowEditor';
import { FeatureOverlay } from './components/Show/FeatureOverlay';
import { PresenterDock } from './components/Show/PresenterDock';
import { useAppStore } from './stores/app.store';
import { authService } from './services/auth.service';
import { WelcomePage } from './components/welcome/WelcomePage';
import { LoadingSplash } from './components/welcome/LoadingSplash';
import { UserRoom } from './components/profile/UserRoom';
import { useUIStore } from './stores/ui.store';
import { useUserProfileStore } from './stores/user-profile.store';
import { mvsepPollingService } from './services/mvsep-polling.service';
import { FeedScreen } from './feed/FeedScreen';
import { useFeedStore } from './catalog/feed/feed.store';
// retired: metrics.bridge → metrics data frozen in store

import { initSyncLifecycle } from './services/metrics-sync.service';
import { handleRehearsalDeepLink, connectRehearsalSession } from './Rehearsal/services/deep-link.service';
export default function App() {
  const mode = useModeStore((s) => s.mode);
  const syncOpen = useSyncStore((s) => s.open);
  const trackInfoOpen = useTrackInfoStore((s) => s.isOpen);
  const aiSettingsOpen = useAiSettingsStore(s => s.showSettings);
  const showActive = useShowStore(s => s.activeMode !== 'entry' && !s.featureActive && !s.isPresenting);
  const isPresenting = useShowStore(s => s.isPresenting);
  const featureActive = useShowStore(s => s.featureActive);
  useBackgroundManagers();
  useKeyboardShortcuts();
  usePerformanceTier();
  const { isHealthy } = useAudioContextHealth(getTransport()!);

  const surface = useAppStore(s => s.surface);
  const authChecked = useAppStore(s => s.authChecked);
  const appMode = useUIStore(s => s.appMode);

  useEffect(() => {
    if (surface !== 'app') return;
    // M1 (342): No-Birth — в V3-режиме V2 не рождается (runtime death)
    const engineMode = import.meta.env.VITE_ENGINE ?? 'v2';
    if (engineMode !== 'v3') {
      tryActivateV2();
      // M2 (345): V2 birth counter — доказательство No-Birth
      (window as any).__v2BirthCount = ((window as any).__v2BirthCount || 0) + 1;
    } else {
      (window as any).__v2BirthCount = 0;
    }
    initTrackEventListeners();
    // const cleanupAudio = initAudioBridge();  // retired → audio-events in main.tsx
    // const cleanupLyrics = initLyricsBridge();  // retired → lyrics-events in main.tsx
    // const cleanupSync = initSyncBridge();  // retired → useSyncStore directly
    // const cleanupTimeSync = initTimeSync();  // retired
    const cleanupTrigger = initTriggerVisualService();
    // const cleanupStemReactive = initStemReactiveBridge();  // retired → stem-reactive events in main.tsx
    // const cleanupTextStyle = initTextStyleBridge();  // retired → text-style-events in main.tsx
    // const cleanupPerformance = initPerformanceBridge();  // retired
    const cleanupBilly = initBillyBridge();
    // retired: takes.bridge → takes-events in main.tsx
    // const cleanupExercise = initExerciseBridge();  // retired — exercise-events in main.tsx
    // const cleanupMonitor = initMonitorBridge();  // retired → monitor-events in main.tsx
    // const cleanupMetrics = initMetricsBridge();  // retired
    const cleanupMetricsSync = initSyncLifecycle();

    // MVSEP: Resume orphaned stem separation jobs after tab close
    setTimeout(() => {
      mvsepPollingService.resumeOrphanedJobs().catch((err) => {
        console.error('[MVSEP] Boot resume failed:', err);
      });
    }, 2000); // Delay: IDB needs to be ready

    return () => {
      // cleanupAudio();  // retired
      // cleanupLyrics();  // retired → lyrics-events in main.tsx
      // cleanupSync();  // retired
      cleanupTrigger();
      // cleanupStemReactive();  // retired → stem-reactive events in main.tsx
      // cleanupPerformance();  // retired
      cleanupBilly();
      // cleanupTakes();  // retired → takes-events in main.tsx
      // cleanupExercise();  // retired
      // cleanupMetrics();  // retired
      cleanupMetricsSync();
    };
  }, [surface]);

  // Surface-reactive class — синхронизирует html класс с surface
  useEffect(() => {
    const html = document.documentElement;
    if (surface === 'welcome') {
      html.classList.add('bl-surface-welcome');
    } else {
      html.classList.remove('bl-surface-welcome');
    }
    return () => html.classList.remove('bl-surface-welcome');
  }, [surface]);

  // Auth check
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.has('auth')) {
      authService.handleCallback(params).then(async (data) => {
        if (data) {
          const { useUserProfileStore } = await import('./stores/user-profile.store');
          useUserProfileStore.getState().createOAuthProfile(data);
        } else {
          console.warn('[auth] handleCallback returned null!');
        }
        useAppStore.getState().setSurface('app');
        useAppStore.getState().setAuthChecked(true);
        window.history.replaceState({}, '', '/');
      });
      return;
    }
    authService.checkExistingAuth().then(isValid => {
      useAppStore.getState().setSurface(isValid ? 'app' : 'welcome');
      useAppStore.getState().setAuthChecked(true);
    });
  }, []);

  // Auto-catalog
  const openedCatalogRef = useRef(false);
  useEffect(() => {
    if (surface === 'app' && !openedCatalogRef.current) {
      const { isReturning } = useUserProfileStore.getState();
      if (!isReturning) {
        useUIStore.getState().setCatalogOpen(true);
      }
      openedCatalogRef.current = true;
    }
  }, [surface]);

  // Rehearsal Video Bridge: Deep-link ?room= — создаёт bridge и плашку статуса
  useEffect(() => {
    handleRehearsalDeepLink().then((rehearsalLink) => {
      if (rehearsalLink) {
        connectRehearsalSession(rehearsalLink);
      }
    });
  }, []);

  // TC-107-14: Deep-link ?post= — scroll to post on feed
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const postId = params.get('post');
    if (!postId || surface !== 'app') return;

    const timer = setTimeout(() => {
      const { posts, fetchFeed } = useFeedStore.getState();
      if (posts.length === 0) {
        fetchFeed().then(() => {
          const found = useFeedStore.getState().posts.find(p => p.id === postId);
          if (!found) {
            console.warn(`[deep-link] Post ${postId} not found`);
          }
        });
      } else {
        const found = posts.find(p => p.id === postId);
        if (!found) {
          console.warn(`[deep-link] Post ${postId} not found or deleted`);
        }
      }
      const feedEl = document.querySelector('.aurora-stage');
      feedEl?.scrollTo({ top: 0, behavior: 'smooth' });
    }, 500);

    return () => clearTimeout(timer);
  }, [surface]);

  if (!authChecked) return <LoadingSplash />;
  if (surface === 'welcome') return <WelcomePage />;

  return (
    <>
      <Header />
      <CatalogPanel />
      {appMode === 'feed' ? <FeedScreen /> : (
      <div id="belive-react" data-track-info={trackInfoOpen ? 'active' : 'inactive'}>
      <BlockEditorModal />
      <BlockScenesModal />
      {mode === 'rehearsal' && !syncOpen && !showActive && !featureActive && (
        <>
          <div data-wagon-train-wrapper>
            <WagonTrain />
          </div>
          <RehearsalLyrics />
        </>
      )}
      {syncOpen && !showActive && !featureActive && <SyncLyrics />}
      {(mode === 'karaoke' || mode === 'concert') && !showActive && !featureActive && <KaraokeLyricsBoard />}
      {!showActive && !featureActive && <CameraPreview />}
      {!showActive && !featureActive && <LiveSubtitle />}
      {!showActive && !featureActive && <LiveControls />}
      {syncOpen ? (
        <SyncEditorPanel />
      ) : showActive ? (
        <ShowEditor />
      ) : (
        <ControlDeck />
      )}
      {featureActive && <FeatureOverlay />}
      {isPresenting && <PresenterDock />}
      {!showActive && !featureActive && <BillyDock />}
      {!showActive && !featureActive && <TriggerDebugOverlay />}
      {!showActive && !featureActive && <PlaybackPerfOverlay />}
      <AudioCrashModal visible={!isHealthy} />
      {trackInfoOpen && <TrackInfoBoard />}
      {aiSettingsOpen && <AiSettingsModal onClose={() => useAiSettingsStore.getState().setShowSettings(false)} />}
      {surface === 'profile' && <UserRoom />}
    </div>
      )}
    </>
  );
}

