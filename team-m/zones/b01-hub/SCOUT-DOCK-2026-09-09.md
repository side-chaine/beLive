# SCOUT-DOCK · факт-шит «механика дока» [SB] · 2026-09-09

**Собрал:** explore-скаут CEO_1 · **Ветки/HEAD:** `feature/yt-prep` @ 0f34ba4 (на момент съёмки; 007_2 работает параллельно) · **Для:** прогон A (сценарии дока, 007_2) как второй независимый факт-лист против SCENARIOS-DOCK-FACTS-2026-09-09.md 007_2 — Двойная карта на фактах.
**Errata CEO_1:** все file:line верифицированы скаутом grep'ом; ниже — только факты.

## 1. deck.store.ts — полный стейт
- Поля: `expanded:false` :20 · `activeTabId:''` :21 · `pianoWasOpen:false` :22 · `visualMode:false` :23
- persist `bl-deck`, partialize :31-34: **переживают перезагрузку только expanded + activeTabId**
- `toggle()` :24 — меняет expanded, НЕ трогает tab · `setTab(id)` :25 — tab+expanded=true · `clearTab()` :27 — пусто+свёрнут · `enterVisualMode()` :28 / `exitVisualMode()` :29 — visualMode+expanded=true

## 2. ui.store.ts — флаги поверхностей
- `catalogOpen` :39 · `karaokeLinesCount 2|4` :40 (дефолт 2; тоггл 2↔4 в KLB tsx:111-117) · `karaokeLyricsScale` :41 · `catalogTab` :43 · `appMode:'studio'|'feed'` :44 · feed-колонки :45-47 (единственный persist :66-70)
- **Флаг show/hide-панелей ОТСУТСТВУЕТ** — планируется Z2 K-C (:88 спеки), в коде нет (grep hidePanels/showPanels/panelsVisible = 0)

## 3. mode.store.ts
- `concert|karaoke|rehearsal|live` :3, дефолт rehearsal :11, **НЕ persist** (reconnect = rehearsal)
- setMode :12; переключатели: ModeButtons.tsx:20 (4 пилюли, БЕЗ dropdown — dropdown = Z3 план), practice restore :148, event-bus mode-events :77/:82, ThemeProvider :27, AI-tools :969, тесты

## 4. deck/registry.ts + modules.ts — видимость модулей по режимам
- getModulesForMode :25-27 (filter по m.modes); lazy-кэш навсегда :39-49
| id | label | modes | 
|---|---|---|
| mixer | Studio | reh,kar,conc |
| takes | Quest | reh,kar,conc |
| show | Show | reh,kar,conc,live |
| monitor | Split | reh,kar,conc,live |
| styles | Styles | reh,kar,conc |
| pitch | Notes | reh,kar,conc |
| billy | 🤖 | reh,kar,conc,live |
- extraActions sync/dna — НЕ модули, действия ControlDeck :68-93
- Закомментированы: mix, tools, ai (v2.0-наследие :3-59)

## 5. ControlDeck.tsx + --bl-deck-height (СЧЁТ ПОДТВЕРЖДЁН: 4 pub-операции / 5 cons)
- Структура :57-105: root(fixed bottom, z999995) → TransportPanel(безусловно :62) → DeckBar :67 → panel при expanded :95-101 (height var(--bl-deck-panel,240px))
- stale-tab guard :48-55 (режим↔tab нормализация)
- pub: ControlDeck RO :28 + mount :44 · ShowEditor.tsx:25 RO · SyncEditorPanel.tsx:95 RO (cleanup НЕ удаляет var — BillyDock-зависимость :32-37)
- cons: useBillyZoneCache.ts:25 (parseFloat) · RehearsalLyrics.module.css:6 · CatalogPanel.tsx:62 · SyncLyrics.tsx:85 · InstrumentOverlay.module.css:5

## 6. DeckBar.tsx
- hasStudio :180 = виден где есть mixer-модуль (не live) · modeTiles :179 (TILES takes/pitch/show/monitor :27-32 × visibleModules)
- клики плиток/меню/Studio = interruptPracticeSession(→setTab) :209/:285/:353; toggle :382
- ⋯-меню: CoverArt-шапка :335-344 · прочие модули :345-357 (minus TILES/mixer) · «Аудио» :358 → AudioActionsPopover (VMix :22-54, Mic :57-109, mic-volume :112-190) · Sync/DNA :366-377 (data-active syncOpen/trackInfoOpen) · Expand :378-385 · mic-dot data-mic :310 + CSS :189-200
- темпо: displayRate=isPracticeActive?practiceRate:playbackRate :63; applyRate 0.25-4 кламп P.8 0.8-1.2 :66-72; guard при практике :80/:88/:106; aria 0-100+valuetext :228-234
- неоны: instValue dual music-bus↔instrumental :115-121 (hasMusicStems=BUILTIN role 'music'); practice override :125-147; pointer-drag :150-166; keydown ±0.05 :169-176

