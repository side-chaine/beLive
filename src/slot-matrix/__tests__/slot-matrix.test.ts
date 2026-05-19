import { describe, test, expect, vi, beforeEach } from 'vitest';
import {
  remToPx,
  getRootFontSize,
  resetRootFontSizeCache,
  computeLineHeight,
  computeSlotY,
  computeTotalHeight,
  computeOffsetY,
  computeSlotId,
  parseBracketedParts,
  LINE_HEIGHT_MULTIPLIER,
  DEFAULT_SLOT_GAP,
  DEFAULT_INTER_BLOCK_GAP,
  MAX_SUB_BLOCK_LINES,
} from '../slot-matrix.utils';
import { computeSlotMatrix } from '../compute-slot-matrix';

// ═══════════════════════════════════════════════════
// MOCKS
// ═══════════════════════════════════════════════════

vi.mock('../../utils/block-utils', () => ({
  getBlockFontSize: (count: number) => {
    if (count <= 2) return '3.2rem';
    if (count <= 4) return '2.6rem';
    if (count <= 6) return '2.0rem';
    if (count <= 8) return '1.6rem';
    return '1.3rem';
  },
  createSubBlocks: (indices: number[], max: number) => {
    const clampedMax = Math.max(1, max);
    const result: Array<{
      id: string;
      lineIndices: number[];
      isFirst: boolean;
      isLast: boolean;
    }> = [];
    for (let i = 0; i < indices.length; i += clampedMax) {
      const chunk = indices.slice(i, i + clampedMax);
      result.push({
        id: `sub-${result.length}`,
        lineIndices: chunk,
        isFirst: i === 0,
        isLast: i + clampedMax >= indices.length,
      });
    }
    return result;
  },
  getActiveBlock: (activeLine: number, blocks: any[]) => {
    return blocks.find((b: any) => b.lineIndices.includes(activeLine)) ?? null;
  },
  getActiveSubBlockIndex: (activeLine: number, block: any, max: number) => {
    return 0;
  },
}));

vi.mock('../../structure/block-colors', () => ({
  getCanonicalBlockColor: (type: string) => {
    const colors: Record<string, string> = {
      verse: '#4CAF50',
      prechorus: '#FFEB3B',
      chorus: '#F44336',
      bridge: '#9C27B0',
      interlude: '#E91E63',
      intro: '#2196F3',
      outro: '#00BCD4',
      unknown: '#9E9E9E',
    };
    return colors[type] ?? '#9E9E9E';
  },
}));

// ═══════════════════════════════════════════════════
// SETUP
// ═══════════════════════════════════════════════════

beforeEach(() => {
  resetRootFontSizeCache();
  vi.spyOn(window, 'getComputedStyle').mockReturnValue({
    fontSize: '16px',
  } as CSSStyleDeclaration);
});

// ═══════════════════════════════════════════════════
// SLOT UTILS
// ═══════════════════════════════════════════════════

