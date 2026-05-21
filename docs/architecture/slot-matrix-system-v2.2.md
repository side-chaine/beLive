# ⚠️ DOCUMENTATION MISMATCH — ACTION REQUIRED

> **CRITICAL:** This file currently contains "Styles System" documentation, NOT Slot Matrix architecture.
> This is a known error discovered during sync audit (2026-05-20).
>
> **Current file content:** Line Preset Rail Model, Active/Preview/Others lanes, bank philosophy
> **Should contain:** Slot Matrix layout computation system (computeSlotMatrix, SlotGroup, SubBlockRange, transition presets)
>
> **Status:** Awaiting rewrite. Do NOT use this file as reference for slot-matrix code.
> **Code reference:** `src/slot-matrix/` directory — `compute-slot-matrix.ts`, `slot-matrix.types.ts`, `use-slot-matrix.ts`
> **Actual Styles System doc:** `docs/architecture/styles-system.md`

---

# SLOT MATRIX SYSTEM — beLive
## Версия 2.2 | Дата: 2026-05-07
## Авторы: Центры 73-85 + Соннет

---

## БЫСТРЫЙ НАВИГАТОР

| Раздел | Содержание |
|--------|-----------|
| §1 | Назначение системы |
| §2 | Файловая структура |
| §3 | Типы и интерфейсы |
| §4 | Цвета блоков |
| §5 | Font Size таблица |
| §6 | Константы и параметры |
| §7 | Toggle система откатов |
| §8 | ПС Travel — архитектура |
| §9 | Transition Preset System 🆕 |
| §10 | DOM структура |
| §11 | Провода для будущих фич |
| §12 | Тест-прогон |
| §13 | Известные баги |

---

## §1. НАЗНАЧЕНИЕ СИСТЕМЫ

Slot Matrix — универсальная система умных слотов для работы со строками в beLive.
Каждый слот = одна строка с предсказуемой позицией, состоянием и проводами для квестов, эффектов и стилей.

```
СЛОЙ 1: TEXT LAYER
  ├─ Умный перенос слов — Phase 4
  ├─ Бэк-вокал в скобках → SlotPart (провода проложены)
  └─ Переводчик → Phase 4

СЛОЙ 2: SLOT LAYER
  ├─ CSS Grid рендер (minmax для роста при переносах)
  ├─ Подблоки — max 4 строки
  ├─ ПС (Preview Slot) — предпросмотр следующего блока/подблока
  ├─ Overlay travel animation с shadow measurement
  └─ Transition Preset System — стиль перехода 🆕

СЛОЙ 3: QUEST LAYER (Phase 4)
  ├─ Slot.questState: 7 состояний
  ├─ Квест "Исчезающие строки"
  ├─ Квест "Fill-in"
  └─ Пользовательские квесты + шеринг

СЛОЙ 4: SYNC LAYER
  ├─ Word-sync слоты — Phase 5
  ├─ Подсветка, эффекты, стили
  └─ Loop boundaries через data-attr
```

---

## §2. ФАЙЛОВАЯ СТРУКТУРА

```
src/slot-matrix/
├── slot-matrix.types.ts              ← 10 типов и интерфейсов
├── slot-matrix.utils.ts              ← Константы и утилиты
├── compute-slot-matrix.ts            ← Чистая функция: блок → SlotMatrix
├── compute-slot-groups.ts            ← Чистая функция: блок → SlotGroup[]
├── compute-slot-canvas.ts            ← Phase 3.5+ (orphaned)
├── use-slot-matrix.ts                ← React хук: основная матрица
├── use-slot-canvas.ts                ← Phase 3.5+ (orphaned)
├── measure-next-block.ts             ← Shadow measurement для ПС travel
├── transition-preset.types.ts        ← Типы TransitionPreset 🆕
└── validate-transition-preset.ts     ← Валидация ZIP import 🆕

src/data/
└── transition-presets.ts             ← 5 встроенных пресетов 🆕

src/utils/block-utils.ts              ← getBlockFontSize, createSubBlocks
src/structure/block-colors.ts         ← 9 цветов блоков (SSoT)

src/stores/
└── plate.store.ts                    ← transitionPreset field + persist 🆕

src/bridges/
└── plate.bridge.ts                   ← Auto-save plate.store → IDB 🆕

src/components/
├── RehearsalLyrics.tsx               ← Рендер + ПС overlay + state machine 🆕
├── RehearsalLyrics.module.css        ← Grid, ПС, анимации, preset rules 🆕
└── StylesDeck.tsx                    ← UI кнопки "Переход" 🆕

src/services/
└── track.orchestrator.ts             ← Step 11.5: IDB → plate.store 🆕
```

---

## §3. ТИПЫ И ИНТЕРФЕЙСЫ

### Slot — один слот = одна строка

