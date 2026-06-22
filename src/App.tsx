import React, { useEffect, useRef } from 'react';
import { initAudioBridge } from './bridges/audio.bridge';
import { initLyricsBridge } from './bridges/lyrics.bridge';
import { initMarkersBridge } from './bridges/markers.bridge';
import { initModeBridge } from './bridges/mode.bridge';
import { initTrackBridge } from './bridges/track.bridge';
import { initCoverThemeBridge } from './bridges/cover-theme.bridge';
import { initStemReactiveBridge } from './bridges/stem-reactive.bridge';
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

import { initTextStyleBridge, destroyTextStyleBridge } from './bridges/textStyle.bridge';
import { initPlateBridge, destroyPlateBridge } from './bridges/plate.bridge';
import { initPerformanceBridge } from './performance/performance.bridge';
import { initBillyBridge } from './billy/billy.bridge';
import { initTakesBridge } from './takes/takes.bridge';
import { initExerciseBridge } from './exercises/exercise.bridge';
import { useSyncStore } from './sync/store/sync.store';
import BlockEditorModal from './blocks/components/BlockEditorModal';
import SyncEditorPanel from './sync/components/SyncEditorPanel';
import { SyncLyrics } from './sync/components/SyncLyrics';
import { initSyncBridge } from './sync/bridge/sync.bridge';
import { initTimeSync } from './bridges/time-sync';
import { initTriggerBridge } from './triggers/trigger.bridge';
import { TriggerDebugOverlay } from './triggers/TriggerDebugOverlay';
import { PlaybackPerfOverlay } from './components/PlaybackPerfOverlay';
import { TrackInfoBoard } from './components/TrackInfoBoard/TrackInfoBoard';
import { useTrackInfoStore } from './stores/trackInfo.store';
import { useAudioStore } from './stores/audio.store';
import { useLyricsStore } from './stores/lyrics.store';
import { useMarkersStore } from './stores/markers.store';
import { useModeStore } from './stores/mode.store';
import { useBackgroundManagers } from './hooks/useBackgroundManagers';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { tryActivateV2 } from './audio/featureFlag';
import { initMonitorBridge, destroyMonitorBridge } from './bridges/monitor.bridge';
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

  const surface = useAppStore(s => s.surface);
  const authChecked = useAppStore(s => s.authChecked);
  const appMode = useUIStore(s => s.appMode);

  useEffect(() => {
    if (surface !== 'app') return;
    tryActivateV2();
    initTrackEventListeners();
    const cleanupAudio = initAudioBridge();
    const cleanupLyrics = initLyricsBridge();
    const cleanupMarkers = initMarkersBridge();
    const cleanupMode = initModeBridge();
    const cleanupTrack = initTrackBridge();
    const cleanupCoverTheme = initCoverThemeBridge();
    const cleanupSync = initSyncBridge();
    const cleanupTimeSync = initTimeSync();
    const cleanupTrigger = initTriggerBridge();
    const cleanupStemReactive = initStemReactiveBridge();
    const cleanupTextStyle = initTextStyleBridge();
    const cleanupPlate = initPlateBridge();
    const cleanupPerformance = initPerformanceBridge();
    const cleanupBilly = initBillyBridge();
    const cleanupTakes = initTakesBridge();
    const cleanupExercise = initExerciseBridge();
    const cleanupMonitor = initMonitorBridge();

    // MVSEP: Resume orphaned stem separation jobs after tab close
    setTimeout(() => {
      mvsepPollingService.resumeOrphanedJobs().catch((err) => {
        console.error('[MVSEP] Boot resume failed:', err);
      });
    }, 2000); // Delay: IDB needs to be ready

    return () => {
      cleanupAudio();
      cleanupLyrics();
      cleanupMarkers();
      cleanupMode();
      cleanupTrack();
      cleanupCoverTheme();
      cleanupSync();
      cleanupTimeSync();
      cleanupTrigger();
      cleanupStemReactive();
      destroyTextStyleBridge();
      destroyPlateBridge();
      cleanupPerformance();
      cleanupBilly();
      cleanupTakes();
      cleanupExercise();
      destroyMonitorBridge();
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
      {trackInfoOpen && <TrackInfoBoard />}
      {aiSettingsOpen && <AiSettingsModal onClose={() => useAiSettingsStore.getState().setShowSettings(false)} />}
      {surface === 'profile' && <UserRoom />}
    </div>
      )}
    </>
  );
}

function DevPanel() {
  const { isPlaying, currentTime, duration } = useAudioStore();
  const { lines, activeLineIndex } = useLyricsStore();
  const markers = useMarkersStore((s) => s.markers);
  const mode = useModeStore((s) => s.mode);

  return null;
}