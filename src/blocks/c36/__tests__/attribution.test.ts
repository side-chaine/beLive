// attribution.test.ts — детектор D1–D13 + sensitivity ±25%. Центр_42, BL-042.
import { describe, it, expect } from 'vitest';
import { detectAttribution, AUX_KINDS, ATTRIBUTION_DEFAULTS } from '../attribution';
import { genius, lrc, setsOf, LIVE_INDICES, FIXED_INDICES } from './live-fixture';
import type { GeniusBlock, LrcLine } from '../parse';

const G = genius(), L = lrc();
const detect = (ind: number[][], blocks: GeniusBlock[] = G, lines: LrcLine[] = L, p = {}) =>
  detectAttribution(blocks, lines, setsOf(ind), p);

describe('attribution · детектор', () => {
  it('A1 · I Disappear LIVE: ремонт aux=3 → next=4, anchor@22', () => {
    const r = detect(LIVE_INDICES)!;
    expect(r).toBeTruthy();
    expect(r.changedIdx).toEqual([3, 4]);
    expect(r.zeroWidth).toEqual([3]);
    expect(r.evidence.anchorAt).toBe(22);
    expect(r.evidence.stolen).toEqual([22]);
    expect(r.partition[3]).toBeNull();
    expect(r.partition[4]).toEqual({ startIdx: 22, endIdx: 31 });
    expect(r.evidence.nextAnchorBefore).toBeLessThan(0.6);
    expect(r.evidence.nextAnchorAfter).toBe(1);
  });

  it('A2 · D5 exact-match primary: свидетель есть → ремонта НЕТ', () => {
    const g = G.map((b, i) => (i === 3 ? { ...b, lines: [L[22].text] } : b));
    expect(detect(LIVE_INDICES, g)).toBeNull();
  });

  it('A3 · D6 rescue (reverse-N10): перефразировка в окне → aux сохраняет строку', () => {
    const lines = L.map((x, i) => (i === 22 ? { ...x, text: 'Yeah, hey, hey' } : x));
    expect(detect(LIVE_INDICES, G, lines)).toBeNull();
  });

  it('A4 · D6 ЛОКАЛЬНОСТЬ: точный двойник aux-якоря ДАЛЕКО от окна не спасает и не мешает', () => {
    expect(detect(LIVE_INDICES)).toBeTruthy();
  });

  it('A5 · D9 анти-filler: stolen — «♪» → ремонта НЕТ', () => {
    const lines = L.map((x, i) => (i === 22 ? { ...x, text: '♪' } : x));
    expect(detect(LIVE_INDICES, G, lines)).toBeNull();
  });

  it('A6 · D7: aux последний блок (outro) → ремонта НЕТ (защита Unforgiven)', () => {
    const g: GeniusBlock[] = [G[4], { label: 'Outro', kind: 'outro', lines: ['no witness here at all'] }];
    const ind = [[22, 23, 24, 25, 26, 27, 28, 29, 30, 31], [32]];
    expect(detect(ind, g)).toBeNull();
  });

  it('A7 · D1: не-aux kind (verse) → ремонта НЕТ', () => {
    const g = G.map((b, i) => (i === 3 ? { ...b, kind: 'verse' } : b));
    expect(detect(LIVE_INDICES, g)).toBeNull();
  });

  it('A8 · D10/D12: якорь соседа уже объяснён на своём старте → ремонта НЕТ', () => {
    const lines = L.map((x, i) => (i === 23 ? { ...x, text: 'Hey, hey, hey, and I went' } : x));
    expect(detect(LIVE_INDICES, G, lines)).toBeNull();
  });

  it('A9 · AUX_KINDS зеркалит model.ts (иначе T1 «no-disputes не тронут» ломается)', () => {
    expect([...AUX_KINDS].sort()).toEqual(['instrumental', 'interlude', 'outro']);
  });

  it('A10 · D3 maxStolen: 3 строки у aux → ремонта НЕТ', () => {
    const ind = LIVE_INDICES.map((s, i) => (i === 3 ? [22, 23, 24] : i === 4 ? [25, 26, 27, 28, 29, 30, 31] : [...s]));
    expect(detect(ind)).toBeNull();
  });

  it('A11 · enabled=false → выключено', () => {
    expect(detect(LIVE_INDICES, G, L, { enabled: false })).toBeNull();
  });

  it('A12 · sensitivity ±25% по всем 4 порогам: исход не меняется', () => {
    const dims: (keyof typeof ATTRIBUTION_DEFAULTS)[] = ['thetaLow', 'thetaHigh', 'deltaMin', 'delta'];
    for (const d of dims) {
      for (const f of [0.75, 1.25]) {
        const r = detect(LIVE_INDICES, G, L, { [d]: (ATTRIBUTION_DEFAULTS[d] as number) * f })!;
        expect(r, `${String(d)}×${f}`).toBeTruthy();
        expect(r.changedIdx).toEqual([3, 4]);
      }
    }
  });

  it('A13 · детерминизм: 10 вызовов → идентичный результат', () => {
    const first = JSON.stringify(detect(LIVE_INDICES));
    for (let k = 0; k < 10; k++) { expect(JSON.stringify(detect(LIVE_INDICES))).toBe(first); }
  });

  it('A14 · уже починенный partition → ремонта НЕТ (идемпотентность детектора)', () => {
    expect(detect(FIXED_INDICES)).toBeNull();
  });
});