describe('slot-matrix.utils', () => {

  // --- remToPx ---

  test('remToPx: 1rem = 16px при rootFontSize 16', () => {
    expect(remToPx(1)).toBe(16);
  });

  test('remToPx: 2.6rem = 41.6px', () => {
    expect(remToPx(2.6)).toBeCloseTo(41.6, 1);
  });

  test('remToPx: 0rem = 0px', () => {
    expect(remToPx(0)).toBe(0);
  });

  // --- computeLineHeight ---

  test('computeLineHeight: 2.6rem × 1.0 fontScale = 52px', () => {
    expect(computeLineHeight('2.6rem', 1.0)).toBeCloseTo(52, 0);
  });

  test('computeLineHeight: 2.6rem × 1.5 fontScale = 78px', () => {
    expect(computeLineHeight('2.6rem', 1.5)).toBeCloseTo(78, 0);
  });

  test('computeLineHeight: 3.2rem × 1.0 = 64px', () => {
    expect(computeLineHeight('3.2rem', 1.0)).toBeCloseTo(64, 0);
  });

  // --- computeSlotY ---

  test('computeSlotY: slot 0 = 0', () => {
    expect(computeSlotY(0, 52, 8)).toBe(0);
  });

  test('computeSlotY: slot 1 = 60', () => {
    expect(computeSlotY(1, 52, 8)).toBe(60);
  });

  test('computeSlotY: slot 2 = 120', () => {
    expect(computeSlotY(2, 52, 8)).toBe(120);
  });

  // --- computeTotalHeight ---

  test('computeTotalHeight: 4 слота → 232px', () => {
    // (4-1) × (52+8) + 52 = 232
    expect(computeTotalHeight(4, 52, 8)).toBe(232);
  });

  test('computeTotalHeight: 1 слот = lineHeight', () => {
    expect(computeTotalHeight(1, 52, 8)).toBe(52);
  });

  test('computeTotalHeight: 0 слотов = 0', () => {
    expect(computeTotalHeight(0, 52, 8)).toBe(0);
  });

  test('computeTotalHeight: gap НЕ включается после последнего', () => {
    expect(computeTotalHeight(1, 50, 10)).toBe(50);
  });

  // --- computeOffsetY ---

  test('computeOffsetY: slot 0 → 90', () => {
    // totalHeight=232, slotStep=60, lineHeight=52
    // (232/2) - 0 - 26 = 90
    expect(computeOffsetY(0, 60, 52, 232)).toBe(90);
  });

  test('computeOffsetY: slot 1 → 30', () => {
    // (232/2) - 60 - 26 = 30
    expect(computeOffsetY(1, 60, 52, 232)).toBe(30);
  });

  test('computeOffsetY: slot 2 → -30', () => {
    // (232/2) - 120 - 26 = -30
    expect(computeOffsetY(2, 60, 52, 232)).toBe(-30);
  });

  // --- computeSlotId ---

  test('computeSlotId: verse-1-0-2', () => {
    expect(computeSlotId('verse-1', 0, 2)).toBe('verse-1-0-2');
  });

  test('computeSlotId: chorus-2-1-0', () => {
    expect(computeSlotId('chorus-2', 1, 0)).toBe('chorus-2-1-0');
  });

  // --- parseBracketedParts ---

  test('parseBracketedParts: "(Oh) I know" → [back, lead]', () => {
    const parts = parseBracketedParts('(Oh) I know what it takes', 'test');
    expect(parts).toHaveLength(2);
    expect(parts[0].type).toBe('back');
    expect(parts[0].text).toBe('(Oh)');
    expect(parts[0].bracketed).toBe(true);
    expect(parts[1].type).toBe('lead');
    expect(parts[1].text).toBe('I know what it takes');
    expect(parts[1].bracketed).toBe(false);
  });

  test('parseBracketedParts: no brackets → single lead', () => {
    const parts = parseBracketedParts('Just a normal line', 'test');
    expect(parts).toHaveLength(1);
    expect(parts[0].type).toBe('lead');
    expect(parts[0].bracketed).toBe(false);
  });

  test('parseBracketedParts: multiple brackets → 4 parts', () => {
    const parts = parseBracketedParts('(Oh) I know (yeah) what it takes', 'test');
    expect(parts).toHaveLength(4);
    expect(parts[0].type).toBe('back');
    expect(parts[1].type).toBe('lead');
    expect(parts[2].type).toBe('back');
    expect(parts[3].type).toBe('lead');
  });

  test('parseBracketedParts: only brackets', () => {
    const parts = parseBracketedParts('(Oh)', 'test');
    expect(parts).toHaveLength(1);
    expect(parts[0].type).toBe('back');
  });

  test('parseBracketedParts: empty string', () => {
    expect(parseBracketedParts('', 'test')).toHaveLength(0);
  });

  test('parseBracketedParts: part IDs include prefix', () => {
    const parts = parseBracketedParts('(Oh) test', 'verse-1-0-2');
    expect(parts[0].id).toBe('verse-1-0-2-back-0');
    expect(parts[1].id).toBe('verse-1-0-2-lead-0');
  });

  // --- Constants ---

  test('constants have expected values', () => {
    expect(LINE_HEIGHT_MULTIPLIER).toBe(1.25);
    expect(DEFAULT_SLOT_GAP).toBe(8);
    expect(DEFAULT_INTER_BLOCK_GAP).toBe(24);
    expect(MAX_SUB_BLOCK_LINES).toBe(6);
  });
});

// ═══════════════════════════════════════════════════
// COMPUTE SLOT MATRIX
// ═══════════════════════════════════════════════════