## 7. App.tsx — карта развилок :213-253
| условие | рендер | док |
|---|---|---|
| !authChecked | LoadingSplash | — |
| surface=welcome | WelcomePage | НЕТ |
| appMode=feed | FeedScreen | НЕТ |
| syncOpen | SyncLyrics + **SyncEditorPanel** | ЗАМЕЩЕНИЕ :237-243 |
| showActive | **ShowEditor** | ЗАМЕЩЕНИЕ |
| иначе | WagonTrain+RehearsalLyrics (rehearsal) / KaraokeLyricsBoard (kar/conc :233) + **ControlDeck** | ЖИВЁТ |
| featureActive | FeatureOverlay :244, CameraPreview/LiveSubtitle/LiveControls ВЫКЛЮЧЕНЫ :234-236 | ControlDeck рендерится? — **НЕТ: ternary :237-243 не исключает featureActive — док остаётся, но Live-* гаснут; проверить визуальное поведение** |
| isPresenting | PresenterDock :245 | ControlDeck под ним (не взаимоискл.) |
| bl-mascot=on | BillyDock :246 | ++ |
| coachPanelOpen | CoachPanel :247 | ++ |
- showActive = activeMode!=='entry' && !featureActive && !isPresenting :77

## 8. DeckBar.css media
- ≤1080: gap 10, padding 10/12, studio/tiles 64×64, more h64, иконки 24px, tempo max-none, **лейбл % скрыт** :241-249
- ≤820: подписи скрыты, неон 48px/13px :250-253; TransportPanel ≤1280/≤1080 :402-412

## 9. Z2 v1.1 дока-релевантное
- K-C :88/:123/:135/:156/:170: флаг в ui.store (новый), L0=скрывает DeckBar, TransportPanel остаётся; bounding слой НАД панелью; ЖИВОЙ пересчёт при смене --bl-deck-height (RO)
- transport-actions.ts :40/:131: applyRate/Inst/Voc переезжают, чтения call-time getState, intermediate-контракт
- НЕ-решения :188-199: repeat (нет в audio.store → disabled/noop) · бейдж Mini-Catalog · Show/Hide-скоуп (полная семантика→Z3) · углы chevron vs Show/Hide (арбитраж Никиты) · «105» формула · inactive-line финал · MASTER/VOCAL/INST=Волна-2 · таймер=200 · linesCount5 только по scroll-краю

## 10. interrupt & practice
- interruptPracticeSession :72-123: no-op без практики; с практикой → все interrupt-хендлеры → **восстановление volume из snapshot** :94-110 (setVolumes+audioStore.setState) → cancelExercise :114 → action
- вызовов в src (без тестов): **25 в 8 файлах** (DeckBar 5, TakesControlStrip 5, WagonTrain 4, shortcuts 3, ControlDeck 2, TransportPanel 2, TakesPanel 2, ExerciseStrip 2)
- practice store: isActive/currentRate/practiceStatus/scenarioId/passesCount/isAutoAdvance; **потребители в доке = ТОЛЬКО DeckBar** (12 вхождений)

## 11. PHONE-аудит (док-область)
- 390px: ControlDeck = боль №1: panel 240px фикс + header/wagon/billy → ~55% экрана; @media в ControlDeck.module.css = 0; deck-height RO работает (консы подстраиваются :77)
- MonitorMixPanel 3-колонки схлопываются 🔴; tablet 768-1024: панель не пересчитывается, overflow-x спасает
- системно: pointer:coarse=0 во всём проекте, safe-area только в WelcomePage (22 fixed-оверлея без env()), 100vh без dvh ×5

## 12. ЧЕГО НЕТ В ДЕРЕВЕ (подтверждено)
LeftProfilePanel · VideoOverlay · WaveCanvas · transport-actions.ts — только в спеках/ROADMAP.
TransportPanel «105 BPM» :207-208 — статик-литерал, стора нет. --bl-transport-panel-h:76px (css:34-35).
