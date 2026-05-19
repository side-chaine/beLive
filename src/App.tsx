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
// TC-PITCH-04: Removed PianoOverlay import (now PitchTab in dock)

import { initTextStyleBridge, destroyTextStyleBridge } from './bridges/textStyle.bridge';
import { initPlateBridge, destroyPlateBridge } from './bridges/plate.bridge';
import { initPerformanceBridge } from './performance/performance.bridge';
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

export default function App() {
  const mode = useModeStore((s) => s.mode);
  const syncOpen = useSyncStore((s) => s.open);
  const trackInfoOpen = useTrackInfoStore((s) => s.isOpen);
  useBackgroundManagers();
  useKeyboardShortcuts();

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
      cleanupTakes();
      cleanupExercise();
      destroyMonitorBridge();
    };
  }, []);

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
        <>
          <ControlDeck />
        </>
      )}
      <TriggerDebugOverlay />
      <PlaybackPerfOverlay />
      {trackInfoOpen && <TrackInfoBoard />}
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