```typescript
interface Slot {
  id: string;            // "verse-1-0-2"
  blockId: string;
  subBlockIndex: number;
  slotIndex: number;
  lineIndex: number;     // индекс в lyrics.lines[]
  text: string;
  parts: SlotPart[];     // lead + back вокал
  isEmpty: boolean;
  y: number;             // Y внутри контейнера (px)
  height: number;        // высота БЕЗ gap (px)
  isPreview: boolean;
  previewBlockType?: string;
  previewBlockColor?: string;
  isLoopStart?: boolean;
  isLoopEnd?: boolean;
  // Quest (Phase 4):
  questState?: QuestSlotState;
  questMeta?: QuestSlotMeta;
  wordBreakPoints?: WordBreakPoint[];
  nextSubBlockFirstLine?: number;
}
```

### SubBlockRange — подблок

```typescript
interface SubBlockRange {
  id: string;              // "verse-1-0"
  blockId: string;
  subBlockIndex: number;
  startSlotIndex: number;
  endSlotIndex: number;
  lineIndices: number[];   // КРИТИЧНО для shadow measurement
  isFirst: boolean;
  isLast: boolean;         // КРИТИЧНО для L1/L2 routing
}
```

### SlotGroup — визуальная группа

```typescript
interface SlotGroup {
  id: string;              // "group-verse-1-0"
  blockId: string;
  subBlockIndex: number;
  slots: Slot[];
  previewSlot: Slot | null;
  subBlock: SubBlockRange;
  fontSize: string;
  blockType: string;
  blockColor: string;
  gridTemplateRows: string;
  contentHeight: number;
  totalHeight: number;
  activeSlotIndex: number;
  isPreview: boolean;
  isActive: boolean;
  x: number; y: number; width: number; height: number;
  opacity: number;
}
```

### NextBlockMeasurement — shadow measurement

```typescript
interface NextBlockMeasurement {
  containerHeight: number; // С ПС → ИСПОЛЬЗОВАТЬ для travel
  contentHeight: number;   // БЕЗ ПС → ТОЛЬКО диагностика
  firstLineOffset: number;
  nextBlockId: string;     // staleness guard
}
```

### TransitionPreset 🆕

```typescript
interface TransitionPreset {
  id: string;              // "smooth" | "bounce" | "spotlight" | "snap" | "gentle"
  name: string;            // "Smooth" (отображаемое имя)

  appear: {
    duration: number;      // сек, например 0.5
    easing: EasingValue;   // "ease-out" или "cubic-bezier(...)"
    translateY: number;    // px, скольжение при появлении
    opacity: { from: number; to: number };
  };

  travel: {
    duration: number;
    easing: EasingValue;
  };

  enter: {                 // Phase 2 MVP
    mode: 'none' | 'fade';
    duration: number;
    easing: EasingValue;
    opacity: { from: number; to: number };
  };

  dissolve: {              // Phase 2 MVP
    mode: 'none' | 'fade';
    duration: number;
    easing: EasingValue;
    endOpacity: number;
  };

  spotlight?: {
    enabled: boolean;
    glowRadius: number;    // px
    glowOpacity: number;   // 0–1
    dimOthers: number;     // opacity для неактивных строк
  };
}

type EasingValue = string; // "ease-out" | "cubic-bezier(0.22, 1, 0.36, 1)" | ...
```

### QuestSlotState — 7 состояний (провода)

```typescript
type QuestSlotState =
  | 'visible' | 'hidden' | 'highlighted'
  | 'dimmed'  | 'blurred' | 'locked' | 'completed';
```

### SlotPart — lead/back вокал

```typescript
interface SlotPart {
  id: string;
  type: 'lead' | 'back';
  text: string;
  bracketed: boolean;
  colorOverride?: string;
}
```

---

## §4. ЦВЕТА БЛОКОВ — Single Source of Truth

**Файл:** `src/structure/block-colors.ts`

| Block Type | HEX | CSS Variable |
|------------|-----|-------------|
| `verse` | `#4CAF50` | `--bl-block-verse` |
| `prechorus` | `#FFEB3B` | `--bl-block-prechorus` |
| `chorus` | `#F44336` | `--bl-block-chorus` |
| `bridge` | `#9C27B0` | `--bl-block-bridge` |
| `interlude` | `#E91E63` | ⚠️ CSS variable не добавлена |
| `intro` | `#2196F3` | `--bl-block-intro` |
| `outro` | `#00BCD4` | `--bl-block-outro` |
| `unknown` | `#9E9E9E` | — |
| `blank` | `rgba(255,255,255,0.1)` | — |

**Правило:** ВСЕГДА `getCanonicalBlockColor()`. Никогда не хардкодить цвета вне `block-colors.ts`.

---

## §5. FONT SIZE ТАБЛИЦА

| Line Count | Font Size | Line Height (×1.25) |
|------------|-----------|---------------------|
| ≤ 2 | `3.2rem` | 64px |
| ≤ 4 | `2.6rem` | 52px |
| ≤ 6 | `2.0rem` | 40px |
| ≤ 8 | `1.6rem` | 32px |
| > 8 | `1.3rem` | 26px |

