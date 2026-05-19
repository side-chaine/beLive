# beLive — Отчёт по интеграции Pitch в Dock

**Сессия:** 19 марта 2026  
**Куратор:** Соннет 4.6  
**Разработчик:** Никита  
**Статус на момент отчёта:** откат на TC-DOCK-PIANO-STATE (стабильная точка)

---

## 1. Контекст задачи

Исходная задача: вынести кнопки **Sync, Monitor и Pitch** из вкладки Tools в основную панель Dock Bar как самостоятельные toggle-кнопки.

Pitch — особый случай: это не lazy-render panel как Takes/Styles, а отдельный `position: fixed` overlay поверх экрана (PianoOverlay).

**Параллельное требование:** сохранить корректную работу плашки с текстом (RehearsalLyrics) и строчки Block Cue при всех состояниях Dock.

---

## 2. Архитектура до начала работ

### 2.1 Ключевые компоненты

| Компонент | Роль | Детали |
|-----------|------|--------|
| `ControlDeck` | Dock Bar | `z-index: 999995`, `position: fixed, bottom: 0` |
| `PianoOverlay` | Piano keyboard overlay | `z-index: 90→999996`, `fixed bottom: 0` |
| `TransportBar` | Прогресс-бар | `z-index: 999998`, `fixed bottom: 0, h: 20px` |
| `RehearsalLyrics` | Плашка с текстом | `z-index: 5`, `bottom: var(--bl-deck-height, 76px)` |
| `BlockCue` | Строчка следующего блока | `position: absolute, bottom: 8px→16px` внутри `.root` |
| `--bl-deck-height` | CSS переменная | Управляет позицией плашки снизу |

### 2.2 Оригинальная логика Pitch (в Tools)

```
1. Кнопка Pitch в ControlPanel (Tools) → togglePiano()
2. ControlDeck: if (pianoOpen) return null → размонтируется
3. PianoOverlay рендерится → ResizeObserver пишет --bl-deck-height = ~187px
4. Cleanup PianoOverlay: только ro.disconnect() — НЕТ removeProperty
5. Piano OFF → ControlDeck монтируется → ResizeObserver восстанавливает --bl-deck-height
```

Эта схема работала потому что **PianoOverlay владел `--bl-deck-height` пока был открыт.**

---

## 3. Проблемы и диагностика

### 3.1 Главный баг: плашка отваливается от Dock

При переносе Pitch в Dock: при активации Piano плашка переставала следовать за Dock.

**Диагностика через DevTools trap:**
```javascript
var orig = CSSStyleDeclaration.prototype.setProperty;
CSSStyleDeclaration.prototype.setProperty = function(p,v){
  if(p==='--bl-deck-height') console.trace('SET deck-height='+v);
  return orig.apply(this,arguments);
};
```

**Результат:** обнаружен race condition — ControlDeck ResizeObserver срабатывал **до** того как `pianoOpen` становился `true` в store.

### 3.2 Причины race condition

- `usePianoStore.getState().open` читался в ResizeObserver callback
- Store обновлялся асинхронно через React scheduler
- ResizeObserver мог сработать до обновления store → stale read
- Оба компонента писали в одну `--bl-deck-height` → конфликт

### 3.3 Проблема `return null`

Оригинальный ControlDeck: `if (pianoOpen) return null`.

При переносе Pitch в Dock возник порочный круг: кнопка Pitch находится в Dock, но при нажатии Dock исчезает (`return null`). Piano рендерился за Dock (z-index 90 < 999995).

### 3.4 Проблема z-index

```
ControlDeck:  z-index 999995
PianoOverlay: z-index 90 (изначально) → Piano ЗА Dock
Решение: поднять до 999996 → Piano ПОВЕРХ Dock ✅
```

### 3.5 Два fixed элемента в PianoOverlay

Диагностика показала что PianoOverlay содержит `TransportBar` (h:20, z:999998) как отдельный fixed child. Это создавало путаницу при измерении высоты.

```
Piano root (controls): top:0, h:48
Piano root (keyboard): top:625, h:187
TransportBar:          top:792, h:20
```

