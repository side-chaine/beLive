import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeSlotGroups } from '../compute-slot-groups';
import type { TextBlock } from '../../stores/blocks.store';
import { createSubBlocks } from '../../utils/block-utils';

// Mock block
const mockBlock: TextBlock = {
  id: 'verse-1',
  name: 'Verse 1',
  type: 'verse',
  lineIndices: [0, 1, 2, 3],
};

const mockBlock8: TextBlock = {
  id: 'verse-2',
  name: 'Verse 2',
  type: 'verse',
  lineIndices: [4, 5, 6, 7, 8, 9, 10, 11],
};

const mockNextBlock: TextBlock = {
  id: 'chorus-1',
  name: 'Chorus 1',
  type: 'chorus',
  lineIndices: [12, 13, 14, 15],
};

const lines = [
  'Line 0', 'Line 1', 'Line 2', 'Line 3',
  'Line 4', 'Line 5', 'Line 6', 'Line 7',
  'Line 8', 'Line 9', 'Line 10', 'Line 11',
  'Chorus 0', 'Chorus 1', 'Chorus 2', 'Chorus 3',
];

describe('computeSlotGroups', () => {
  // ═══ Базовые тесты ═══
  
  it('returns 1 group for 4-line block (1 subBlock)', () => {
    const groups = computeSlotGroups({
      displayBlock: mockBlock,
      activeLineIndex: 1,
      lines,
      fontScale: 1.0,
      blockType: 'verse',
    });
    expect(groups).toHaveLength(1);
    expect(groups[0].isActive).toBe(true);
    expect(groups[0].subBlockIndex).toBe(0);
  });

  it('returns 2 groups for 8-line block (2 subBlocks)', () => {
    const groups = computeSlotGroups({
      displayBlock: mockBlock8,
      activeLineIndex: 5,
      lines,
      fontScale: 1.0,
      blockType: 'verse',
    });
    expect(groups).toHaveLength(2);
    expect(groups[0].subBlockIndex).toBe(0);
    expect(groups[1].subBlockIndex).toBe(1);
  });

  it('marks correct group as active', () => {
    const groups = computeSlotGroups({
      displayBlock: mockBlock8,
      activeLineIndex: 8,
      lines,
      fontScale: 1.0,
      blockType: 'verse',
    });
    expect(groups[0].isActive).toBe(false);
    expect(groups[1].isActive).toBe(true);
  });

  // ═══ Слоты ═══
  
  it('each group has correct number of content slots', () => {
    const groups = computeSlotGroups({
      displayBlock: mockBlock8,
      activeLineIndex: 5,
      lines,
      fontScale: 1.0,
      blockType: 'verse',
    });
    expect(groups[0].slots).toHaveLength(4); // lines 4-7
    expect(groups[1].slots).toHaveLength(4); // lines 8-11
  });

  it('slots have correct lineIndex values', () => {
    const groups = computeSlotGroups({
      displayBlock: mockBlock,
      activeLineIndex: 1,
      lines,
      fontScale: 1.0,
      blockType: 'verse',
    });
    expect(groups[0].slots.map(s => s.lineIndex)).toEqual([0, 1, 2, 3]);
  });

  it('activeSlotIndex is correct', () => {
    const groups = computeSlotGroups({
      displayBlock: mockBlock,
      activeLineIndex: 2,
      lines,
      fontScale: 1.0,
      blockType: 'verse',
    });
    expect(groups[0].activeSlotIndex).toBe(2);
  });

  it('activeSlotIndex = -1 when activeLine not in group', () => {
    const groups = computeSlotGroups({
      displayBlock: mockBlock8,
      activeLineIndex: 8,
      lines,
      fontScale: 1.0,
      blockType: 'verse',
    });
    expect(groups[0].activeSlotIndex).toBe(-1);
  });

  // ═══ ПС (Preview Slot) ═══
  
  it('active group gets previewSlot when nextBlock exists', () => {
    const groups = computeSlotGroups({
      displayBlock: mockBlock,
      activeLineIndex: 1,
      lines,
      fontScale: 1.0,
      blockType: 'verse',
      nextBlock: mockNextBlock,
    });
    expect(groups[0].previewSlot).not.toBeNull();
    expect(groups[0].previewSlot!.isPreview).toBe(true);
    expect(groups[0].previewSlot!.lineIndex).toBe(12);
  });

  it('non-active groups have no previewSlot', () => {
    const groups = computeSlotGroups({
      displayBlock: mockBlock8,
      activeLineIndex: 5,
      lines,
      fontScale: 1.0,
      blockType: 'verse',
      nextBlock: mockNextBlock,
    });
    expect(groups[1].previewSlot).toBeNull(); // неактивный подблок
  });

  it('previewSlot has nextBlock color', () => {
    const groups = computeSlotGroups({
      displayBlock: mockBlock,
      activeLineIndex: 1,
      lines,
      fontScale: 1.0,
      blockType: 'verse',
      nextBlock: mockNextBlock,
    });
    expect(groups[0].previewSlot!.previewBlockColor).toBe('#F44336');
  });

  it('no previewSlot when no nextBlock', () => {
    const groups = computeSlotGroups({
      displayBlock: mockBlock,
      activeLineIndex: 1,
      lines,
      fontScale: 1.0,
      blockType: 'verse',
    });
    expect(groups[0].previewSlot).toBeNull();
  });

  // ═══ Визуальные данные ═══
  
  it('fontSize matches getBlockFontSize for slot count', () => {
    const groups = computeSlotGroups({
      displayBlock: mockBlock,
      activeLineIndex: 1,
      lines,
      fontScale: 1.0,
      blockType: 'verse',
    });
    expect(groups[0].fontSize).toBe('2.6rem'); // 4 lines
  });

  it('blockColor is canonical', () => {
    const groups = computeSlotGroups({
      displayBlock: mockBlock,
      activeLineIndex: 1,
      lines,
      fontScale: 1.0,
      blockType: 'verse',
    });
    expect(groups[0].blockColor).toBe('#4CAF50');
  });

  it('gridTemplateRows is minmax format', () => {
    const groups = computeSlotGroups({
      displayBlock: mockBlock,
      activeLineIndex: 1,
      lines,
      fontScale: 1.0,
      blockType: 'verse',
    });
    // gridTemplateRows = "minmax(52px, auto) minmax(52px, auto) ..."
    const rows = groups[0].gridTemplateRows.match(/minmax\(\d+px, auto\)/g);
    expect(rows).not.toBeNull();
    expect(rows!).toHaveLength(4);
  });

  // ═══ Высоты ═══
  
  it('contentHeight is correct', () => {
    const groups = computeSlotGroups({
      displayBlock: mockBlock,
      activeLineIndex: 1,
      lines,
      fontScale: 1.0,
      blockType: 'verse',
      gapPx: 16,
    });
    // 4 × 52 + 3 × 16 = 256
    expect(groups[0].contentHeight).toBe(256);
  });

  it('totalHeight = contentHeight when no previewSlot', () => {
    const groups = computeSlotGroups({
      displayBlock: mockBlock,
      activeLineIndex: 1,
      lines,
      fontScale: 1.0,
      blockType: 'verse',
      gapPx: 16,
    });
    expect(groups[0].totalHeight).toBe(groups[0].contentHeight);
  });

  it('totalHeight > contentHeight when previewSlot exists', () => {
    const groups = computeSlotGroups({
      displayBlock: mockBlock,
      activeLineIndex: 1,
      lines,
      fontScale: 1.0,
      blockType: 'verse',
      nextBlock: mockNextBlock,
      gapPx: 16,
    });
    expect(groups[0].totalHeight).toBeGreaterThan(groups[0].contentHeight);
  });

  // ═══ Позиции (Phase 3.3+) ═══
  
  it('x, y, width = 0 (placeholder for Phase 3.3)', () => {
    const groups = computeSlotGroups({
      displayBlock: mockBlock,
      activeLineIndex: 1,
      lines,
      fontScale: 1.0,
      blockType: 'verse',
    });
    expect(groups[0].x).toBe(0);
    expect(groups[0].y).toBe(0);
    expect(groups[0].width).toBe(0);
  });

  it('height = totalHeight', () => {
    const groups = computeSlotGroups({
      displayBlock: mockBlock,
      activeLineIndex: 1,
      lines,
      fontScale: 1.0,
      blockType: 'verse',
      gapPx: 16,
    });
    expect(groups[0].height).toBe(groups[0].totalHeight);
  });

  // ═══ SubBlockRange ═══
  
  it('subBlock isFirst/isLast are correct', () => {
    const groups = computeSlotGroups({
      displayBlock: mockBlock8,
      activeLineIndex: 5,
      lines,
      fontScale: 1.0,
      blockType: 'verse',
    });
    expect(groups[0].subBlock.isFirst).toBe(true);
    expect(groups[0].subBlock.isLast).toBe(false);
    expect(groups[1].subBlock.isFirst).toBe(false);
    expect(groups[1].subBlock.isLast).toBe(true);
  });

  // ═══ Grid mode (gapPx=16) ═══
  
  it('grid mode: slot positions correct with gapPx=16', () => {
    const groups = computeSlotGroups({
      displayBlock: mockBlock,
      activeLineIndex: 1,
      lines,
      fontScale: 1.0,
      blockType: 'verse',
      gapPx: 16,
    });
    const slots = groups[0].slots;
    expect(slots[0].y).toBe(0);
    expect(slots[1].y).toBe(68);  // 52 + 16
    expect(slots[2].y).toBe(136); // 68 + 68
    expect(slots[3].y).toBe(204); // 136 + 68
  });

  it('groups have opacity field', () => {
    const groups = computeSlotGroups({
      displayBlock: mockBlock,
      activeLineIndex: 1,
      lines,
      fontScale: 1.0,
      blockType: 'verse',
    });
    expect(groups[0].opacity).toBe(1.0); // active
  });
});