---

## §6. КОНСТАНТЫ И ПАРАМЕТРЫ

### JS Constants

| Константа | Значение | Файл | Описание |
|-----------|----------|------|----------|
| `MAX_SUB_BLOCK_LINES` | `4` | slot-matrix.utils.ts | Макс строк в подблоке |
| `DEFAULT_INTER_BLOCK_GAP` | `24` | slot-matrix.utils.ts | Gap между блоками |
| `DEFAULT_SLOT_GAP` | `8` | slot-matrix.utils.ts | ⚠️ Устарело — runtime использует 16 |
| `LINE_HEIGHT_MULTIPLIER` | `1.25` | slot-matrix.utils.ts | Соответствует CSS line-height |
| `GRID_GAP` | `16` | use-slot-matrix.ts | Фактический grid gap |

### Travel Hardcodes (RehearsalLyrics.tsx)

| Параметр | Значение | Описание |
|----------|----------|----------|
| `PADDING_TOP` | `24` | ← совпадает с CSS padding |
| `PADDING_BOTTOM` | `24` | ← совпадает с CSS padding |
| `travelDuration` | из пресета | ← раньше 0.8, теперь из TransitionPreset |
| Block trigger offset | `1.0s` | За сколько сек до маркера |
| SubBlock ratio | `0.6` | Доля интервала для SubBlock |
| `lineH` fallback | `52` | ⚠️ Точен только для 4-line блоков |
| Idle offset | `8px` | ПС под последней строкой |

---

## §7. TOGGLE СИСТЕМА ОТКАТОВ

```typescript
// RehearsalLyrics.tsx
const USE_SLOT_GRID = true;   // true=Grid, false=legacy flex
const USE_SLOT_CANVAS = true; // true=overlay travel, false=grid row

// Зависимость: USE_SLOT_CANVAS требует USE_SLOT_GRID = true
// Откат: 1) USE_SLOT_CANVAS=false → 2) USE_SLOT_GRID=false
```

| USE_SLOT_GRID | USE_SLOT_CANVAS | Режим |
|---------------|-----------------|-------|
| `true` | `true` | ✅ Текущий продакшн |
| `true` | `false` | Grid + ПС строка + Block Cue |
| `false` | `false` | Legacy flex — аварийный откат |

---

## §8. ПС TRAVEL — АРХИТЕКТУРА

### Unified L2 — shadow measurement

```
isLastSub = activeSlotGroup?.subBlock?.isLast

SubBlock→SubBlock (!isLastSub):
  Измеряем следующий подблок ТЕКУЩЕГО блока
  Trigger: nextSubBlockFirstMarkerTime - min(travelDuration, interval×0.6)

Block→Block (isLastSub):
  Измеряем первый подблок СЛЕДУЮЩЕГО блока
  Trigger: nextBlockFirstMarkerTime - 1.0s
```

### Travel Target Formula (delta=0 доказано)

```
available       = blockRect.height - PADDING_TOP - PADDING_BOTTOM
centeringOffset = (available - measurement.containerHeight) / 2
targetTop       = blockRect.top + PADDING_TOP + centeringOffset + firstLineOffset
clampedTarget   = clamp(targetTop, minTop, maxTop)
```

### Shadow Measurement

```
- Off-screen div с точной копией .slotContainer CSS
- font-family: inherit — критично для переносов строк
- Контент + ПС строка — ОДИН reflow, try/finally cleanup
- containerHeight (С ПС) → travel target
- contentHeight (БЕЗ ПС) → ТОЛЬКО диагностика
```

### 8 Защитных механизмов

1. `USE_SLOT_CANVAS` toggle
2. `USE_SLOT_GRID` toggle
3. try/finally — shadow не утечёт
4. `containerWidth ≤ 0` guard
5. `containerHeight > 0` guard
6. `nextBlockId` staleness guard
7. Clamp targetTop
8. Fallback (центр viewport)

---

## §9. TRANSITION PRESET SYSTEM 🆕

### Обзор

Пресет управляет стилем перехода между блоками: как ПС появляется, летит, и как строки реагируют на смену блока. Сериализуется в JSON, едет с ZIP треком.

**5 встроенных пресетов:**

| ID | Имя | Характер |
|----|-----|---------|
| `smooth` | Smooth | Плавный, органичный (default) |
| `bounce` | Bounce | Резкий старт, небольшой отскок |
| `spotlight` | Spotlight | Прожектор + затемнение остальных |
| `snap` | Snap | Мгновенный, минималистичный |
| `gentle` | Gentle | Медленный, нежный |

### Persistence контракт

