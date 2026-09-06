# PHONE-AUDIT — Горизонтальный слой [PHONE] · Фаза-1: чистый аудит (read-only)

**Дата:** 2026-09-06 · **Агент:** agent-phone-audit (Big Pickle Zen) · **HEAD:** `16d608c` (origin/main) · **Канон:** tsc=184 · vitest 812/68
**Метод:** статический анализ (rg/read по 41 CSS-файлу + компоненты-потребители). **Ни один байт src/ не изменён.**
**Метод-честность:** браузерных смоков на 390px/768px НЕ проводилось — все вердикты «ломается/держит» ниже = прогноз по коду, НЕ проверено на живом устройстве. Оценки производительности на телефоне: НЕ ПРОВЕРЕНО.

---

## 0. ДРАЙВЕР: расхождение с брифом

Бриф (agent-phone-audit.md §1) говорит: «7 css-файлов уже несут @media (FeedScreen.css, InstrumentCard, BillyDock, MonitorMixPanel, WelcomePage, BlockScenesModal + ещё)».
**Факт по коду (rg `@media` по всем 41 css): только 6 файлов, и состав другой:**

| Файл из брифа | @media width/height | @media prefers-reduced-motion |
|---|---|---|
| src/feed/FeedScreen.css | ✅ 767px | ✅ |
| src/components/welcome/WelcomePage.css | ✅ 480px / 420h | — |
| src/components/BillyDock/BillyDock.module.css | — | ✅ (только reduced-motion) |
| src/components/BlockScenesModal.module.css | — | ✅ (только reduced-motion) |
| src/triggers/word-effects.css | — | ✅ (только reduced-motion) |
| **InstrumentCard** | ❌ **нет** | ❌ |
| **MonitorMixPanel** | ❌ **нет** | ❌ |

Плюс 7-й: `src/catalog/components/CatalogLayout.css` (1024px + 767px) — не назван в брифе.
Итого «настоящих» responsive-файлов = **4** (FeedScreen, WelcomePage, CatalogLayout + feed-track-snap в FeedLayout.css, см. §1). BillyDock/BlockScenesModal/word-effects несут ТОЛЬКО `prefers-reduced-motion` — это accessibility, не адаптация. **Аудит ниже = по фактам кода.**

---

## 1. КАРТА СУЩЕСТВУЮЩЕГО: файл → breakpoints → что адаптируют

### 1.1. Реальная адаптация (width/height breakpoints)

| Файл | Breakpoint | Что делает | Оценка |
|---|---|---|---|
| `src/feed/FeedScreen.css:216` | `max-width: 767px` | `.feed-grid { grid-template-columns: 1fr !important }` + скрывает `.col-hdr-toggle`, `.edge-tab` | 🟢 телефон: 3 колонки → 1, скролл ленты вертикальный. **Планшет 768-1024px НЕ покрыт** (см. §2.1) |
| `src/catalog/components/CatalogLayout.css:40` | `max-width: 1024px` | grid `22% 1fr 28%` → `0 1fr 32%` (л Col2 скрыта) | 🟢 планшет: 2 колонки |
| `src/catalog/components/CatalogLayout.css:44` | `max-width: 767px` | 1 колонка + `scroll-snap-type: x mandatory` + `min-width: 100vw` на колонках | 🟡 горизонтальный свайп-скролл между колонками. `min-width: 100vw` при наличии `padding`/`gap` даст лёгкий горизонтальный дребезг (content шире viewport) — НЕ ПРОВЕРЕНО на устройстве |
| `src/components/welcome/WelcomePage.css:80` | `max-width: 480px` | паддинги/размер кнопок Google/VK | 🟢 экранные кнопки уже `width:100%` — ок |
| `src/components/welcome/WelcomePage.css:85` | `max-height: 420px` | сжатие gap (landscape-телефон) | 🟢 редкий, но правильный ход |
| `src/catalog/feed/FeedLayout.css:182-198` | (без @media, intrinsic) | `.feed-track-snap`: `overflow-x:auto` + `scroll-snap` + `-webkit-overflow-scrolling: touch` | 🟢 горизонтальная карусель треков — единственный честный touch-scroll в проекте |
| `src/feed/useResizeColumns.ts` (JS) | `matchMedia('(max-width: 767px)')` | `isMobile` → drag-хэнддлы скрыты, клавиатурный resize off; ResizeObserver на grid; ширины колонок авто-дефолтятся под viewport (<1200 tablet / ≥1600 wide) | 🟢 живой, событийно-чистый (pointer-capture, pointercancel). РЕДКИЙ ПЛЮС проекта |

