# IMMERSION-REPORT · MO-lyrics «Лирика-Хранитель» · 2026-09-12

**Задача №1 ПОГРУЖЕНИЕ** (хендоф HANDOFF-MO-lyrics.md, канон-очередь Никиты 11:4x).
**HEAD-контекст:** рабочее дерево = `origin/main bf1a278` (трек-1) · сравнение с `feature/yt-prep 002eade` (трек-2 [SB]).
**Метод:** живые чтения file:line по обоим трекам + git-история + vitest-прогоны семьи.

---

## §A. ЯДРО-КАРТА СЕМЬИ (пункт 1(а))

**Семья lyrics = 4 ядра MAP-167 (все L3/unclassified в MECHANISM-MAP-draft.yaml, owner-agent: null до сегодня) + 1 пограничный файл blocks-семьи:**

| Ядро MAP | Файл | LOC | Класс (УЗ-4) | Роль |
|---|---|---|---|---|
| `lyrics.store` | `src/stores/lyrics.store.ts` | **117** | класс 1 (стор) | Zustand-стор строк + BAC-001 FOUC-буфер + D-CASE 7 гейт structurePending |
| `lyrics.service` | `src/services/lyrics.service.ts` | **338** | класс 2 (сервис) | legacy-класс window.lyricsDisplay: загрузка/парсинг/рендер текста, RTF/LRC-детект |
| `auto-lyrics.service` | `src/services/auto-lyrics.service.ts` | **2152** | класс 2 (сервис) | W11: lrclib.net авто-подтягивание + Genius↔LRC матчинг (blockFirstLineSync) + TC-096 версия-пикер |
| `lyrics-events` | `src/foundation/event-bus/wrappers/lyrics-events.ts` | **190** | класс 2 (обёртка) | EventBus-wrapper лирики: rAF детектор/писатель активной строки (экс-lyrics.bridge) |
| *(граница blocks)* `tagged-lyrics.parser` | `src/blocks/parser/tagged-lyrics.parser.ts` | **365** | **файл blocks-семьи** | parseTaggedLyrics: Genius-теги → DetectedBlock; жилая граница — см. §B.3 |

**Ядра MAP — 4 шт** (`lyrics.store` :1844 · `lyrics.service` :1421 · `auto-lyrics.service` :1329 · `lyrics-events` :1117 в draft.yaml). `tagged-lyrics.parser` в MAP-167 **НЕ значится** (grep пуст) — он в семье blocks (парсер), но каждый его потребитель, кроме blockEditor.store, — мой (auto-lyrics:6-7, UploadPanel:481).

**LOC-бюджет ядра:** 117+338+2152+190 = **2 797** (+365 граница = 3 162). Тесты семьи: 2 741 LOC / 118 кейсов зелёные (см. §F).

**Оба трека:** `git diff origin/main feature/yt-prep` по 4 ядрам = **пусто** (байт-идентичны), КРОМЕ tracked-расхождения в потребителях — см. §C.4 (гейт-сага).

**API auto-lyrics.service (крупнейшее ядро, 2152 LOC, публичный контур):** prefetch :122 · prefetchWithDuration :132 · refetchWithDuration :141 · getCached :153 · waitForCache :157 · parseLrcString :190 (**@deprecated**, см. §E-2) · lrcToMarkers :206 · blockFirstLineSync :246 (маркетинговое ядро §7 Calibration + SyncTuning DEFAULT_TUNING :27-34) · matchGeniusToLrc :1134 · extractCleanLyrics :1612 · detectedBlocksToPersistedBlocks :1637 · markAutoSyncApplied :1695 · shouldSkipEditorsForTrack :1699 · fetchLrcVersions :1806 · parseLrcVersion :1877 · computeCoverage :1907 · tryBetterLrcVersion :1923 · `_normalizeText` :2074 / `_CYR_TO_LAT` :2095 (транслит-мост RU↔EN для матчинга). Сервис **сам слушает** `document 'track-loaded'` (:82-87) → refetchWithDuration.

---

## §B. ГРАНИЦА С MO-sync-word (пункт 1(б)) — СТЫК-ТАБЛИЦА И ДОГОВОР

### B.1 Ось разделения (договор)

