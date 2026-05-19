import type { TextBlock } from '../stores/blocks.store';

/** Find block containing given line index */
export function getActiveBlock(
  lineIndex: number,
  blocks: TextBlock[]
): TextBlock | null {
  if (lineIndex < 0 || !blocks.length) return null;
  const exact = blocks.find(b => b.lineIndices.includes(lineIndex));
  if (exact) return exact;
  let best: TextBlock | null = null;
  let bestMax = -Infinity;
  for (const b of blocks) {
    const maxLine = Math.max(...b.lineIndices);
    if (maxLine < lineIndex && maxLine > bestMax) {
      bestMax = maxLine;
      best = b;
    }
  }
  return best;
}

/** Find next block after current */
export function getNextBlock(
  current: TextBlock | null,
  blocks: TextBlock[]
): TextBlock | null {
  if (!current || !blocks.length) return null;
  const idx = blocks.findIndex(b => b.id === current.id);
  return idx >= 0 && idx < blocks.length - 1 ? blocks[idx + 1] : null;
}

/** Dynamic font size based on line count in block */
export function getBlockFontSize(lineCount: number): string {
  if (lineCount <= 2) return '3.2rem';
  if (lineCount <= 4) return '2.6rem';
  if (lineCount <= 6) return '2.0rem';
  if (lineCount <= 8) return '1.6rem';
  return '1.3rem';
}

/**
 * Sub-block representation for visual segmentation of large lyric blocks.
 * Computed on-the-fly — never persisted to IDB.
 */
export interface SubBlock {
  id: string;             // "sub-0", "sub-1", ...
  lineIndices: number[];  // subset of parent block lineIndices
  isFirst: boolean;       // первый подблок в блоке?
  isLast: boolean;        // последний подблок в блоке?
}

// ═══════════════════════════════════════════════════
// ECHO-DETECTION: КОНСТАНТЫ
// ═══════════════════════════════════════════════════

/** Зона обнаружения echo (0-indexed): строки 3-6 */
const ECHO_ZONE_START = 2;
const ECHO_ZONE_END = 5;

/** Минимум совпадающих значимых слов для признания echo */
const MIN_SIGNIFICANT_WORDS_MATCH = 2;

/** Минимальный gap (строк между) для отличия паттерна от хука */
const MIN_PATTERN_GAP = 2;

/** Максимальный сдвиг от базового квадратного деления */
const MAX_SHIFT_FROM_BASE = 2;

/** Минимальный размер подблока (строк) */
const MIN_SUBBLOCK_LINES = 2;

/** Минимальная длина значимого слова (языково-независимо) */
const MIN_WORD_LENGTH = 3;

/** Порог частотности для локального стоп-листа (>40% строк) */
const FREQ_THRESHOLD = 0.4;

/** Максимальное увеличение прыжка font size при корректировке */
const MAX_FONT_JUMP_DELTA = 0.65;

/** Pre-compiled regex для очистки пунктуации */
const PUNCTUATION_RE = /[^\p{L}\p{N}\s]/gu;

// ═══════════════════════════════════════════════════
// ECHO-DETECTION: УТИЛИТЫ
// ═══════════════════════════════════════════════════

/**
 * Очистка текста: нижний регистр + убрать пунктуацию + апострофы
 * "I don't know" → "i dont know"
 */
