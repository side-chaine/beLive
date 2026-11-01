// beLive — Paragraph Blocks (D2: editorText · D3: auto-blocks)
// Чистые функции: Genius-текст без тегов → абзацы (\n\n = граница блока).
// Без пустых строк внутри абзаца структура не восстановима ⇒ null (caller решает fallback).

/** Ведущие bracket-метки: [Testo di «…»], [ti:…], [ar:…] — метаданные, не лирика. */
const BRACKET_PREFIX_RE = /^(?:\[[^\]]*\]\s*)+/;

/** LRC-тайминг вида [mm:ss] / [mm:ss.xx] ⇒ это не song-text. */
const LRC_TIMESTAMP_RE = /\[\d{1,3}:\d{2}/;

/** Персистентный блок лирики, собираемый из абзацев (D3). */
export interface ParagraphBlock {
  id: string;
  name: string;
  type: string;
  lineIndices: number[];
}

/**
 * Абзацы исходника Genius: CRLF normalize, отсечение bracket-метаданных,
 * пустые строки выброшены. null = это не song-text (пусто / LRC).
 */
function collectParagraphs(sourceText: string): string[][] | null {
  const text = String(sourceText ?? '').replace(/\r\n|\r/g, '\n');
  if (!text.trim()) return null;
  if (LRC_TIMESTAMP_RE.test(text)) return null;

  const paragraphs: string[][] = [];

  for (const rawParagraph of text.split(/\n\s*\n/)) {
    const lines: string[] = [];
    for (const rawLine of rawParagraph.split('\n')) {
      const line = rawLine.replace(BRACKET_PREFIX_RE, '').trim();
      if (line) lines.push(line);
    }
    if (lines.length > 0) paragraphs.push(lines);
  }

  return paragraphs;
}

/**
 * buildParagraphEditorText — абзацы исходника Genius как текст редактора блоков.
 * Возвращает null, если структуры абзацев нет (LRC / нет пустых строк / < 2 содержательных абзаца).
 */
export function buildParagraphEditorText(sourceText: string): string | null {
  const paragraphs = collectParagraphs(sourceText);
  if (!paragraphs || paragraphs.length < 2) return null;

  return paragraphs.map(lines => lines.join('\n')).join('\n\n');
}

/** Fingerprint абзаца = нормализованные первые 2 непустые строки (lowercase, non-letters → space, collapse). */
function paragraphFingerprint(lines: string[]): string {
  return lines
    .filter(line => line.trim())
    .slice(0, 2)
    .map(line => line.toLowerCase().replace(/[^\p{L}]+/gu, ' ').trim())
    .filter(part => part.length > 0)
    .join(' ');
}

/**
 * buildParagraphBlocks (D3) — блоки строятся АВТОМАТИЧЕСКИ из абзацев Genius.
 * Тип выводится по fingerprint: встречается ≥2 раз ⇒ chorus (для ВСЕХ вхождений), иначе verse.
 * Строки абзаца мапятся в lineSpace через indexOf от курсора (устойчиво к дублям строк).
 * Абзацев < 2 ⇒ [].
 */
export function buildParagraphBlocks(sourceText: string, lineSpace: string[]): ParagraphBlock[] {
  const paragraphs = collectParagraphs(sourceText);
  if (!paragraphs || paragraphs.length < 2) return [];

  const space = Array.isArray(lineSpace) ? lineSpace : [];
  const fingerprints = paragraphs.map(paragraphFingerprint);
  const freq = new Map<string, number>();
  for (const fp of fingerprints) {
    if (!fp) continue;
    freq.set(fp, (freq.get(fp) ?? 0) + 1);
  }

  const blocks: ParagraphBlock[] = [];
  const counters: Record<string, number> = { verse: 0, chorus: 0 };
  let cursor = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    const fp = fingerprints[i];
    const type = fp && (freq.get(fp) ?? 0) >= 2 ? 'chorus' : 'verse';
    counters[type] = (counters[type] ?? 0) + 1;

    const lineIndices: number[] = [];
    for (const line of paragraphs[i]) {
      const idx = space.indexOf(line, cursor);
      if (idx !== -1) {
        lineIndices.push(idx);
        cursor = idx + 1;
      }
    }

    blocks.push({
      id: `auto-para-block-${i}`,
      name: type === 'chorus' ? `Припев ${counters.chorus}` : `Куплет ${counters.verse}`,
      type,
      lineIndices,
    });
  }

  return blocks;
}