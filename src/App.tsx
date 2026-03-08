import React, { useEffect } from 'react';
import { initAudioBridge } from './bridges/audio.bridge';
import { initLyricsBridge } from './bridges/lyrics.bridge';
import { initMarkersBridge } from './bridges/markers.bridge';
import { initModeBridge } from './bridges/mode.bridge';
import { initTrackBridge } from './bridges/track.bridge';
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
import { PianoOverlay } from './components/PianoOverlay';
import { MonitorMixPanel } from './components/MonitorMixPanel';

import { initTextStyleBridge, destroyTextStyleBridge } from './bridges/textStyle.bridge';
import { useSyncStore } from './sync/store/sync.store';
import BlockEditorModal from './blocks/components/BlockEditorModal';
import SyncEditorPanel from './sync/components/SyncEditorPanel';
import { SyncLyrics } from './sync/components/SyncLyrics';
import { initSyncBridge } from './sync/bridge/sync.bridge';
import { initTimeSync } from './bridges/time-sync';
import { useAudioStore } from './stores/audio.store';
import { useLyricsStore } from './stores/lyrics.store';
import { useMarkersStore } from './stores/markers.store';
import { useModeStore } from './stores/mode.store';
import { useBackgroundManagers } from './hooks/useBackgroundManagers';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { tryActivateV2 } from './audio/featureFlag';

export default function App() {
  const mode = useModeStore((s) => s.mode);
  const syncOpen = useSyncStore((s) => s.open);
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
    const cleanupSync = initSyncBridge();
    const cleanupTimeSync = initTimeSync();
    const cleanupTextStyle = initTextStyleBridge();

    return () => {
      cleanupAudio();
      cleanupLyrics();
      cleanupMarkers();
      cleanupMode();
      cleanupTrack();
      cleanupSync();
      cleanupTimeSync();
      destroyTextStyleBridge();
    };
  }, []);

  return (
    <div id="belive-react">
      <BlockEditorModal />

      <MonitorMixPanel />
      <Header />
      <CatalogPanel />
      {mode === 'rehearsal' && !syncOpen && (
        <>
          <WagonTrain />
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
          <PianoOverlay />
        </>
      )}
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