### 1.2. Только accessibility (НЕ адаптация, но близко к слою)

| Файл | Что | Оценка |
|---|---|---|
| BillyDock.module.css:920 | reduced-motion → all animations off | 🟢 |
| BlockScenesModal.module.css:398 | reduced-motion | 🟢 |
| word-effects.css:466 | reduced-motion (bounce off) | 🟢 |
| FeedScreen.css:148 | reduced-motion (drag-handle) | 🟢 |
| useBillyAudioReactive.ts:178 (JS) | `matchMedia('(prefers-reduced-motion: reduce)')` — живой | 🟢 |

### 1.3. Глобальный контекст

- `index.html:11` — viewport meta ✅ `width=device-width, initial-scale=1` (единственный вход, `src/js/index.html` не существует).
- `touch-action: none` — 3 места: `FeedScreen.css:58` (drag-handle, но на мобиле хэндл скрыт = мёртв), `MonitorMixPanel.module.css:678`, `InstrumentCard.module.css:16` (+ `manipulation` :119). Точечно, осмысленно.
- `env(safe-area-inset-*)` — **единственное место во всём проекте: WelcomePage.css**. Все 22 fixed-оверлея (ControlDeck, RehearsalLyrics, BillyDock, LiveSubtitle, KaraokeLyricsBoard, TrackInfoBoard, WagonTrain, ShowEditor, PresenterDock, CameraPreview, UserRoom, FeatureOverlay, InstrumentOverlay…) игнорируют чёлки/жест-бар iPhone. На телефоне с notch: контент ControlDeck (нижний бар) будет перекрыт home-indicator.
- `100vh` без `dvh` — 5 мест (`CameraPreview:6`, `FeedScreen:21`, `BlockScenesModal:24`, `PresenterDock:346/676`). На iOS Safari URL-bar: при скролле высота прыгает. `svh/dvh` не используются нигде.

---

## 2. КАРТА ЛОМАЮЩЕГОСЯ (ключевые экраны без адаптации)

Вердикты — прогноз по коду (см. шапку про НЕ ПРОВЕРЕНО). Критичность: 🟡 планшет 768-1024 · 🔴 телефон 390px.

### 2.1. FeedScreen (главный экран) — 🟡 планшет 🔴 частично телефон

