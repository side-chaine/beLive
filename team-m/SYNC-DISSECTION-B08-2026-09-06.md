# SYNC-DISSECTION-B08 · ПОЛНЫЙ РАЗБОР ВСЕХ ФУНКЦИЙ SYNC-РЕДАКТОРА

**Зона:** B08 «Башня Sync» (`src/sync/**`) · **Агент:** agent-sync (смена-1, заказ Никиты 06.09)
**Канон на момент разбора:** HEAD `16d608c` · tsc 184/812 vitest (канон реестра 16d608c) · зона: tsc 8, reach 0, junction 0
**Метод:** полный проход всех 31 файла зоны (4 575 LOC) + стыки (main.tsx-патчи, markers.store, wordSync.store, event-bus SyncBus, gateway /v1/align, track.loader, auto-lyrics) · скаут-пакет: sync-scout + arch-scout (06.09)

---

## 0. СВОДКА ОДНОЙ СТРОКОЙ

**Башня Sync жива вся (0 мёртвых файлов, 0 reach-нарушений), но стоит на невидимом фундаменте: реальный CRUD маркеров живёт НЕ в зоне, а в ~230 строках window-патчей `main.tsx:328-554`, наращивающих 83-строчную оболочку `js/marker-manager.js`. AI-синк (кнопка Align) — полный фронт-путь к mock-бэкенду (gateway /v1/align = каждая строка 2с, confidence 0.5), который осознанно отфильтрован двойным контр-доверием (F46 + порог 0.55). Кнопка «Add» имеет контрактный разрыв (TS2554), замаскированный совместимостью имён.**

---

## 1. КАРТА ФАЙЛОВ ЗОНЫ (31 файл · 4 575 LOC)

### 1.1 Живые входы зоны (импортируются кодом снаружи src/sync — 12 файлов)

| Файл | LOC | Роль | Импортёры-снаружи |
|---|---|---|---|
| `components/SyncEditorPanel.tsx` | 1338 | главный редактор (default export, монтируется в App) | App.tsx:33,238 |
| `components/SyncLyrics.tsx` | 208 | полноэкранная лирика при открытом редакторе | App.tsx:34,232 |
| `store/sync.store.ts` | 135 | UI-стейт редактора (zoom/follow/source/undo) | App.tsx:31,73 · ControlDeck.tsx:14-15,39 · ControlPanel.tsx:6,22 · CatalogLayout.tsx:10,115,242-243 |
| `selectors/word-selectors.ts` | 26 | чистые селекторы word-sync | RehearsalLyrics.tsx:8 (транзит в B01) |
| `word-sync/services/ai-lyrics-sync.service.ts` | 116 | гидрация word-sync-слоя при загрузке трека | track.loader.ts:5-7,79,440 (авто) |
| `word-sync/line-map.builder.ts` | 81 | классификатор строк лирики | upload.service.ts:7 (B09-стык) |
| `word-sync/types.ts` | 85 | типы контракта выравнивания | wordSync.store.ts:7 · upload.service.ts:10 · idb.service.ts:55(dyn) |
| `word-sync/line-map.types.ts` | 9 | типы карты строк | wordSync.store.ts:8 · idb.service.ts:54(dyn) |
| `word-sync/confidence.ts` | 18 | пороги доверия 0.55/0.8 | wordSync.store.ts:9 |
| `services/batch-publish.service.ts` | 118 | пакетная публикация ZIP→TG | CatalogContent.tsx:10-11 (B09-стык) |
| `canvas/peaks.ts` | 33 | генератор пиков волны | **5 имп. в takes**: TakesCanvas:2 · TakesPanel:13 · TakesControlStrip ×3(dyn) · useTakesPlayback:119(dyn) |
| `word-sync/hash.ts` | 15 | FNV-1a-хэш лирики (инвалидация кэша) | вн.: ai-lyrics-sync:2, zip-export:8 (+upload via types) |

### 1.2 Внутренние файлы (живы через внутри-зонные цепочки — 15 файлов)