**Моя ось = СТРОКА (line-level):** сырой текст → строки → блоки → активная строка → плашка/центр Репетиции.
**Его ось = СЛОВО (word-level):** пословное выравнивание (AlignmentResult/WordTiming) внутри строки.
Гейт `structurePending` и буфер BAC-001 живут на строке = мои. `wordSync.store`, confidence 0.55/0.8, FNV-1a hash, gateway /v1/align = его.

### B.2 Спорный файл: wordSync.store.ts (122 LOC, `src/stores/wordSync.store.ts`)

**Предложение договора:** `wordSync.store` = **ядро MO-sync-word** (хранит AlignmentResult — его типы :2-8 из `src/sync/word-sync/types`), НО он читает мою ось только через `rawLineIndex` (число, без импорта lyrics.store — импорт-зависимость НУЛЕВАЯ, проверено grep: wordSync.store не импортирует lyrics.store и наоборот). **MO-lyrics прав.wordSync.store: 0 строк.** В MAP-167 он значится отдельным ядром `wordSync.store` :2144 — пусть остаётся за MO-sync-word. Финальное слово — за планом Никиты / сверкой карт двух МО (двойная карта, конституция 08.09).

### B.3 Стык-таблица (кто кого, file:line, владелец)

| Стык | Кто → Кого | file:line | Владелец |
|---|---|---|---|
| Гидрация word-sync | track.loader → ai-lyrics-sync.service (prepareWordSyncLayer) | track.loader.ts:5-7, :79 (clear), :440 (prepare) | **MO-sync-word** (сервис его зоны), провод — MO-lyrics |
| displayLyrics-источник | track.loader передаёт `lyrics` (моя ось) в prepareWordSyncLayer | track.loader.ts:440-446 | **MO-lyrics** (данные мои) |
| fill-vs-cue | wordSync.store.getActiveWordForLine (cue, +0.18с lookahead) :87-105 vs getFillWordForLine (точный) :108-121 | wordSync.store.ts:11-12, :87-121 | **MO-sync-word** (конверт-358), семантика потребления — моя в WordHighlightLine |
| word-selectors | чистые селекторы над его стором | src/sync/selectors/word-selectors.ts:9-30 (4 функции) | **MO-sync-word** (B08 разобрал) |
| WordHighlightLine | RehearsalLyrics потребляет его статусы | src/triggers/WordHighlightLine.tsx:2,25,33 | компонент зонный B01, данные его |
| tagged-lyrics.parser | auto-lyrics:6-7 + UploadPanel:481 → parseTaggedLyrics | parser:185 | **файл blocks-семьи**; мои вызовы — только чтение. См. §B.4 |
| line-map.builder | классификатор строк (мои строки → выравниваемые) | src/sync/word-sync/line-map.builder.ts:37 | **MO-sync-word**; вход = мой сырой текст |
| markers-events | ресинк маркеров после `awaitStemReady('vocals')` | markers-events.ts:14,29 (читает lines.length) | wrapper event-bus, данные мои |

### B.4 tagged-lyrics.parser — граница с blocks-семьёй (пункт 1(б) хендофа)

`parseTaggedLyrics` (parser.ts:185, 365 LOC): BRACKET_RE :29 `[Тэг]` + PREFIX_RE :39 `Тэг:` → DetectedBlock; Genius-noise фильтр :137-178; composite-теги `Bridge/Outro` second-wins :243-260; авто-нумерация verse/chorus/solo-per-subType :272-316. **Потребители:** blockEditor.store:4 (его владелец), auto-lyrics.service:6-7 (мой), UploadPanel:481 (upload-семья). TC-010-верификация B08 (05.09): 7/7 блоков, 61/61 строка, confidence 100%. **Вердикт: файл = blocks-семья (MO-блоков нет → зонный B01-HUB/blockEditor по MAP); моя граница — импорт-строки :6-7, менять сигнатуру DetectedBlock без визита ко мне НЕЛЬЗЯ.** В MAP-167 файл не значится ядром — кандидат волны-2 (см. §E-4).

---

## §C. ГЕЙТ structurePending / «белый центр» (пункт 1(в)) — верификация на обоих треках

### C.1 Живой механизм (main, файл 117 строк)

