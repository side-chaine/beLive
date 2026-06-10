# Dock Standard — Спецификация дока beLive

**Version:** 1.0  
**Date:** 2026-04-27  
**Authors:** Центр15 + Agent 007  
**Status:** Implemented (Waves 1-7 complete)

---

## 1. Архитектурный принцип

beLive док следует **DAW-паттерну** (Bitwig/Ableton):

- **Фиксированная высота** — док не прыгает при переключении вкладок
- **Единый контейнер** — родитель `.panel` = единственный источник истины для геометрии
- **Резиновые вкладки** — дочерние панели заполняют контейнер, не задают свою высоту
- **Контент скроллится** — если не влезает, появляется scroll (не resize дока)

---

## 2. Геометрия дока

### 2.1 CSS Variables (index.html, style#dock-standard-tokens)

```css
:root {
  --bl-deck-height-expanded: 300px;   /* Full dock height */
  --bl-deck-height-collapsed: 48px;   /* Tab bar only */
  --bl-deck-tabs: 40px;              /* Tab header height */
  --bl-deck-panel: 240px;            /* Content area height */
  --bl-deck-panel-pad: 8px 16px;     /* Content area padding */
  --bl-deck-transport: 20px;         /* Transport bar height */
}
```

### 2.2 Layout структура

```
┌──────────────────────────────────────────────────────┐
│ .root (position: fixed, bottom: 0, z-index: 999995) │
│ height: var(--bl-deck-height-expanded, 300px)       │
│                                                      │
│  ┌─ .tabs ──────── var(--bl-deck-tabs, 40px) ──────┐│
│  │  CoverArt | Tabs | Sliders | Buttons | Collapse  ││
│  └───────────────────────────────────────────────────┘│
│  ┌─ .panel ─────── var(--bl-deck-panel, 240px) ────┐│
│  │  padding: var(--bl-deck-panel-pad, 8px 16px)    ││
│  │  overflow-y: auto                                ││
│  │  [ActiveModule — резиновая вкладка]              ││
│  └───────────────────────────────────────────────────┘│
│  ┌─ TransportBar ── var(--bl-deck-transport, 20px) ─┐│
│  │  Progress bar + time (В ПОТОКЕ, не fixed!)       ││
│  └───────────────────────────────────────────────────┘│
│                                                      │
│  TOTAL: 40 + 240 + 20 = 300px                       │
└──────────────────────────────────────────────────────┘
```

### 2.3 Динамический --bl-deck-height

ResizeObserver в ControlDeck.tsx обновляет `--bl-deck-height` на `<html>` при:
- Expand/collapse дока
- Изменении размера окна

Внешние потребители используют `--bl-deck-height` для позиционирования:
- `RehearsalLyrics` — `bottom: var(--bl-deck-height, 76px)`
- `InstrumentOverlay` — `bottom: var(--bl-deck-height, 76px)`
- `CatalogPanel` — `bottom: var(--bl-deck-height, 76px)`
- `SyncLyrics` — `bottom: var(--bl-deck-height, 300px)`
- `PianoOverlay` — `bottom: var(--bl-deck-height, 300px)`

---

## 3. Стандарт контейнера вкладки

### 3.1 Родитель (.panel)

`.panel` — единственный источник истины для геометрии:
- `height: var(--bl-deck-panel, 240px)` — фиксированная
- `padding: var(--bl-deck-panel-pad, 8px 16px)` — единый gutter
- `overflow-y: auto` — скролл если контент не влезает

### 3.2 Дочерняя вкладка (обязательный паттерн)

```css
.root {
  display: flex;
  flex-direction: column;
  height: 100%;        /* Заполняет родителя */
  min-height: 0;       /* Flexbox safemode */
  padding: 0;          /* Родитель уже даёт padding */
}
```

### 3.3 Верифицированные вкладки

| Вкладка | Паттерн | padding | height | Статус |
|---------|---------|---------|--------|--------|
| MixerPanel (Studio) | Резиновая | 0 | 100% | ✅ Visual sub-mode |
| TakesPanel (Quest) | Резиновая (inline) | 0 | 100% | ✅ |
| RecordingPanel | Резиновая | 0 | 100% | ✅ | ⚠️ DEAD CODE — not registered in modules.ts, not imported anywhere |
| MonitorMixPanel (Split) | Резиновая | 0 | 100% | ✅ |
| StylesDeck | Резиновая | 0 | 100% | ✅ |
| PitchTab (Notes) | Резиновая | 0 | 100% | ✅ |

---

## 4. TransportBar

### 4.1 Архитектура

TransportBar = **часть flex column дока**, НЕ position: fixed.

- `height: 20px` — фиксированная
- `flexShrink: 0` — не сжимается
- Рендерится внутри `.root` после `.panel`