describe('createSubBlocks — balanced split (TC-SUB-01)', () => {
  const makeIndices = (n: number) => Array.from({ length: n }, (_, i) => i);
  
  it('1-5 строк → один подблок', () => {
    for (let n = 1; n <= 5; n++) {
      const result = createSubBlocks(makeIndices(n));
      expect(result).toHaveLength(1);
      expect(result[0].lineIndices).toHaveLength(n);
      expect(result[0].isFirst).toBe(true);
      expect(result[0].isLast).toBe(true);
    }
  });
  
  it('6 строк → [3, 3]', () => {
    const result = createSubBlocks(makeIndices(6));
    expect(result).toHaveLength(2);
    expect(result[0].lineIndices).toHaveLength(3);
    expect(result[1].lineIndices).toHaveLength(3);
    expect(result[0].isFirst).toBe(true);
    expect(result[0].isLast).toBe(false);
    expect(result[1].isFirst).toBe(false);
    expect(result[1].isLast).toBe(true);
  });
  
  it('7 строк → [3, 4]', () => {
    const result = createSubBlocks(makeIndices(7));
    expect(result).toHaveLength(2);
    expect(result[0].lineIndices).toHaveLength(3);
    expect(result[1].lineIndices).toHaveLength(4);
  });
  
  it('8 строк → [4, 4]', () => {
    const result = createSubBlocks(makeIndices(8));
    expect(result).toHaveLength(2);
    expect(result[0].lineIndices).toHaveLength(4);
    expect(result[1].lineIndices).toHaveLength(4);
  });
  
  it('9 строк → [4, 5]', () => {
    const result = createSubBlocks(makeIndices(9));
    expect(result).toHaveLength(2);
    expect(result[0].lineIndices).toHaveLength(4);
    expect(result[1].lineIndices).toHaveLength(5);
  });
  
  it('10 строк → [4, 6]', () => {
    const result = createSubBlocks(makeIndices(10));
    expect(result).toHaveLength(2);
    expect(result[0].lineIndices).toHaveLength(4);
    expect(result[1].lineIndices).toHaveLength(6);
  });
  
  it('11 строк → [4, 4, 3]', () => {
    const result = createSubBlocks(makeIndices(11));
    expect(result).toHaveLength(3);
    expect(result[0].lineIndices).toHaveLength(4);
    expect(result[1].lineIndices).toHaveLength(4);
    expect(result[2].lineIndices).toHaveLength(3);
  });
  
  it('12 строк → [4, 4, 4]', () => {
    const result = createSubBlocks(makeIndices(12));
    expect(result).toHaveLength(3);
    expect(result[0].lineIndices).toHaveLength(4);
    expect(result[1].lineIndices).toHaveLength(4);
    expect(result[2].lineIndices).toHaveLength(4);
  });
  
  it('13 строк → [4, 4, 5]', () => {
    const result = createSubBlocks(makeIndices(13));
    expect(result).toHaveLength(3);
    expect(result[0].lineIndices).toHaveLength(4);
    expect(result[1].lineIndices).toHaveLength(4);
    expect(result[2].lineIndices).toHaveLength(5);
  });
  
  it('14 строк → [4, 5, 5]', () => {
    const result = createSubBlocks(makeIndices(14));
    expect(result).toHaveLength(3);
    expect(result[0].lineIndices).toHaveLength(4);
    expect(result[1].lineIndices).toHaveLength(5);
    expect(result[2].lineIndices).toHaveLength(5);
  });
  
  it('15 строк → [5, 5, 5]', () => {
    const result = createSubBlocks(makeIndices(15));
    expect(result).toHaveLength(3);
    expect(result[0].lineIndices).toHaveLength(5);
    expect(result[1].lineIndices).toHaveLength(5);
    expect(result[2].lineIndices).toHaveLength(5);
  });
  
  it('isFirst/isLast корректны для всех размеров', () => {
    for (let n = 1; n <= 18; n++) {
      const result = createSubBlocks(makeIndices(n));
      expect(result[0].isFirst).toBe(true);
      expect(result[0].isLast).toBe(result.length === 1);
      expect(result[result.length - 1].isLast).toBe(true);
      expect(result[result.length - 1].isFirst).toBe(result.length === 1);
      // Все подблоки имеют isFirst или isLast (или оба)
      for (const sb of result) {
        expect(sb.isFirst !== undefined).toBe(true);
        expect(sb.isLast !== undefined).toBe(true);
      }
    }
  });
  
  it('пустой массив → пустой результат', () => {
    const result = createSubBlocks([]);
    expect(result).toHaveLength(0);
  });
});

