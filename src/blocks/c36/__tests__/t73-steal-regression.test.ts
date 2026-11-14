// t73-steal-regression.test.ts — BL-042 t73, фикс (early-pass ре-анкор V2 → LRC 9).
// HARD-GATE oracle: назначение блоков MJ/Runaway/Unforgiven ДОЛЖНО быть byte-exact
// к baseline (до-фикс снимок 806, 2026-11-14). Плюс I Disappear: V1=[0..8], V2=[9..17]
// БЕЗ переплетения и БЕЗ украденных строк 9/15 (early-pass ре-анкор, path A от CEO).
import { describe, it, expect } from 'vitest';
import { blockFirstLineSync, type LrcResult } from '../../../services/auto-lyrics.service';
import { loadDump } from '../parse';
import mj from './dumps/mj-real.json';
import runaway from './dumps/runaway.json';
import unforgiven from './dumps/metallica-the-unforgiven-ii.json';
import iDisappear from './dumps/metallica-i-disappear.json';

function run(dump: any) {
  const lrcLines = loadDump(dump).lrcLines;
  const lrcResult: LrcResult = {
    lines: lrcLines.map((x: any) => ({ text: x.text, time: x.t ?? 0 })),
    rawSynced: dump.lrcRaw ?? '', fetchedAt: 0,
  };
  return blockFirstLineSync(dump.geniusRaw ?? '', lrcResult);
}

const MJ_BASELINE: [string, number[]][] = [
  ['Intro', [0,1,2,3,4]],
  ['Verse 1', [5,6,7,8,9,10,11]],
  ['Chorus 1', [12,13,14]],
  ['Verse 2', [15,16,17,18,19,20,21,22]],
  ['Chorus 2', [23,24]],
  ['Post-Chorus 1', [25,26,27,28,29,30,31]],
  ['Verse 3', [32,33,34,35,36,37,38,39]],
  ['Chorus 3', [40,41]],
  ['Post-Chorus 2', [42]],
  ['Bridge 1', [43,44,45,46,48,49,50,51]],
  ['Verse 4', [47,52,53,54,55,56,57,58,59]],
  ['Chorus 4', [60,61]],
  ['Solo', [62,63,64,65,66,67,68,69,70,71,72,73,74,75]],
  ['Bridge 2', []],
  ['Verse 5', []],
  ['Chorus 5', [76,77,78]],
];
const RUNAWAY_BASELINE: [string, number[]][] = [
  ['Verse 1', [0,1,2,3,4,5]],
  ['Pre-Chorus', [6,7,8,9]],
  ['Chorus 1', [10,11,12,13,14,15,16,17]],
  ['Verse 2', [18,19,20,21,22,23]],
  ['Pre-Chorus', [24,25,26,27]],
  ['Chorus 2', [28,29,30,31,32,33,34,35]],
  ['Bridge', [36,37,38,39,40,41,42,43,44,45,46]],
  ['Chorus 3', [47,48,49,50,51,52,53,54]],
  ['Outro', [55,56,57,58]],
];
const UNFORGIVEN_BASELINE: [string, number[]][] = [
  ['Verse 1', [0,1,2,3,4,5,6,7]],
  ['Verse 2', [8,9,10,11,12,13]],
  ['Pre-Chorus', [14,15,16]],
  ['Chorus 1', [17,18,19,20,21,22,23,24]],
  ['Verse 3', [25,26,27,28,29,30]],
  ['Pre-Chorus', [31,32,33]],
  ['Chorus 2', [34,35,36,37,38,39,40]],
  ['Solo', [41]],
  ['Bridge', [42,43,44]],
  ['Pre-Chorus', [45,46]],
  ['Chorus 3', [47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63]],
  ['Outro', [64,65,66]],
];

function assertBaseline(name: string, dump: any, baseline: [string, number[]][]) {
  const res = run(dump);
  expect(res.blocks.length, `${name}: число блоков`).toBe(baseline.length);
  for (let i = 0; i < baseline.length; i++) {
    const [bname, exp] = baseline[i];
    expect(res.blocks[i].name, `${name} block ${i} name`).toBe(bname);
    expect(res.blocks[i].lineIndices, `${name} block ${i} (${bname}) byte-exact`).toEqual(exp);
  }
}

describe('BL-042 t73 · HARD-GATE: назначение MJ/Runaway/Unforgiven byte-exact', () => {
  it('MJ assignment byte-exact', () => assertBaseline('MJ', mj, MJ_BASELINE));
  it('Runaway assignment byte-exact', () => assertBaseline('Runaway', runaway, RUNAWAY_BASELINE));
  it('Unforgiven assignment byte-exact', () => assertBaseline('Unforgiven', unforgiven, UNFORGIVEN_BASELINE));
});

describe('BL-042 t73 · коммит #1: I Disappear — кража строк устранена (V1=[0..8], V2=[9..17])', () => {
  it('V1=[0..8], V2=[9..17] (без переплетения), partition 54/54', () => {
    const res = run(iDisappear);
    const v1 = res.blocks.findIndex((b) => /^verse\s*1/i.test(b.name ?? b.type ?? ''));
    const v2 = res.blocks.findIndex((b) => /^verse\s*2/i.test(b.name ?? b.type ?? ''));
    expect(v1).toBeGreaterThanOrEqual(0);
    expect(v2).toBeGreaterThanOrEqual(0);
    expect(res.blocks[v1].lineIndices, 'V1').toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(res.blocks[v2].lineIndices, 'V2').toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17]);
    // partition: 54 строки, без дыр/дублей
    const all = res.blocks.flatMap((b) => b.lineIndices).sort((a, b) => a - b);
    expect(all).toEqual(Array.from({ length: 54 }, (_, k) => k));
  });
});