describe('computeSlotMatrix', () => {
  const mockBlock = {
    id: 'verse-1',
    name: 'Verse 1',
    type: 'verse',
    lineIndices: [0, 1, 2, 3],
  };

  const mockNextBlock = {
    id: 'chorus-1',
    name: 'Chorus 1',
    type: 'chorus',
    lineIndices: [4, 5],
  };

  const mockLines = [
    'Line one of verse',
    'Line two of verse',
    'Line three of verse',
    'Line four of verse',
    'Lift me up let me go',
    'Line two of chorus',
  ];

  test('creates 4 content slots for 4-line block', () => {
    const matrix = computeSlotMatrix({
      displayBlock: mockBlock,
      activeLineIndex: 1,
      lines: mockLines,
      fontScale: 1.0,
    });

    expect(matrix.slots.filter(s => !s.isPreview)).toHaveLength(4);
    expect(matrix.layoutMode).toBe('plate');
    expect(matrix.gapPx).toBe(DEFAULT_SLOT_GAP);
    expect(matrix.interBlockGap).toBe(DEFAULT_INTER_BLOCK_GAP);
  });

  test('each slot has correct text and lineIndex', () => {
    const matrix = computeSlotMatrix({
      displayBlock: mockBlock,
      activeLineIndex: 0,
      lines: mockLines,
      fontScale: 1.0,
    });

    expect(matrix.slots[0].text).toBe('Line one of verse');
    expect(matrix.slots[0].lineIndex).toBe(0);
    expect(matrix.slots[3].text).toBe('Line four of verse');
    expect(matrix.slots[3].lineIndex).toBe(3);
  });

  test('slot IDs follow pattern blockId-subBlockIndex-slotIndex', () => {
    const matrix = computeSlotMatrix({
      displayBlock: mockBlock,
      activeLineIndex: 0,
      lines: mockLines,
      fontScale: 1.0,
    });

    expect(matrix.slots[0].id).toBe('verse-1-0-0');
    expect(matrix.slots[2].id).toBe('verse-1-0-2');
  });

  test('slot Y positions are predictable', () => {
    const matrix = computeSlotMatrix({
      displayBlock: mockBlock,
      activeLineIndex: 0,
      lines: mockLines,
      fontScale: 1.0,
    });

    expect(matrix.slots[0].y).toBe(0);
    expect(matrix.slots[1].y).toBe(matrix.slotStep);
    expect(matrix.slots[2].y).toBe(matrix.slotStep * 2);
    expect(matrix.slots[3].y).toBe(matrix.slotStep * 3);
  });

  test('activeSlotIndex matches activeLineIndex', () => {
    const matrix = computeSlotMatrix({
      displayBlock: mockBlock,
      activeLineIndex: 2,
      lines: mockLines,
      fontScale: 1.0,
    });

    expect(matrix.activeSlotIndex).toBe(2);
  });

  test('activeSlotIndex defaults to 0 for invalid line', () => {
    const matrix = computeSlotMatrix({
      displayBlock: mockBlock,
      activeLineIndex: -1,
      lines: mockLines,
      fontScale: 1.0,
    });

    expect(matrix.activeSlotIndex).toBe(0);
  });

  test('creates preview slot with next block data', () => {
    const matrix = computeSlotMatrix({
      displayBlock: mockBlock,
      activeLineIndex: 0,
      lines: mockLines,
      fontScale: 1.0,
      nextBlock: mockNextBlock,
    });

    const ps = matrix.slots.find(s => s.isPreview);
    expect(ps).toBeDefined();
    expect(ps!.text).toBe('Lift me up let me go');
    expect(ps!.previewBlockType).toBe('chorus');
    expect(ps!.previewBlockColor).toBe('#F44336');
    expect(ps!.blockId).toBe('chorus-1');
  });

  test('preview Y = last content bottom + interBlockGap', () => {
    const matrix = computeSlotMatrix({
      displayBlock: mockBlock,
      activeLineIndex: 0,
      lines: mockLines,
      fontScale: 1.0,
      nextBlock: mockNextBlock,
      interBlockGap: 24,
    });

    const lastContent = matrix.slots.filter(s => !s.isPreview).pop()!;
    const ps = matrix.slots.find(s => s.isPreview)!;

    expect(ps.y).toBe(lastContent.y + lastContent.height + 24);
  });

  test('preview slot height differs for different fontSize', () => {
    const matrix = computeSlotMatrix({
      displayBlock: mockBlock,
      activeLineIndex: 0,
      lines: mockLines,
      fontScale: 1.0,
      nextBlock: mockNextBlock,
    });

    const contentSlot = matrix.slots[0];
    const ps = matrix.slots.find(s => s.isPreview)!;

    expect(ps.height).toBeGreaterThan(contentSlot.height);
  });

  test('no preview slot when nextBlock undefined', () => {
    const matrix = computeSlotMatrix({
      displayBlock: mockBlock,
      activeLineIndex: 0,
      lines: mockLines,
      fontScale: 1.0,
    });

    expect(matrix.previewSlotIndex).toBe(-1);
    expect(matrix.slots.find(s => s.isPreview)).toBeUndefined();
  });

  test('offsetY centers active slot', () => {
    const matrix = computeSlotMatrix({
      displayBlock: mockBlock,
      activeLineIndex: 0,
      lines: mockLines,
      fontScale: 1.0,
    });

    expect(matrix.offsetY).toBeGreaterThan(0);
  });

  test('fontScale affects lineHeight and slotStep', () => {
    const m1 = computeSlotMatrix({
      displayBlock: mockBlock,
      activeLineIndex: 0,
      lines: mockLines,
      fontScale: 1.0,
    });

    const m2 = computeSlotMatrix({
      displayBlock: mockBlock,
      activeLineIndex: 0,
      lines: mockLines,
      fontScale: 1.5,
    });

    expect(m2.lineHeight).toBeGreaterThan(m1.lineHeight);
    expect(m2.slotStep).toBeGreaterThan(m1.slotStep);
  });

  test('key changes with different fontScale', () => {
    const m1 = computeSlotMatrix({
      displayBlock: mockBlock,
      activeLineIndex: 0,
      lines: mockLines,
      fontScale: 1.0,
    });

    const m2 = computeSlotMatrix({
      displayBlock: mockBlock,
      activeLineIndex: 0,
      lines: mockLines,
      fontScale: 1.5,
    });

    expect(m1.key).not.toBe(m2.key);
  });

  test('loop boundaries marked on slots', () => {
    const matrix = computeSlotMatrix({
      displayBlock: mockBlock,
      activeLineIndex: 0,
      lines: mockLines,
      fontScale: 1.0,
      loopStartLine: 1,
      loopEndLine: 2,
    });

    expect(matrix.slots[1].isLoopStart).toBe(true);
    expect(matrix.slots[2].isLoopEnd).toBe(true);
    expect(matrix.slots[0].isLoopStart).toBeFalsy();
    expect(matrix.slots[3].isLoopEnd).toBeFalsy();
  });

  test('bracketed parts parsed in slots', () => {
    const linesWithBack = [
      '(Oh) I know what it takes',
      'Line two',
      'Line three',
      'Line four',
    ];

    const matrix = computeSlotMatrix({
      displayBlock: mockBlock,
      activeLineIndex: 0,
      lines: linesWithBack,
      fontScale: 1.0,
    });

    expect(matrix.slots[0].parts).toHaveLength(2);
    expect(matrix.slots[0].parts[0].type).toBe('back');
    expect(matrix.slots[0].parts[0].text).toBe('(Oh)');
    expect(matrix.slots[0].parts[1].type).toBe('lead');
    expect(matrix.slots[0].parts[1].text).toBe('I know what it takes');
  });

  test('subBlocks computed correctly', () => {
    const matrix = computeSlotMatrix({
      displayBlock: mockBlock,
      activeLineIndex: 0,
      lines: mockLines,
      fontScale: 1.0,
    });

    expect(matrix.subBlocks.length).toBeGreaterThanOrEqual(1);
    expect(matrix.subBlocks[0].blockId).toBe('verse-1');
    expect(matrix.subBlocks[0].isFirst).toBe(true);
  });

  test('totalHeight includes preview slot', () => {
    const m1 = computeSlotMatrix({
      displayBlock: mockBlock,
      activeLineIndex: 0,
      lines: mockLines,
      fontScale: 1.0,
    });

    const m2 = computeSlotMatrix({
      displayBlock: mockBlock,
      activeLineIndex: 0,
      lines: mockLines,
      fontScale: 1.0,
      nextBlock: mockNextBlock,
    });

    expect(m2.totalHeight).toBeGreaterThan(m1.totalHeight);
  });

  test('offsetY computed from contentHeight, not totalHeight', () => {
    const mWithPS = computeSlotMatrix({
      displayBlock: mockBlock,
      activeLineIndex: 0,
      lines: mockLines,
      fontScale: 1.0,
      nextBlock: mockNextBlock,
    });

    const mNoPS = computeSlotMatrix({
      displayBlock: mockBlock,
      activeLineIndex: 0,
      lines: mockLines,
      fontScale: 1.0,
    });

    // offsetY одинаковый — ПС не влияет на центрирование
    expect(mWithPS.offsetY).toBe(mNoPS.offsetY);
  });
});