| Файл | LOC | Роль |
|---|---|---|
| `components/WaveformCanvas.tsx` | 682 | канвас-ядро: drag/select/loop/seek/wheel-zoom |
| `hooks/useWaveformData.ts` | 106 | fetch+decode двух стемов через `ae.hybridEngine` (M1-2 контракт) |
| `hooks/useWaveformRender.ts` | 151 | композитор отрисовки (grid→wave→markers→selection→loop) |
| `hooks/useWaveformViewport.ts` | 89 | auto-fit зума + rAF-playhead (follow-режим 30% от левого края) |
| `canvas/draw-grid.ts` | 47 | адаптивная сетка времени (интервал 0.5–30с по зуму) |
| `canvas/draw-waveform.ts` | 77 | отрисовка волны по пикам (только видимый регион) |
| `canvas/draw-markers.ts` | 175 | M1 (цветная линия+пин) / M2 (чёрная+красный ромб) / highlight / selection / loop |
| `canvas/hit-testing.ts` | 78 | чистые hit-тесты (маркер ±10px, loop-handle ±10px) |
| `word-sync/services/lyrics-align.service.ts` | 25 | сервис-обёртка провайдера |
| `word-sync/services/alignment-request.builder.ts` | 70 | сборка AlignmentJobRequest из lineMap |
| `word-sync/services/alignment-cache.service.ts` | 82 | вердикт кэша: ready/missing/stale-{lyrics,audio,source,provider} |
| `word-sync/providers/gateway-align.provider.ts` | 69 | fetch → `{VITE_GATEWAY_URL}/v1/align` |
| `word-sync/providers/base.ts` | 40 | интерфейс AlignmentProvider |
| `word-sync/config.ts` | 6 | BAC-108: warn в dev / throw в прод без VITE_GATEWAY_URL |
| `services/zip-export.service.ts` | 197 | ZIP: стемы/лирика/обложка/фон/markers/export.json/alignment.json + 50MB пре-флайт |

### 1.3 Тесты (4 файла · 499 LOC · 62 кейса — класс H-1, исключены из reach)

`hash.test.ts` (10) · `confidence.test.ts` (26) · `line-map.builder.test.ts` (12) · `alignment-cache.service.test.ts` (14).

**Мёртвых файлов: 0.** (tokenizer.ts / useWordHighlight.ts из DEAD-CODE-MANIFEST-2026-08-30 уже снесены — в дереве отсутствуют; hold-лист: 0 записей src/sync; triage-51: зона чиста.)

---

## 2. ФУНКЦИИ РЕДАКТОРА — ЧТО ВИДИТ ПОЛЬЗОВАТЕЛЬ

**Вход в редактор (4 точки):**
1. ControlDeck.tsx:509-523 — вкладка «Sync» (technical section) → `interruptPracticeSession` → `openSync()`
2. ControlPanel.tsx:22 — кнопка Sync
3. upload.service.ts:668 — загрузка ZIP-трека с `{openSyncEditor: true}` (редактор открывается сам)
4. CatalogLayout.tsx:115 — смена трека из каталога `closeSync()` (принудительное закрытие)

**Монтирование:** App.tsx:232 `syncOpen && !showActive && !featureActive && <SyncLyrics/>`; :237-238 `syncOpen ? <SyncEditorPanel/> : …` — редактор замещает ControlDeck, SyncLyrics замещает RehearsalLyrics. Панель фикс-высоты 240px, отдаёт `--bl-deck-height` через ResizeObserver.

### 2.1 Контролы тулбара (SyncEditorPanel.tsx:817-1335)

