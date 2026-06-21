// ═══════════════════════════════════════════════════
// SLOT MATRIX TYPES
// beLive Slot Matrix System — Foundation Types
// ═══════════════════════════════════════════════════

/** Адресуемая часть содержимого слота (lead / back вокал) */
export interface SlotPart {
  /** ID внутри слота: "verse-1-0-2-back-0" */
  id: string;
  /** Семантическая роль: lead = основной вокал, back = бэк-вокал (скобки) */
  type: 'lead' | 'back';
  /** Текст части */
  text: string;
  /** Текст в скобках */
  bracketed: boolean;
  /** Переопределение цвета (для бэк-вокала, пока undefined) */
  colorOverride?: string;
}

/**
 * Состояние слота для квестовой системы.
 * @architectural Reservation for Quest System (Phase 4, not yet implemented).
 *    See docs/architecture/slot-matrix-system-v2.2.md §11.
 *    Do NOT remove — part of frozen Slot contract (slot-matrix v2.2).
 *    Not yet read/written at runtime; will be activated by quest engine.
 */
export type QuestSlotState = 
  | 'visible'     // обычное отображение
  | 'hidden'      // скрыт (квест "исчезающие строки")
  | 'highlighted' // подсвечен (подсказка в квесте)
  | 'dimmed'      // приглушён (квест "fill-in")
  | 'blurred'     // размыт (вариант fill-in — форма видна, текст нет)
  | 'locked'      // заблокирован (пользовательский квест — нельзя менять)
  | 'completed';  // пройденный шаг (визуальная обратная связь)

/** Визуальная группа слотов — основная единица рендера на канве.
 *  Обёртывает SubBlockRange + добавляет визуальные данные.
 *  1 SubBlockRange → 1 SlotGroup (всегда). */
export interface SlotGroup {
  /** ID: "group-{blockId}-{subBlockIndex}" */
  id: string;
  /** ID родительского блока */
  blockId: string;
  /** Индекс подблока внутри блока */
  subBlockIndex: number;

  // ═══ Контент ═══
  /** Контент-слоты группы (БЕЗ ПС) */
  slots: Slot[];
  /** ПС слот (отдельно, для гибкости рендера) */
  previewSlot: Slot | null;
  /** Логический подблок (обёрнутый) */
  subBlock: SubBlockRange;

  // ═══ Визуальные данные ═══
  /** Font size для группы ("2.6rem") */
  fontSize: string;
  /** Тип блока ("verse", "chorus" и т.д.) */
  blockType: string;
  /** Цвет блока (HEX: "#4CAF50") */
  blockColor: string;
  /** CSS Grid template rows */
  gridTemplateRows: string;
  /** Высота контента БЕЗ ПС (px) */
  contentHeight: number;
  /** Общая высота С ПС (px) */
  totalHeight: number;
  /** Индекс активного слота (-1 если нет) */
  activeSlotIndex: number;

  // ═══ Позиционирование (Phase 3.3+: канва) ═══
  /** Это preview группа? (ПС следующего блока) */
  isPreview: boolean;
  /** Активная группа (содержит activeLineIndex)? */
  isActive: boolean;
  /** X позиция в канве (px). Phase 3.3+ */
  x: number;
  /** Y позиция в канве (px). Phase 3.3+ */
  y: number;
  /** Ширина группы (px). Phase 3.3+ */
  width: number;
  /** Высота группы (px) = totalHeight */
  height: number;
  /** Opacity группы: 1.0 = active, 0.3 = preview idle, 0.95 = preview grow */
  opacity: number;
}

/** Полноэкранная канва слотов.
 *  Вычисляет позиции и размеры всех групп слотов
 *  для абсолютного позиционирования в .root canvas.
 *  Phase 3.5+: используется когда layoutMode='full-area'. */
export interface SlotCanvas {
  /** Ключ мемоизации: "group-id-zoom-WxH" */
  key: string;
  /** Все видимые группы (active + preview) */
  groups: SlotGroup[];
  /** Viewport ширина (px) — из DOM ResizeObserver */
  viewportWidth: number;
  /** Viewport высота: header → dock (px) — из DOM ResizeObserver */
  viewportHeight: number;
  /** Масштаб (1.0 = normal, 0.5 = half, 2.0 = double) */
  zoom: number;
  /** Режим расположения */
  layoutMode: LayoutMode;
}

/** Метаданные квеста для слота.
 * @architectural Phase 4 reservation. See slot-matrix-system-v2.2.md §11. */
