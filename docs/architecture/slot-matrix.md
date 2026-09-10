# 🎼 Slot Matrix — Architecture of the Lyrics Layout Engine

**Status:** ✅ LIVING (живой док алгоритмов — proposal PA-6 исполнен, Ш-конвой docs==code)
**Last Updated:** September 10, 2026 (003, по атласу 06-aux + прогону 106/106)
**Owner:** beLive Lyrics Layout
**Related:** `slot-matrix-system-v2.2.md` (tombstone, HISTORICAL — НЕ справочник), `RehearsalLyrics.tsx`, `WagonTrain.tsx`

> **Origin:** этот док создан взамен tombstone v2.2 (950 строк «Awaiting rewrite», содержит Styles System по ошибке синка 2026-05-20 и врёт про `MAX_SUB_BLOCK_LINES=4`). Tombstone не правим — он исторический артефакт. Живая правда — здесь, все file:line проверены rg/sed на `HEAD 3447f71` (10.09), тест-пруф 106/106 (`npx vitest run src/slot-matrix`).

---

## 1. ОБЗОР: ЧТО ТАКОЕ SLOT MATRIX

Slot Matrix = чистый вычислитель раскладки текста репетиции. Вход — `TextBlock` + активная строка + `fontScale`; выход — `SlotMatrix` (слоты/подблоки/offsetY), из которой UI рендерит центрированную «плашку» строк с превью-строкой (ПС) следующего блока.

```
TextBlock + activeLineIndex + fontScale
   ↓ (createSubBlocks, ≤6 строк/подблок)
Подблоки → активный подблок → contentSlots + ПС (2 уровня)
   ↓ (computeOffsetY — центр по КОНТЕНТУ)
SlotMatrix → useSlotMatrix (memo) → RehearsalLyrics grid
```

**Ядро домена — `src/slot-matrix/` 8 файлов / 1 488 строк (+3 тест-файла 1 594 строки / 106 тестов).**

| Файл | LOC | Роль | Живость (rg-импортеры вне зоны) |
|---|---|---|---|
| `compute-slot-matrix.ts` | 218 | ядро: подблоки→слоты→ПС→offsetY | 🟢 через `use-slot-matrix.ts:3` |
| `use-slot-matrix.ts` | 196 | React-обёртка: 6 store-reads → memo | 🟢 `RehearsalLyrics:21/:173` |
| `slot-matrix.utils.ts` | 153 | константы + позиционная математика + bracket-парсер | 🟢 4 зоны |
| `measure-next-block.ts` | 160 | shadow-измерение следующего блока (1 reflow) | 🟢 `RehearsalLyrics:22/:432` |
| `slot-matrix.types.ts` | 234 | контракт: Slot/SlotMatrix/SubBlockRange/LayoutMode | 🟢 типы ядра |
| `transition-preset.types.ts` | 120 | контракт пресетов переходов | 🟢 `transition-presets.ts` |
| `compute-slot-groups.ts` | 193 | ≈дубль ядра → SlotGroup[] | 🔴 DEAD (0 импортёров, Phase 3.3) |
| `compute-slot-canvas.ts` | 214 | matrix+viewport → SlotCanvas | 🔴 DEAD (0 импортёров, Phase 3.5) |

---

## 2. ЯДРО: computeSlotMatrix (compute-slot-matrix.ts:43-218)

**Вход** (`ComputeSlotMatrixParams:25-37`): `displayBlock, activeLineIndex, lines, fontScale, nextBlock?, loopStartLine?, loopEndLine?, gapPx=8, interBlockGap=24, maxSubBlockLines=6, layoutMode='plate'`.

**Алгоритм (9 шагов, нумерация = комментарии кода):**