```
plate.store.transitionPreset = runtime truth (localStorage)
IDB TrackRecord.transitionPreset = per-track memory
ZIP export.json = шеринг пресетов

Read path (load track):
  Orchestrator Step 11.5: if (track.transitionPreset != null)
    → plate.store.setTransitionPreset(preset)

Write path (user picks preset):
  plate.store.setTransitionPreset("bounce")
    → plate.bridge debounce 300ms
    → syncToIDB(trackId, { transitionPreset: "bounce" })

Guard: null/undefined → НЕ перезаписывать plate.store
```

### State Machine

```
IDLE
  │ shouldGrowPreview=true
  ▼
GROW (ПС появляется под последней строкой)
  │ travel trigger fires
  ▼
TRAVEL (ПС летит к цели)
  │ setIsTraveling=true, setIsDissolving=true
  ▼
DISSOLVE (dim предвестник, старые строки исчезают)
  │ useLayoutEffect: isDissolving → setIsEntering=true
  ▼
ENTER (новые строки fade in)
  │ double rAF → data-enter-mounted="true"
  │ setTimeout(cleanup, enter.duration)
  ▼
IDLE
```

**React State Inventory:**

| State | Set True | Set False |
|-------|----------|-----------|
| `isTraveling` | Travel trigger | useLayoutEffect, pause, shouldGrowPreview=false |
| `isDissolving` | Travel trigger | useLayoutEffect after isEntering check |
| `isEntering` | useLayoutEffect (if isDissolving) | setTimeout после enter duration |
| `isEnterMounted` | double rAF после isEntering | setTimeout после enter duration |

### 16 Архитектурных решений (заморожены)

| # | Решение | Почему |
|---|---------|--------|
| 1 | Appear = transition-based + data-mounted | Полная параметризация через CSS vars |
| 2 | data-mounted timing = double rAF | Браузер рисует начальное состояние |
| 3 | CSS vars scope = `.root` | Sibling наследование (ПС = sibling блока) |
| 4 | Mode dispatch = data-attributes | CSS Modules safe (не classList.add) |
| 5 | Sibling selector `~` для spotlight | ПС НЕ потомок .activeBlock |
| 6 | Store = plate.store + IDB | Разделение concerns |
| 7 | Store→IDB = Bridge + debounce 300ms | Автосохранение |
| 8 | Easing = String | CSS-native |
| 9 | Dissolve = Enter-only MVP | React мгновенно UNMOUNT старые строки |
| 10 | Spotlight > Dissolve priority | Нет конфликта opacity |
| 11 | Performance guard = tier + recording | lite→smooth, recording→no spotlight |
| 12 | Padding/lineHeight из CSS | Layout ≠ animation |
| 13 | Preset имена краткие | UX |
| 14 | VOC dataVersion=4 | Разрывает L3→L2 бесконечный цикл |
| 15 | ZIP import guard null/undefined | Не перезаписывать выбор пользователя |
| 16 | initPlateBridge() после textStyle.bridge | Порядок инициализации |

### Критические нюансы

**CSS Variable Scope:**
```
.previewOverlay = SIBLING .activeBlock, НЕ потомок.
Все --bl-ps-* переменные ставить на .root — НЕ на .activeBlock.
```

**CSS Modules Name Mangling:**
```
НЕЛЬЗЯ: overlayRef.current.classList.add('mounted')
НУЖНО:  overlayRef.current.dataset.mounted = 'true'
```

**Sibling Selector для Spotlight:**
```css
/* Правильно: general sibling combinator ~ */
.activeBlock[data-spotlight-active="true"] ~ .previewOverlay[data-mounted="true"] { }

/* Неправильно: descendant selector */
.activeBlock .previewOverlay { }
```

**Dissolve = Enter-only MVP:**
```
React мгновенно UNMOUNT старые строки при смене блока.
"Dissolve" = dim предвестник ДО switch.
Старые строки исчезают мгновенно, новые fade in.
Full dissolve (ghost layer) = Phase 3+.
```

### Несделанное (P2)

| TC | Что | Зависимость |
|----|-----|------------|
| TC-82-07 | ZIP Import — transitionPreset | upload.service.ts |
| TC-82-08 | ZIP Export — transitionPreset | upload.service.ts |
| TC-85-06 | ZIP Import — dataVersion reset | upload.service.ts |
| — | Spotlight radial overlay | JSX + CSS positioning |
| — | Full dissolve (ghost layer) | React portal |

---

## §10. DOM СТРУКТУРА

