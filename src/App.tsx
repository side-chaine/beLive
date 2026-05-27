import React, { useEffect } from 'react';
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
import { useAiSettingsStore } from './stores/ai-settings.store';
import { LandingPage } from './components/landing/LandingPage';
import { useUserProfileStore } from './stores/user-profile.store';

export default function App() {
  const mode = useModeStore((s) => s.mode);
  const syncOpen = useSyncStore((s) => s.open);
  const trackInfoOpen = useTrackInfoStore((s) => s.isOpen);
  const aiSettingsOpen = useAiSettingsStore(s => s.showSettings);
  useBackgroundManagers();
  useKeyboardShortcuts();
  const isOnboarded = useUserProfileStore(s => s.isOnboarded);
  const setShowOnboarding = useUserProfileStore(s => s.setShowOnboarding);
  const showOnboarding = useUserProfileStore(s => s.showOnboarding);

  useEffect(() => {
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
  }, []);

  if (!isOnboarded) {
    return <LandingPage onStart={() => setShowOnboarding(true)} />;
  }

  // Заглушка онбординга (будет заменён в TC-AUTH-005/006/007)
  if (showOnboarding && !isOnboarded) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        background: '#0a0a0a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 24 }}>🎤</div>
          <div style={{ color: '#fff', fontSize: 32, fontWeight: 600 }}>
            Как тебя зовут?
          </div>
          <div style={{ color: '#666', fontSize: 16, marginTop: 8 }}>
            Полный онбординг будет в TC-AUTH-005/006/007
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="belive-react" data-track-info={trackInfoOpen ? 'active' : 'inactive'}>
      <BlockEditorModal />

      <Header />
      <CatalogPanel />
      {mode === 'rehearsal' && !syncOpen && (
        <>
          <div data-wagon-train-wrapper>
            <WagonTrain />
          </div>
          <RehearsalLyrics />
        </>
      )}
      {syncOpen && <SyncLyrics />}
      {(mode === 'karaoke' || mode === 'concert') && <KaraokeLyricsBoard />}
      <CameraPreview />
      <LiveSubtitle />
      <LiveControls />
      {syncOpen ? (
        <SyncEditorPanel />
      ) : (
        <ControlDeck />
      )}
      <BillyDock />
      <TriggerDebugOverlay />
      <PlaybackPerfOverlay />
      {trackInfoOpen && <TrackInfoBoard />}
      {aiSettingsOpen && <AiSettingsModal onClose={() => useAiSettingsStore.getState().setShowSettings(false)} />}
    </div>
  );
}

function DevPanel() {
  const { isPlaying, currentTime, duration } = useAudioStore();
  const { lines, activeLineIndex } = useLyricsStore();
  const markers = useMarkersStore((s) => s.markers);
  const mode = useModeStore((s) => s.mode);

  return null;
}