| Элемент | file:line | Факт |
|---|---|---|
| **Арм** | lyrics.store.ts:47-59 | `document 'before-track-change'` (:115) → toTrackId-гвард (:49, bare Event = delete/clearAll, арма нет) → свежий `window.trackCatalog` (:51, без кэша) → hasStructure = `blocksData.length>0` ИЛИ `syncMarkers.some(blockType!=='unknown')` (:53-54) → `setState({structurePending})` атомарный ре-арм (:55) |
| **Watchdog** | lyrics.store.ts:57-58 | **4000мс** (НЕ 1200! — см. C.2), `_structWatchdog` отдельная переменная (:44), релиз = raw-деградация |
| **Релиз-каналы (3)** | :46 releaseStruct | ① blocks-subscribe `useBlocksStore.subscribe(blocks>0)` :116; ② flush-сиблинг в BAC-001-subscribe :108-111 (lyricsReady false→true + blocks>0 тем же тиком); ③ watchdog :57 |
| **Держатель** | RehearsalLyrics.tsx:33 (читает) → **:768 `if (structurePending) return null`** | центр не рендерится до релиза |
| **Слой BAC-001** | :62-112 | `_rawLyricsBuffer` + lyricsReady-гейт + свой 5с watchdog :79 — независимый нижний этаж (сирота-сын VMO-035) |

### C.2 Дрейф канона: watchdog = 4000мс, а не 1200

**Хендоф и реестр 201 (02.09 22:40/03.09) говорят «1200 мс» — это устарело.** Коммит `937e9e7` (после 006-замеров M2-latency: арм-время vs прибытие blocks 1400-1500мс): «watchdog 1200→4000 (raw = только патология-fallback >4s)». Тест-канон: `lyrics-structure-gate.test.ts:56` «К3: watchdog 4000мс → false», случай (а) :65-73 подтверждает изоляцию от BAC-001-сторожа. **Прогноз 201-БЭ «белый ровно 1200мс» на текущем main невыполним — окно белого теперь до 4000мс, и сырость после watchdog'а = только патология >4с.**

### C.3 Иерархия гейтов (живой маршрут клика → рендера)

```
клик трека (track.loader:71 Step 3 before-track-change)
  → arm structurePending (если hasStructure)          [мой гейт, слой-2]
  → Step 4 clear: ld.clearAllTextBlocks/fullReset :76-79 + clearWordSyncLayer :79
  → Step 8 развилка :110/:114: blocksData>0 → ld.loadImportedBlocks :114  |  else → ld.reloadLyrics :116
  → ld._renderLyrics → document 'lyrics-rendered' (lyrics.service:127) → Facade dual-publish → eventBus Sync 'lyrics-rendered'
  → blocks-events.ts:52 syncBlocksFromLegacy → useBlocksStore.setBlocks (blocks.store:31)
  → [релиз-канал ①/②] → RehearsalLyrics:768 пропускает рендер
  → Audio 'track-loaded' (V3DataInterceptor) → lyrics-events.ts:143/165 syncLyricsFromLegacy (50/250мс retry) → lines наполняются
  → BAC-001 flush → lyricsReady=true → рендер (RehearsalLyrics:767)
```
V2-fallback: если track-loaded не пришёл — BAC-001 watchdog 5000мс :69-79 поднимет lyricsReady сам (но не снимет structurePending — их снимает только 4000мс-сторож).

### C.4 Расхождение треков (пункт «track-divergence» хендофа) — ГЛАВНАЯ НАХОДКА

`git diff origin/main feature/yt-prep -- src/stores/lyrics.store.ts src/components/RehearsalLyrics.tsx`:
- **[SB] yt-prep ГЕЙТА НЕ ИМЕЕТ**: −33 строк lyrics.store (весь D-CASE 7 блок :41-116 частично), −4 строки RehearsalLyrics (:33 хук + :768 гейт). Только BAC-001-этаж жив.
- merge-base треков `32137a8` (02.09, D-CASE 7 «RESHENO-S-USLOVIYAMI» = коммит одних доков) — **фикс `32e7473` в yt-prep НЕ влит** (`git merge-base --is-ancestor` = НЕТ; в merge-base файл lyrics.store.ts гейта не содержит — 0 упоминаний structurePending).
- Мелочь: auto-lyrics.service :189 — комментарий @deprecated разошёлся (main: «снос-30 06.09: lrc-parser.service.ts снесён», SB: старый «Import from lrc-parser.service instead» — SB-копия устарела, lrc-parser.service.ts снесён на main).
- **Следствие для песочницы:** в [SB] любой FOUC-тест «белого центра» снимет ЛОЖЬ от главного канона (гейт отсутствует) — BAC-001 там один. Рецепт мерж-гигиены в §E-1. Это расхождение-класс «H-1: труп-издатель track-loaded AudioEngineV2:2147 на SB» из отчёта MO-transport (2:49) — один корень: **yt-prep отстаёт от main на волны D-CASE 7 + снос-30**.