```html
<div class="root" data-reactive="true">

  <!-- ПЛАШКА -->
  <div class="activeBlock slotMatrixActive"
       data-slot-group-id="group-verse-1-0"
       data-slot-group-type="verse"
       data-slot-group-color="#4CAF50"
       data-spotlight-active="false"
       data-traveling="false"
       data-dissolving="false">

    <!-- СТРОКИ (CSS Grid) -->
    <div class="slotContainer" data-slot-container="true"
         style="fontSize:2.6rem; gridTemplateRows:minmax(52px,auto)...">

      <div class="line" data-line-index="3" data-active="true">...</div>
      <div class="line" data-line-index="4">...</div>

      <!-- ПС строка (скрыта когда overlay активен) -->
      <div class="line" data-is-preview="true"
           data-block-type="chorus"
           style="color:#F44336; opacity:0; transition:none">
        Tonight
      </div>
    </div>
  </div>

  <!-- ПС OVERLAY (position:fixed) -->
  <div class="previewOverlay"
       data-mounted="true"
       data-travel-target="234"
       data-travel-block-id="auto-block-3"
       data-travel-container-h="332"
       data-travel-content-h="256"
       style="top:234px; left:119px; width:900px;
              fontSize:2.6rem; color:#F44336">
    Tonight
  </div>

  <!-- НОВЫЕ СТРОКИ при enter (data-entering) -->
  <div class="activeBlock" data-entering="true">
    <div class="slotContainer" data-enter-mounted="true">...</div>
  </div>

</div>
```

---

## §11. ПРОВОДА ДЛЯ БУДУЩИХ ФИЧ

### Quest System (Phase 4)
```
Slot.questState → visible/hidden/dimmed/blurred/locked/completed/highlighted
Slot.questMeta.hideOrder → порядок скрытия
Slot.questMeta.fillDifficulty → 1-5 (fill-in квест)
Slot.questMeta.questId → пользовательские квесты
Slot.questMeta.revealRule → always|after-step|on-approach|on-first-play
```

### Back Vocal (Phase 5)
```
Slot.parts: SlotPart[]
SlotPart.type: 'lead' | 'back'
SlotPart.bracketed → всё в скобках = back vocal
SlotPart.colorOverride → провод для кастомного цвета
```

### Word Sync (Phase 5)
```
Slot.wordBreakPoints: WordBreakPoint[]
priority: 1=пробел, 2=дефис, 3=пунктуация
```

### Full-area Canvas (Phase 3.5)
```
SlotCanvas, useSlotCanvas(), computeSlotCanvas() — готовы, не подключены
```

---

## §12. ТЕСТ-ПРОГОН (верификация в браузере)

### Travel target (delta=0)
```javascript
const block = document.querySelector('[data-slot-group-id]');
const container = document.querySelector('[data-slot-container]');
const firstLine = block?.querySelector('[data-line-index]:not([data-is-preview])');
const blockRect = block?.getBoundingClientRect();
const containerH = container?.getBoundingClientRect().height;
const predicted = blockRect.top + 24 + (blockRect.height - 48 - containerH) / 2;
const real = firstLine.getBoundingClientRect().top;
console.table({
  predicted: Math.round(predicted),
  real: Math.round(real),
  delta: Math.round(Math.abs(predicted - real)),
  verdict: Math.abs(predicted - real) <= 2 ? '✅ ТОЧНО' : '❌ НЕТОЧНО'
});
```

### Transition Preset
| Сценарий | Ожидание |
|----------|----------|
| Клик Smooth → appear | Плавное появление 0.5s |
| Клик Snap → appear | Мгновенное 0.15s |
| Клик Spotlight → travel | Glow + dim остальных |
| Клик Bounce → travel | Отскок при посадке |
| Switch track → вернуться | Пресет сохраняется |
| Pause → resume | isTraveling сбрасывается |

---

## §13. ИЗВЕСТНЫЕ БАГИ (отложены)

| Баг | Описание | Приоритет |
|-----|----------|-----------|
| `DEFAULT_SLOT_GAP=8` | Конфликт с CSS 16px | Низкий |
| `interlude` missing CSS | Нет `--bl-block-interlude` | Когда появится |
| `lineH=52` fallback | Неточен для non-4-line | Низкий |
| `offsetY` unused | useSlotMatrix возвращает, не используется | Низкий |
| `useSlotCanvas` orphaned | Хук без потребителей | Phase 3.5 |
| `BUG-fontScale-inline` | fontScale не в inline fontSize | Следующий wave |
| VOC L2 неточность | 1/8 anchors → неточный offset | P2 |
| ZIP без transitionPreset | TC-82-07/08 не выполнены | P2 |

---

*Документ живой. Версия 2.2 актуальна для Phase 2 (Grid + ПС Travel + Transition Presets).*

---

## §2A. ПОДБЛОКИ — АРХИТЕКТУРА ДЕЛЕНИЯ

**Version:** 1.0 | **Date:** 2026-05 | **Authors:** Центр_2 + Никита  
**Status:** ✅ PRODUCTION (Волна 1)

---

### 2A.1. Назначение

Когда блок (куплет, припев и т.д.) содержит много строк текста, центральная плашка в режиме репетиции делит его на **подблоки** — визуальные сегменты по 3-6 строк для обеспечения читаемости и навигации.