### 3.6 Двойное активное состояние кнопок

`activeTabId` из `deck.store` и `pianoOpen` из `piano.store` — независимы. При открытии Piano: `pianoOpen=true`, но `activeTabId` оставался `'rec'` → горели две кнопки одновременно.

### 3.7 Попытки с `--bl-piano-height`

Несколько TC пытались разделить переменные:
```css
bottom: calc(var(--bl-deck-height, 76px) + var(--bl-piano-height, 0px));
```
Это создало больше проблем — два компонента писали в разные переменные, но плашка всё равно прыгала из-за race condition в ControlDeck.

---

## 4. Принятые решения

### TC Timeline

| TC | Что сделано | Итог |
|----|-------------|------|
| TC-DOCK-11 | Убрать Mix и AI tabs | ✅ |
| TC-DOCK-12 | Sync/Monitor/Pitch через load() в modules.ts | ❌ Нестабильно — load() кэшируется |
| TC-DOCK-13 | Sync/Monitor/Pitch как прямые кнопки в ControlDeck | ✅ |
| TC-DOCK-14 | Gap слайдеров (left: 55%) | ✅ |
| TC-PITCH-FINAL | Убрать `return null` из ControlDeck | ✅ Ключевое |
| TC-PITCH-FINAL-2/9 | Guard через `pianoOpenRef` вместо store | ✅ Race condition fix |
| TC-PITCH-FINAL-3 | PianoOverlay z-index → 999996 | ✅ |
| TC-PITCH-FINAL-4 | Force update `--bl-deck-height` при закрытии Piano | ✅ |
| TC-PITCH-FINAL-12 | Убрать ResizeObserver из PianoOverlay | ✅ Ключевое |
| TC-PITCH-FINAL-13 | Collapse Dock скрывает Piano | ✅ |
| TC-DOCK-PIANO-STATE | `pianoWasOpen` флаг в deck.store | ✅ Стабильная точка |
| TC-DOCK-CLEANUP | `'__piano__'` sentinel + padding fix | ⚠️ Частично — конфликт при expanded |

### 4.1 Ref Bridge Pattern (главный fix race condition)

```typescript
const pianoOpenRef = useRef(false);

useEffect(() => {
  pianoOpenRef.current = pianoOpen;
}, [pianoOpen]);

// В ResizeObserver:
const ro = new ResizeObserver(([entry]) => {
  if (pianoOpenRef.current) return; // ref, не store
  document.documentElement.style.setProperty(
    '--bl-deck-height', `${entry.contentRect.height}px`
  );
});
```

Ref обновляется синхронно через useEffect — гарантированно до того как ResizeObserver сработает.

### 4.2 PianoOverlay не трогает `--bl-deck-height`

Финальное решение: **убрать ResizeObserver из PianoOverlay полностью.**

```
Плашка bottom = высота ControlDeck tabs bar (~38px collapsed)
Piano keyboard рисуется поверх через z-index (999996 > 999995)
Плашка стабильна — не знает о Piano
```

### 4.3 Force update при закрытии Piano

```typescript
useEffect(() => {
  if (pianoOpen) return;
  const el = rootRef.current;
  if (!el) return;
  document.documentElement.style.setProperty(
    '--bl-deck-height', `${el.getBoundingClientRect().height}px`
  );
}, [pianoOpen]);
```

### 4.4 pianoWasOpen — память о состоянии Piano

```typescript
// deck.store.ts
pianoWasOpen: false,
setPianoWasOpen: (v) => set({ pianoWasOpen: v }),

// ControlDeck toggle logic:
if (expanded) {
  if (pianoOpen) {
    setPianoWasOpen(true);
    usePianoStore.getState().togglePiano();
  }
  toggle(); // свернуть
} else {
  toggle(); // развернуть
  if (pianoWasOpen) {
    setPianoWasOpen(false);
    usePianoStore.getState().togglePiano(); // вернуть Piano
  }
}
```

### 4.5 Block Cue