### 4.2 Единственность

TransportBar рендерится **ТОЛЬКО** в ControlDeck. PianoOverlay НЕ имеет собственного TransportBar.

### 4.3 Z-index стек

| Компонент | z-index | Позиция |
|-----------|---------|---------|
| ControlDeck .root | 999995 | fixed, bottom: 0 |
| PianoOverlay | 999996 | fixed, above dock |
| TransportBar | (наследуется от .root) | В потоке |

---

## 5. PianoOverlay

PianoOverlay позиционируется **НАД доком**, не НА доке:

```css
PianoOverlay.root {
  position: fixed;
  bottom: var(--bl-deck-height, 300px);
  /* Растёт вверх от верхней границы дока */
}
```

---

## 5.1 Visual Sub-mode (MixerPanel)

Visual = **локальный под-режим MixerPanel**, не отдельная вкладка дока.

**Архитектура:**
- Кнопка Visual в `mixerToolbar` рядом со кнопкой Stems
- Visual активен только когда `stemsEnabled=true`
- `useState(false)` — local state, не deckStore
- Когда Visual активен: рендерится `<InstrumentStrip />` (карточки с FX)
- Когда Visual выключен: рендерятся `<ChannelStrip />` (faders + meters)

**CSS:**
- `.visualToggle` — стиль кнопки (аналог `.stemsToggle`)
- `.visualActive` — фиолетовый акцент (`#9b59b6`)
- `instrument-card.css` — tier gating + recording clamp для карточек

**Поведение:**
- Stems OFF → Visual кнопка серая (opacity 0.4, not-allowed)
- Stems ON → Visual кнопка активна (клик переключает режим)
- Visual ON → InstrumentStrip с waveform canvas + volume drag + M/S buttons
- Visual OFF → ChannelStrip с faders + VU meters + M/S buttons

---

## 5.2 Sync Button — Technical Section

Sync = **технический раздел**, позиция в правом углу док-бара.

**Архитектура:**
- НЕ модуль (не в modules.ts) — hardcoded кнопка в ControlDeck
- Позиция: перед collapse toggle (▾), в правой части `.tabs`
- Открывает SyncEditorPanel (не dock tab)
- Использует `syncOpen` state (не `activeTabId`)

**Логика:**
```tsx
<button
  className={styles.tab}
  data-active={syncOpen ? 'true' : 'false'}
  onClick={() => {
    interruptPracticeSession(() => {
      useDeckStore.getState().setTab('');
      if (syncOpen) requestCloseSync();
      else requestOpenSync();
    });
  }}
  title='Sync'
>
  Sync
</button>
```

**Поведение:**
- Клик Sync → открывает SyncEditorPanel (overlay)
- Клик Sync ещё раз → закрывает SyncEditorPanel
- Sync НЕ влияет на activeTabId (dock tabs)

---

## 6. Lazy Decode для Waveform

### 6.1 Проблема

skipDecode=true оптимизация (TC-DEC-01) ускоряет загрузку трека (3.5s → 0.5s), но оставляет `stem.audioBuffer = null`. TakesCanvas требует AudioBuffer для рендера волны.

### 6.2 Решение

Lazy decode — декодировать буфер только при открытии вкладки Takes:

```
StemPlayer.ensureAudioBuffer()
  → Если buffer есть → вернуть сразу (кешировано)
  → Если null → fetch(cleanBlobUrl) → decodeAudioData → кешировать → вернуть
```

### 6.3 API

| Метод | Файл | Назначение |
|-------|------|------------|
| `StemPlayer.ensureAudioBuffer()` | StemPlayer.ts | Lazy decode для любого stem |
| `AudioEngineV2.ensureInstrumentalBuffer()` | AudioEngineV2.ts | Делегирует instrumental stem |
| `AudioEngineV2.ensureVocalsBuffer()` | AudioEngineV2.ts | Делегирует vocals stem |
| `v1.ensureInstrumentalBuffer` | patchV1.ts | Экспорт на V1 shell |
| `v1.ensureVocalsBuffer` | patchV1.ts | Экспорт на V1 shell |

### 6.4 Потребитель (TakesPanel)

```typescript
// instrumentalBuffer — useState + useEffect с async fallback
const [instrumentalBuffer, setInstrumentalBuffer] = useState<AudioBuffer | null>(null);
useEffect(() => {
  const existing = ae?.getAudioBuffer?.() ?? null;
  if (existing) { setInstrumentalBuffer(existing); return; }
  ae?.ensureInstrumentalBuffer?.()?.then(buf => {
    if (!cancelled && buf) setInstrumentalBuffer(buf);
  });
}, [duration]);

// vocalBuffer — аналогичный паттерн
const [vocalBuffer, setVocalBuffer] = useState<AudioBuffer | null>(null);
useEffect(() => {
  const existing = ae?.getVocalAudioBuffer?.() ?? null;
  if (existing) { setVocalBuffer(existing); return; }
  ae?.ensureVocalsBuffer?.()?.then(buf => {
    if (!cancelled && buf) setVocalBuffer(buf);
  });
}, [duration]);
```