Подблоки влияют на:
- **Плашку RehearsalLyrics** — показывает только активный подблок
- **WagonTrain** — отображает subSegments (нижние чёрточки) с пропорциями
- **ПС (Preview Slot) routing** — L1 (подблок→подблок) vs L2 (блок→блок)
- **Font size** — зависит от количества строк в активном подблоке
- **Transition Preset** — trigger time зависит от isLast

---

### 2A.2. Принцип "Дополненного Квадрата"

Базовое деление строится на музыкальной логике:

**Квадрат** = 4 строки — базовая музыкальная единица (90% поп/рок структур).  
**Неполный квадрат** = 3 строки — antecedent (вступительная мысль).  
**Расширенный квадрат** = 5-6 строк — consequent с дополнением (развитие + разрешение).

#### Правила деления

1. **1-5 строк** → не делим, один подблок
2. **6-10 строк** → 2 подблока: первый = "вступление", второй = "развитие"
3. **11-15 строк** → 3 подблока: AAB (квадраты первые, хвост последний)
4. **16+ строк** → 3 подблока, равномерно (макс 6 в каждом)

#### Таблица деления

| Строк | Деление | Акценты | Font (п/б 1 / п/б 2) | Принцип |
|-------|---------|---------|----------------------|---------|
| 1-5 | [N] | 1 | 3.2→2.0rem | Не делим |
| 6 | [3, 3] | 1, 4 | 2.6 / 2.6 | Два неполных квадрата |
| 7 | [3, 4] | 1, 4 | 2.6 / 2.6 | Неполный + квадрат |
| 8 | [4, 4] | 1, 5 | 2.6 / 2.6 | Два квадрата |
| 9 | [4, 5] | 1, 5 | 2.6 / 2.0 | Квадрат + расширенный |
| 10 | [4, 6] | 1, 5 | 2.6 / 2.0 | Квадрат + расширенный финал |
| 11 | [4, 4, 3] | 1, 5, 9 | 2.6 / 2.6 / 2.6 | AAB |
| 12 | [4, 4, 4] | 1, 5, 9 | 2.6 / 2.6 / 2.6 | Три квадрата |
| 13 | [4, 4, 5] | 1, 5, 9 | 2.6 / 2.6 / 2.0 | AAB расширенный |
| 14 | [4, 5, 5] | 1, 5, 10 | 2.6 / 2.0 / 2.0 | Квадрат + два расш. |
| 15 | [5, 5, 5] | 1, 6, 11 | 2.0 / 2.0 / 2.0 | Три расширенных |
| 16+ | равн. на 3 | — | — | Макс 6 в каждом |

#### Почему "меньший первый, больший второй"

В музыке расширение идёт в **конце**, не в начале. Эмоции нарастают → повторы → разрешение. Поэтому:
- `[3, 4]` — акцент на 4-й строке = начало второго подблока ✅
- `[4, 3]` — акцент на 5-й строке = середина блока ❌

#### Почему 5 строк не делим

5 строк в 2.0rem отлично читаются на плашке. Разрыв ради "красивого деления" ломает целостность. Font size стабильный (один подблок = один размер).

---

### 2A.3. Echo-Detection (Волна 1)

Базовое деление по квадратам работает в ~85% случаев. Для оставшихся 15% — **echo-detection**: анализ текста строк для определения музыкальных паттернов.

#### Принцип

**Echo** = повторение начала музыкальной фразы, сигнализирующее о начале новой смысловой волны.

```
Строка 1: "I don't know what's worth fighting for"  ← ЗАПУСК
Строка 2: "Or why I have to scream"                  ← развитие
Строка 3: "But now I have some clarity"              ← развитие
Строка 4: "To show you what I mean"                  ← завершение квадрата
Строка 5: "I don't know how I got this way"          ← ПЕРЕЗАПУСК (echo!)
```

Строка 5 должна быть **началом второго подблока**, а не концом первого.

#### Алгоритм

```
1. Вычислить базовое деление (computeBalancedSplit)
2. Если передан lines[] и 2 подблока:
   a. Вычислить локальный стоп-лист (слова >40% частотности)
   b. Извлечь fingerprint для каждой строки (первые 2 значимых слова)
   c. Сканировать зону строк 3-6:
      - Сравнить fingerprint строки j с fingerprint строки i (i < j)
      - Gap ≥ 2 строки между = паттерн → кандидат на границу
      - Gap < 2 или идентичные строки = хук → отклонить
   d. Проверить ограничения:
      - Сдвиг от базового ≤ 2 строк
      - Минимальный подблок ≥ 2 строки
      - Font size прыжок не увеличивается > 0.65rem
   e. Если echo найден → скорректировать деление
3. Если lines[] не передан → использовать только базовое деление
```

#### Защита от ложных срабатываний