### C.5 Верификация гейта (живьём)

- vitest `lyrics-structure-gate.test.ts` — **8/8 PASS** (К1 арм/релиз · К2 без-структуры · К3 4000мс raw-деградация · (а) изоляция флагов · (б) watchdog→raw не null-навсегда · +3). Диспатч document-only (setup.ts:125 глушит window —условие 009).
- Семейный набор: 118/118 (см. §F).

---

## §D. КАРТА СОБЫТИЙ ЛИРИКИ (пункт 1(г)) — как реально ходят события

**Ответ на вопрос хендофа «lyrics-events wrapper жив?» — ДА, ЖИВ:**
- main.tsx:23 импорт + main.tsx:68 `registerInit({ id: 'lyrics-events', init: initLyricsEvents })` → registry `runAll()` :78. Смок: wrappers.smoke.test.ts:8 «track-loaded triggers active-line-changed» PASS.
- Третья система событий (MO-practice: document жив / eventBus мёртв) — у лирики **гибрид из 3-х рельс**, все живые:

| Рельса | Издатель → Потребитель | file:line | Статус |
|---|---|---|---|
| **document-CustomEvent** | lyrics.service:127 `_renderLyrics` → `'lyrics-rendered'`; :144 `'active-line-changed'` | lyrics.service.ts:127,144 | 🟢 жив (издатели) |
| **EventBus Sync** | тот же _renderLyrics → `SyncBus.lyricsRendered()` (dynamic import :134-136) → подписчики: lyrics-events:138 (sync lines), blocks-events:52 (sync blocks) | lyrics.service.ts:134 · channels/sync.ts:7 | 🟢 жив |
| **Facade dual-publish** | document-dispatch перехватывается monkey-patched `dispatchEvent` → LEGACY_EVENT_MAP `'lyrics-rendered'` → eventBus.Sync | facade.ts:41,139-146 | 🟢 жив — **транспорт document→eventBus для legacy-издателей** |
| **rAF-scheduler** | playback scheduler (детектор по маркерам) → writer → `useLyricsStore.setState({activeLineIndex})` + reverse-dispatch document :105-110 | lyrics-events.ts:33-113 | 🟢 жив (активная строка во время плея) |

**Исправление карты 201 (реестр 02.09 22:40, «lyrics-rendered — 1 живой издатель, lyrics.service:135»):** издатель по-прежнему один (lyrics.service:127/:135 — двойной выстрел document+SyncBus), но **потребителей двое через eventBus** (lyrics-events:138 + blocks-events:52) + document-рельса для legacy window-кода. `SyncBus.blocks-applied` — по-прежнему 0 eventBus-издателей (только document-мост UploadPanel.tsx:709 через Facade), вывод B08/201 подтверждён.

**События арма гейта — вне шины вообще:** `before-track-change` (track.loader:71-72 document-dispatch; подписка lyrics.store:115 document) — document-рельса, Facade дублирует в eventBus.Track 'before-change' (facade.ts:28), где его слушает lyrics-events:155 (сброс lines/activeLineIndex) и blocks-events:25 (clearBlocks). Каталог Catalog:* — 0 eventBus-издателей (201 прав, уточнение MO-upload: живы через document→Facade путь).

**WagonTrain** (потребитель): WagonTrain.tsx:4,19-20 — читает только `activeLineIndex`+`lines` (никаких событий не слушает). Полный список потребителей useLyricsStore (17 файлов, живые): RehearsalLyrics:3,30-33 · WagonTrain:4 · LiveSubtitle:1 · KaraokeLyricsBoard:6 · BlockScenesModal · SyncEditorPanel:14 · SyncLyrics · slot-matrix/use-slot-matrix:8,39-40 · loop.store:4 (7 упоминаний getState) · BillyDock:2 · useBillyLocomotion:2 · StructureDiagram/AiExpertPanel (TrackInfoBoard) · word-line.detector:2-3,22 · markers-events:14,29 · position-sync:13,74 · lyrics-events:7.

