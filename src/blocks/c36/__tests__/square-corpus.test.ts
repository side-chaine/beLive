// BL-048 · corpus harness (offline core): parseSyncedLrc + collectSquareStats
// на реальном LRC из фикстур. Сетевая часть (runCorpus/fetchTrackLrc) не гоняется
// в CI — она кэш-зависима и бьёт lrclib (rate-limit).
import { describe, it, expect } from 'vitest';
import {
  parseSyncedLrc,
  collectSquareStats,
  summarizeWindows,
} from '../corpus/square-corpus';
import iDisappearJson from './dumps/metallica-i-disappear.json';

const iLines: string[] = iDisappearJson.lrcLines.map((l: any) => l.text);

describe('BL-048 · square-corpus (offline)', () => {
  it('parseSyncedLrc: [mm:ss.xx] text → строки с таймкодом', () => {
    const raw = '[00:39.89] Hey, hey, hey\n[00:42.55] Here I go now\n\n[00:44.65] Here I go into new days';
    const lines = parseSyncedLrc(raw);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toEqual({ t: 39.89, text: 'Hey, hey, hey' });
    expect(lines[1].t).toBeCloseTo(42.55);
    expect(lines[2].text).toBe('Here I go into new days');
  });

  it('collectSquareStats на I Disappear: V1/V2 дают [6,3] (rule D matched)', () => {
    const stats = collectSquareStats(iLines);
    const agg = summarizeWindows(stats, 'I Disappear');
    // V1 (idx 0..8) и V2 (idx 9..17) — точные 3-группы → [6,3].
    expect(agg.byRuleDSplit['6,3']).toBeGreaterThanOrEqual(2);
    expect(agg.ruleDMatched).toBeGreaterThanOrEqual(2);
    expect(agg.windows).toBeGreaterThan(0);
  });

  it('unison-collapse: окно из идентичных строк помечается', () => {
    const win = ['la', 'la', 'la', 'la', 'la', 'la', 'la'];
    const stats = collectSquareStats(win);
    expect(stats.every((s) => s.unisonCollapse)).toBe(true);
    const agg = summarizeWindows(stats);
    expect(agg.unisonCollapse).toBe(stats.length);
  });

  it('tail-giant НЕ срабатывает на нормальных [6,3] (tail < 3*square)', () => {
    const stats = collectSquareStats(iLines);
    // ни одно [6,3] не должно давать tailGiant (3 < 3*6)
    const tg = stats.filter((s) => s.tailGiant);
    expect(tg.length).toBe(0);
  });
});