| Кейс | Тип | Как распознаётся | Реакция |
|------|-----|-----------------|---------|
| "I don't know" × 2, разные продолжения | Паттерн | gap ≥ 2, не идентичны | ✅ Корректирует границу |
| "I'm breaking the habit" × 3 подряд | Хук | gap = 0 | ❌ Отклоняет |
| "Here we are now" (идентичная строка) | Хук | normalizedTexts идентичны | ❌ Отклоняет |
| "Love" в каждой строке | Шум | Частота > 40% → стоп-лист | ❌ Отклоняет |
| "Hello" × 2, 1 значимое слово | Ложный | < 2 значимых совпадений | ❌ Отклоняет |

#### Fingerprint extraction

```
Шаг 1: normalizeText() — lowercase + убрать пунктуацию + апострофы
"I don't know what's worth fighting for" → "i dont know whats worth fighting for"

Шаг 2: Фильтр шума — длина < 3 символов
["dont", "know", "whats", "worth", "fighting", "for"]

Шаг 3: Фильтр локального стоп-листа — слова > 40% частотности в блоке

Шаг 4: Взять первые 2 значимых слова
["dont", "know"]
```

#### Константы

| Константа | Значение | Описание |
|-----------|----------|----------|
| `ECHO_ZONE_START` | 2 | Зона обнаружения: начиная ��о строки 3 (0-indexed) |
| `ECHO_ZONE_END` | 5 | Зона обнаружения: до строки 6 |
| `MIN_SIGNIFICANT_WORDS_MATCH` | 2 | Минимум совпадающих слов для echo |
| `MIN_PATTERN_GAP` | 2 | Минимальный gap (строк между) для паттерна |
| `MAX_SHIFT_FROM_BASE` | 2 | Максимальный сдвиг от базового квадрата |
| `MIN_SUBBLOCK_LINES` | 2 | Минимальный размер подблока |
| `MIN_WORD_LENGTH` | 3 | Минимальная длина значимого слова |
| `FREQ_THRESHOLD` | 0.4 | Порог частотности для стоп-листа |
| `MAX_FONT_JUMP_DELTA` | 0.65 | Максимальное увеличение прыжка font size |

---

### 2A.4. Файловая карта

#### Ядро логики

| Файл | Роль | Ключевые функции |
|------|------|-----------------|
| `src/utils/block-utils.ts` | **ЯДРО** — всё деление подблоков | `computeBalancedSplit()`, `detectEchoBreakPoint()`, `createSubBlocks()`, `getActiveSubBlockIndex()`, `getBlockFontSize()` |
| `src/slot-matrix/slot-matrix.utils.ts` | Константа MAX_SUB_BLOCK_LINES = 6 | Единственный источник истины для лимита |

#### Потребители (вызывают createSubBlocks)

| Файл | Когда вызывается | Передаёт lines? |
|------|-----------------|-----------------|
| `src/slot-matrix/compute-slot-matrix.ts` | Вычисление SlotMatrix для плашки | ✅ Да |
| `src/slot-matrix/compute-slot-groups.ts` | Вычисление SlotGroup[] (альтернативная) | ✅ Да |
| `src/slot-matrix/use-slot-matrix.ts` | React хук — основная матрица | ✅ Да |
| `src/components/WagonTrain.tsx` | Рендер subSegments в TrackMap | ✅ Да |
| `src/components/RehearsalLyrics.tsx` | Shadow measurement для ПС travel | ✅ Да |

#### Что зависит от подблоков

| Компонент | Зависимость | Файл |
|-----------|-------------|------|
| **Плашка RehearsalLyrics** | Показывает только активный подблок | `RehearsalLyrics.tsx` |
| **WagonTrain subSegments** | Пропорции по `flex: sub.lineIndices.length` | `WagonTrain.tsx` |
| **ПС L1/L2 routing** | `isLast` определяет уровень routing | `compute-slot-matrix.ts:117` |
| **ПС shadow measurement** | Измеряет целевой подблок | `RehearsalLyrics.tsx:355` |
| **ПС trigger time** | L1 vs L2 offset | `RehearsalLyrics.tsx:433` |
| **Font size** | `getBlockFontSize(visibleLineIndices.length)` | `block-utils.ts` |
| **Transition preset** | isLast влияет на dissolve/enter | `RehearsalLyrics.tsx` |

---

### 2A.5. Поток данных

```
Пользователь нажимает Play
↓
AudioEngineV2 → currentTime обновляется
↓
Marker-driven → activeLineIndex обновляется
↓
useSlotMatrix() вызывается:
├─ createSubBlocks(displayBlock.lineIndices, 6, lines)
│   ├─ computeBalancedSplit() → базовое деление
│   ├─ detectEchoBreakPoint() → echo-корректировка (если lines передан)
│   └─ Сборка SubBlock[] с isFirst/isLast
├─ getActiveSubBlockIndex() → какой подблок активен
├─ computeSlotMatrix() → слоты, ПС, высоты
└─ Возвращает: matrix, subBlocks, activeSubBlockIndex, ...
↓
RehearsalLyrics рендерит:
├─ Активный подблок (visibleLineIndices)
├─ Font size от getBlockFontSize(visibleLineIndices.length)
├─ ПС (L1 или L2 в зависимости от isLast)
└─ Transition (dissolve/enter при смене подблока)
↓
WagonTrain рендерит:
├─ subSegments с пропорциями flex
├─ data-sub-active на активном сегменте
└─ Клик на сегмент → seek к маркеру
```