---

## 7. TakesCanvas Geometry

### 7.1 Canvas height formula

```typescript
const containerHeight = entry.contentRect.height;
const padding = 8;
// ExerciseStrip + TakesControlStrip are absolute positioned — don't consume flow space
const available = containerHeight - padding;
setCanvasHeight(Math.max(120, available));
```

### 7.2 Why absolute elements are NOT subtracted

| Элемент | Позиция | В потоке? | Вычитается? |
|---------|---------|-----------|-------------|
| ExerciseStrip | `absolute, top: 0, height: 28` | Нет | Нет |
| TakesControlStrip | `absolute, bottom: 48` | Нет | Нет |
| Live trail canvas | `absolute, inset: 0` | Нет | Нет |

Canvas заполняет всю панель. Absolute элементы накладываются поверх.

### 7.3 I/V/M режимы

| Режим | Цвет волны | Что показывается |
|-------|-----------|------------------|
| I (Instrumental) | Красный `rgba(210,85,85,0.5)` | Instrumental peaks |
| V (Vocals) | Синий `rgba(79,139,255,0.55)` | Vocal peaks |
| M (Mix) | Оба цвета (пониженная прозрачность) | Instrumental + Vocal peaks |

---

## 8. Waveform Styling System

### 8.1 Текущее состояние

| Компонент | Система стилей | Статус |
|-----------|---------------|--------|
| TakesCanvas (static) | Hardcoded rgba цвета | Future: canvas-colors.ts |
| I/V/M кнопки | Hardcoded цвета | Future: синхронизировать |
| Live Trail (recording) | Tier-based skins (waveform-skins.ts) | ✅ Работает |

### 8.2 Live Trail Skins

```typescript
interface LiveTrailSkin {
  color: string;     // '#ffa500' (orange)
  opacity: number;   // 0.70 - 0.95
  barGap: number;    // 0-1px
  glow: {            // Optional
    color: string;
    blur: number;    // 4-6px
  } | null;
}
```

| Tier | Opacity | Glow |
|------|---------|------|
| lite | 0.70 | None |
| balanced | 0.85 | None |
| max | 0.90 | 4px |
| ultra | 0.95 | 6px |

---

## 9. Контракт данных (от Оптимуса)

### 9.1 Принцип разделения

```
ВСТРОЕННЫЕ ВКЛАДКИ:
  → Читают Zustand stores напрямую
  → Знают о типах stores
  → React-рендеринг

ПЛАГИННЫЕ ВКЛАДКИ (будущее):
  → Читают данные ТОЛЬКО через PluginAPI (postMessage)
  → НЕ знают о Zustand stores
  → iframe-рендеринг

ЭТО ГРАНИЦА. НЕ РАЗМЫВАТЬ.
```

---

## 10. Модалка (VST-паттерн) — будущее

Expand из дока в VST-подобное окно произвольного размера:
- Модалка = отдельный window/overlay
- Размер = не ограничен доком
- Закрытие = возврат в док

---

## 11. Стандартные контролы — будущее

| Контрол | Назначение | Заменяет |
|---------|-----------|----------|
| DockSlider | Native `<input type="range">` + CSS styling | Custom div sliders в ControlDeck |
| DockToggle | Button с `data-active` | Inline toggle кнопки |
| DockMeter | Div-based progress bar | Inline meter implementations |
| DockButton | Standard button, theme-aware | Inline styled buttons |

---

## 12. Wire Map — Кто какие переменные читает/пишет

| Variable | Writer | Readers |
|----------|--------|---------|
| `--bl-deck-height` | ControlDeck ResizeObserver | RehearsalLyrics, CatalogPanel, SyncLyrics, PianoOverlay |
| `--bl-deck-height-expanded` | index.html (:root) | ControlDeck (intent) |
| `--bl-deck-height-collapsed` | index.html (:root) | ControlDeck (intent) |
| `--bl-deck-tabs` | index.html (:root) | .tabs |
| `--bl-deck-panel` | index.html (:root) | .panel |
| `--bl-deck-panel-pad` | index.html (:root) | .panel |
| `--bl-deck-transport` | index.html (:root) | TransportBar |

---

## 13. Список изменений (TC Log)