1. **Подблоки** `:59` — `createSubBlocks(lineIndices, 6, lines)` (из `block-utils`): блок нарезается на подблоки ≤6 строк («дополненный квадрат»).
2. **Активный подблок** `:62-65` — `getActiveSubBlockIndex`; его строки = видимый контент.
3. **Размеры** `:69-71` — `fontSize` от числа строк (`getBlockFontSize`), `lineHeight = fontSize × 1.25 × fontScale` (LINE_HEIGHT_MULTIPLIER utils:8), `slotStep = lineHeight + gapPx`.
4. **SubBlockRange[]** `:74-83` — метаданные всех подблоков (`isFirst/isLast/lineIndices`) — «карта подблоков» для UI-стейта.
5. **Content-слоты** `:88-107` — строка → Slot: `y = slotIndex × slotStep` (computeSlotY utils:59-65), `parts = parseBracketedParts` (бэки в скобках → отдельные SlotPart), флаги `isLoopStart/isLoopEnd`.
6. **Активный слот** `:110` — `visibleLineIndices.indexOf(activeLineIndex)` (fallback 0).
7. **ПС — превью-строка, ДВА уровня** `:112-182`:
   - **Уровень 1 (подблок→подблок)** `:117-148`: следующий подблок ТОГО ЖЕ блока — ПС несёт цвет/тип текущего блока.
   - **Уровень 2 (блок→блок)** `:150-182`: `nextBlock.lineIndices[0]` — ПС несёт цвет/тип СЛЕДУЮЩЕГО блока (`previewBlockColor = getCanonicalBlockColor(nextBlock.type)`).
   - ПС-позиция `:127-130`: `lastContentSlot.y + height + interBlockGap` — под контентом, с зазором 24px.
8. **Сборка** `:185` — `allSlots = [...contentSlots, previewSlot?]`.
9. **Итоги** `:188-217` — `contentHeight` (gap после последней строки НЕ входит, utils:68-75), `totalHeight` (вкл. ПС), **`offsetY` = центрирование по КОНТЕНТУ, НЕ по totalHeight** (см. §4, инвариант I3).

**Выход** (`SlotMatrix`, types:…) — `key: blockId-subBlockIndex-fontScale-fontSize` (:200) — ключ мемоизации.

---

## 3. ПОЗИЦИОННАЯ МАТЕМАТИКА (slot-matrix.utils.ts)

| Формула | Где | Смысл |
|---|---|---|
| `lineHeight = remToPx(fontSizeRem) × 1.25 × fontScale` | utils:50-56 | чистая высота строки (1.25 = CSS `.line { line-height: 1.25 }`) |
| `slotY = slotIndex × (lineHeight + gapPx)` | utils:59-65 | позиция слота в подблоке |
| `totalHeight = (n−1) × (lineHeight + gapPx) + lineHeight` | utils:68-75 | высота контента: gap после последней НЕ включён |
| **`offsetY = contentHeight/2 − activeSlotY − lineHeight/2`** | utils:78-86 | центрирование АКТИВНОЙ строки (см. §4 I3) |
| `slotId = blockId-subBlockIndex-slotIndex` | utils:89-95 | стабильный ID для React-ключей |

**Константы (utils:8-17):**

| Константа | Значение | Комментарий кода |
|---|---|---|
| `LINE_HEIGHT_MULTIPLIER` | 1.25 | из CSS `.line` |
| `DEFAULT_SLOT_GAP` | 8 | из CSS `.activeBlock { gap: 8px }` |
| `DEFAULT_INTER_BLOCK_GAP` | 24 | padding-bottom плашки |
| **`MAX_SUB_BLOCK_LINES`** | **6** | «дополненный квадрат» — ⚠️ tombstone v2.2 утверждал 4, факт = 6 (test `slot-matrix.test.ts:454` подтверждает) |

**Bracket-парсер** `parseBracketedParts:104-145` — `(текст в скобках)` → `SlotPart {type:'back'}` (бэк-вокал), остальное → `{type:'lead'}`. Регэксп `:101`, fallback-lead `:135-142`.

**remToPx + кэш root font-size** `:23-43` — `getRootFontSize` кэшируется, сброс по `resize` (`:151-152`).

---

## 4. ИНВАРИАНТЫ (проверены тестами)