| Контроль | Что делает | Механизм |
|---|---|---|
| **Back** :826 | закрыть редактор | `closeSync()` |
| **Loop** :842 | очистить луп (лампочка при активном) | window-экспоуз `__syncClearLoop` → `useLoopStore.clearLoop()` + восстановление follow |
| **Follow** :864 | следить ли за плейхедом | `toggleFollow` (rAF, плейхед на 30% слева) |
| **Markers** :874 | показать/скрыть маркеры | `toggleMarkersVisible` |
| **Blocks** :885 | открыть Block-редактор | `openBlockEditor()` (blocks/bridge) |
| **Zoom −/+** :903 | зум 10–500 px/s (×1.3) | `zoomOut/zoomIn` |
| **Source M/I/V** :913 | источник волны: mix/instr/vocal | `cycleSource`; слайдер громкости :920 → `ae.setInstrumentalVolume/setVocalsVolume` + stem.store + localStorage |
| **Add** :938 | маркер на первую НЕпомеченную строку | `placeMarker` (см. боль №1 — контрактный разрыв) |
| **Undo/Redo** :941-956 | снимки маркеров | sync.store pushUndo/undo/redo через mm.getMarkers/setMarkers |
| **Del** :961 | удалить ближайший/выбранные | window-экспоуз `__syncDeleteMarker` |
| **‹ Lines ›** :994-1168 | LRC-пикер версий с lrclib.net | `fetchLrcVersions`/`parseLrcVersion` (auto-lyrics.service:1806/1877, вне зоны) |
| **Align** :1170 | **AI-синк** — выравнивание слов | `handleAlignLyrics` :470-567 → lyrics-align.service → gateway (см. §4) |
| **Cancel** :1207 | откат к состоянию на открытии | `handleCancel` → undoStack[0] (не закрывает редактор) |
| **ZIP** :1215 | экспорт-архив трека | `handleExportZip` → zip-export.service (прогресс-заливка кнопки) |
| **📤 TG** :1243 | залить последний ZIP в TG | `uploadToTelegram` (stale-blob гард: isDirty → отказ) |
| **Publish** :1271 | ZIP + авто-заливка одной кнопкой | `handlePublishToBeLive` (symbol-токен против гонки) |
| **Save** :1326 | сохранить маркеры в IDB **+ скачать JSON-файл** | `mm.saveMarkersToTrack()` + getTrack + Blob(BOM) + `markClean` + closeSync |

### 2.2 Клавиатура редактора

- **«1»** — M1-маркер: SyncEditorPanel:425-445 (capture-phase) → `placeMarker` — первая непомеченная строка, время `ae.getCurrentTime()`
- **«2»** — M2-маркер: → `mm._addM2Marker()` (main.tsx:561-654) — закрывающий маркер блока: активная строка → блок → есть M1? → предыдущий блок → fallback последний M1 → `block-0`; повторный «2» = update времени. Не привязан к строке (lineIndex=-1, чёрная линия+красный ромб)
- **Escape** — снять луп (WaveformCanvas:525-533)
- ⚠️ **Двойная семантика:** кнопка «Add» (первая дыра) ≠ клавиша «1» legacy `_addMarkerForActiveLine` (активная строка + автопродвижение на следующую). Оба висят на keydown — React-capture :443 и document :61 в marker-manager.js. Кто перехватывает первым — capture-фаза React (фаза 1 у document-capture в React 17+: оба слушают document, React-листенер раньше по порядку регистрации → placeMarker срабатывает, legacy — тоже (не stopPropagation в mm!)). Но у React-обработчика есть `e.stopPropagation()` :434 → legacy-слушатель marker-manager.js:61 НЕ сработает (document-level, bubble... нет, mm слушает bubble `document.addEventListener('keydown', ...)` без capture). React-хендлер зарегистрирован с `true` (capture на document) → срабатывает в capture-фазе раньше → stopPropagation глушит mm-хендлер. Значит: в открытом редакторе «1» = React-семантика (первая дыра), вне редактора = legacy-семантика (активная строка). ✅ разведено, не баг — но семантический сдвиг.

### 2.3 Канвас-функции (WaveformCanvas.tsx)

- **Клик по пустому** → seek через TransportV3 (`t3.seek` :438-450; V2-fallback публикует `seek-position-changed` вручную)
- **Клик по маркеру** (±10px) → single-drag
- **Клик по выбранному при мультивыборе** → group-drag (delta ко всем выбранным)
- **Протяжка** (порог 5px) → selection (зелёная); маркеры внутри подсвечиваются
- **Shift+протяжка** → создать луп (оранжевый регион ≥0.1с; follow отключается, восстанавливается при снятии)
- **Ручки лупа** (±10px края / тело) → перетаскивание start/end/всего лупа → `useLoopStore.setRawLoop`
- **Wheel** → горизонтальный скролл; **Ctrl/Cmd+wheel** → pinch-зум с якорем на курсоре
- **Playhead** — rAF-цикл, follow = lock на 30% слева, авто-скролл волны

### 2.4 Функции-сервисы (внутренняя механика)

