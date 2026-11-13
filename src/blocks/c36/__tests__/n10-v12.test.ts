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

  it('V3 · режим 2 пишет лог с причиной и списком изменённых блоков', () => {
    const d = load('metallica-i-disappear.json');
    const g = gate(d);
    expect(g.mode).toBe('overridden-by-validity');
    expect(g.logLine!).toMatch(/^\[blocks\] overridden-by-validity · overlap at 1 · changed 4\/9: /);
    expect(g.logLine!).toMatch(/Interlude 22\.\.22→0 строк/);
    expect(g.changed!.length).toBe(4);
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