- **I1. Подблок ≤ 6 строк** — `MAX_SUB_BLOCK_LINES=6` (utils:17); потребители — `computeSlotMatrix:59`, `WagonTrain:48/:150`, `BlockScenesModal:264/:349`.
- **I2. ПС всегда есть** (если существует следующий подблок ИЛИ блок) — двухуровневая логика `:117-182`; ПС `isPreview: true`, `opacity 0.3/idle` после switch (measure-next-block:10-15).
- **I3. offsetY центрирует по contentHeight, НЕ totalHeight** — `computeSlotMatrix:196-198` передаёт `contentHeight`; ПС не участвует в центрировании (тест `slot-matrix.test.ts:303-315`).
- **I4. Матрица НЕ зависит от activeLineIndex напрямую** — мемо-ключ = `blockId-subBlockIndex-fontScale` (use-slot-matrix:70-72); пересчёт только при смене ПОДБЛОКА (не строки).
- **I5. Один reflow в measureNextBlock** — все rows ДО appendChild (measure-next-block:41, «ВЫЗЫВАТЬ ТОЛЬКО вне rAF» :47).
- **I6. travel-цель = containerHeight, НЕ contentHeight** — flexbox центрирует по ПОЛНОЙ высоте (вкл. ПС); contentHeight = −38px промах (measure-next-block:6-15, «ПОЧЕМУ»-комментарий).

---

## 5. REACT-СЛОЙ: useSlotMatrix (use-slot-matrix.ts:27-196)

**6 store-reads** `:39-45` — `lyrics(lines/activeLineIndex)`, `blocks(blocks)`, `textStyle(fontScale)`, `loop(isLooping/start/end)`.

**Деривации (все — из matrix, «единственный источник»):**
- `displayBlock/nextBlock` `:48-57`, активный подблок `:60-67`.
- `matrix` `:75-89` — `useMemo(computeSlotMatrix, [matrixKey, lines, nextBlock, loop…, activeLineIndex])`; `gapPx: GRID_GAP=16` `:85` — ⚠️ **двойной gap**: utils.DEFAULT=8, hook GRID_GAP=16 (компенсация убранного `.line` padding 4+8+4=16, `:14-15`) — известный dual, см. §8-Д2.
- `gridTemplateRows` `:95-101` — `minmax(slot.height, auto)` на непустые слоты (рост при переносе текста).
- `visibleLineIndices` `:106-111`, `isLastLineInSubBlock` `:114-120`.
- **`activeSlotGroup`** `:129-182` — активная SlotGroup c **тремя документированными FIXa деривации**: FIX#1 fontSize от ВСЕХ контент-слотов вкл. empty `:144-145`; FIX#2 activeSlotIndex = −1 если строка не найдена (не 0-фолбэк ядра) `:148-151`; FIX#3 gridRows = контент + ПС-строка `:153-158`.

**⚠️ dead-import:** `computeOffsetY` импортирован `:4`, но НЕ вызывается (offsetY берётся из matrix:103) — Д-2-кандидат.

---

## 6. ИЗМЕРЕНИЕ: measureNextBlock (measure-next-block.ts:49-159)

**Назначение:** реальная высота slotContainer СЛЕДУЮЩЕГО блока ДО анимации travel — через off-screen shadow-элемент (`data-shadow-measure:73`, `position:fixed; left:-9999px` :75-76), копирующий CSS-правила grid.

**Контракт** (`NextBlockMeasurement:5-28`): `containerHeight` (travel-цель, ВКЛЮЧАЯ ПС + gaps) · `contentHeight` (приближение, «ТОЛЬКО для диагностики» :20-21) · `firstLineOffset` · `nextBlockId` (staleness-гард `:26-27`).

**Критические правила (из шапки `:30-48`):** padding:0 в slot mode · ПС в grid всегда (от nextNextBlock) · ПС margin-top: 8px (= interBlockGap 24 − slotGap 16) · ОДИН reflow (rows до appendChild) · `gridTemplateRows` в shadow НЕ добавляется, пока жив BUG-fontScale-inline (при fontScale≠1.0 minmax ≠ CSS line-height) `:43-45` · вызов вне rAF, один раз при смене `shouldGrowPreview` `:47`.

**Потребитель:** `RehearsalLyrics:432` (travel-анимация по containerHeight).

---

## 7. TRANSITION-СИСТЕМА (пресеты → CSS)

**Банк пресетов** `src/data/transition-presets.ts` — 5 встроенных (`smooth/bounce/…`), `Record<string, TransitionPreset>`, сериализуются в JSON, **едут в ZIP-треках** (шапка `:2-3`). `DEFAULT_PRESET = smooth:262`, `CURRENT_PRESET_VERSION = 1:265`.