| Функция | Файл:строка | Что делает |
|---|---|---|
| `buildLineMap` | line-map.builder.ts:37 | классификация строк: `lyric / separator / bracket [Тэг] / non-lexical (на-на, ла-ла, da-da)` → карта + выравниваемые строки. Anti-catastrophic-regex (урок PERF) |
| `computeLyricsHash` | hash.ts:5 | FNV-1a → `fnv1a:xxxxxxxx` — ключ инвалидации кэша выравнивания |
| `getAlignmentCacheVerdict` | alignment-cache.service.ts:42 | машина инвалидации: missing → stale-lyrics (hash≠) → stale-source (audio≠) → stale-audio → **stale-provider (provider==='mock' — F46)** → ready |
| `prepareWordSyncLayer` | ai-lyrics-sync.service.ts:38 | гидрация при загрузке трека (track.loader:440): lineMap + hash + вердикт кэша → wordSync.store (ready/missing/degraded). RTF-детектор деградации (`{\rtf` = источник мусорный) |
| `clearWordSyncLayer` | ai-lyrics-sync.service.ts:114 | очистка при смене трека (track.loader:79) |
| `buildAlignmentJobRequest` | alignment-request.builder.ts:42 | сборка запроса: rawLyrics + lineMap + alignableLines + anchors + mode(full/anchored/repair-window) |
| `generateTrackZip` | zip-export.service.ts:37 | стемы (STORE без сжатия) + lyrics.txt + cover + background + export.json + **alignment.json**; пре-флайт 50MB → mp3-транскодер (worker) → fallback-битрейт → throw если всё равно больше |
| `batchPublishTracks` | batch-publish.service.ts:38 | последовательная публикация N треков (300ms пауза), abort-хэндл, прогресс-колбэки |

---

## 3. ФОРМАТ ДАННЫХ — ДВУХСЛОЙНАЯ МОДЕЛЬ

### 3.1 Слой 1: маркеры (line-level, M1/M2) — Frozen-READ стор + legacy

```
Marker { id, lineIndex, time, text, blockType, color,
         markerType: 'M1'|'M2', afterBlockId, isSuggested }
```
- **M1** — строка лирики = время старта. Цвет = цвет блока (`_getColorForBlockType`), синим синтезом блоков из маркеров (main.tsx:379)
- **M2** — закрывающая граница блока (после afterBlockId), цвет фикс `#1a1a1a`, ромб-колпак
- Хранилище: `markers.store` (Frozen-READ, как bridges — OPERATING-RULES.md:15) + legacy `window.markerManager` (SSOT времени жизни: mm.markers). Мост: `markers-events.ts` (track-loaded → bounded settle-poll 120мс/2с + ресинк после `awaitStemReady('vocals')`)

### 3.2 Слой 2: word-sync (word-level, AI-выравнивание)

```
AlignmentResult { source:'ai-aligner', version:1, lyricsHash, audioHash?,
                  audioSource: 'vocal-stem'|'mix'|'instrumental',
                  provider, mode: 'full'|'anchored'|'repair-window',
                  lines: LineTiming[] { words: WordTiming[]{start,end,confidence} },
                  separators }
```
- **Инвалидация:** lyricsHash (FNV-1a от нормализованной лирики) + audioHash + audioSource + provider≠mock. Любое несовпадение → «stale-*» → слой деградирует, кнопка Align обязана пересчитать
- **Доверие:** пороги `LOW 0.55 / HIGH 0.8` (confidence.ts). `<0.55` → построчная подсветка (никогда не «выдуманная точность» — принцип честности word-sync, migration-story:23). `0.55–0.8` = repair-candidate (кандидат на ручную починку)
- **Опережение подсветки:** `ACTIVE_WORD_TIME_OFFSET = 0.18с` + epsilon 0.03с (cue-style early) — слово загорается чуть раньше звучания; `getFillWordForLine` — точное, без lookahead (для fill-эффектов)
- **Гидрация:** автоматическая при загрузке трека (track.loader:440), БЕЗ кнопки. Кнопка Align = только `mode:'anchored'` (по маркерам-якорям, hard:true)
- **Персист:** `updateTrackField(id, {alignmentData, lineMap})` в IDB (SyncEditorPanel:536-539); ZIP несёт `alignment.json`

### 3.3 LRC-теги (вне зоны, но питает её)

