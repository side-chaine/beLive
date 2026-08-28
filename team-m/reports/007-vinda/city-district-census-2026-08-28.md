---
agent: 007-vinda (Hub)
task: city-district-census
status: delivered
updated: 2026-08-28
---

# 🏘 ПЕРЕПИСЬ КВАРТАЛОВ · Статус всех зон beLive для карты города

> Разведка: 007_Винда + 2 параллельных скаута (read-only, 28.08). Все факты: ls/grep/чтение голов файлов.
> Назначение: этот отчёт = **слой данных «статусы зданий»** для будущего bLb-SNAPSHOT (ОТЧЁТ 1 §8). Легенда: ✅ жив · 🚧 каркас · ⏸ HOLD/будущее · 🗑 легаси.
> Башня Билли переписана детально в ОТЧЁТЕ 5; коммуникации — в ОТЧЁТЕ 3.

---

## §1. СВОДНАЯ КАРТА (17 кварталов)

| Квартал | Здания (код) | Статус | VMO |
|---|---|---|---|
| 🌐 Врата (Welcome) | стартовая/онбординг (OnboardingAccordion) | ✅ жив | 001 |
| 📚 Площадь Каталог | `src/catalog/*` (CatalogLayout 3 колонки + swipe, CatalogContent, CatalogBillyChat, GhostTrackCard) + ПОРТ-dropzone (CatalogLayout.tsx:247-249) + DUO/FULL-бейджи (:220) + feed/ (12 модулей: FeedLayout, FeedPostCard, PostComposer, CommentsPanel, HeroStack...) + catalog.store (387) | ✅ жив | 002,024,025-028,033 |
| 🏭 Завод Studio | лирика+TrackMap, стемы-микшер, Visual-стемы (ядро аудио V3) | ✅ жив; 2 аварии P1 (FOUC потушена, Other наблюдение) | 003-005,036,037 |
| 🎓 Академия Quest | `src/practice/` (4 сценария Wave G + billy-action-runner) + `src/exercises/` (store/runtime/recipes + 6 генераторов: tempo-ladder/backing-ladder/call-response/echo/fill-select/trade + QuestEntrySurface/TempoSetupModal/QuestCompletionMoment) + `src/takes/` (TakesPanel 58KB, TakesControlStrip 40KB, recorder webm/opus, live-trail waveform) + deck-модуль 'Quest' (deck/modules.ts:63) + LoopEngineV3 | ✅ жив; 🚧 experimental/special-рецепты = «future waves» (демо) | 006,007,008,015-017 |
| 🎭 Театр Show | `src/components/Show/` (9 файлов: ShowEntry, ShowEditor, FeatureOverlay, PresenterDock, StepWorkspace, StepStrip, PointList, featureRegistry) + show/show-editor/show-presentation stores + show.html/show.image сервисы; монтаж App.tsx:53-56,240,245-246 | ✅ жив | 009,010 |
| 📡 Башня Split | `src/Rehearsal/` (trigger-bridge: ReplayGuard/EnvelopeSender/Watchdog/DriftCorrector/Coalescer/VirtualClock; deep-link ?room= HMAC; signaling-client WS; peer-connection perfect-negotiation; clock-scheduler.worker) + MonitorMixPanel (deck, DualAutoMixRow/CalibrationDrum); монтаж App.tsx:70,176-180 | ✅ жив; ⏳ видео Студент-Педагог ждёт S3-патч (post-m3); `attachLocalTracks` существует, но НЕ вызывается; components/ ПУСТО | 011 |
| 🎨 Ателье Styles | `src/styles/` (style-recipes) + **StylesDeck.tsx**: Font (textStyle-store) / Line (levels + LineFxSelectorModal) / Theme (`src/theme/`: store/themes/tokens/engine) / Плашка (plate.store W12) | ✅ жив | 012 |
| 🎹 Лаб Notes | питч C2-C6 | 🔥 авария: не подключён к V3, детекция ~80%, ложные октавы (ПОДКЛЮЧЕНИЕ РЕШЕНО/КАЧЕСТВО ОТЛОЖЕНО) | 013 |
| 🤖 Башня Билли | см. ОТЧЁТ 5 | ✅ дороги+FSM+звук; ⏸ правое окно/карточки/CoachPanel | 014 |
| 🏛️ Площадь Hub | feed/ (в Каталоге) + профиль+комменты | 🚧 демо; юр.вопрос «соцсеть vs пейджер» открыт (008 рек. #6) | 020 |
| 🎤 Арены Karaoke/Concert | `src/Karaoke/`, `src/Concert/` = **🗑 .gitkeep-пустышки**; реальная жизнь вне их: KaraokeLyricsBoard (App.tsx:233), KaraokeBackground/ConcertBackground, activateKaraoke/activateConcert (mode-switch), textStylePresets | ✅ функциональность жива; 🗑 директории-плейсхолдеры | 021,022 |
| 🎤 Арена Live | mode 'live' (mode.store) + LiveSubtitle + LiveControls (App.tsx:236-237) + activateLive + стиль 'live' | ✅ жив (каркас S4) | 023 |
| 🛠️ Мастерская Sync | `src/sync/` (canvas draw-grid/markers/waveform + **SyncEditorPanel.tsx:1347** App.tsx:238 + hooks + selectors + batch-publish/zip-export + sync.store 135 + **word-sync/**: confidence/hash/line-map.builder/tokenizer + providers base+gateway-align + ai-lyrics-sync + alignment-cache + 5 тестов) + stores: wordSync (122, FROZEN-READ, word-level) / markers (74, FROZEN-READ, line-level) / lyrics (84). Two-layer sync подтверждён структурно. ⚠️ подкаталога bridge/ НЕТ (вопреки докам) | ✅ жив | 018,019,040 |
| 🏚️ Старая мастерская блоков | `src/blocks/` (blockEditor.service init main.tsx:13, BlockEditorModal App.tsx:222, parser block-taxonomy/tagged-lyrics + 2 теста, blockEditor.store). Используют: App/main/block-editor-events/ControlPanel/auto-lyrics/SyncEditorPanel/waveform-editor.stub. **BAC-107 подтверждён**: live-mode.stub.ts ✓ + waveform-editor.stub.ts ✓ (register main.tsx:10) + facade.ts:51 FIXME(STUB-MIGRATION) ✓ | 🗑 легаси (ещё смонтирована; чинится W5) | 032,038 |
| 🏠 Дом профиля | `src/avatar/` (AvatarEngine, FullAvatar/FallbackAvatar живы, assets/store/css) + **UserRoom.tsx** (292) + user-profile.store, mount App.tsx:253 (`surface==='profile'`) | ✅ жив; ⏸ «Комната» (будущее) — зачатков нет вообще | 029,030 |
| ⚡ Электростанция AI Config | AiSettingsModal (App.tsx:252) + ai-settings.store + providers (gateway/belive/openrouter) | ✅ жив (BAC-108 закрыт); 🔴 belive-ai воркер отсутствует (ОТЧЁТ 3 H2) | 031 |
| 🧬 Архив ДНК / GTRACK | отдельного модуля НЕТ — ДНК живёт в TrackInfoBoard (🧬 DNA-вкладка, StructureDiagram, ai-expert-prompts) + metadata-backfill.service | 🚧 каркас (выделенной комнаты нет) | 034 |
| 🎬 Киностудия фонов | `src/backgrounds/` (RehearsalBackground 577, Concert/KaraokeBackground, backgroundConfig) + useBackgroundManagers + Сценарий-фон: block-scene.service + BlockScenesModal + blockScene.store | ✅ жив; Upload Pack для фонов не найден (upload только в ПОРТ каталога) | 032,039 |

## §2. СТАТИСТИКА ГОРОДА

- **✅ Живых кварталов: 12** (Врата, Каталог, Studio, Quest, Show, Split, Styles, Live, Sync, Профиль, Фоны, AI Config)
- **🚧 Каркас: 3** (Hub-демо, Архив ДНК, experimental-Quest)
- **⏸ HOLD/будущее: 4 точки** (правое окно Билли + карточки, CoachPanel, «Комната» профиля, S3-видео)
- **🗑 Легаси: 2** (Старая мастерская блоков — W5; Karaoke/Concert-директории .gitkeep)
- **🔥 Аварии: 2 активные** (фейдер Other — наблюдение; питч — не в V3) + 1 потушена (FOUC)

## §3. НОВЫЙ DRIFT (в дополнение к ОТЧЁТАМ 1/5)

| # | Drift | Факт |
|---|---|---|
| D13 | `src/sync/bridge/` не существует | В доках (sync-scout.md) указан — в коде нет |
| D14 | `src/Karaoke/`, `src/Concert/` = .gitkeep-пустышки | Зоны 021/022 живут в компонентах вне директорий — на карте города показывать как «Арены», не как папки |
| D15 | UserRoom монтаж App.tsx:253 | Совпадает с REGISTRY-строкой про CoachPanel:253 — но CoachPanel фактически на :247 (D9): в App.tsx:253 сидит UserRoom. REGISTRY-запись c0084c2 перепутала номера строк |
| D16 | Rehearsal `attachLocalTracks` не вызывается | Код есть, вызова нет — S3-патч это закроет (post-m3) |
| D17 | «Комната» (VMO-030, словарь) | Зачатков в коде ноль — чистое будущее, на карте = стройплощадка 🚧 |

## §4. ВЫВОД

1. **Город на 70% живой**: 12 из 17 кварталов работают, легаси — 2 точки (обе в плане W5/волн).
2. Карта города может быть построена **прямо из данных этого отчёта**: квартал → здания(file:line) → статус → VMO-скрины → баги (ОТЧЁТ 1 §6) → ответственный (REGISTRY §1).
3. Все «пустыри» на карте — не дыры, а **задокументированное будущее** (S1-S7 CONTEXT.md): правое окно Билли, Комната профиля, ДНК-комната, S3-видео, Hub.
4. Перепись не трогала frozen (wordSync/markers stores = FROZEN-READ, только чтение) — frozen-guard GREEN.

---

*ls/grep/чтение 28.08. Ничего не изменено. 🏘*