```css
/* было: bottom: 8px */
.blockCue {
  bottom: 16px; /* +8px отступ для видимости над нижними элементами */
}
```

---

## 5. Что сработало / что мешало

### Сработало
- **DevTools trap** на CSS setProperty — нашёл виновника за 10 секунд
- **Принцип одного владельца переменной** — ControlDeck владеет `--bl-deck-height`, никто другой не пишет в неё
- **Откаты к стабильной точке** вместо накопления патчей
- **Реконн перед каждым TC** — понимание текущего состояния → точный fix

### Мешало
- **Накопленный мусор от TC**: `calc()`, `--bl-piano-height`, `lastValidHeight`, хардкод `57px` — пришлось откатывать
- **TransportBar внутри PianoOverlay** как fixed child — неочевидная архитектура, ломала измерения высоты
- **`return null` в ControlDeck** — корень многих проблем при переносе Pitch в Dock
- **Два независимых store** (`deck.store` + `piano.store`) без координации
- **`padding-bottom: 20px`** в ControlDeck.module.css — вызывал прыжок плашки при toggle вкладок

---

## 6. Открытые вопросы для Архитектора

### 6.1 Piano + Dock Expanded конфликт (главный)

При `expanded=true` и `pianoOpen=true` — Dock panel перекрывает Piano keyboard.

**Варианты решения:**
1. Auto-collapse Dock при открытии Piano (TC написан — TC-PITCH-COLLAPSE, но не применён)
2. Рендерить Piano только когда Dock collapsed
3. Переосмыслить Pitch как режим внутри Dock (не overlay) — самый чистый вариант архитектурно

### 6.2 Monitor → Dock panel

Monitor сейчас — модалка. Следующая задача: перенести в Dock как panel (как Takes/Styles). Это устранит конфликт с Piano и даст единообразный UX.

### 6.3 Tools tab

Вкладка Tools содержит старые кнопки (Monitor, Pitch, Blocks, Sync). После финализации — убрать. Сейчас оставлена для безопасного отката.

### 6.4 Высота режимов Dock

Разные режимы имеют разную высоту панели. Желаемое: единая высота = референс Sync. Нужен TC на стандартизацию.

---

## 7. Финальное состояние (TC-DOCK-PIANO-STATE)

```
✅ Pitch, Sync, Monitor — кнопки в Dock bar
✅ Pitch подсвечивается при открытии Piano (pianoOpen → data-active)
✅ Collapse Dock → Piano скрывается
✅ Expand Dock → Piano восстанавливается (pianoWasOpen флаг)
✅ Block Cue видна в нормальном состоянии (bottom: 16px)
✅ Плашка стабильна при переключении вкладок
✅ Race condition устранён (pianoOpenRef)
✅ PianoOverlay z-index 999996 > ControlDeck 999995

⚠️ Piano + Dock Expanded → нерешённый конфликт
⚠️ Double active state при '--piano--' sentinel (частично)
```

### Ключевые файлы

| Файл | Изменения |
|------|-----------|
| `src/components/ControlDeck.tsx` | Кнопки Sync/Monitor/Pitch, pianoOpenRef guard, force update effect, pianoWasOpen logic |
| `src/components/ControlDeck.module.css` | padding-bottom: 0 (убран 20px) |
| `src/components/PianoOverlay.tsx` | z-index: 999996, ResizeObserver убран |
| `src/components/RehearsalLyrics.module.css` | blockCue bottom: 16px |
| `src/stores/deck.store.ts` | pianoWasOpen + setPianoWasOpen |

---

## 8. Рекомендации (FROZEN / TODO)

```
FROZEN:
  - PianoOverlay НЕ пишет в --bl-deck-height
  - ControlDeck ResizeObserver с pianoOpenRef guard
  - return null убран из ControlDeck
  - PianoOverlay z-index: 999996

TODO для Архитектора:
  - Решить Piano + Dock Expanded архитектурно
  - Monitor → Dock panel (убрать модалку)
  - Tools tab → удалить
  - Стандартизировать высоту всех режимов Dock
```

---

*beLive — каждый трек = своя музыкальная среда.*