describe('echo-detection', () => {
  const makeIndices = (n: number) => Array.from({ length: n }, (_, i) => i);
  
  it('Linkin Park: echo "dont know" → подтверждает [4,6]', () => {
    const lines = [
      "I don't know what's worth fighting for",
      "Or why I have to scream",
      "But now I have some clarity",
      "To show you what I mean",
      "I don't know how I got this way",
      "I'll never be alright",
      "So, I'm breaking the habit",
      "I'm breaking the habit",
      "I'm breaking the habit",
      "Tonight"
    ];
    const result = createSubBlocks(makeIndices(10), 6, lines);
    expect(result).toHaveLength(2);
    expect(result[0].lineIndices).toHaveLength(4);
    expect(result[1].lineIndices).toHaveLength(6);
  });
  
  it('Повтор хука: gap=0 → НЕ корректирует', () => {
    const lines = [
      "Running through the fire",
      "Running through the fire",
      "Running through the fire",
      "Never gonna stop",
      "Never gonna stop",
      "Tonight"
    ];
    const result = createSubBlocks(makeIndices(6), 6, lines);
    expect(result).toHaveLength(2);
    expect(result[0].lineIndices).toHaveLength(3);
    expect(result[1].lineIndices).toHaveLength(3);
  });
  
  it('Идентичные строки с gap=2 → НЕ корректирует', () => {
    const lines = [
      "With the lights out its less dangerous",
      "Here we are now entertain us",
      "I feel stupid and contagious",
      "Here we are now entertain us",
      "A mulatto an albino",
      "A mosquito my libido"
    ];
    const result = createSubBlocks(makeIndices(6), 6, lines);
    expect(result).toHaveLength(2);
    expect(result[0].lineIndices).toHaveLength(3);
    expect(result[1].lineIndices).toHaveLength(3);
  });
  
  it('Частое слово → стоп-лист фильтрует', () => {
    const lines = [
      "Love is all you need",
      "Love is all we feel",
      "Love is everything",
      "Love will set us free",
      "Love can heal the world",
      "Love is you and me"
    ];
    const result = createSubBlocks(makeIndices(6), 6, lines);
    expect(result).toHaveLength(2);
    expect(result[0].lineIndices).toHaveLength(3);
    expect(result[1].lineIndices).toHaveLength(3);
  });
  
  it('Без lines → базовое деление без echo', () => {
    const result = createSubBlocks(makeIndices(10), 6);
    expect(result).toHaveLength(2);
    expect(result[0].lineIndices).toHaveLength(4);
    expect(result[1].lineIndices).toHaveLength(6);
  });
  
  it('Echo сдвигает базу: Walking alone', () => {
    const lines = [
      "Walking alone through the night",
      "Shadows are falling down",
      "Looking around for a sign",
      "Walking alone till the morning light",
      "Nothing is what it seems",
      "Lost in the city of dreams",
      "Trying to find my way home",
      "Calling you on the phone"
    ];
    const result = createSubBlocks(makeIndices(8), 6, lines);
    expect(result).toHaveLength(2);
    expect(result[0].lineIndices).toHaveLength(3);
    expect(result[1].lineIndices).toHaveLength(5);
  });
  
  it('Маленький блок → без echo', () => {
    const lines = [
      "This is something",
      "That I want",
      "This is something",
      "That I need"
    ];
    const result = createSubBlocks(makeIndices(4), 6, lines);
    expect(result).toHaveLength(1);
    expect(result[0].lineIndices).toHaveLength(4);
  });
  
  it('Совпадение 1 слова → недостаточно для echo', () => {
    const lines = [
      "Take me to the river",
      "Wash me in the water",
      "Drop me in the ocean",
      "Take me to the mountain",
      "Hide me in the valley",
      "Show me what you got"
    ];
    const result = createSubBlocks(makeIndices(6), 6, lines);
    expect(result).toHaveLength(2);
    expect(result[0].lineIndices).toHaveLength(3);
    expect(result[1].lineIndices).toHaveLength(3);
  });
});
