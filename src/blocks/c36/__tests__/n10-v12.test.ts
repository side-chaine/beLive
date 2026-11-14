// n10-v12.test.ts — контроль правила v1.2: zero-width только для aux-типов,
// фикс N10 на I Disappear, лог режима 2. Порт /tmp/c36v12/tests/n10-v12.test.js
// под vitest. gate импортируется из порта (B-валидность), не из песочницы.
import { describe, it, expect } from 'vitest';
import iDisappearJson from './dumps/metallica-i-disappear.json';
import mjJson from './dumps/mj-real.json';

import { loadDump, type Dump } from '../parse';
import { mmodel } from '../model';
import { gate } from '../gate';

const FILES: Record<string, unknown> = {
  'metallica-i-disappear.json': iDisappearJson,
  'mj-real.json': mjJson,
};

const load = (f: string): Dump => loadDump(FILES[f] as unknown as Dump);

describe('n10-v12 — B-валидность (v1.2)', () => {
  it('V1 · aux-only: Verse с отсутствующим в LRC текстом НЕ получает 0 строк', () => {
    const d = load('metallica-i-disappear.json');
    const blocks = d.geniusBlocks!.map((b, i) => (i === 0 ? { ...b, lines: ['Zzz unknown words here', ...b.lines.slice(1)] } : b));
    const r = mmodel(blocks, d.lrcLines);
    expect(!(r.zeroWidth && r.zeroWidth.has(0))).toBe(true);
    expect(!!(r.blocks![0] && r.blocks![0]!.startIdx === 0)).toBe(true);
  });

  it('V2 · N10: Interlude без текста в LRC = 0 строк, Verse 3 встаёт на 22..31', () => {
    const d = load('metallica-i-disappear.json');
    const r = mmodel(d.geniusBlocks!, d.lrcLines);
    expect(r.blocks![3]).toBeNull();
    expect([r.blocks![4]!.startIdx, r.blocks![4]!.endIdx]).toEqual([22, 31]);
    expect(r.perBlock[3]!.zeroWidth).toBe(true);
    expect(r.perBlock[3]!.anchorAt).toBe(22);
  });

  it('V3 · режим 2 пишет лог с причиной и списком изменённых блоков (genuine overlap)', () => {
    // Синтетический дамп с НАСТОЯЩИМ overlap: строки 2 и 3 заявлены обоими
    // блоками. Это genuine defect (не намеренная не-монотонность / gap /
    // orphan-before-first) — гейт обязан уйти в режим 2 и залогировать per-line.
    // Дамп конструируется напрямую (loadDump перестраивает geniusBlocks из
    // geniusRaw, поэтому здесь задаём Dump явно).
    const synth: Dump = {
      lrcLines: Array.from({ length: 7 }, (_: unknown, i: number) => ({ i, t: i, text: `a${i}` })),
      geniusBlocks: [
        { label: 'A', kind: 'verse', lines: ['a0', 'a1', 'a2', 'a3'] },
        { label: 'B', kind: 'verse', lines: ['a2', 'a3', 'a4'] },
      ],
      currentOutput: [
        { i: 0, label: 'A', startIdx: 0, endIdx: 3, lines: 4 },
        { i: 1, label: 'B', startIdx: 2, endIdx: 4, lines: 3 },
      ],
    };
    const g = gate(synth);
    expect(g.mode).toBe('overridden-by-validity');
    expect(g.logLine!).toMatch(/^\[blocks\] overridden-by-validity · /);
    expect(g.logLine!).toMatch(/overlap at line 2|overlap at line 3/);
    expect(g.changed!.length).toBeGreaterThan(0);
  });

  it('V4 · MJ: NOT MAPPED проверяется до геометрии — defer, legacy не тронут', () => {
    const d = load('mj-real.json');
    const g = gate(d);
    expect(g.mode).toBe('defer-unclean');
    expect(g.rule).toBe('not-mapped');
    const expected = d.currentOutput!.map((b) => (b.startIdx == null ? null : { startIdx: b.startIdx, endIdx: b.endIdx }));
    expect(g.blocks).toEqual(expected);
  });
});
