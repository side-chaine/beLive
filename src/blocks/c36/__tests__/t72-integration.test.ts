// t72-integration.test.ts — интеграция t72: пайплайн blockFirstLineSync + гейт c36.
// Тонкий post-processing гейт поверх существующего выхода blockFirstLineSync.
// НЕ трогает c36 (gate/model/parse/legacy/metrics/hungarian) — только вызывает gate().
//
// Проверяем режимы из спецы §7 на 4 дампах:
//   I Disappear  -> 'overridden-by-validity' на ДАМПЕ (см. F17 ниже);
//                   в проде шов починен через repaired-attribution (AC1).
//   MJ           -> 'defer-unclean' byte-exact (16/16)
//   Unforgiven   -> 'overridden' (12/12)
//   Runaway      -> 'no-disputes'
//
// F17: дамп I Disappear хранит currentOutput ДИАПАЗОНАМИ, а живой выход —
// МНОЖЕСТВАМИ с gap-fill (V1 {0-9,12,15}, V2 {10,11,13,14,16,17}). Диапазоны
// 0..15 / 10..17 схлопывают переплетение в ЛОЖНЫЙ overlap 10..15, поэтому
// standalone-гейт на дампе видит дефект геометрии (mode 2) — это артефакт
// lossy-кодирования дампа, а не поведение прода. Прод идёт через wiring с
// РЕАЛЬНЫМИ множествами → repaired-attribution. Два субъекта — не сравниваем.
import { describe, it, expect } from 'vitest';
import iDisappearJson from './dumps/metallica-i-disappear.json';
import unforgivenJson from './dumps/metallica-the-unforgiven-ii.json';
import mjJson from './dumps/mj-real.json';
import runawayJson from './dumps/runaway.json';

import { loadDump, type Dump } from '../parse';
import { gate } from '../gate';
import { blockFirstLineSync, type LrcResult } from '../../../services/auto-lyrics.service';

interface DumpEntry {
  file: string;
  json: unknown;
  expectedMode: string;
  expectedBlockCount: number;
}

const ENTRIES: DumpEntry[] = [
  { file: 'metallica-i-disappear.json', json: iDisappearJson, expectedMode: 'overridden-by-validity', expectedBlockCount: 9 },
  { file: 'mj-real.json', json: mjJson, expectedMode: 'defer-unclean', expectedBlockCount: 16 },
  { file: 'metallica-the-unforgiven-ii.json', json: unforgivenJson, expectedMode: 'overridden', expectedBlockCount: 12 },
  { file: 'runaway.json', json: runawayJson, expectedMode: 'no-disputes', expectedBlockCount: 9 },
];

// Диапазон [min..max] по lineIndices (гапы сжимаются — гейт оперирует смежным диапазоном).
function rangeOf(lineIndices: number[]): { startIdx: number; endIdx: number } | null {
  if (!lineIndices || lineIndices.length === 0) { return null; }
  return { startIdx: Math.min(...lineIndices), endIdx: Math.max(...lineIndices) };
}

// Пересечение индексов между блоками — признак сломанного разбиения.
function hasOverlappingIndices(blocks: { lineIndices: number[] }[]): boolean {
  const seen = new Set<number>();
  for (const b of blocks) {
    for (const idx of b.lineIndices) {
      if (seen.has(idx)) { return true; }
      seen.add(idx);
    }
  }
  return false;
}

// Адаптируем формат дампа под вход blockFirstLineSync (не меняя c36).
function runSync(entry: DumpEntry): { d: Dump; result: ReturnType<typeof blockFirstLineSync> } {
  const d = loadDump(entry.json as unknown as Dump);
  const rawDump = entry.json as unknown as Dump & { lrcRaw?: string };
  const lrcResult: LrcResult = {
    lines: d.lrcLines.map((l) => ({ text: l.text, time: l.t ?? 0 })),
    rawSynced: rawDump.lrcRaw ?? '',
    fetchedAt: 0,
  };
  const result = blockFirstLineSync(rawDump.geniusRaw ?? '', lrcResult);
  return { d, result };
}

describe('t72 · blockFirstLineSync + c36 gate integration', () => {
  for (const entry of ENTRIES) {
    it(`${entry.file} → mode '${entry.expectedMode}' (${entry.expectedBlockCount}/${entry.expectedBlockCount})`, () => {
      const { d, result } = runSync(entry);

      // Эталонный (standalone) гейт на дампе — классификация трека (тестирует gate.ts).
      const g = gate(d);

      // (1) режим из §7 (standalone классификация)
      expect(g.mode).toBe(entry.expectedMode);

      // (2) число блоков
      expect(g.blocks.length).toBe(entry.expectedBlockCount);
      expect(result.blocks.length).toBe(g.blocks.length);

      // (3) wiring НЕ ломает разбиение blockFirstLineSync: нет пересечений индексов.
      //     Согласно guardrail 5 («калибровки legacy byte-exact (defer)») wiring
      //     применяет override ТОЛЬКО на подлинном дефекте геометрии (mode 2,
      //     overridden-by-validity); mode 3 (стоимостной) и defer/no-disputes
      //     сохраняют выход blockFirstLineSync как есть (byte-exact).
      expect(hasOverlappingIndices(result.blocks)).toBe(false);

      // (4) ДВА РАЗНЫХ СУБЪЕКТА:
      //   g = gate(d)     → классификация ДАМПА (lossy ranges, mode3=true).
      //   result.blocks   → ПРИМЕНЁННЫЙ прод-выход (mode3=false, реальные множества).
      // Сравнивать диапазоны между ними на I Disappear нельзя: дамп видит ложный
      // overlap и переписывает 4 блока, прод ремонтирует 2 (F17). Поэтому AC1
      // проверяем на проде — единственном субъекте, который видит владелец.
      if (entry.file === 'metallica-i-disappear.json') {
        expect(result.blocks[3].lineIndices, 'AC1: Interlude опустевший').toEqual([]);
        expect(result.blocks[4].lineIndices, 'AC1: Verse 3 забрал строку 22').toEqual(
          [22, 23, 24, 25, 26, 27, 28, 29, 30, 31]);
      }
    });
  }

  it('MJ + Runaway (defer / no-disputes): legacy byte-exact — lineIndices НЕ тронуты гейтом', () => {
    for (const file of ['mj-real.json', 'runaway.json']) {
      const entry = ENTRIES.find((e) => e.file === file)!;
      const { d, result } = runSync(entry);
      const g = gate(d);
      // На defer/no-disputes гейт не меняет lineIndices → совпадает с legacy = g.blocks.
      expect(g.mode === 'defer-unclean' || g.mode === 'no-disputes').toBe(true);
      for (let i = 0; i < g.blocks.length; i++) {
        const actual = rangeOf(result.blocks[i].lineIndices);
        const expected = g.blocks[i]
          ? { startIdx: g.blocks[i]!.startIdx, endIdx: g.blocks[i]!.endIdx }
          : null;
        expect(actual, `${file} block ${i} byte-exact mismatch`).toEqual(expected);
      }
    }
  });
});