**Контракт** `transition-preset.types.ts` (120 строк): `appear / travel (spotlight) / dissolve / enter / timing` — тайминг-секция (`triggerOffset, subBlockOffsetRatio, triggerWindow, idleGap, dissolveStart, enterDelay`).

**Поток:**
```
transition-presets.ts (5) → StylesDeck:673 (UI выбора) + RehearsalLyrics:13/:64 (fallback DEFAULT_PRESET)
   → timing-параметры управляют switch-анимацией подблоков (dissolve at-switch / enter с задержкой)
```

---

## 8. ТЕСТ-КОНТРАКТ + DRIFTS + DEAD INVENTORY

### 8.1 Тест-пруф: 106/106 (3 файла, `npx vitest run src/slot-matrix`, 10.09)
- `slot-matrix.test.ts` (666 строк) — ядро: offsetY-центрирование `:303-315/:517-534`, подблоки `:356-370`, **MAX_SUB_BLOCK_LINES=6 подтверждён `:454`**.
- `slot-groups.test.ts` (555 строк, 24 теста) — контракт мёртвой computeSlotGroups (зарезервированный Phase-3.3).
- `slot-canvas.test.ts` (373 строки, 13 тестов) — контракт мёртвой computeSlotCanvas (Phase-3.5).

### 8.2 DRIFTS (safety-класс — в Д-2/цепь, НЕ правки 003)
| # | Дрейф | Факт vs Факт |
|---|---|---|
| Д1 | `MAX_SUB_BLOCK_LINES` | код=6 (utils:17) vs tombstone v2.2=4 — этот док несёт 6 |
| Д2 | **Двойной gap** | `DEFAULT_SLOT_GAP=8` (utils:11) vs `GRID_GAP=16` (use-slot-matrix:15) — «подтверждённый dual», hook-компенсация padding |
| Д3 | Tombstone перечисляет несуществующие файлы | `validate-transition-preset.ts`, `use-slot-canvas.ts` — не существуют в дереве |
| Д4 | `measureNextBlock` без юнит-тестов | DOM-зависимость — дыра тест-контракта (браузер-тест Никиты) |

### 8.3 DEAD inventory (Д-2, удаление НЕ 003 — функции спланированы, тесты = зарезервированный контракт)
`computeSlotGroups`+тип (0 импортёров, Phase 3.3) · `computeSlotCanvas`+тип (0, Phase 3.5) · `SlotCanvas` · `TransitionPhase` · `CURRENT_PRESET_VERSION` (data/:265 — 1 импортёр вне живого потока) · `computeOffsetY` (dead-import use-slot-matrix:4) · reservation-типы `QuestSlotState/QuestSlotMeta/WordBreakPoint` (Phase 4/5).

---

## 9. ПОТРЕБИТЕЛИ (шов к UI-атласам пары)

| Потребитель | Что берёт | Атлас |
|---|---|---|
| `RehearsalLyrics.tsx` | `useSlotMatrix:21/:173`, `measureNextBlock:22/:432`, `TRANSITION_PRESETS:13` | PA-5 (05-remaining) |
| `WagonTrain.tsx` | `MAX_SUB_BLOCK_LINES:10/:48/:150`, подблоки-логика | PA-1 (01-dock) |
| `BlockScenesModal.tsx` | `createSubBlocks + MAX_SUB_BLOCK_LINES:21/:264/:349` | PA-3 (03-show-pitch) |
| `StylesDeck.tsx` | `TRANSITION_PRESETS:8/:673` (UI выбора) | PA-5 |
| `data/transition-presets.ts` | `TransitionPreset` тип из transition-preset.types | — |

**Схема потока (критерий §3.3):** `lyrics/blocks/textStyle/loop stores → useSlotMatrix (6 reads, memo) → computeSlotMatrix (подблоки≤6 → слоты + ПС 2 уровня → offsetY по контенту) → RehearsalLyrics grid (minmax rows) → ПС-переходы по пресетам (5) → travel по measureNextBlock.containerHeight`.

---

*Этот документ — ЖИВОЙ: обновлять при волнах slot-системы. Сверка docs==code: формулы §3 = utils:50-95 дословно; инварианты §4 = тест-пруф 106/106. — 003 · Ш-конвой docs==code · 10.09*
