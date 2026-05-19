# App + ControlDeck Structure Context Pack
**Для:** Оператор/007 (Center_6 → Center_7 transition)
**Дата:** 2026-05-15

## A: SCAN-21 — App.tsx — точная структура

### Строки 1-30 (импорты)

```typescript
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
```

### Где рендерится WagonTrain

```
src/App.tsx
12:import { WagonTrain } from './components/WagonTrain';
97-      {mode === 'rehearsal' && !syncOpen && (
98-        <>
98:          <WagonTrain />
100-          <RehearsalLyrics />
101-        </>
```

### Где рендерится TriggerDebugOverlay

```
src/App.tsx
33:import { TriggerDebugOverlay } from './triggers/TriggerDebugOverlay';
113-        </>
114-      )}
114:      <TriggerDebugOverlay />
116-      <PlaybackPerfOverlay />
117-    </div>
```

### Корневой div

```
src/App.tsx
91:  return (
91:    <div id="belive-react">
93-      <BlockEditorModal />
```

### Тело компонента (строки 90-120)

```typescript
  return (
    <div id="belive-react">
      <BlockEditorModal />

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
        </>
      )}
      <TriggerDebugOverlay />
      <PlaybackPerfOverlay />
    </div>
  );
}
```

### Структура рендера (сверху вниз)

```
<div id="belive-react">
  <BlockEditorModal />
  
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
    </>
  )}
  
  <TriggerDebugOverlay />
  <PlaybackPerfOverlay />
</div>
```

---

## B: SCAN-22 — ControlDeck.tsx — структура кнопок

### Строки 1-15 (импорты)

```typescript
import { Suspense, useEffect, useRef } from 'react';
import { useDeckStore } from '../stores/deck.store';
import { useModeStore } from '../stores/mode.store';
import { usePianoStore } from '../stores/piano.store';
import { getModulesForMode, getLazyComponent } from '../deck/registry';
import '../deck/modules';
import { TransportBar } from './TransportBar';
import styles from './ControlDeck.module.css';
import { useAudioStore } from '../stores/audio.store';
import { useStemStore } from '../stem/stem.store';
import { useSyncStore } from '../sync/store/sync.store';
import { requestOpenSync, requestCloseSync } from '../sync/bridge/sync.bridge';
import { useMonitorStore } from '../stores/monitor.store';
import { useRecordingStore } from '../stores/recording.store';
import { interruptPracticeSession } from '../exercises/exercise.interruption';
```

### Где рендерится Sync кнопка

```
src/components/ControlDeck.tsx
11:import { useSyncStore } from '../sync/store/sync.store';
12:import { requestOpenSync, requestCloseSync } from '../sync/bridge/sync.bridge';
31:  const syncOpen = useSyncStore(s => s.open);
476:        {/* Sync — technical section */}
478-        <button
479-          className={styles.tab}
479:          data-active={syncOpen ? 'true' : 'false'}
481-          onClick={() => {
482-            // Interrupt practice first if active, then continue requested action
483-            interruptPracticeSession(() => {
484-              useDeckStore.getState().setTab('');
484:              if (syncOpen) requestCloseSync();
484:              if (syncOpen) requestCloseSync();
485:              else requestOpenSync();
487-            });
488-          }}
488:          title='Sync'
490-        >
490:          Sync
492-        </button>
```

### 10 строк ПЕРЕД Sync кнопкой

```typescript
                  userSelect: 'none',
                  pointerEvents: 'none',
                }}>
                  Mic {Math.round((micVolume || 0) * 100)}
                </span>
              </div>
            )}
          </div>
        </div>


        {/* Sync — technical section */}
```

### className styles.tab

```
src/components/ControlDeck.tsx
123:                className={styles.tab}
478:          className={styles.tab}
495:          className={styles.tabsToggle}
```

---

## 📋 Сводка для интеграции TIB

### App.tsx — куда вставлять импорт и рендер

**Импорт (строка 35, после TriggerDebugOverlay):**
```typescript
import { TrackInfoBoard } from './components/TrackInfoBoard/TrackInfoBoard';
```

**Рендер (строка 115, после PlaybackPerfOverlay, до закрывающего div):**
```typescript
<TrackInfoBoard />
```

**Полный порядок:**
```typescript
<div id="belive-react">
  <BlockEditorModal />
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
    </>
  )}
  <TriggerDebugOverlay />
  <PlaybackPerfOverlay />
  <TrackInfoBoard />  {/* ← добавить здесь */}
</div>
```

### ControlDeck.tsx — куда вставлять кнопку TrackMap

**Место: после Sync кнопки (строка 492)**

**Кнопка:**
```typescript
<button
  className={styles.tab}
  data-active={trackInfoOpen ? 'true' : 'false'}
  onClick={() => {
    interruptPracticeSession(() => {
      useDeckStore.getState().setTab('');
      if (trackInfoOpen) useTrackInfoStore.getState().close();
      else useTrackInfoStore.getState().open(currentTrack?.id || 0);
    });
  }}
  title='TrackMap'
>
  TrackMap
</button>
```

**Где:**
- После Sync кнопки (строка 492)
- Перед tabsToggle кнопкой (строка 494)

---

## ⚠️ Architecture Gaps

1. **Нет импорта TrackInfoBoard в App.tsx** — нужно добавить
2. **Нет рендера TrackInfoBoard в App.tsx** — нужно добавить
3. **Нет кнопки TrackMap в ControlDeck** — нужно добавить
4. **Нет trackInfoOpen state в deck.store** — нужно добавить

---

## 🎯 Recommended Next Steps

1. **Добавить импорт TrackInfoBoard в App.tsx** (строка 35)
2. **Добавить рендер TrackInfoBoard в App.tsx** (строка 115)
3. **Добавить trackInfoOpen state в deck.store** (строка 6)
4. **Добавить кнопку TrackMap в ControlDeck** (строка 492)
5. **Добавить useTrackInfoStore import в ControlDeck** (строка 15)

---

SCANNING COMPLETE
