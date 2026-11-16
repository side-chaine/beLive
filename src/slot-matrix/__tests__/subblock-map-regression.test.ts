// REGRESSION: единый сплиттер для сетки и активного подблока.
// Баг: activeSubIdx считался legacy createSubBlocks'ом, а применялся
// к массиву subBlocksOf (smart) → индекс уезжал на предыдущий подблок.
// Тесты на индексах/классах, без имён треков.
import { describe, it, expect } from 'vitest';
import { createSubBlocks, getActiveSubBlockIndex } from '../../utils/block-utils';
import { subBlocksOf } from '../../utils/subblocks';

describe('REGRESSION: activeSubIdx индексирует массив subBlocksOf', () => {
  // Паттерн: 2 копии группы [a,b,c] + хвост [x,y,z] → квадрат [6,3].
  // Legacy createSubBlocks → [4,5] (строка 4 в подблоке 1).
  // Smart subBlocksOf → [6,3] (строка 4 в подблоке 0).
  const lines = ['a', 'b', 'c', 'a', 'b', 'c', 'x', 'y', 'z'];
  const block = {
    id: 'outro-x',
    name: 'Block X',
    type: 'outro',
    lineIndices: lines.map((_, i) => i),
  };

  it('активная строка → индекс подблока в МАССИВЕ subBlocksOf', () => {
    const grid = subBlocksOf(block, lines, 6);
    const activeLine = 4;
    const idx = getActiveSubBlockIndex(activeLine, block, 6, lines);

    // Индекс из геттера обязан указывать на подблок, который реально
    // содержит активную строку в массиве, по которому строится сетка.
    expect(grid[idx].lineIndices).toContain(activeLine);
  });

  it('активный подблок не уезжает на предыдущий: только свои lineIndices', () => {
    const grid = subBlocksOf(block, lines, 6);
    const activeLine = 4;
    const idx = getActiveSubBlockIndex(activeLine, block, 6, lines);
    const active = grid[idx];

    // Доказательство расхождения: legacy-индекс, применённый к smart-массиву
    // (как было в баге), увёл бы на [6,7,8], где строки 4 НЕТ.
    const legacy = createSubBlocks(block.lineIndices, 6, lines);
    const legacyIdx = legacy.findIndex((s) => s.lineIndices.includes(activeLine));
    expect(legacyIdx).not.toBe(idx);
    expect(grid[legacyIdx].lineIndices).not.toContain(activeLine);

    // После правки — свой подблок, без чужих строк «предыдущего».
    expect(active.lineIndices).toEqual([0, 1, 2, 3, 4, 5]);
    expect(active.lineIndices).not.toContain(6);
  });
});