- 767px: спасён (`1fr !important`). НО: `--col0-w`/`--col2-w` инлайн-стили из useResizeColumns продолжают писаться в grid-container и НЕ обнуляются на мобиле — ими блокируется только `grid-template-columns`, не паддинги колонок.
- **Планшет 768-1024px: провал.** useResizeColumns даёт TABLET-дефолт col0=220 + col2=300 + MIN_COL1=**400px** → сумма ≥920px. На 768px экране: col1 фактическая ширина ≈ 768−220−300−12 = **236px** (клэмп-логика useResizeColumns:88 выравнивает col0/col2 вниз, но MIN_COL1=400 не обеспечивает grid'у) — лента сжата до трети. Data-пресеты (`studio-left/right/focus`) — ручное спасение, но не дефолт.
- Drag-хэнддлы: pointer-events (drag) — ок и на тач, но скрыты на <767px (`col0Visible && !isMobile`) — правильно.

### 2.2. ControlDeck (нижний бар) — 🔴 телефон 🟡 планшет

- `ControlDeck.module.css` — **ноль @media**. `.panel { height: var(--bl-deck-panel, 240px) }` фикс: на 390px-экране панель + хэндл 28px + header 64px + WagonTrain ≈ 30px + BillyDock → съедают ~55% высоты.
- Внутри панели контент-строки (MixerPanel и др.) горизонтальный `overflow-x: auto` — скролл есть, но target'ы кнопок малы (см. §3.2).
- Свернуть панель можно (хэндл), но ширина контента не пересчитывается под 390px: 52px channel-strip × N стемов + Fader Order + tabs — плотная клумба, `overflow-x` спасает функционально, не юзабилити.
- `--bl-deck-height` (ResizeObserver, ControlDeck.tsx:82) корректно пушится в CSS-вар → RehearsalLyrics/InstrumentOverlay/CatalogPanel подстраиваются — механизм живой, что даёт дешёвый рычаг фазы-2.

### 2.3. RehearsalLyrics (плашка лирики) — 🟡 телефон

- 689 строк css, ноль @media. `.activeBlock { width: 80%; padding: 24px 40px; max-width: 900px }` — на 390px: ширина ок (80%≈312px), паддинг 40px по бокам прожорлив. Слот-грид (Slot Matrix) с `--bl-slot-gap: 16px` на 390px сожмётся, но `overflow: auto` не даст переполнению убить layout.
- `bottom: var(--bl-deck-height, 76px)` — отступ от ControlDeck живой (ResizeObserver) ✅.
- Границы блоков (boundary-drag, RehearsalLyrics.tsx:909/958) — `onPointerDown` + pointer-capture ✅ работает на тач. ПЛЮС.

### 2.4. WagonTrain (TrackMap) — 🟡 телефон

- Горизонтальный `overflow-x: auto` со скрытым скроллбаром = свайп-скролл работает ✅.
- `.wagon { flex: 1 1 0; min-width: 54px }` — вагоны сжимаются до 54px на любом экране: на 390px ≈ 5-6 вагонов в ряд, названия трек-блоков уходят в `overflow: hidden`. Юзабилити-цена, не краш.

### 2.5. MixerPanel — 🔴 телефон 🟡 планшет

- Ноль @media. Канальные полосы 52px в горизонтальном `overflow-x: auto` — на 390px видно ~6 стемов, остальное свайпом. Функционально жив.
- Фейдеры = `<input type="range">` с `writing-mode: vertical-lr` — **нативный контрол = нативный тач** ✅. Это лучшая новость микшера: тач-драг фейдера работает из коробки.
- VU-метр 10px — декоративно мелкий, но не блокер.

### 2.6. MonitorMixPanel — 🔴 телефон 🟡 планшет

- Ноль @media. `.consoleGrid { minmax(200px,1fr) minmax(180px,0.8fr) 1fr }` → сумма минимумов 380px+2×gap. На 768px: три колонки по ~240px — тесно, но живо. **На 390px: 200px+180px+~0px — Auto Mix-колонка схлопывается в 0.** Grid не ломается (minmax держит минимумы → общий горизонтальный оверфлоу секции с `overflow: hidden` → Auto Mix невидим/недоступен).
- Слайдеры — `<input type="range">` (ToggleSliderRow/DualAutoMixRow) = нативный тач ✅. `touch-action: none:678` на спец-контроле — осмысленно.

### 2.7. Каталог (CatalogContent/CatalogPanel) — 🟢 планшет 🟡 телефон

- CatalogLayout: 1024/767 breakpoints есть ✅. Внутри — тележка feed-track-snap (scroll-snap) ✅.
- `.bl-catalog-col { min-width: 100vw }` — см. §1.1 (дребезг с gap/padding).

### 2.8. ShowEditor / StepWorkspace / PresenterDock (B03 Show) — 🔴 телефон 🟡 планшет

- ShowEditor: fullscreen fixed-оверлей, ноль @media; pointList `width: 220px` фикс + правые панели `220px` → на 390px остаётся ~0px рабочей области.
- PresenterDock: 3 fixed-слоя, `max-width: calc(100vh - 260/320px)` — вертикально-завязанные, на landscape-телефоне сжуются в кашу.

### 2.9. SyncEditorPanel + WaveformCanvas (B08 Sync) — 🔴 телефон 🟡 планшет

- Панель: инлайн-стили, кнопки 28×28px, без @media.
- **WaveformCanvas: `onMouseDown/Move/Up/Leave` БЕЗ pointer-событий (WaveformCanvas.tsx:646-649)** → на тач-устройстве драг плейхеда/выделение НЕ РАБОТАЕТ (tap-click может сработать как mousedown-эмуляция, drag — нет). Классический mouse-only.
- CalibrationDrum — `onPointerDown` ✅.

### 2.10. Прочее (мелкие вердикты)

- **TrackInfoBoard** — overlay с `overflow-y: auto` ✅ скролл есть; контент `repeat(auto-fill, minmax(180px,1fr))` сам адаптируется 🟡.
- **BlockScenesModal** — `width: 98vw` 🟢; внутренние колонки flex-row → на 390px тесно, но scroll есть 🟡.
- **AiSettingsModal** — модалка 98vw-класса, `min-width` на контролях — 🟡.
- **LineFxSelectorModal** — `width: min(760px, 92vw)` 🟢 паттерн-эталон.
- **StylesDeck** — 5 колонок `minmax(130-180px)` = сумма минимумов ~810px → на 390px grid-оверфлоу, панели невидимы 🔴 (но это внутренность ControlDeck-панели, у неё свой overflow-x 🟡).
- **PianoKeyboard** — `white-space: nowrap` + overflow: клавиатура уезжает за экран, свайп работает 🟡.
- **UserRoom** — fixed, без @media: НЕ ПРОВЕРЕНО детально (файл в зоне, глубоко не ходил).
- **avatar.css** — только max-width на превью, не критично.
- **BottomBar.module.css** — 0 импортёров = мёртвый css (кандидат в dead-code, не в мой скоуп фазы-1).

---

## 3. TOUCH-СЛОЙ

### 3.1. `pointer: coarse` — **НЕ УЧТЁН НИГДЕ** (0 вхождений по всему src)

Никакого различения coarse/fine. Всё hover-стилизованное на тач либо мертво (визуал), либо выполняется тапом (функционал жив, но hover-подсказки/луп-инфо не видны).

### 3.2. Mouse-only драг-паттерны (click/drag без touch-альтернативы)

| Место | Проблема | Механизм |
|---|---|---|
| **`src/sync/components/WaveformCanvas.tsx:646`** | 🔴 mouse-only drag (playhead/selection) | `onMouseDown/Move/Up/Leave` без pointer-событий → тач-драг мёртв |
| **`src/components/ControlDeck.tsx:209/284/461`** | 🟡 mouse-only (3× фейдер-подобных драга) | `onMouseDown` + document `mousemove/mouseup` |
| **`src/components/Show/PresenterDock.tsx:339`** | 🟡 mouse-only drag (dock) | `onMouseDown` → `mousemove/mouseup` |
| MixerPanel фейдеры | ✅ нативный `<input range>` — тач ок | |
| MonitorMix слайдеры | ✅ нативный range | |
| useResizeColumns | ✅ pointer-events + `if (isMobile) return` | |
| RehearsalLyrics boundary-drag | ✅ pointer-capture | |
| InstrumentCard drag | ✅ `onPointerDown` (98) | |
| CalibrationDrum | ✅ pointer | |

Итог: паттерн Pointer Events в проекте ЕСТЬ и работает (5 живых мест) — WaveformCanvas/ControlDeck/PresenterDock просто старые mouse-экземпляры. Миграция mouse→pointer = механическая, но это B01/B03/B08-зоны (не мой слой: responsive-слой — @media/breakpoints/touch-СТИЛИ; pointer-события = бизнес-код зон → фаза-2 только спеками зонным агентам, НЕ прямыми правками).

### 3.3. useResizeColumns / matchMedia — где живые, где мертвы

- `useResizeColumns.ts` — ЖИВОЙ (FeedScreen.tsx:29): mobile-детект, pointer-drag, ResizeObserver, store-persist. Эталон.
- `useBillyAudioReactive.ts:178` — ЖИВОЙ (reduced-motion).
- `useBillyZoneCache.ts:25` — читает `--bl-deck-height` — ЖИВОЙ.
- matchMedia width в компонентах, кроме useResizeColumns — **0 вхождений**: больше никакого JS-адаптива нет (всё в css, где его почти нет).
- Мёртвых matchMedia не найдено.

### 3.4. Мелкие touch-детали

- `user-select: none` точечно — BillyDock/FeedScreen/InstrumentCard — ок.
- Кнопочные target'ы: 28px-кнопки (SyncEditorPanel инлайн) и 20-22px (WagonTrain/MixerPanel M/S) — ниже 44px-нормы Apple HIG / 48px Material; на тач — мимо-тапы. `touch-action: manipulation` на InstrumentCard:119 — правильно, но точечно.
- BillyDock 64×91px — tap-target ок, перекрытие зоны клика лирики: z-index 999996 vs RehearsalLyrics 5 — ок.

---

## 4. ГОРИЗОНТАЛЬНЫЕ УГРОЗЫ · 3-колоночный GPT-контракт (PERSONAL|MAIN|AI-COACH) на 390px

Контракт живёт в `team-m/SHARED-REGISTRY.md` (UI-CHANGE-SPEC, Никита+GPT «006 Diagnostic Lock», CEO_1 12:00: трёхколоночная архитектура, баланс VOICE↔INSTRUMENTAL — главный контроль). В src/ слово AI-COACH есть только в `TrackInfoBoard/ai-expert-prompts.ts` (роли-эксперты), layout-скелета 3-колонок под контракт в коде НЕТ (ближайший — feed-grid: Профиль|Лента|Комментарии).

**Приговор: ДА, нужен отдельный мобильный layout.** Обоснование цифрами:

1. **Арифметика колонок несовместима с 390px:** даже минимальные сущности контракта (панель профиля с аватаром ~180-280px + фид ~400px MIN_COL1 + AI-coach ~240-300px) дают ≥820px — на 2× шире телефона. CSS-grid с minmax-минимумами НЕ может изящно схлопнуться — либо оверфлоу, либо 0-ширины.
2. **Прецедент уже есть и работает:** CatalogLayout на 767px уходит в 1fr + horizontal scroll-snap по 100vw-колонкам; FeedScreen на 767px уходит в `1fr !important`. Оба паттерна — с pivot-контроллом (в FeedScreen — edge-tabs скрыты на мобиле, в CatalogLayout — свайп). Третья колонка AI-COACH на телефоне должна стать: edge-tab/свайпом (как каталог) или bottom-sheet над ControlDeck — НЕ третьей колонкой.
3. **Stack противник:** ControlDeck (240px панель) + WagonTrain + header 64px уже съедают телефон по вертикали; добавка третьей колонки по горизонтали сделала бы рабочую область ~150×200px — непригодно.
4. Cost: мобильный layout = отдельный `@media (max-width: 767px)`-бренч контракта (или CSS container queries для стем-панелей), а не «сжать 3 колонки» — сжатие невозможно без поломки minmax-минимумов (см. MonitorMixPanel §2.6 — уже сейчас третья колонка схлопывается в 0).

**Оценка усилия (НЕ СПЕКА, ориентир):** CSS-слой отдельного мобильного лейаута ~3-5 файлов @media-блоков; JS-детект уже есть (useResizeColumns.isMobile — реюз). Прогноз производительности AV-стека ( Signalsmith/аватар/лирика) на телефоне: НЕ ПРОВЕРЕНО, отдельное расследование (возможно Web Audio + визуал вообще потребует feature-гейта на мобиле).

---

## 5. ТОП-5 ЗОН БОЛИ (по 390px/768px)

| # | Зона | Боль | Вердикт-прогноз |
|---|---|---|---|
| 1 | **ControlDeck** (нижний бар) | фикс 240px панель + контент без @media съедает телефон; кнопки <44px | 🔴 телефон / 🟡 планшет |
| 2 | **MonitorMixPanel** | 3-col minmax(200/180px) — третья колонка в 0 на 390px; ноль @media | 🔴 телефон |
| 3 | **WaveformCanvas (Sync)** | mouse-only драг — тач-драг мёртв; sync-редактор = ключевой workflow | 🔴 телефон (workflow недоступен) |
| 4 | **ShowEditor+PresenterDock** | fixed 220px-панели, ноль @media, fullscreen-оверлей | 🔴 телефон / 🟡 планшет |
| 5 | **FeedScreen планшет 768-1024** | MIN_COL1=400px несогласован с шириной планшета — лента в 236px | 🟡 планшет (телефон закрыт 767-блоком) |

**P.S. общесистемное:** 0 × `pointer: coarse` во всём проекте · safe-area только в WelcomePage (21 fixed-оверлей без env()) · 100vh без dvh (5 мест) — iOS URL-bar прыжки.

---

## 6. Честный итог фазы-1

- **Телефон 390px:** главный экран (Feed/лента/каталог) — держится (767-блоки живые), рабочие панели (микшер/монитор/show/sync) — НЕ адаптированы: частично спасены overflow-x, но рабочие процессы (sync-драг, monitor-автомикс, show-точки) на тач почти нереализуемы.
- **Планшет 768-1024px:** главный экран — ТРУП (нет ни одного breakpoint в этом диапазоне, кроме каталога), рабочие — тесно, но живы.
- **Паттерны для фазы-2 уже в репо:** useResizeColumns (pointer+isMobile) · CatalogLayout scroll-snap · LineFxSelectorModal `min(760px, 92vw)` · native range-фейдеры · `--bl-deck-height` ResizeObserver-мост. Фаза-2 может собираться из готовых костей, а не изобретаться.
- **Frozen-зоны не задеты** (аудит read-only, css-слой; упоминаний frozen-файлов в контексте аудита нет).

## 7. Куда фаза-2 (после GO Никиты на вердикт) — заготовки, НЕ спеки

1. ControlDeck/RehearsalLyrics/WagonTrain: телефон-блок `@media (max-width: 767px)` — компакт-панель (высота var(--bl-deck-panel) вниз), safe-area `env()` на fixed-слоях.
2. MonitorMixPanel/StylesDeck: 768px-блок с 2-колоночным/1-колоночным гридом (по образцу CatalogLayout:40/44).
3. FeedScreen: планшет-блок 768-1024 (согласовать MIN_COL1 с useResizeColumns-константой — это уже JS, через B01/центр).
4. WaveformCanvas/ControlDeck/PresenterDock mouse→pointer — спеки В ЗОННЫЕ агенты (B08/B01/B03), НЕ мои правки (бизнес-код).
5. Global: `pointer: coarse` + `hover: none` media-слой для hover-зависимых tooltip'ов; dvh-замена 100vh.
