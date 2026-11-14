// t72-invariants.test.ts — инварианты prod-выхода на ВСЁМ корпусе.
// Центр_42, BL-042 ITER-3. Возвращает AC1f (снят в D3 как «рискованный») —
// он доказуем: финальный цикл Pass 3 безусловно синхронизирует contentLines
// для КАЖДОГО блока с непустыми lineIndices. Genius-текст остаётся только у
// unmapped-блоков, которые предикат исключает.
//
// Красный здесь = НАХОДКА (рассинхрон contentLines), а не повод снять проверку.
import { describe, it, expect } from 'vitest';
import iDisappearJson from './dumps/metallica-i-disappear.json';
import unforgivenJson from './dumps/metallica-the-unforgiven-ii.json';
import mjJson from './dumps/mj-real.json';
import runawayJson from './dumps/runaway.json';
import { loadDump, type Dump } from '../parse';
import { blockFirstLineSync, type LrcResult } from '../../../services/auto-lyrics.service';

const CORPUS: Array<[string, unknown]> = [
  ['i-disappear', iDisappearJson],
  ['unforgiven-ii', unforgivenJson],
  ['mj-real', mjJson],
  ['runaway', runawayJson],
];

function run(json: unknown) {
  const raw = json as Dump & { lrcRaw?: string };
  const d = loadDump(raw);
  const lrcResult: LrcResult = {
    lines: d.lrcLines.map((l) => ({ text: l.text, time: l.t ?? 0 })),
    rawSynced: raw.lrcRaw ?? '',
    fetchedAt: 0,
  };
  return blockFirstLineSync(raw.geniusRaw ?? '', lrcResult);
}

describe('BL-042 · корпусные инварианты prod-выхода', () => {
  for (const [name, json] of CORPUS) {
    it(`${name} · AC1f: contentLines ≡ lyricsLines[lineIndices] для всех замапленных`, () => {
      const res = run(json);
      for (const [i, b] of res.blocks.entries()) {
        if (b.lineIndices.length === 0) { continue; }   // unmapped → Genius-текст, норма
        expect(b.contentLines, `block ${i} contentLines desync`)
          .toEqual(b.lineIndices.map((k) => res.lyricsLines[k]));
      }
    });

    it(`${name} · lineIndices: возрастание, уникальность ВНУТРИ блока, границы [0,m)`, () => {
      const res = run(json);
      const m = res.lyricsLines.length;
      for (const [i, b] of res.blocks.entries()) {
        const s = b.lineIndices;
        expect(new Set(s).size, `block ${i} has intra-block dupes`).toBe(s.length);
        for (let k = 0; k < s.length; k++) {
          expect(Number.isInteger(s[k]), `block ${i} non-int`).toBe(true);
          expect(s[k] >= 0 && s[k] < m, `block ${i} out of bounds`).toBe(true);
          if (k > 0) { expect(s[k], `block ${i} not ascending`).toBeGreaterThan(s[k - 1]); }
        }
      }
    });

    it(`${name} · идемпотентность: два прогона, blocks byte-equal`, () => {
      // Сравниваем ТОЛЬКО blocks: markers.id содержит Date.now() (не детерминирован).
      expect(JSON.stringify(run(json).blocks)).toBe(JSON.stringify(run(json).blocks));
    });
  }
});
