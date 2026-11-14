// t72-ac1.test.ts — AC1 БЕЗУСЛОВНО на prod-выходе. Центр_42, BL-042 ITER-2.
// На коде до фикса этот файл ОБЯЗАН падать (Interlude=[22], Verse3=[23..31]).
import { describe, it, expect } from 'vitest';
import { blockFirstLineSync, type LrcResult } from '../../../services/auto-lyrics.service';
import { partitionStats } from '../apply';
import { rawDump, lrc, LIVE_INDICES, FIXED_INDICES } from './live-fixture';

function run() {
  const d = rawDump();
  const lrcResult: LrcResult = {
    lines: lrc().map((x) => ({ text: x.text, time: x.t ?? 0 })),
    rawSynced: d.lrcRaw ?? '', fetchedAt: 0,
  };
  return blockFirstLineSync(d.geniusRaw ?? '', lrcResult);
}
const idx = (b: { name?: string }, res: ReturnType<typeof run>) =>
  res.blocks.findIndex((x) => new RegExp(b.name!, 'i').test(x.name ?? x.type ?? ''));

describe('BL-042 AC1 · шов I Disappear починен в PROD-пути', () => {
  it('AC1a · Interlude = 0 строк', () => {
    const res = run();
    const i = idx({ name: 'interlude' }, res);
    expect(i).toBeGreaterThanOrEqual(0);
    expect(res.blocks[i].lineIndices).toEqual([]);
  });

  it('AC1b · Verse 3 = 22..31', () => {
    const res = run();
    const i = idx({ name: 'verse\\s*3' }, res);
    expect(i).toBeGreaterThanOrEqual(0);
    expect(res.blocks[i].lineIndices).toEqual([22, 23, 24, 25, 26, 27, 28, 29, 30, 31]);
  });

  it('AC1c · РОВНО 2 блока изменены, остальные byte-exact к живому legacy', () => {
    const res = run();
    const actual = res.blocks.map((b) => [...b.lineIndices]);
    expect(actual).toEqual(FIXED_INDICES);
    const diff = actual.map((a, i) => (a.join(',') === LIVE_INDICES[i].join(',') ? -1 : i)).filter((i) => i >= 0);
    expect(diff).toEqual([3, 4]);
  });

  it('AC1d · partition: 54/54 покрытия, 0 дыр, 0 дублей', () => {
    const res = run();
    const st = partitionStats(res.blocks.map((b) => b.lineIndices), res.lyricsLines.length);
    expect(res.lyricsLines.length).toBe(54);
    expect(st.covered).toBe(54);
    expect(st.holes).toEqual([]);
    expect(st.dupes).toEqual([]);
    expect(st.outOfBounds).toEqual([]);
  });

  it('AC1e · contentLines опустевшего Interlude = ИСХОДНЫЙ Genius, не украденная LRC-строка', () => {
    const res = run();
    const i = idx({ name: 'interlude' }, res);
    expect(res.blocks[i].contentLines).toEqual(['Hey, yeah, yeah']);
  });

  it('AC1g · идемпотентность: два прогона byte-equal', () => {
    expect(JSON.stringify(run().blocks)).toBe(JSON.stringify(run().blocks));
  });

  it('AC1h · markers не тронуты: 54 шт., time === LRC time', () => {
    const res = run();
    const src = lrc();
    expect(res.markers.length).toBe(54);
    res.markers.forEach((mk, i) => expect(mk.time).toBe(src[i].t));
  });
});