`parseTaggedLyrics` — src/blocks/parser/tagged-lyrics.parser.ts:185 (NOT src/sync!). Потребители: blockEditor.store, auto-lyrics.service ×3, UploadPanel. Script-tags LRC («[Chorus]») → блоки; TC-010-верификация (05.09): 7/7 блоков, 61/61 строк, confidence 100% — «no [Chorus] after [Bridge]» корректно разложился. **TC-010 сам (матчинг Genius↔LRC) жил в auto-lyrics.service (B09-путь загрузки) — в живой зоне B08 матчинга НЕТ: зона потребляет готовые маркеры.**

### 3.4 Событийная шина

SyncBus (8 именованных методов, 7 live-событий + sync-editor-closed исключён как RESIDUE): blocks-applied, active-line-changed, lyrics-rendered, save-track-markers, loop-set, loop-cleared, loopcompleted, sections-updated. **Фронт зоны НЕ публикует в SyncBus** — редактор ходит через window-глобалы + zustand + CustomEvent('save-track-markers'). Подписчики шины: lyrics.service, **AutoMixController:54-55** (B04-стык: авто-микс секций слушает active-line-changed).

---

## 4. AI-СИНК: ЧЕСТНЫЙ РАЗБОР ЦЕПОЧКИ (кнопка Align)

```
Align :1170 → handleAlignLyrics :470
  гварды: lineMap ∅ / hash ∅ / audioSource ∅ / degraded → error
  anchors = все маркеры M1 (lineIndex+time, hard)
  buildAlignmentJobRequest(mode:'anchored') :496
  lyricsAlignService.align :504
    → GatewayAlignProvider.align (fetch POST {VITE_GATEWAY_URL}/v1/align)
      → gateway/src/index.ts:329 «mock-success, unauthenticated»
         КАЖДАЯ строка: start=index*2, end=+2, confidence 0.5, words=[]
         provider:'mock', providerVersion:'stub-v1'
  → response.ok → wordSync.store(ready) + updateTrackField(alignmentData)
```

**Контр-доверие (двухслойное, осознанное):**
1. **F46** (alignment-cache.service.ts:67-70): `provider === 'mock'` → вердикт **stale-provider** → кэш/гидрация отказывают → mock никогда не попадает в IDB-гидрацию при загрузке
2. **Порог 0.55** (confidence.ts): у mock-строк confidence=0.5 → band 'low' → `shouldEnableWordHighlight = false` → **слова не подсвечиваются никогда**

**Итог честно:** фронт-путь полностью жив (кнопка → запрос → ответ → стор → IDB), бэкенд = заглушка с ручной раскладкой «2 секунды на строку». Пользователь видит статус `gateway-align:ready`, но подсветки слов нет — и не будет, пока `/v1/align` не станет настоящим выравнивателем. **Провайдер фронтовый тоже честно называет себя `stub-v1` (gateway-align.provider.ts:15).** НЕ БАГ — контракт: mock ≠ истина. Но пользовательская ловушка: «Aligning…» → без видимого эффекта, без объяснения почему.

---

## 5. ТОЧКИ БОЛИ (найдено в этом прогоне)