---

### 2A.6. Влияние на ПС (Preview Slot)

Подблоки напрямую определяют **L1 vs L2 routing** ПС:

```typescript
// compute-slot-matrix.ts:117
if (!activeSubBlock.isLast && subBlocks[activeSubBlockIndex + 1]) {
  // L1: SubBlock→SubBlock (тот же блок)
  // ПС = первый слот следующего подблока
  // Цвет = цвет текущего блока
  // Trigger = nextSubBlockFirstMarkerTime - dynamic offset
} else if (nextBlock) {
  // L2: Block→Block (следующий блок)
  // ПС = первый слот первого подблока следующего блока
  // Цвет = цвет следующего блока
  // Trigger = nextBlockFirstMarkerTime - fixed offset
}
```

**При изменении деления подблоков → меняется когда `isLast` → меняется L1/L2 routing.**

Пример:
- 10 строк, [4, 6]: первый подблок `isLast=false` → L1 routing ✅
- 5 строк, [5]: единственный подблок `isLast=true` → L2 routing ✅
- 8 строк, [4, 4]: первый подблок `isLast=false` → L1 routing ✅

---

### 2A.7. Font Size cascade

Font size определяется **количеством строк в активном подблоке**, не во всём блоке:

```typescript
// compute-slot-matrix.ts:69
const fontSize = getBlockFontSize(visibleLineIndices.length);
// visibleLineIndices = activeSubBlock.lineIndices
```

Это означает что при смене подблока font size **может прыгнуть**:

| Блок | Подблок 1 | Подблок 2 | Прыжок при смене |
|------|-----------|-----------|-----------------|
| 6 строк [3,3] | 2.6rem | 2.6rem | 0 ✅ |
| 8 строк [4,4] | 2.6rem | 2.6rem | 0 ✅ |
| 9 строк [4,5] | 2.6rem | 2.0rem | 0.6rem ⚠️ |
| 10 строк [4,6] | 2.6rem | 2.0rem | 0.6rem ⚠️ |

Echo-detection отклоняет корректировку если она увеличивает прыжок > 0.65rem относительно базового.

---

### 2A.8. Волна 2 (будущее)

| Что | Описание | Зависимость |
|-----|----------|------------|
| Анализ объёма слов | Короткие строки ("Oh yeah") → больше в подблок | lines[] уже передан |
| Пунктуация | "?" / "!" = завершение мысли → кандидат на границу | normalizeText уже есть |
| Рифма | Совпадающие окончания = пара, не разделять | Новый модуль |
| Расширенная echo-зона | Строки 6-7 для длинных блоков | ECHO_ZONE_END увеличить |

---

### 2A.9. Тест-покрытие

| Категория | Кейсов | Файл |
|-----------|--------|------|
| Базовое деление (1-15 строк) | 13 | `slot-groups.test.ts` |
| isFirst/isLast для 1-18 | 1 | `slot-groups.test.ts` |
| Пустой массив | 1 | `slot-groups.test.ts` |
| Echo: Linkin Park | 1 | `slot-groups.test.ts` |
| Echo: Повтор хука (gap=0) | 1 | `slot-groups.test.ts` |
| Echo: Идентичные строки | 1 | `slot-groups.test.ts` |
| Echo: Стоп-лист | 1 | `slot-groups.test.ts` |
| Echo: Без lines | 1 | `slot-groups.test.ts` |
| Echo: Сдвиг базы | 1 | `slot-groups.test.ts` |
| Echo: Маленький блок | 1 | `slot-groups.test.ts` |
| Echo: 1 слово совпадение | 1 | `slot-groups.test.ts` |

**Итого: 24 теста напрямую свя��анных с подблоками + 82 других тестов slot-matrix = 106 тестов**

---

### 2A.10. Изменение логики — чеклист

Если нужно изменить деление подблоков:

1. ⬜ `computeBalancedSplit()` — таблица деления
2. ⬜ `detectEchoBreakPoint()` — echo-константы и логика
3. ⬜ `MAX_SUB_BLOCK_LINES` — лимит строк в подблоке
4. ⬜ `getBlockFontSize()` — пороги font size
5. ⬜ Тесты — обновить ожидаемые значения
6. ⬜ Проверить ПС routing — isLast может измениться
7. ⬜ Проверить WagonTrain — пропорции subSegments
8. ⬜ Проверить shadow measurement — целевой подблок

---

*§2A актуален для Волны 1 (базовое деление + echo-detection). Волна 2 (анализ объёма слов, пунктуация, рифма) — будущая работа.*
