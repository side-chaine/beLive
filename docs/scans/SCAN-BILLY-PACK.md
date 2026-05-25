# 📦 SCAN-BILLY-PACK — Полная инвентаризация Billy-системы

> **Цель:** Единый источник истины по всем сканам 001–010 для Центра (chat.z.ai)  
> **Статус:** ✅ Завершён  
> **Дата:** 2026-05-24  

---

## Структура

1. [SCAN-01: Lyrics DOM](#scan-01-lyrics-dom)
2. [SCAN-02: WagonTrain](#scan-02-wagontrain)
3. [SCAN-03: Z-Index Stack](#scan-03-z-index-stack)
4. [SCAN-04: App.tsx Render Tree + Root](#scan-04-apptsx-render-tree--root)
5. [SCAN-05: ControlDeck Ground Plane](#scan-05-controldeck-ground-plane)
6. [SCAN-06: Practice System](#scan-06-practice-system)
7. [SCAN-07: Audio-Reactive Bridge](#scan-07-audio-reactive-bridge)
8. [SCAN-08: Event Bus Map](#scan-08-event-bus-map)
9. [SCAN-09: CSS Vars Inventory](#scan-09-css-vars-inventory)
10. [SCAN-10: BillyDock Verification](#scan-10-billydock-verification)

---

## SCAN-01: Lyrics DOM

### Компоненты

| Компонент | Файл | Роль |
|-----------|------|------|
| `RehearsalLyrics` | `src/components/RehearsalLyrics.tsx` (1087 строк) | Главный контейнер отображения текста |
| `KaraokeLyricsBoard` | `src/components/KaraokeLyricsBoard.tsx` | Альтернативный рендеринг (караоке) |
| `WordHighlightLine` | `src/triggers/WordHighlightLine.tsx` | По-word хайлайтинг |
| `lyrics.store` | `src/stores/lyrics.store.ts` | Состояние: lines[], activeLineIndex, activeBlockId |
| `lyrics.bridge` | `src/bridges/lyrics.bridge.ts` | Мост DOM ↔ Store |

### RehearsalLyrics — ключевые data-атрибуты

На `.root`:
- `data-reactive="true"`
- `data-line-active-level={lineActiveLevel}` (`'focus'|'dim'|'off'`)
- `data-line-next-level={lineNextLevel}` (`'guide'|'hint'|'off'`)
- `data-line-others-level={lineOthersLevel}` (`'dim'|'low'|'medium'`)
- `data-line-others-source={lineOthersSource}`

На `.activeBlock`:
- `data-slot-group-id={activeSlotGroup?.id}`
- `data-slot-group-type={activeSlotGroup?.blockType}`
- `data-slot-group-color={activeSlotGroup?.blockColor}`
- `data-spotlight-active="true"` (когда preset включён)
- `data-spotlight-dim-others="true"` (когда dim включён)
- `data-traveling="true"` (во время travel)
- `data-dissolving="true"` (во время dissolve)
- `data-entering="true"` (во время enter)
- `data-enter-mounted="true"` (enter завершён)

На каждой `.line`:
- `data-line-index={slot.lineIndex}`
- `data-slot-id={slot.id}`
- `data-active="true"` (текущая линия)
- `data-is-preview="true"` (preview-слот)
- `data-grow-cue="true"` (предпросмотр растёт)
- `data-block-type={displayBlock.type}`
- `data-word-fx-mode={wordFxMode}`
- `data-reactive-words="true"` (есть word-sync)
- `data-line-next="true"` (следующая линия)
- `data-line-next-level={lineNextLevel}`

На `.previewOverlay`:
- `data-travel-target={psOverlayTop}`
- `data-travel-block-id={nextBlockMeasureRef.current?.nextBlockId}`
- `data-travel-container-h={...containerHeight}`
- `data-travel-content-h={...contentHeight}`

На `.blockCue`:
- `data-block-type={nextBlock.type}`
- `data-grow-cue="true"`

На каждой `.loopBoundary`:
- `data-direction="up"|"down"` (для стрелок)

### CSS Vars на RehearsalLyrics

Transition Preset vars (на `.root`):
```
--bl-ps-appear-duration
--bl-ps-appear-easing
--bl-ps-appear-slide
--bl-ps-appear-start-opacity
--bl-ps-appear-end-opacity
--bl-ps-travel-duration
--bl-ps-travel-easing
--bl-ps-spotlight-intensity
--bl-ps-spotlight-glow-size
--bl-ps-spotlight-glow-opacity
--bl-ps-spotlight-others-opacity
--bl-ps-dissolve-duration
--bl-ps-dissolve-end-opacity
--bl-ps-dissolve-scale
--bl-ps-enter-duration
--bl-ps-enter-start-opacity
--bl-ps-enter-slide-y
```

### WordHighlightLine — ключевые пропсы
- `lineIndex: number`
- `text: string`
- `fx: WordFxMode` (`'default'|'neon'|'progress'|'underline'|'bounce'`)
- `focus: WordFocusLevel` (`'off'|'soft'|'strong'`)
- `blockType?: string`

### CSS-классы триггеров (`word-effects.css`)
- `.bl-word-line` — обёртка линии
- `.bl-word` — базовое слово
- `.bl-word--active` — активное слово
- `[data-word-state="settled"]` — спетые слова
- `[data-line-role="active"]` / `[data-line-role="past"]` / `[data-line-role="future"]` — роль линии
- `[data-word-fx="..."]` — тип FX (progress/neon/underline/bounce)
- `[data-word-focus="..."]` — уровень фокуса (off/soft/strong)
- `[data-visual-tier="lite"|"balanced"|"max"|"ultra"]` — производительность
- `[data-recording-active="true"]` — режим записи

### KaraokeLyricsBoard (`z-index: 50`)
- Альтернативный рендеринг текста
- `data-line-index` на каждой линии
- Использует `karaoke-word` классы

---

## SCAN-02: WagonTrain

### Компоненты

| Компонент | Файл | Роль |
|-----------|------|------|
| `WagonTrain` | `src/components/WagonTrain.tsx` | Горизонтальная карусель блоков |
| `WagonTrain.module.css` | `src/components/WagonTrain.module.css` | Стили (z-index: 10) |
| `loop.store` | `src/stores/loop.store.ts` | Состояние лупов |
| `blocks.store` | `src/stores/blocks.store.ts` | Состояние блоков |
| `types.ts` | `src/blocks/types.ts` | BLOCK_TYPE_CONFIG |

### Data-атрибуты WagonTrain

На каждом блоке в трейне:
- `data-block-type={block.type}`
- `data-loop-active={isLoopActive}`
- `data-half-loop={isHalfLoop}`
- `data-block-id={block.id}`

### BLOCK_TYPE_CONFIG (7 типов)

| Type | Label | Color | CSS Var |
|------|-------|-------|---------|
| `verse` | Verse | `#4CAF50` | `--bl-block-verse` |
| `prechorus` | Pre-Chorus | `#FFEB3B` | `--bl-block-prechorus` |
| `chorus` | Chorus | `#F44336` | `--bl-block-chorus` |
| `bridge` | Bridge | `#9C27B0` | `--bl-block-bridge` |
| `interlude` | Interlude | `#E91E63` | `--bl-block-interlude` |
| `intro` | Intro | `#2196F3` | `--bl-block-intro` |
| `outro` | Outro | `#00BCD4` | `--bl-block-outro` |

### WagonTrain CSS Vars
- `--react-header-height` (top позиция)
- `--bl-spacing-sm`, `--bl-spacing-xs`
- `--bl-cover-bg-tint`, `--bl-cover-border`, `--bl-cover-glow`, `--bl-cover-glow-strong`
- `--bl-surface-sunken`, `--bl-surface-overlay`
- `--bl-border-subtle`, `--bl-border-strong`
- `--bl-text-secondary`
- `--bl-font-family`
- `--bl-transition-fast`
- `--bl-accent`
- `--bl-block-*` (все 7 типов для градиентов)

### Z-index в WagonTrain
- `.root`: `z-index: 10`
- `.block`: `z-index: 1`
- `.block[data-loop-active="true"]`: `z-index: 2`
- `.block[data-half-loop="true"]`: `z-index: 3`

---

## SCAN-03: Z-Index Stack

### Полный реестр z-index (34 CSS-декларации)

| # | Компонент | Файл | z-index | Примечание |
|---|-----------|------|---------|------------|
| 1 | `AiSettingsModal` | `AiSettingsModal.module.css:9` | **999999** | Самый верхний |
| 2 | `LineFxSelectorModal` | `LineFxSelectorModal.module.css:4` | **999998** | |
| 3 | `InstrumentOverlay` | `InstrumentOverlay.module.css:6` | **999998** | |
| 4 | `TrackInfoBoard (container)` | `TrackInfoBoard.module.css:30` | **999997** | |
| 5 | `TrackInfoBoard (child)` | `TrackInfoBoard.module.css:55` | 1 | |
| 6 | `TrackInfoBoard (base)` | `TrackInfoBoard.module.css:7` | 0 | |
| 7 | `BillyDock` | `BillyDock.module.css:8` | **999996** | |
| 8 | `Header` (inline) | `Header.tsx` | **999996** | Inline style |
| 9 | `ControlDeck` | `ControlDeck.module.css:6` | **999995** | |
| 10 | `BottomBar` | `BottomBar.module.css:6` | **999995** | |
| 11 | `BlockEditorModal` | `BlockEditorModal.module.css:6` | 9999 | |
| 12 | `BlockEditorModal (inner)` | `BlockEditorModal.module.css:260` | 1 | |
| 13 | `WagonTrain .root` | `WagonTrain.module.css:5` | **10** | |
| 14 | `WagonTrain .block` | `WagonTrain.module.css:140` | 1 | |
| 15 | `WagonTrain .block` | `WagonTrain.module.css:150` | 1 | |
| 16 | `WagonTrain .block` | `WagonTrain.module.css:165` | 1 | |
| 17 | `WagonTrain [data-loop-active]` | `WagonTrain.module.css:270` | 2 | |
| 18 | `WagonTrain [data-half-loop]` | `WagonTrain.module.css:357` | 3 | |
| 19 | `RehearsalLyrics .root` | `RehearsalLyrics.module.css:7` | 5 | |
| 20 | `RehearsalLyrics .coverBg` | `RehearsalLyrics.module.css:18` | 1 | |
| 21 | `RehearsalLyrics .coverBgImage` | `RehearsalLyrics.module.css:213` | 2 | |
| 22 | `RehearsalLyrics .previewOverlay` | `RehearsalLyrics.module.css:321` | 20 | |
| 23 | `RehearsalLyrics .previewOverlay[data-mounted]` | `RehearsalLyrics.module.css:344` | 19 | |
| 24 | `RehearsalLyrics .blockCue` | `RehearsalLyrics.module.css:368` | 20 | |
| 25 | `RehearsalLyrics .slotContainer` | `RehearsalLyrics.module.css:538` | 0 | |
| 26 | `RehearsalLyrics .loopBoundary` | `RehearsalLyrics.module.css:582` | 10 | |
| 27 | `MonitorMixPanel` | `MonitorMixPanel.module.css:700` | 10 | |
| 28 | `KaraokeLyricsBoard` | `KaraokeLyricsBoard.module.css:15` | 50 | |
| 29 | `LiveControls` | `LiveControls.module.css:5` | 150 | |
| 30 | `ThemeSelector` | `ThemeSelector.module.css:31` | 200 | |
| 31 | `LiveSubtitle` | `LiveSubtitle.module.css:6` | 100 | |
| 32 | `PianoKeyboard (white)` | `PianoKeyboard.module.css:20` | 1 | |
| 33 | `PianoKeyboard (black)` | `PianoKeyboard.module.css:32` | 2 | |
| 34 | `instrument-card` | `instrument-card.css:72` | 1 | |
| 35 | `CameraPreview` | `CameraPreview.module.css:7` | 1 | |

### Z-Index Layer Map (снизу вверх)

```
Layer 0:      Slot Container (0)
Layer 1:      Cover Background, TrackInfoBoard child, WagonTrain blocks, Piano white
Layer 2:      Cover Image, WagonTrain loop-active, Piano black
Layer 3:      WagonTrain half-loop
Layer 5:      RehearsalLyrics Root
Layer 10:     WagonTrain Root, Loop Boundary, MonitorMixPanel
Layer 19-20:  Preview Overlay, Block Cue
Layer 50:     KaraokeLyricsBoard
Layer 100:    LiveSubtitle
Layer 150:    LiveControls
Layer 200:    ThemeSelector
Layer 9995:   BlockEditorModal
Layer 999995: ControlDeck, BottomBar
Layer 999996: BillyDock, Header
Layer 999997: TrackInfoBoard
Layer 999998: LineFxSelectorModal, InstrumentOverlay
Layer 999999: AiSettingsModal
```

---

## SCAN-04: App.tsx Render Tree + Root

### Точка входа

| Файл | Роль |
|------|------|
| `main.tsx` | React root + DOMContentLoaded инициализация |
| `index.html` | HTML шаблон |
| `Header.tsx` | Верхний бар |

### main.tsx — порядок загрузки
```
DOMContentLoaded →
  1. initMonitorBridge()
  2. initModeSwitchBridge()
  3. render(<App />, #root)
  4. initTriggerBridge()
  5. initAudioReactiveBridge()
  6. initExerciseBridge()
  7. initMarkerBridge()
  8. initLoopBridge()
  9. initTrackBridge()
  10. initAudioBridge()
  11. initBlocksBridge()
  12. initCoverThemeBridge()
  13. initLyricsBridge()
  14. initStemReactiveBridge()
```

### Header — ключевые детали
- `z-index: 999996` (inline style)
- Устанавливает `--react-header-height` CSS var через ResizeObserver
- ResizeObserver на headerRef: `document.documentElement.style.setProperty('--react-header-height', \`${el.offsetHeight}px\`)`

### index.html
- `<div id="root"></div>` — React mount point
- `<div id="belive-ui"></div>` — legacy UI mount
- Подключает CSS: `index.css`, `fonts/Geist/...`

---

## SCAN-05: ControlDeck Ground Plane

| Файл | Роль |
|------|------|
| `ControlDeck.tsx` | Нижняя панель управления |
| `ControlDeck.module.css` | Стили (z-index: 999995) |

### ControlDeck — ключевые детали
- `z-index: 999995`
- ResizeObserver устанавливает `--bl-deck-height` на `document.documentElement`
- **НЕ удаляет** `--bl-deck-height` при размонтировании — BillyDock зависит от него
- Содержит: drag-перетаскивание лупов, mousemove/mouseup listeners

### BillyDock использует `--bl-deck-height`
```css
/* BillyDock.module.css:7 */
bottom: calc(var(--bl-deck-height, 48px) - 10px);
```

---

## SCAN-06: Practice System

### Файловая структура

| Файл | Роль |
|------|------|
| `exercise.store.ts` | Zustand-стор упражнений (459 строк) |
| `exercise.types.ts` | TypeScript типы |
| `exercise.schema.ts` | Валидация схемы |
| `exercise.recipes.ts` | Рецепты упражнений |
| `exercise.runtime.ts` | Логика шагов, курсора, фаз (143 строк) |
| `exercise.interruption.ts` | Прерывание практики (187 строк) |
| `exercise.bridge.ts` | Мост к DOM-событиям (34 строк) |
| `exercise.scope-resolver.ts` | Резолвер области |
| `exercise.validator.ts` | Валидатор |
| `ExerciseStrip.tsx` | UI-компонент полоски упражнения |
| `exercise.runtime.test.ts` | Тесты runtime |
| `exercise.interruption.test.ts` | Тесты interruption |

### Exercise Runtime (`exercise.runtime.ts`)

**Фазы упражнения (`ExercisePhase`):**
- `idle` — бездействие
- `listening` — прослушивание
- `pre-recording` — подготовка к записи
- `recording` — запись
- `comparing` — сравнение
- `waiting` — ожидание
- `exercise-complete` — завершено

**Типы шагов (`StepAction`):**
- `listen` → фаза `listening`
- `record` → фаза `pre-recording`
- `compare` → фаза `comparing`
- `wait` → фаза `waiting`

**BackingMode (громкость инструментала/вокала):**
- `full`: 1/1
- `instrumental`: 1/0
- `guide`: 1/0.25
- `silent`: 0/0
- `vocals-only`: 0/1

**advanceExerciseCursor:**
- Следующий шаг в рамках раунда
- При завершении раунда — переход на следующий или `completed: true`
- `ExerciseCursorResult`: `{ nextRound, nextStepIndex, completed, roundCompleted }`

**isExerciseExecutionLocked:**
- `true` когда фаза `listening`, `pre-recording` или `recording`

### Exercise Interruption (`exercise.interruption.ts`)

**Архитектура:**
- `PracticeInterruptHandler` registry (Map<consumerId, handler>)
- `registerPracticeInterruptHandler(consumerId, handler)`
- `unregisterPracticeInterruptHandler(consumerId)`
- `isPracticeSessionActive()` — проверка activeExercise + фаза не idle
- `interruptPracticeSession(action?)` — вызывает все handler'ы, восстанавливает volumes, отменяет exercise
- `runWithPracticeInterruption(fn)` — HOF-обёртка
- `initPracticeInterruptionBridge()` — выставляет `window.__belivePracticeInterruption`
- `disposePracticeInterruptionBridge()` — очистка

### Exercise Bridge (`exercise.bridge.ts`)

**События:**
- Слушает `before-track-change` → `cancelExercise()`
- Подписан на `takesStore.isRecording` → фаза `pre-recording` → `recording`, `recording` → `onStepCompleted()`

### Exercise Store — ключевые поля

```typescript
interface ExerciseState {
  activeExercise: Exercise | null;
  activeQuest: Quest | null;
  phase: ExercisePhase;
  currentRound: number;
  currentStepIndex: number;
  resolvedTimeRange: { startTime; endTime } | null;
  savedVolumes: { instrumental; vocals } | null;
  savedPlaybackRate: number | null;
  savedVmixEnabled: boolean | null;
  sessionProgress: SessionProgress;
  currentExerciseResult: ExerciseResult | null;
  completionMoment: CompletionMoment | null;
  shouldTriggerRecord: boolean;
  recordSlot: number | null;
  recordMode: 'standard' | 'in-flight' | null;
  roundCapture: RoundCaptureState | null;
  scenarioMixOverride: ScenarioMixOverride | null;
}
```

---

## SCAN-07: Audio-Reactive Bridge

### Файл: `src/bridges/audio-reactive.bridge.ts` (150 строк)

**Архитектура:**
- Участвует в `PlaybackVisualScheduler` (scheduler lifecycle owned by trigger bridge)
- Detector + Writer паттерн через scheduler

**Detector (`audio-reactive-detector`):**
- `AnalyserNode` с `fftSize=256`, `smoothingTimeConstant=0.8`
- Частотные диапазоны: bass (0-10%), mid (10-40%), high (40-100%)
- Beat detection: порог `bass > 0.6`, decay `0.85`
- Соединяется: `stereoMerger → analyser` или `instrumentalGain → analyser`

**Writer (`audio-reactive-writer`):**
- Использует `queueCssVar()` для batch-записи CSS vars
- Частота: 15fps (через scheduler)

**CSS vars (5 шт.):**
```
--bl-audio-energy → overall mix energy (0..1)
--bl-audio-bass   → bass band (0..1)
--bl-audio-mid    → mid band (0..1)
--bl-audio-high   → high band (0..1)
--bl-audio-beat   → beat hit (0..1, with decay)
```

**Жизненный цикл:**
- `window.addEventListener('playback-state-changed')` — при старте: `setup()`, при стопе: `resetCssVars()`
- При старте: `document.documentElement.setAttribute('data-reactive', 'subtle')`
- Cleanup: disconnect analyser, unregister from scheduler

---

## SCAN-08: Event Bus Map

### CustomEvent Producer → Consumer Table

| Событие | Producer(s) | Consumer(s) |
|---------|-------------|-------------|
| `before-track-change` | `track.orchestrator.ts`, `track.actions.ts` | `exercise.bridge`, `takes.bridge`, `lyrics.bridge`, `blocks.bridge`, `loop.bridge`, `blocks.store`, `stem-reactive.bridge`, `trackInfo.store`, `practice-session.store`, `trigger.bridge` |
| `track-loaded` | `AudioEngineV2.ts` | `lyrics.bridge`, `markers.bridge`, `blocks.bridge`, `audio.bridge`, `track.bridge`, `auto-lyrics.service` |
| `track-load-failed` | `track.orchestrator.ts` | `cover-theme.bridge` |
| `track-fully-loaded` | `AudioEngineV2.ts` | `audio.bridge` |
| `track-saved` | `upload.service.ts` | `CatalogLayout` |
| `tracks-changed` | `upload.service.ts`, `track.actions.ts` | `track.bridge` |
| `track-stem-ready` | `AudioEngineV2.ts` | `audio.bridge` |
| `playback-state-changed` | `AudioEngineV2.ts` (window+document) | `audio-reactive.bridge`, `audio.bridge`, `lyrics.bridge`, `takes.bridge`, `trigger.bridge`, `stem-reactive.bridge` |
| `playback-rate-changed` | `AudioEngineV2.ts` | `audio.bridge`, `practice-session.store` |
| `loopcompleted` | `AudioEngineV2.ts` | `practice-session.store` |
| `loop-set` | `AudioEngineV2.ts` | — |
| `loop-cleared` | `AudioEngineV2.ts` | — |
| `vocalmix-state-changed` | `AudioEngineV2.ts` | `audio.bridge` |
| `microphone-state-changed` | `MicrophoneManager.ts` | `audio.bridge` |
| `audio-position-changed` | — | `audio.bridge` |
| `timeupdate` | — | `audio.bridge` |
| `active-line-changed` | `lyrics.service.ts`, `lyrics.bridge.ts` | `lyrics.bridge`, `RehearsalBackground` |
| `lyrics-rendered` | `lyrics.service.ts` | `lyrics.bridge`, `blocks.bridge` |
| `mode-changed` | `mode-switch.bridge.ts` | `lyrics.bridge`, `mode.bridge`, `loop.bridge` |
| `blocks-applied` | `blockEditor.bridge.ts` | `blocks.bridge`, `track.bridge` |
| `catalog-close` | `catalog.store.ts` | `CatalogLayout` |
| `catalog-cleared` | `track.actions.ts` | `track.bridge`, `cover-theme.bridge` |
| `sync-editor-closed` | `sync.bridge.ts`, `catalog.store.ts` | — |
| `deck-set-tab` | `catalog.store.ts` | `CatalogLayout` |
| `sections-updated` | — | `markers.bridge` |
| `monitor-state-changed` | — | `monitor.bridge` |
| `monitor-route-changed` | — | `monitor.bridge` |
| `practice:started` | `practice-session.store.ts` | — |
| `practice:completed` | `practice-session.store.ts` | — |
| `practice:pass-complete` | `practice-session.store.ts` | — |
| `practice:cancelled` | `practice-session.store.ts` | — |
| `save-track-markers` | — | `track.actions.ts` |
| `camera-permission-resolved` | `live-mode.stub.ts` | — |

### Статистика
- **Всего CustomEvent имён:** ~30
- **dispatchEvent `new CustomEvent`:** 24 matches
- **dispatchEvent `new Event` (без detail):** 3 (`tracks-changed`, `before-track-change`)
- **addEventListener на document/window:** 107 matches
- **addEventListener на DOM элементах:** ~15 (audio elements, кнопки, etc.)
- **Самый популярный event:** `before-track-change` (10+ consumers)

---

## SCAN-09: CSS Vars Inventory

### CSS Var — Setteři (setProperty/JSX)

| CSS Var | Где устанавливается | Значение |
|---------|-------------------|----------|
| `--bl-audio-energy` | `audio-reactive.bridge.ts:47` | `0` (сброс), `queueCssVar` (0..1) |
| `--bl-audio-bass` | `audio-reactive.bridge.ts:48` | `0` (сброс), `queueCssVar` (0..1) |
| `--bl-audio-mid` | `audio-reactive.bridge.ts:49` | `0` (сброс), `queueCssVar` (0..1) |
| `--bl-audio-high` | `audio-reactive.bridge.ts:50` | `0` (сброс), `queueCssVar` (0..1) |
| `--bl-audio-beat` | `audio-reactive.bridge.ts:51` | `0` (сброс), `queueCssVar` (0..1) |
| `--react-header-height` | `Header.tsx:25` | `{el.offsetHeight}px` |
| `--bl-deck-height` | `ControlDeck.tsx:68,84` | `{entry.contentRect.height}px` |
| `--bl-billy-block-color` | `BillyDock.tsx:149` | `activeBlockColor` |
| `--bl-ps-*` (16 vars) | `RehearsalLyrics.tsx:113-131` | Transition preset values |
| `--bl-line-word-opacity` | `RehearsalLyrics.tsx:706` | `0.35`/`0.8`/`0.6` (dim/low/medium) |
| `--bl-line-word-color` | `RehearsalLyrics.tsx:707` | Цвет в зависимости от уровня |
| `--bl-preview-opacity` | `RehearsalLyrics.tsx:728` | `0.35`/`0.55`/`0.85` |
| `--bl-preview-color` | `RehearsalLyrics.tsx:729` | `rgba(0,210,160,...)` |
| `--bl-preview-weight` | `RehearsalLyrics.tsx:730` | `400`/`400`/`500` |
| `--plate-cue-x` | `RehearsalLyrics.tsx:769` | `{cueLeft}` (px) |
| `--plate-cue-top` | `RehearsalLyrics.tsx:1039` | `{cueTop}` (px) |
| `--bl-bc-font-size` | `RehearsalLyrics.tsx:1040` | `{bcFontSize}` |

### CSS Var — Design Tokens (потребляются, предположительно на :root)

#### Поверхности
| Var | Fallback | Используется в |
|-----|----------|----------------|
| `--bl-surface-base` | — | TrackInfoBoard |
| `--bl-surface-raised` | `#1a1a1a` | BillyDock |
| `--bl-surface-sunken` | `rgba(20,20,20,0.35)` | WagonTrain |
| `--bl-surface-overlay` | `rgba(0,0,0,0.18)` | WagonTrain |

#### Текст
| Var | Fallback | Используется в |
|-----|----------|----------------|
| `--bl-text-primary` | — | TrackInfoBoard |
| `--bl-text-secondary` | `rgba(255,255,255,0.7)` | TrackInfoBoard, WagonTrain |
| `--bl-text-muted` | `rgba(255,255,255,0.6)` | TrackInfoBoard, WagonTrain, RehearsalLyrics |

#### Границы
| Var | Fallback | Используется в |
|-----|----------|----------------|
| `--bl-border-default` | — | TrackInfoBoard |
| `--bl-border-subtle` | `rgba(255,255,255,0.12)` | TrackInfoBoard, WagonTrain |
| `--bl-border-strong` | `rgba(255,255,255,0.22)` | WagonTrain |

#### Акцент
| Var | Fallback | Используется в |
|-----|----------|----------------|
| `--bl-accent` | `#9b59b6` или `#22d3ee` | TrackInfoBoard, BillyDock, WagonTrain |

#### Блоки
| Var | Fallback | Используется в |
|-----|----------|----------------|
| `--bl-block-verse` | `#4CAF50` | WagonTrain, word-effects.css |
| `--bl-block-prechorus` | `#FFEB3B` | WagonTrain, word-effects.css |
| `--bl-block-chorus` | `#F44336` | WagonTrain, word-effects.css |
| `--bl-block-bridge` | `#9C27B0` | WagonTrain, word-effects.css |
| `--bl-block-interlude` | `#E91E63` | WagonTrain |
| `--bl-block-intro` | `#2196F3` | WagonTrain, word-effects.css |
| `--bl-block-outro` | `#00BCD4` | WagonTrain, word-effects.css |

#### Обложка (Cover)
| Var | Используется в |
|-----|----------------|
| `--bl-cover-bg-tint` | WagonTrain |
| `--bl-cover-border` | WagonTrain |
| `--bl-cover-glow` | WagonTrain |
| `--bl-cover-glow-strong` | WagonTrain |

#### Шрифты и отступы
| Var | Fallback | Используется в |
|-----|----------|----------------|
| `--bl-font-family` | `'Inter', sans-serif` | WagonTrain |
| `--bl-spacing-xs` | `4px` | WagonTrain |
| `--bl-spacing-sm` | `8px` | WagonTrain |
| `--bl-transition-fast` | `150ms ease` | WagonTrain |

#### Word Effects (word-effects.css — defaults на :root)
| Var | Default | Описание |
|-----|---------|----------|
| `--bl-word-progress` | 0..1 (injected) | Прогресс слова |
| `--bl-word-active` | 0\|1 (injected) | Активность слова |
| `--bl-line-active` | 0\|1 (injected) | Активность линии |
| `--bl-active-opacity` | `1` | Прозрачность активного слова |
| `--bl-active-color` | `#ffffff` | Цвет активного слова |
| `--bl-active-scale` | `1.04` | Масштаб активного слова |
| `--bl-active-glow` | `0 0 8px...` | Свечение активного слова |
| `--bl-dim-opacity` | `0.5` | Прозрачность неактивного |
| `--bl-dim-color` | `rgba(255,255,255,0.5)` | Цвет неактивного |
| `--bl-dim-glow` | `none` | Свечение неактивного |
| `--bl-line-glow` | `none` | Свечение линии |
| `--bl-word-transition-speed` | `0.12s` | Скорость перехода |
| `--bl-neon-color` | `#0dcaf0` | Neon цвет |
| `--bl-line-word-opacity` | fallback `--bl-dim-opacity` | Opacity на уровне линии |
| `--bl-line-word-color` | fallback `--bl-dim-color` | Цвет на уровне линии |
| `--bl-line-word-glow` | fallback `--bl-dim-glow` | Свечение на уровне линии |

#### BillyDock-specific
| Var | Fallback | Используется |
|-----|----------|--------------|
| `--bl-billy-block-color` | `transparent` | BillyDock.module.css |
| `--bl-deck-height` | `48px` | BillyDock.module.css |

#### TrackInfoBoard-specific
| Var | Используется |
|-----|--------------|
| `--expert-color` | TrackInfoBoard.module.css (для экспертного выделения) |

---

## SCAN-10: BillyDock Verification

### Новые/изменённые файлы (по git diff)

| Файл | Статус | Строк |
|------|--------|-------|
| `BillyDock.tsx` | **NEW** | 258 |
| `BillyDock.module.css` | **NEW** | 467 |
| `useBillyState.ts` | Modified | Изменения состояния |
| `useBillyAudioReactive.ts` | Modified | Изменения реактивности |
| `trackInfo.store.ts` | Modified | Изменения хранилища |
| `BillyChatModule.tsx` | Modified | Изменения модуля |

### BillyDock Component (`BillyDock.tsx`)

**Ключевые особенности:**
- Устанавливает `--bl-billy-block-color` CSS var через inline style
- Анимационные состояния: idle, talk, jump, float, pulse, bounce
- Jump logic — дергается в ритм музыки
- Позиционирование: `fixed`, `bottom: calc(var(--bl-deck-height, 48px) - 10px)`
- `z-index: 999996`

### BillyDock CSS (`BillyDock.module.css`)

**Ключевые стили:**
```css
.root {
  position: fixed;
  bottom: calc(var(--bl-deck-height, 48px) - 10px);
  z-index: 999996;
}
```
- Drop-shadow эффекты с `--bl-billy-block-color`
- Акцент на `--bl-accent` (#9b59b6) для outline/background/box-shadow
- `--bl-surface-raised` (#1a1a1a) для tooltip
- Состояния hover/focus с анимацией

### useBillyAudioReactive.ts — изменения

Читает CSS vars:
```typescript
// Из computed style
cs.getPropertyValue('--bl-stem-vocals-energy').trim()
// fallback на --bl-audio-energy
vocalRaw ? clamp01(parseFloat(vocalRaw) || 0) : get('--bl-audio-energy')

// Поля возврата:
{
  energy: get('--bl-audio-energy'),
  bass: get('--bl-audio-bass'),
  mid: get('--bl-audio-mid'),
  high: get('--bl-audio-high'),
  beat: get('--bl-audio-beat'),
}
```

---

## RED FLAGS & WARNINGS

### 1. Z-Index Race Condition: BillyDock (999996) vs Header (999996)
Оба имеют одинаковый z-index. Наложения могут давать неопределённый порядок отрисовки.

### 2. `--bl-deck-height` Lifetime
ControlDeck **не удаляет** `--bl-deck-height` при unmount. BillyDock зависит от этой переменной. Если ControlDeck пересоздаётся — возможно мерцание.

### 3. Event Bus — Нет типизации
Все CustomEvent'ы используют `(e as CustomEvent).detail` — нет единого реестра типов событий. Это источник потенциальных багов при рефакторинге.

### 4. `--bl-stem-vocals-energy` может отсутствовать
`useBillyAudioReactive.ts` обращается к `--bl-stem-vocals-energy` с fallback на `--bl-audio-energy`. В коде нет гарантии, что `--bl-stem-vocals-energy` сеттится кем-либо.

### 5. Audio-Reactive Bridge — single `AnalyserNode`
Весь аудио-реактивный слой использует один `AnalyserNode` (fftSize=256, sc=0.8). Нет выделенного анализатора для вокала/stem'ов.

### 6. Обилие document-level Event Listeners
107 `addEventListener` на `document`/`window` — может влиять на производительность. Нет единого Event Bus — все подписки размазаны по bridges.

### 7. CSS Vars — нет единого файла токенов
Design tokens (`--bl-surface-*`, `--bl-text-*`, `--bl-border-*`, etc.) потребляются из CSS modules, но нигде не объявлены явно в одном файле. Предположительно на `:root` в `index.css` или подобном.

### 8. Practice Interruption — глобальный registry
`interruptHandlerRegistry` — глобальная Map без автоматической очистки. `disposePracticeInterruptionBridge()` чистит, но если компоненты не вызывают dispose — handler'ы утекают.

### 9. Exercise Bridge — подписка на takesStore
`exercise.bridge.ts` подписывается на `useTakesStore.subscribe()` — прямой доступ к Zustand store из bridge, что нарушает слойную архитектуру.

### 10. BillyDock и Header — оба z-index 999996
Если Header и BillyDock пересекаются по вертикали, порядок отрисовки не определён. Нужно или развести z-index, или явно управлять stacking context.

---

## Сводка

| Скан | Статус | Объём данных |
|------|--------|-------------|
| SCAN-01: Lyrics DOM | ✅ | 1087 строк кода, 20+ data-атрибутов, 16 CSS vars |
| SCAN-02: WagonTrain | ✅ | 7 типов блоков, 6 CSS classes, 7 CSS vars, цепь z-index |
| SCAN-03: Z-Index Stack | ✅ | 34 CSS декларации, 10-уровневая карта |
| SCAN-04: App.tsx Render Tree | ✅ | 14 bridges, порядок инициализации |
| SCAN-05: ControlDeck | ✅ | z-index 999995, ResizeObserver, `--bl-deck-height` |
| SCAN-06: Practice System | ✅ | 5 модулей, 7 фаз, 4 шага, interruption registry |
| SCAN-07: Audio-Reactive Bridge | ✅ | AnalyserNode, 5 CSS vars, detector+writer, 15fps |
| SCAN-08: Event Bus Map | ✅ | ~30 событий, 24 dispatch, 107 listeners |
| SCAN-09: CSS Vars Inventory | ✅ | 50+ var, 6 setProperty, 15+ design tokens, 16 transition vars |
| SCAN-10: BillyDock Verification | ✅ | 258+467 строк new code, z-index 999996, 5 анимационных состояний |