| № | Боль | Где | Серьёзность |
|---|---|---|---|
| **1** | **Контрактный разрыв кнопки Add:** `addMarker(targetLine, currentTime)` — 2 позиционных аргумента при сигнатуре стора `addMarker(marker-объект)` → **TS2554 живой**. В рантайме второй аргумент теряется на уровне markers.store, спасает только совпадение первого с патчем `mm.addMarker(lineIndex, time?)` (main.tsx:385), который при time=undefined делает **второе** `ae.getCurrentTime()` — время маркера ≠ времени, снятого в placeMarker (мс-дрейф). Комментарий «delegates to legacy MM» ложен наполовину | SyncEditorPanel.tsx:413 ↔ markers.store.ts:44,63 ↔ main.tsx:385 | 🟠 средняя: работает вживую, но TS-правда кричит; любой рефакторинг сигнатуры сломает молча |
| **2** | **Fundamental зависимость от невидимого фундамента:** js/marker-manager.js = 83 строки-оболочка (только конструктор+keydown), весь CRUD/setMarkers/saveMarkersToTrack/_addM2Marker — ~230 строк window-патчей в main.tsx:328-554. Зона B08 вызывает mm.* 11 раз (sync.store undo/redo, save, export, LRC-apply). Документация зоны без main.tsx = ложь | main.tsx:328-554 · js/marker-manager.js | 🟠 архитектурный долг: «Башня» без видимого фундамента; менять сигнатуру mm = править зону, не найдя правку grep'ом зоны |
| **3** | **Save = скачивание файла:** кнопка Save ВСЕГДА скачивает `text_track_<title>.json` на диск пользователя (BOM+UTF-8) как побочный эффект сохранения в IDB. Пользователь ожидает «сохранить», получает файл в «Загрузках» на каждый Save | SyncEditorPanel.tsx:119-161 | 🟡 UX-неочевидность |
| **4** **| Лампочка Loop не реактивна:** `__syncHasLoop()` вызывается прямо в render (:849-854) — луп создан shift-протяжкой по канвасу → кнопка Loop не узнает до следующего ре-рендера панели | SyncEditorPanel.tsx:842-861 | 🟡 косметика (клавиша Esc работает) |
| **5** | **Прямая мутация zustand-объектов при group-drag:** `m.time = ...` на объектах массива стора без set() (рисуется — работает, persist через updateMarker), нарушение иммутабельности | WaveformCanvas.tsx:280-288 | 🟡 работает, хрупко (сторе Frozen-READ) |
| **6** | **UI-ловушка Align:** см. §4 — кнопка «успешна», эффекта нет, объяснения нет. Хоть F46+0.55 делают правильную вещь (mock не просачивается), пользовательский фидбек должен говорить «provider=mock, подсветка отключена» | SyncEditorPanel.tsx:984-991 (статус-строка) | 🟡 UX |
| **7** | **Double-fetch стемов для волны:** useWaveformData заново fetch+decode instrumental+vocals (полные файлы в память) независимо от аудио-движка и от takes-волн; hybridEngine-контракт M1-2 держит фасад. Для 3-минутного стема ~30МБ ×2 | useWaveformData.ts:12-67 | 🟡 память/скорость; у takes свой peaks-путь |
| **8** | **peaks.ts — ассет вне зоны:** 5 импортёров из takes — граница B08 размыта; перенос в utils/audio снимет связку «takes ↔ sync» | canvas/peaks.ts | ⚪ предложение |
| **9** | **Дубль импорта useSyncStore** (:2 и :8) — TS2300 ×2 | SyncEditorPanel.tsx:2,8 | ⚪ чистка (deadcode-батч) |
| **10** | **TS-долг зоны 8/184:** TS2300×2 (дубль-импорт) · TS2554×1 (боль №1) · TS6133×3 (idx:1089, viewport-параметры) · TS6133×1 (тест lineMap) · TS6196×1 (LoopHandleDetection) | см. карту | ⚪ 7 из 8 — чистка; 1 — боль №1 |

### Прецеденты боли из истории (arch-scout, верифицировано)

- **TC-010** (25-08.08): убийство N:M-матчинга (38 нечётких матчей → 7-8 блочных, дрейф −2.8s → ≈0, 450+ → 163 строк). Цена прогона 05.09: 7/7 блоков, 61/61 строк, confidence 100% — но детектив «201s vs 203s» (LRC от другой версии трека) показал: без подбора версии по длительности синк бесполезен. **Урок: источником дрейфа был не алгоритм, а данные.**
- **GUARD-36** (7222a7c): race-кадр смены трека (старые markers vs новые lines) — CRITICAL → quiet race-warn; смоук 6086bbf: `[GUARD]` тихий.
- **P1-рассинхрон ≥500ms** при смене трека (markers-events setTimeout 500ms vs V3-автостарт) — исправлен синхронной публикацией маркеров (6086bbf).
- **VOC L2/L3 off под V3** (track.orchestrator:365-436, frozen): треки dataVersion<4 едут с нескорректированными маркерами; компенсация — markers-events.ts:57-63 ресинк после `awaitStemReady('vocals')` (гвард с warn при отсутствии — живой warn в коде :62).

---

## 6. МЕТРИКИ ЗОНЫ (ПУЛЬС, замер 06.09)