// ═══════════════════════════════════════════════════
// GRID MODE TESTS (gapPx=16)
// ═══════════════════════════════════════════════════

describe('Grid mode (gapPx=16)', () => {
  const mockBlock = {
    id: 'verse-1',
    type: 'verse',
    name: 'Verse 1',
    lineIndices: [0, 1, 2, 3],
  };

  const mockNextBlock = {
    id: 'chorus-1',
    type: 'chorus',
    name: 'Chorus 1',
    lineIndices: [4, 5, 6, 7],
  };

  const mockLines = [
    'Line one',
    'Line two',
    'Line three',
    'Line four',
    'Chorus one',
  ];

  const GRID_GAP = 16;

  test('slotStep = lineHeight + 16', () => {
    const matrix = computeSlotMatrix({
      displayBlock: mockBlock,
      activeLineIndex: 0,
      lines: mockLines,
      fontScale: 1.0,
      gapPx: GRID_GAP,
    });

    // lineHeight = 2.6rem × 16 × 1.25 × 1.0 = 52px
    expect(matrix.lineHeight).toBe(52);
    expect(matrix.slotStep).toBe(52 + 16); // 68
  });

  test('contentHeight = N*lineHeight + (N-1)*16', () => {
    const matrix = computeSlotMatrix({
      displayBlock: mockBlock,
      activeLineIndex: 0,
      lines: mockLines,
      fontScale: 1.0,
      gapPx: GRID_GAP,
    });

    // 4 слота: 4*52 + 3*16 = 208 + 48 = 256
    expect(matrix.contentHeight).toBe(256);
  });

  test('slot.y = slotIndex * (lineHeight + 16)', () => {
    const matrix = computeSlotMatrix({
      displayBlock: mockBlock,
      activeLineIndex: 0,
      lines: mockLines,
      fontScale: 1.0,
      gapPx: GRID_GAP,
    });

    expect(matrix.slots[0].y).toBe(0);      // 0 × 68
    expect(matrix.slots[1].y).toBe(68);     // 1 × 68
    expect(matrix.slots[2].y).toBe(136);    // 2 × 68
    expect(matrix.slots[3].y).toBe(204);    // 3 × 68
  });

  test('preview Y = last content bottom + interBlockGap', () => {
    const matrix = computeSlotMatrix({
      displayBlock: mockBlock,
      activeLineIndex: 0,
      lines: mockLines,
      fontScale: 1.0,
      gapPx: GRID_GAP,
      nextBlock: mockNextBlock,
    });

    const lastContent = matrix.slots[3];
    const previewSlot = matrix.slots[4];

    expect(previewSlot.y).toBe(lastContent.y + lastContent.height + 24);
    // 204 + 52 + 24 = 280
    expect(previewSlot.y).toBe(280);
  });

  test('totalHeight includes preview slot with gap=16', () => {
    const matrix = computeSlotMatrix({
      displayBlock: mockBlock,
      activeLineIndex: 0,
      lines: mockLines,
      fontScale: 1.0,
      gapPx: GRID_GAP,
      nextBlock: mockNextBlock,
    });

    // previewSlot.y (280) + previewSlot.height (52) = 332
    expect(matrix.totalHeight).toBe(332);
  });

  test('offsetY centers active slot with grid gap', () => {
    const matrix = computeSlotMatrix({
      displayBlock: mockBlock,
      activeLineIndex: 1,
      lines: mockLines,
      fontScale: 1.0,
      gapPx: GRID_GAP,
    });

    // contentHeight = 256, activeSlotY = 1 × 68 = 68
    // offsetY = 256/2 - 68 - 52/2 = 128 - 68 - 26 = 34
    expect(matrix.offsetY).toBe(34);
  });

  test('gapPx propagates to matrix.gapPx', () => {
    const matrix = computeSlotMatrix({
      displayBlock: mockBlock,
      activeLineIndex: 0,
      lines: mockLines,
      fontScale: 1.0,
      gapPx: GRID_GAP,
    });

    expect(matrix.gapPx).toBe(16);
  });
});