| TC | Wave | Файл | Суть |
|----|------|------|------|
| DS-01 | 1 | index.html | CSS variables foundation |
| DS-02 | 2 | TransportBar.tsx | Убрать position: fixed, flexShrink: 0 |
| DS-03 | 2 | PianoOverlay.tsx | Убрать дубль TransportBar, bottom: var(--bl-deck-height) |
| DS-04 | 2 | ControlDeck.module.css | Убрать padding-bottom: 20px |
| DS-05 | 3 | ControlDeck.module.css | .panel фиксированная высота через CSS var |
| DS-06 | 3 | ControlDeck.module.css | .tabs фиксированная высота 40px |
| DS-07 | 4 | MixerPanel.module.css | height: 100%, min-height: 0, padding: 0 |
| DS-08 | 4 | RecordingPanel.module.css | height: 100%, min-height: 0, padding: 0 |
| DS-08-FIX-1 | 5 | StemPlayer.ts | ensureAudioBuffer() lazy decode |
| DS-08-FIX-2 | 5 | AudioEngineV2.ts | ensureInstrumentalBuffer() delegate |
| DS-08-FIX-3 | 5 | patchV1.ts | Export ensureInstrumentalBuffer |
| DS-08-FIX-4 | 5 | TakesPanel.tsx | instrumentalBuffer useState+useEffect |
| DS-08-FIX-5 | 5 | TakesPanel.tsx | canvasHeight formula fix (absolute elements) |
| DS-08-FIX-7A | 6 | AudioEngineV2.ts | ensureVocalsBuffer() delegate |
| DS-08-FIX-7B | 6 | patchV1.ts | Export ensureVocalsBuffer |
| DS-08-FIX-7C | 6 | TakesPanel.tsx | vocalBuffer useState+useEffect |
| DS-12 | 7 | dock-standard.md | Эта документация |
| PITCH-01 | Dock Standard | modules.ts | Register Pitch module (migrated from PianoOverlay) |
| PITCH-02 | Dock Standard | PitchTab.tsx | Create PitchTab component (rubber height pattern) |
| PITCH-03 | Dock Standard | ControlDeck.tsx | Remove PianoOverlay integration |
| PITCH-04 | Dock Standard | piano.store.ts | Remove unused piano state |
| PITCH-05 | Dock Standard | ControlDeck.module.css | Remove PianoOverlay CSS |
| PITCH-06 | Dock Standard | App.tsx | Remove PianoOverlay import |
| PITCH-07 | Dock Standard | ControlDeck.tsx | Remove hardcoded Pitch button (duplicate) |
| RENAME-PITCH | Dock Standard | modules.ts + dock-standard.md | Rename label: Pitch → Notes (user clarity) |
| VIS-01 | Dock Standard | modules.ts | Register Visual module (REVERTED in VIS-08) |
| VIS-02 | Dock Standard | VisualTab.tsx | Create VisualTab component (DELETED in VIS-08) |
| VIS-07 | Dock Standard | ControlDeck.tsx | Remove Visual/DAW buttons from dock bar |
| VIS-08 | Dock Standard | modules.ts + VisualTab.tsx | Unregister Visual module, delete VisualTab |
| VIS-09 | Dock Standard | MixerPanel.tsx | Add Visual button + conditional rendering (local state) |
| VIS-10 | Dock Standard | MixerPanel.module.css | Add Visual toggle CSS styles |
| VIS-11 | Dock Standard | deck.store.ts | Remove visualMode state (DEFERRED) |
| VIS-12 | Dock Standard | InstrumentOverlay* | Delete dead code (DEFERRED) |
| FINAL-01 | Dock Standard | modules.ts | Rename labels: Takes→Quest, Mixer→Studio |
| FINAL-02 | Dock Standard | ControlDeck.tsx | Move Sync button to right corner (before collapse toggle) |
| FINAL-03 | Dock Standard | ControlDeck.tsx | Remove dead TC-PITCH-07 comment |
| FINAL-04 | Dock Standard | dock-standard.md | Update docs: table, Wire Map, TC Log, Visual/Sync sections |
| MODE-EXPAND-01 | Dock Standard | modules.ts | Enable Studio/Quest in karaoke+concert modes (consistent UX) |

---

## 14. Future Work

| Приоритет | Задача | Описание |
|-----------|--------|----------|
| P1 | Theme tokens для deck | Добавить deck domain в component tokens |
| P1 | DockSlider компонент | Заменить 193 строки custom div sliders |
| P2 | Canvas colors config | Вынести hardcoded цвета в canvas-colors.ts |
| P2 | I/V/M button sync | Синхронизировать с canvas-colors.ts |
| P2 | Takes CSS module | Перенести inline стили в CSS module |
| P3 | Plugin API | PluginAPI для плагинных вкладок |
| P3 | Modal expand | VST-подобная модалка из дока |

---

*Dock Standard v1.0 — beLive Architecture Team*
