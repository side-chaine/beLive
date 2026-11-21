// GWEN43 · conf-gate по сплошности (file 06 §6, finding N7).
// Блок с интерливингом lineIndices НЕ должен публиковать уверенный квадрат.
// RED до правки: splitSquareFull на несплошном блоке возвращает conf > 0.
// GREEN после: conf === 0, guard === 'non-contiguous', покрытие сохранено.
import { describe, it, expect } from 'vitest';
import { splitSquareFull, CONF } from '../square-full';
import { createSubBlocksFull } from '../square-full';

function idx(a: number, b: number): number[] {
  const out: number[] = [];
  for (let i = a; i <= b; i++) { out.push(i); }
  return out;
}
const sum = (xs: number[]): number => xs.reduce((s, x) => s + x, 0);

// Синтетические тексты: повторяющийся припев (как Unforgiven Chorus).
// Важно: atom Period ещё не введён — тест проверяет ТОЛЬко гейт сплошности.
const CHORUS_LINES: string[] = [
  'what ive felt what ive known',       // 0
  'never shined through in what ive shown',
  'never be never see',
  'wont see what might have been',
  'what ive felt what ive known',
  'never shined through in what ive shown',
  'never free never me',
  'so i dub thee unforgiven',
  'oh ooh oh',                            // 8 (coda-подобный хвост)
];

describe('GWEN43 · N7 conf-gate по сплошности', () => {
  it('несплошной блок [0..7, 8] даёт conf=0 и guard=non-contiguous', () => {
    // Имитация прод-интерливинга: пропущен индекс внутри min..max.
    const broken = [...idx(0, 7), 9]; // 0..7 + 9 (дыра на 8)
    const r = splitSquareFull(broken, [...CHORUS_LINES, 'tail']);
    expect(r.conf).toBe(0);
    expect(r.guard).toBe('non-contiguous');
  });

  it('несплошной блок сохраняет покрытие (инвариант sum(units)==n)', () => {
    const broken = [...idx(0, 7), 9];
    const r = splitSquareFull(broken, [...CHORUS_LINES, 'tail']);
    expect(sum(r.units)).toBe(broken.length);
    expect(r.roman.length).toBe(r.units.length);
  });

  it('createSubBlocksFull тоже применяет гейт', () => {
    const broken = [...idx(0, 7), 9];
    const { result } = createSubBlocksFull(broken, [...CHORUS_LINES, 'tail']);
    expect(result.conf).toBe(0);
    expect(result.guard).toBe('non-contiguous');
  });

  it('НЕГАТИВНЫЙ КОНТРОЛЬ: сплошной блок гейт не трогает', () => {
    const whole = idx(0, 8);
    const r = splitSquareFull(whole, CHORUS_LINES);
    expect(r.guard).not.toBe('non-contiguous');
    // conf у сплошного либо из atoms, либо fallback=0 — но НЕ принудительно 0 через гейт.
    expect([CONF.fallback, CONF.unison, CONF.exactTrain, CONF.pairExactSquare, CONF.nearTrain, CONF.rondo, CONF.anaphora])
      .toContain(r.conf);
  });

  it('acceptance L (Gwen file 07): Chorus3 PROD [38..48,50] → conf=0 + route=non-contiguous', () => {
    // Точная форма L: 12 строк с дырой на 49, Outro с перекрёстной дырой на 50.
    // guard='non-contiguous' здесь = route seam-repair | human (отдельного поля route в контуре нет).
    const chorus3 = [...idx(38, 48), 50];
    const outro = [49, ...idx(51, 56)];
    const lines = Array.from({ length: 57 }, (_, i) => `line ${i}`);
    const c = splitSquareFull(chorus3, lines);
    const o = splitSquareFull(outro, lines);
    expect(c.conf).toBe(0);
    expect(c.guard).toBe('non-contiguous');
    expect(o.conf).toBe(0);
    expect(o.guard).toBe('non-contiguous');
    // Покрытие не ломается ни на одном из сломанных блоков.
    expect(sum(c.units)).toBe(chorus3.length);
    expect(sum(o.units)).toBe(outro.length);
  });
});