function normalizeText(text: string): string {
  return text.toLowerCase().replace(/'/g, '').replace(PUNCTUATION_RE, '').trim();
}

/**
 * Локальный стоп-лист: слова, которые встречаются в >40% строк блока.
 * Защищает от ложных срабатываний на припевах типа "Love, love, love..."
 */
function computeLocalStopWords(
  lineIndices: number[],
  lines: string[]
): Set<string> {
  const wordCounts: Record<string, number> = {};
  const totalLines = lineIndices.length;

  for (const idx of lineIndices) {
    const normalized = normalizeText(lines[idx] ?? '');
    const uniqueInLine = new Set(
      normalized.split(/\s+/).filter(w => w.length >= MIN_WORD_LENGTH)
    );
    for (const w of uniqueInLine) {
      wordCounts[w] = (wordCounts[w] || 0) + 1;
    }
  }

  const stopWords = new Set<string>();
  const threshold = totalLines * FREQ_THRESHOLD;

  for (const [word, count] of Object.entries(wordCounts)) {
    if (count >= threshold) stopWords.add(word);
  }

  return stopWords;
}

/**
 * Извлечение fingerprint: первые 2 значимых слова строки.
 * "I don't know what's worth fighting for" → ["dont", "know"]
 * "Мама, я сходил с ума" → ["мама", "сходил"]
 */
function extractFingerprint(
  text: string,
  localStopWords: Set<string>
): string[] {
  const normalized = normalizeText(text);
  const words = normalized.split(/\s+/);
  const significant: string[] = [];

  for (const word of words) {
    if (word.length >= MIN_WORD_LENGTH && !localStopWords.has(word)) {
      significant.push(word);
      if (significant.length >= 2) break;
    }
  }

  return significant;
}

/**
 * Базовая точка разрыва из computeBalancedSplit
 */
function getBaseBreakIndex(totalLines: number): number {
  const splits: Record<number, number> = {
    6: 3,
    7: 3,
    8: 4,
    9: 4,
    10: 4,
    11: 4,
    12: 4,
    13: 4,
    14: 4,
    15: 5,
  };
  return splits[totalLines] ?? Math.floor(totalLines / 2);
}

/**
 * Числовое значение font size (для сравнения прыжков)
 */
function getBlockFontSizeNumeric(lineCount: number): number {
  if (lineCount <= 2) return 3.2;
  if (lineCount <= 4) return 2.6;
  if (lineCount <= 6) return 2.0;
  if (lineCount <= 8) return 1.6;
  return 1.3;
}

/**
 * Проверка: не приведёт ли корректировка к недопустимому прыжку font size.
 * Сравниваем прыжок при echo-делении с прыжком при базовом делении.
 * Если echo увеличивает прыжок больше чем на MAX_FONT_JUMP_DELTA — отклоняем.
 */
function isFontJumpAcceptable(
  echoBreak: number,
  totalLines: number,
  baseBreak: number
): boolean {
  const baseFont1 = getBlockFontSizeNumeric(baseBreak);
  const baseFont2 = getBlockFontSizeNumeric(totalLines - baseBreak);
  const baseJump = Math.abs(baseFont1 - baseFont2);

  const echoFont1 = getBlockFontSizeNumeric(echoBreak);
  const echoFont2 = getBlockFontSizeNumeric(totalLines - echoBreak);
  const echoJump = Math.abs(echoFont1 - echoFont2);

  return (echoJump - baseJump) <= MAX_FONT_JUMP_DELTA;
}

// ═══════════════════════════════════════════════════
// ECHO-DETECTION: ОСНОВНАЯ ФУНКЦИЯ
// ═══════════════════════════════════════════════════

/**
 * Определяет точку разрыва подблока по echo-паттерну.
 *
 * Возвращает ЛОКАЛЬНЫЙ индекс (0-based в lineIndices),
 * с которого должен начинаться ��торой подблок.
 * Или null — если echo не найден, используй базовое деление.
 *
 * Принципы:
 *   1. Ищем совпадение начала строки с более ранней строкой
 *   2. Совпадение ≥2 значимых слов = echo-кандидат
 *   3. Gap ≥2 строк между = паттерн (граница)
 *   4. Gap <2 или идентичные строки = хук (НЕ граница)
 *   5. Корректировка ≤2 строк от базового квадрата
 *   6. Font size прыжок не увеличивается больше чем на 0.65rem
 */
export function detectEchoBreakPoint(
  lineIndices: number[],
  lines: string[]
): number | null {
  const n = lineIndices.length;

  // Echo имеет смысл только для делимых блоков (6-15 строк)
  if (n < 6 || n > 15) return null;

  // Предрасчёт: локальный стоп-лист
  const localStopWords = computeLocalStopWords(lineIndices, lines);

  // Предрасчёт: fingerprints для всех строк
  const fingerprints: string[][] = [];
  // Предрасчёт: нормализованный текст для проверки идентичности
  const normalizedTexts: string[] = [];

  for (let i = 0; i < n; i++) {
    const text = lines[lineIndices[i]] ?? '';
    fingerprints.push(extractFingerprint(text, localStopWords));
    normalizedTexts.push(normalizeText(text));
  }

  // Базовая точка разрыва (из computeBalancedSplit)
  const baseBreak = getBaseBreakIndex(n);

  // Сканирование echo-зоны
  const zoneEnd = Math.min(ECHO_ZONE_END, n - MIN_SUBBLOCK_LINES);
  for (let j = ECHO_ZONE_START; j <= zoneEnd; j++) {
    const fpJ = fingerprints[j];
    if (fpJ.length < MIN_SIGNIFICANT_WORDS_MATCH) continue;

    for (let i = 0; i < j; i++) {
      const fpI = fingerprints[i];
      if (fpI.length < MIN_SIGNIFICANT_WORDS_MATCH) continue;

      // Проверка gap (строк МЕЖДУ i и j)
      const gap = j - i - 1;
      if (gap < MIN_PATTERN_GAP) continue; // Хук, не паттерн

      // КРИТИЧЕСКАЯ ПРОВЕРКА: идентичные строки
      // Если строки полностью идентичны → повтор хука, НЕ паттерн
      if (normalizedTexts[i] === normalizedTexts[j]) continue;

      // Проверка совпадения fingerprint (2 слова подряд с начала)
      let matchCount = 0;
      const limit = Math.min(fpI.length, fpJ.length);
      for (let k = 0; k < limit; k++) {
        if (fpI[k] === fpJ[k]) matchCount++;
        else break; // Совпадения должны идти подряд с начала
      }
      if (matchCount < MIN_SIGNIFICANT_WORDS_MATCH) continue;

      // ECHO НАЙДЕН! Проверяем ограничения
      // 1. Максимальный сдвиг от базового квадрата
      if (Math.abs(j - baseBreak) > MAX_SHIFT_FROM_BASE) continue;

      // 2. Минимальный размер подблоков
      if (j < MIN_SUBBLOCK_LINES || n - j < MIN_SUBBLOCK_LINES) continue;

      // 3. Font size прыжок
      if (!isFontJumpAcceptable(j, n, baseBreak)) continue;

      // Возвращаем ЛОКАЛЬНЫЙ индекс
      return j;
    }
  }

  return null;
}

// ═══════════════════════════════════════════════════
// СИММЕТРИЧНОЕ ДЕЛЕНИЕ: ДОПОЛНЕННЫЙ КВАДРАТ
// ═══════════════════════════════════════════════════

/**
 * Симметричное деление на подблоки по принципу "дополненного квадрата".
 * Базовая единица = 4 строки (квадрат).
 * 3 строки = неполный квадрат (antecedent).
 * 5 строк = расширенный квадрат (consequent with extension).
 * Меньший подблок первый, больший второй — акцент на начале второго.
 * Для 3 подблоков: AAB (квадраты первые, хвост последний).
 * Максимум 3 подблока, максимум 6 строк в подблоке.
 *
 * Таблица:
 *   1-5  → [N]           6 → [3,3]      7 → [3,4]
 *   8    → [4,4]         9 → [4,5]     10 → [4,6]
 *   11   → [4,4,3]      12 → [4,4,4]  13 → [4,4,5]
 *   14   → [4,5,5]      15 → [5,5,5]
 *   16+  → равномерно на 3 (макс 6)
 */
function computeBalancedSplit(totalLines: number): number[] {
  // 1-5: один подблок, не делим
  if (totalLines <= 5) return [totalLines];

  // 6-10: два подблока (квадратный первый + развитие)
  if (totalLines <= 10) {
    const twoBlockSplits: Record<number, number[]> = {
      6:  [3, 3],
      7:  [3, 4],
      8:  [4, 4],
      9:  [4, 5],
      10: [4, 6],
    };
    return twoBlockSplits[totalLines] ??
      [Math.floor(totalLines / 2), Math.ceil(totalLines / 2)];
  }

  // 11-15: три подблока (AAB: квадраты + хвост)
  if (totalLines <= 15) {
    const threeBlockSplits: Record<number, number[]> = {
      11: [4, 4, 3],
      12: [4, 4, 4],
      13: [4, 4, 5],
      14: [4, 5, 5],
      15: [5, 5, 5],
    };
    return threeBlockSplits[totalLines] ??
      [4, 4, totalLines - 8];
  }

  // 16+: три подблока, равномерно (макс 6)
  const base = Math.floor(totalLines / 3);
  const remainder = totalLines - base * 3;
  if (remainder === 0) return [base, base, base];
  if (remainder === 1) return [base, base, base + 1];
  return [base, base + 1, base + 1]; // remainder === 2
}

// ═══════════════════════════════════════════════════
// ОСНОВНАЯ ФУНКЦИЯ: createSubBlocks
// ═══════════════════════════════════════════════════

/**
 * Разделяет lineIndices блока на подблоки по принципу
 * "дополненного квадрата". Чистая функция.
 *
 * Если передан lines[] — включает echo-detection для умного деления:
 * ищет музыкальные паттерны по совпадению первых слов
 * и корректирует границу подблока.
 *
 * Примеры (без lines):
 *   [0,1,2,3,4]     → [5]      (5 строк: один подблок)
 *   [0,1,2,3,4,5]   → [3,3]    (6 строк: симметрия)
 *   [0,1,2,3,4,5,6] → [3,4]    (7 строк: неполный + квадрат)
 *
 * Примеры (с lines, echo detected):
 *   8 строк, "Walking alone" echo на строке 3 → [3,5] вместо [4,4]
 */
export function createSubBlocks(
  lineIndices: number[],
  maxLines: number = 6,
  lines?: string[]
): SubBlock[] {
  if (maxLines < 1) maxLines = 1;
  if (lineIndices.length === 0) return [];

  // 1. Базовое деление по принципу дополненного квадрата
  let split = computeBalancedSplit(lineIndices.length);

  // 2. Echo-detection: корректировка если есть текст и 2 подблока
  if (lines && split.length === 2) {
    const echoBreak = detectEchoBreakPoint(lineIndices, lines);
    if (echoBreak !== null) {
      const totalLines = lineIndices.length;
      split = [echoBreak, totalLines - echoBreak];
    }
  }

  // 3. Сборка SubBlocks из split
  const result: SubBlock[] = [];
  let offset = 0;
  for (let i = 0; i < split.length; i++) {
    const size = split[i];
    const chunk = lineIndices.slice(offset, offset + size);
    result.push({
      id: `sub-${i}`,
      lineIndices: chunk,
      isFirst: i === 0,
      isLast: i === split.length - 1,
    });
    offset += size;
  }

  return result;
}

/**
 * Определяет индекс активного подблока по activeLineIndex.
 * Возвращает 0 если строка не найдена (fallback на первый подблок).
 */
export function getActiveSubBlockIndex(
  activeLineIndex: number,
  block: TextBlock,
  maxLines: number = 6,
  lines?: string[]
): number {
  if (activeLineIndex < 0 || !block.lineIndices.length) return 0;
  const subBlocks = createSubBlocks(block.lineIndices, maxLines, lines);

  for (let i = 0; i < subBlocks.length; i++) {
    if (subBlocks[i].lineIndices.includes(activeLineIndex)) {
      return i;
    }
  }

  // Fallback: если activeLineIndex выходит за пределы блока
  if (activeLineIndex > block.lineIndices[block.lineIndices.length - 1]) {
    return subBlocks.length - 1;
  }
  return 0;
}