| Гейт | Цифра | Комментарий |
|---|---|---|
| **Reach** | **0 нарушений** | все 27 source-файлов живы (12 входов-снаружи + 15 внутренних), 4 теста в H-1-классе; hold-лист: 0 записей src/sync; dead-code (tokenizer, useWordHighlight) снесён ранее |
| **TS (tsc)** | **8 ошибок зоны / 184 канон** | 4.3% канона; состав см. боль №10; 7 — чистка, 1 — живой контракт (TS2554) |
| **Junction (G-7)** | **0 пар** | junction-registry.yaml не содержит sync-пар — стык синка с B04 (AutoMixController ↔ active-line-changed) не зарегистрирован как пара (кандидат? событие живо, потребитель жив — формально пары «файл↔файл» нет, это событийный стык) |
| **Event-bus** | 7 live-событий SyncBus | зона их НЕ публикует — потребляет мир (AutoMix B04, lyrics.service) |
| **Тесты** | 4 файла / 62 кейса | hash 10 · confidence 26 · line-map 12 · cache 14 — покрытие чистого ядра word-sync; UI-слой (панель, канвас) — 0 тестов |
| **LOC** | 4 575 (зона) | source ~4 037 + тесты 499; ядро = SyncEditorPanel 1338 (29%) |
| **Window-глобалы** | 5 зависимостей | markerManager ×11 · lyricsDisplay ×4 · audioEngine ×5 · trackCatalog ×3 · +3 window-экспоуза канваса (__syncDeleteMarker, __syncClearLoop, __syncHasLoop) |
| **Vitest (зона, live)** | **62/62 зелёные · 4 файла · 2.24с** | прогон смена-1 13:52: hash 10 + confidence 26 + line-map 12 + cache 14; к канону 812 Δ0 — зона тест-нейтральна |

---

## 7. ПРЕДЛОЖЕНИЯ НЕДЕЛИ (для цепи 001→002→009 по GO; не код — разбор)

1. **P1 · Починить контракт Add-кнопки** (боль №1): либо выровнять сигнатуру стора до `(lineIndex, time)`, либо (чище) в placeMarker звать `mm.addMarker(targetLine, currentTime)` напрямую, минуя стор-делегацию, и положить маркер в стор мостом (как делает undo). Закрывает TS2554 + двойное чтение времени. Мелкий, хирургический.
2. **P2 · Честный фидбек Align** (боль №6): статус-строка `provider:status` уже есть — добавить причину «mock → подсветка отключена» при provider==='mock' (инфа уже в alignmentData.provider). Дешёво, снимает ловушку.
3. **P2 · Декларировать фундамент**: досье (этот файл) = первый документ зоны, где mm-патчи main.tsx названы фундаментом. Предложение: A-10-паттерн «[renamed]» — считать CRUD-маркеров «живущим в main.tsx:328-554», во всех будущих правках зоны сверяться туда.
4. **P3 · peaks.ts → utils/audio** (боль №8): 5 внешних импортёров takes; перенос снимает межзонную связку. Только по GO, с probe:bundle.
5. **P3 · Deadcode-батч зоны** (7 TS-хвостов: дубль-импорт, неиспользуемые) — кандидат в ближайший deadcode-батч 301.
6. **P4 · Save без скачивания** (боль №3): разделить «сохранить в IDB» и «скачать JSON» (second click / menu). Вопрос UX-решения владельца.

---

## 8. ВЕРДИКТ СМЕНЫ

Зона B08 **полностью жива и функциональна** как редактор синхронизации: двухслойная модель (маркеры M1/M2 + word-sync) структурно подтверждена, TC-010-эпоха вычистила N:M-матчинг, кэш-инвалидация честная (FNV-1a + F46-mock-фильтр + порог 0.55). Кнопки и канвас — зрелый интерактив (group-drag, loop-handles, pinch-zoom, undo/redo, publish-конвейер с защитами от гонок). Но: (а) фундамент CRUD — невидимые window-патчи main.tsx; (б) AI-синк — полный фронт к честно-мёртвому mock-бэку; (в) один живой контрактный разрыв (Add/TS2554). Ни одна боль не блокирует работу пользователя сегодня.

**Что НЕ ПРОВЕРЕНО:** живой UX-прогон редактора руками (смоук не делался — только код-разбор; vitest зоны прогнан и зелёный 62/62); поведение на PHONE-размерах (зона PHONE-аудита); поведение LRC-пикера при 0 версий в живой сети.

— agent-sync · B08 «Башня Sync» · смена-1 · 06.09.2026