---

## §E. ВЫВОДЫ, ХВОСТЫ И КАНДИДАТЫ В ЦЕПЬ (не решения — пруфы для плана Никиты)

1. **Мерж-хвост [SB] (🔴-класс для 301):** feature/yt-prep отстал от main на D-CASE 7 (гейт) — песочница тестирует «белый центр» без главного фикса; плюс stale-комментарий auto-lyrics:189. Рецепт: влитие main → yt-prep (только эти 3 файла) перед следующим визуальным прогоном [SB]. Владелец решения — Никита.
2. **parseLrcString @deprecated (auto-lyrics:189-206)** — сам код жив (upload.service:13 зовёт parseLrcString+lrcToMarkers), deprecated-шапка ссылается на снос-30 — консистентно, но двойное чтение (main-версия комментария уже правильная). Гигиена: без действий.
3. **Хвост 201-БЭ закрыт кодом:** «белый центр» на main = до 4000мс только при патологии; норма закрывается blocks-subscribe. МС-хронология OrchTiming (track.loader:41-45, 19 меток) позволяет Никите померить живое время по-прежнему.
4. **tagged-lyrics.parser вне MAP-167** — кандидат волны-2 расширения карты (класс-5/блоки), слово за 004/конституцией шаг-4.
5. **wordSync.store-договор (§B.2)** — жду карты MO-sync-word для двойной сверки; конфликтов импортов нет (оси не пересекаются, связаны числом rawLineIndex).
6. **Сан-хвост 48ч (задача №3):** в реестре/доске строки о lyrics: ① «structurePending не существует (реальный гейт = lyricsReady)» (007-YT 08.09 15:4x, круг Z2) — **на main НЕВЕРНО на сегодня** (гейт существует с 32e7473 02.09 и усилен 937e9e7): протухла 10 дней, но держалась потому, что [SB]-реальность её подтверждала — теперь она «верна-для-SB / ложна-для-main», двоится треками; ② «watchdog 1200мс» (201, 02-03.09) — протухло 10.09 (937e9e7 не отражён в реестре нигде, кроме коммит-лога) — предложить 003_2 в сан-список; ③ «lyrics-rendered 1 издатель» — подтвердилось (уточнение потребителей §D).
7. **Тест-дыра:** lyrics.service (338 строк) и lyrics-events (190) не имеют собственных vitest-файлов (кроме wrappers.smoke 1 кейс); gate-тесты покрывают только стор. Кандидат в конверт тест-дыр (класс 358) — по плану Никиты.

## §F. МЕТРИКИ ПРОГОНА

| Гейт | Цифра | Комментарий |
|---|---|---|
| **vitest семьи** | **118/118 PASS** (13:15-13:19) | structure-gate 8 · upload.lyrics 2 · tagged-lyrics.parser 33 · auto-lyrics.grid-search 22 · auto-lyrics.match 51 · wrappers.smoke (lyrics-events) 2 |
| **Оба трека** | 4 ядра байт-IDENT · гейт D-CASE 7 = main-only | git diff = пусто по ядрам; расхождение = только сага §C.4 |
| **tsc** | канон не трогал (чтение только) | src/ не правлю (принцип хендофа) |
| **Reach (семья)** | 0 мёртвых ядер | все 4 ядра имеют живых импортёров (§A, §D) |
| **Frozen** | 0 касаний | lyrics.bridge (экс-frozen) = retired → lyrics-events (App.tsx:4,93 комментарии) |

---

## §G. ЧТО НЕ ПРОВЕРЕНО (честно)

- Живой UX-прогон «белого центра» руками (клик-тайминг на реальном каталоге) — только код-разбор + тесты; OrchTiming-метки ждут хозяина в dev-режиме.
- Поведение гейта на >1000-трек каталоге (IDB-медленность 201-гипотезы) — не измерялось.
- [SB]-песочница живьём не запускалась (вывод §C.4 по git, не по runtime).
- Поведение lyrics-rendered при V2-fallback (без track-loaded) — по коду (watchdog 5с), не по смоуку.

— MO-lyrics «Лирика-Хранитель» · смена-1 · 2026-09-12 13:2x · задача №1 сдана, СТОП: жду план Никиты.