export interface QuestSlotMeta {
  /** Порядок скрытия в квесте (1=первый скрыть) */
  hideOrder?: number;
  /** Сложность fill-in: 1=лёгкий, 5=хардкор */
  fillDifficulty?: number;
  /** ID квеста которому принадлежит */
  questId?: string;
  /** Пользовательский квест? */
  isUserCreated?: boolean;
  /** Правило раскрытия слота */
  revealRule?: 'always' | 'after-step' | 'on-approach' | 'on-first-play';
  /** Раскрыть после шага N (только для revealRule='after-step') */
  revealAfterStep?: number;
}

/** Точка разрыва для умного переноса слов */
export interface WordBreakPoint {
  /** Индекс символа в тексте где допустим разрыв */
  charIndex: number;
  /** Приоритет разрыва: 1=пробел (лучший), 2=дефис, 3=знак препинания */
  priority: number;
  /** Языковое правило (true) vs базовое (false) */
  isLanguageRule: boolean;
}

/** Один слот = одна строка в матрице */
export interface Slot {
  /** Уникальный ID: "verse-1-0-2" = {blockId}-{subBlockIndex}-{slotIndex} */
  id: string;
  /** ID блока: "verse-1" */
  blockId: string;
  /** Индекс подблока внутри блока */
  subBlockIndex: number;
  /** Индекс слота внутри подблока */
  slotIndex: number;
  /** Индекс в lyrics.lines[] */
  lineIndex: number;
  /** Полный текст строки */
  text: string;
  /** Разобранные части (lead + back вокал) */
  parts: SlotPart[];
  /** Y позиция внутри контейнера (px) */
  y: number;
  /** Высота строки БЕЗ gap (px) */
  height: number;
  /** Пустой слот */
  isEmpty: boolean;
  /** Слот предпросмотра (ПС) */
  isPreview: boolean;
  /** Тип следующего блока (для ПС) */
  previewBlockType?: string;
  /** HEX цвет следующего блока (для ПС) */
  previewBlockColor?: string;
  /** @architectural Phase 4 reservation. See QuestSlotState. */
  questState?: QuestSlotState;
  /** Граница loop — начало */
  isLoopStart?: boolean;
  /** Граница loop — конец */
  isLoopEnd?: boolean;
  /** @architectural Phase 4 reservation. See QuestSlotMeta. */
  questMeta?: QuestSlotMeta;
  /** Точки разрыва для умного переноса (заполняется computeBreakPoints) */
  wordBreakPoints?: WordBreakPoint[];
  /** Первая строка следующего подблока того же блока 
   *  (для sub-block preview в Phase 3) */
  nextSubBlockFirstLine?: number;
}

/** Подблок = непрерывная группа слотов внутри блока */
export interface SubBlockRange {
  /** ID: "verse-1-0" */
  id: string;
  /** ID родительского блока */
  blockId: string;
  /** Индекс подблока */
  subBlockIndex: number;
  /** Начальный slotIndex */
  startSlotIndex: number;
  /** Конечный slotIndex */
  endSlotIndex: number;
  /** Первый подблок в блоке */
  isFirst: boolean;
  /** Последний подблок в блоке */
  isLast: boolean;
  /** Line indices этого подблока (из createSubBlocks).
   *  Нужен для:
   *  - Вычисления previewSlot от следующего подблока
   *  - Поиска marker time для следующего подблока
   *  - Создания виртуального TextBlock для shadow measurement */
  lineIndices: number[];
}

/** Режим расположения */
export type LayoutMode = 'plate' | 'full-area';

/** Полная матрица слотов */
export interface SlotMatrix {
  /** Ключ мемоизации */
  key: string;
  /** Все слоты (включая ПС) */
  slots: Slot[];
  /** Чистая высота строки БЕЗ gap (px) */
  lineHeight: number;
  /** Расстояние между слотами (px) */
  gapPx: number;
  /** Шаг Y = lineHeight + gapPx */
  slotStep: number;
  /** Высота контента БЕЗ ПС (px) */
  contentHeight: number;
  /** Общая высота матрицы (px) */
  totalHeight: number;
  /** Индекс активного слота */
  activeSlotIndex: number;
  /** Индекс ПС слота (-1 если нет) */
  previewSlotIndex: number;
  /** Смещение для центрирования активной строки (px) */
  offsetY: number;
  /** Режим расположения */
  layoutMode: LayoutMode;
  /** Расстояние между контентом и ПС (px) */
  interBlockGap: number;
  /** Подблоки */
  subBlocks: SubBlockRange[];
  /** Активный подблок */
  activeSubBlock: SubBlockRange | null;
}
