import { describe, it, expect } from 'vitest';
import {
  bracketCap,
  buildLoopGeo,
  buildStepSeams,
  leftBracket,
  regionBounds,
  subFill,
  wagonOfLine,
  xEnd,
  xStart,
  LOOP_CAP,
  LOOP_GAP,
  LOOP_PAD,
  type WagonSpan,
} from './loop-geometry';

/**
 * Раскладка-стенд: 4 вагона по 4 строки.
 * Габарит 100px, зазор 8px, border 1px, padding 8px слева и 30px справа
 * (30 = место под кнопку петли — именно из-за него полоса строк уже вагона).
 */
function span(i: number, lines: number, startLine: number): WagonSpan {
  const boxLeft = i * 108;
  return {
    boxLeft,
    boxRight: boxLeft + 100,
    left: boxLeft + 9,
    width: 60,
    top: 0,
    bottom: 44,
    lineIndices: Array.from({ length: lines }, (_, k) => startLine + k),
  };
}

const SPANS: WagonSpan[] = [
  span(0, 4, 0),
  span(1, 4, 4),
  span(2, 4, 8),
  span(3, 4, 12),
];

describe('loop-geometry · края региона', () => {
  it('блок целиком: скобка симметрична относительно вагона (±LOOP_PAD)', () => {
    const sx = xStart(SPANS, 4);
    const ex = xEnd(SPANS, 8);
    const x = sx - LOOP_PAD;
    const w = ex - sx + LOOP_PAD * 2;
    expect(sx).toBe(108);
    expect(ex).toBe(208);
    expect(x - 108).toBe(-LOOP_PAD);
    expect(x + w - 208).toBe(LOOP_PAD);
  });

  it('РЕГРЕСС v3: правая граница — правый край ЭТОГО вагона, а не левый следующего', () => {
    // Именно эта подмена и давала «скобка прижата к соседу»: между вагонами
    // зазор 8px, и правый край региона уезжал на gap + PAD внутрь соседа.
    expect(xEnd(SPANS, 8)).toBe(208);
    expect(xEnd(SPANS, 8)).not.toBe(SPANS[2].boxLeft);
    expect(xEnd(SPANS, 8) - xStart(SPANS, 4)).toBe(100);
  });

  it('регион внутри блока: интерполяция по полосе строк', () => {
    // строка 5 — вторая в вагоне ⇒ 9 + (1/4)*60 = 24 от левого края вагона
    expect(xStart(SPANS, 5)).toBe(108 + 9 + 15);
    // последняя строка 6 ⇒ эксклюзивный шов 7 ⇒ 9 + (3/4)*60 = 54
    expect(xEnd(SPANS, 7)).toBe(108 + 9 + 45);
    // две строки = ровно половина полосы
    expect(xEnd(SPANS, 7) - xStart(SPANS, 5)).toBe(30);
  });

  it('шов на стыке блоков слева/справа даёт разные точки (это и есть суть)', () => {
    // шов 8 — это одновременно конец вагона 1 и начало вагона 2
    expect(xEnd(SPANS, 8)).toBe(208);
    expect(xStart(SPANS, 8)).toBe(216);
    expect(xStart(SPANS, 8) - xEnd(SPANS, 8)).toBe(8); // зазор
  });

  it('пустой список вагонов не роняет геометрию', () => {
    expect(xStart([], 0)).toBe(0);
    expect(xEnd([], 0)).toBe(0);
  });

  it('wagonOfLine находит владельца и возвращает -1 для зазора', () => {
    expect(wagonOfLine(SPANS, 0)).toBe(0);
    expect(wagonOfLine(SPANS, 7)).toBe(1);
    expect(wagonOfLine(SPANS, 99)).toBe(-1);
  });
});

describe('loop-geometry · заливка ровно по строкам', () => {
  it('подблок целиком внутри региона залит на 100%', () => {
    expect(subFill([4, 5, 6], 4, 6)).toEqual({ from: 0, to: 100 });
  });

  it('регион режет подблок посередине', () => {
    const f = subFill([4, 5, 6], 5, 6);
    expect(f.from).toBeCloseTo(100 / 3, 5);
    expect(f.to).toBe(100);
  });

  it('регион задевает середину: [0,1,2,3] и строки 1..2', () => {
    const f = subFill([0, 1, 2, 3], 1, 2);
    expect(f.from).toBe(25);
    expect(f.to).toBe(75);
  });

  it('вне региона — пустая заливка, а не «чуть-чуть»', () => {
    expect(subFill([0, 1], 5, 9)).toEqual({ from: 0, to: 0 });
  });
});

describe('loop-geometry · швы и прилипание', () => {
  const geo = buildLoopGeo(SPANS, [6]);

  it('шаговые швы = края блоков + начала подблоков', () => {
    expect(geo.stepSeams).toEqual([0, 4, 6, 8, 12, 16]);
  });

  it('строчные швы покрывают каждую границу строки', () => {
    expect(geo.lineSeams).toContain(5);
    expect(geo.lineSeams).toContain(13);
    expect(geo.lineSeams.length).toBe(17); // 0..16
  });

  it('магнит тянется к ближайшему шву, а не к курсору', () => {
    // xStart(4) = 108, xStart(5) = 124
    expect(geo.snap(109, 'start', 'line')).toBe(4);
    expect(geo.snap(123, 'start', 'line')).toBe(5);
    // xEnd(7) = 154 — курсор почти на нём
    expect(geo.snap(155, 'end', 'line')).toBe(7);
  });

  it('в шаговом режиме строчные швы недоступны', () => {
    // 5 — строчный шов, но не шаговый: ближайший шаговый либо 4, либо 6
    expect(geo.snap(124, 'start', 'step')).toBe(4);
  });

  it('buildStepSeams без подблоков = только края блоков', () => {
    expect(buildStepSeams(SPANS, [])).toEqual([0, 4, 8, 12, 16]);
  });
});

describe('loop-geometry · усики не смыкаются в рамку', () => {
  it('широкий регион получает полный усик', () => {
    expect(bracketCap(300)).toBe(LOOP_CAP);
  });

  it('узкий регион: усик урезан, но просвет в середине остался', () => {
    const w = 39; // примерно одна строка + PAD с двух сторон
    const c = bracketCap(w);
    expect(c).toBeLessThan(LOOP_CAP);
    expect(w - 2 * c).toBeGreaterThanOrEqual(LOOP_GAP - 1e-6);
  });

  it('очень узкий регион: усиков нет вовсе — две вертикали, а не коробка', () => {
    expect(bracketCap(10)).toBe(0);
    expect(bracketCap(0)).toBe(0);
  });

  it('путь для узкого региона начинается с укороченного усика', () => {
    // (39 - 14) / 2 = 12.5 — а не 18, иначе усики встретятся и выйдет рамка
    expect(leftBracket(0, 0, 39, 54, 5, LOOP_CAP)).toContain('M12.5 0.0');
  });
});

describe('loop-geometry · вертикальные границы', () => {
  it('берёт верх первого и низ последнего вагона региона', () => {
    const spans = [
      { ...SPANS[0], top: 0, bottom: 44 },
      { ...SPANS[1], top: 50, bottom: 94 },
      { ...SPANS[2], top: 100, bottom: 144 },
    ];
    expect(regionBounds(spans, 4, 11)).toEqual({ top: 50, bottom: 144 });
  });

  it('пустой регион отдаёт нули, а не Infinity', () => {
    expect(regionBounds(SPANS, 100, 200)).toEqual({ top: 0, bottom: 0 });
  });
});
