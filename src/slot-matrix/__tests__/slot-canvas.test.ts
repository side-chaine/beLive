import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeSlotCanvas } from '../compute-slot-canvas';
import type { SlotMatrix, SlotGroup, SubBlockRange } from '../slot-matrix.types';
import type { TextBlock } from '../../stores/blocks.store';

// ═══════════════════════════════════════
// MOCKS
// ═══════════════════════════════════════

vi.mock('../../utils/block-utils', () => ({
  getBlockFontSize: (count: number) => {
    if (count <= 2) return '3.2rem';
    if (count <= 4) return '2.6rem';
    if (count <= 6) return '2.0rem';
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
  getActiveSubBlockIndex: () => 0,
}));

vi.mock('../../structure/block-colors', () => ({
  getCanonicalBlockColor: (type: string) => {
    const colors: Record<string, string> = {
      verse: '#4CAF50',
      chorus: '#F44336',
      bridge: '#9C27B0',
      intro: '#2196F3',
      outro: '#00BCD4',
      unknown: '#9E9E9E',
    };
    return colors[type] ?? '#9E9E9E';
  },
}));

// ═══════════════════════════════════════
// SETUP
// ═══════════════════════════════════════

beforeEach(() => {
  vi.spyOn(window, 'getComputedStyle').mockReturnValue({
    fontSize: '16px',
  } as CSSStyleDeclaration);
});

// Helper: создать SlotMatrix mock
function createMockMatrix(overrides?: Partial<SlotMatrix>): SlotMatrix {
  return {
    key: 'verse-1-0-1',
    slots: [
      {
        id: 'verse-1-0-0', blockId: 'verse-1', subBlockIndex: 0,
        slotIndex: 0, lineIndex: 0, text: 'Line one',
        parts: [], y: 0, height: 52, isEmpty: false, isPreview: false,
      },
      {
        id: 'verse-1-0-1', blockId: 'verse-1', subBlockIndex: 0,
        slotIndex: 1, lineIndex: 1, text: 'Line two',
        parts: [], y: 68, height: 52, isEmpty: false, isPreview: false,
      },
      {
        id: 'verse-1-0-2', blockId: 'verse-1', subBlockIndex: 0,
        slotIndex: 2, lineIndex: 2, text: 'Line three',
        parts: [], y: 136, height: 52, isEmpty: false, isPreview: false,
      },
      {
        id: 'verse-1-0-3', blockId: 'verse-1', subBlockIndex: 0,
        slotIndex: 3, lineIndex: 3, text: 'Line four',
        parts: [], y: 204, height: 52, isEmpty: false, isPreview: false,
      },
    ],
    lineHeight: 52,
    gapPx: 16,
    slotStep: 68,
    contentHeight: 256,
    totalHeight: 256,
    activeSlotIndex: 0,
    previewSlotIndex: -1,
    offsetY: 90,
    layoutMode: 'plate',
    interBlockGap: 24,
    subBlocks: [{
      id: 'verse-1-0',
      blockId: 'verse-1',
      subBlockIndex: 0,
      startSlotIndex: 0,
      endSlotIndex: 3,
      isFirst: true,
      isLast: true,
    }],
    activeSubBlock: {
      id: 'verse-1-0',
      blockId: 'verse-1',
      subBlockIndex: 0,
      startSlotIndex: 0,
      endSlotIndex: 3,
      isFirst: true,
      isLast: true,
    },
    ...overrides,
  };
}

// Helper: создать activeSlotGroup mock
function createMockSlotGroup(overrides?: Partial<SlotGroup>): SlotGroup {
  return {
    id: 'group-verse-1-0',
    blockId: 'verse-1',
    subBlockIndex: 0,
    slots: createMockMatrix().slots.filter(s => !s.isPreview && !s.isEmpty),
    previewSlot: null,
    subBlock: {
      id: 'verse-1-0',
      blockId: 'verse-1',
      subBlockIndex: 0,
      startSlotIndex: 0,
      endSlotIndex: 3,
      isFirst: true,
      isLast: true,
    },
    fontSize: '2.6rem',
    blockType: 'verse',
    blockColor: '#4CAF50',
    gridTemplateRows: 'minmax(52px, auto) minmax(52px, auto) minmax(52px, auto) minmax(52px, auto)',
    contentHeight: 256,
    totalHeight: 256,
    activeSlotIndex: 0,
    isPreview: false,
    isActive: true,
    x: 0,
    y: 0,
    width: 0,
    height: 256,
    opacity: 1.0,
    ...overrides,
  };
}

const mockNextBlock: TextBlock = {
  id: 'chorus-1',
  name: 'Chorus 1',
  type: 'chorus',
  lineIndices: [4, 5, 6, 7],
};

const mockLines = [
  'Line one', 'Line two', 'Line three', 'Line four',
  'Chorus one', 'Chorus two', 'Chorus three', 'Chorus four',
];

// ═══════════════════════════════════════
// TESTS
// ═══════════════════════════════════════

describe('computeSlotCanvas', () => {

  // ═══ Active group positioning ═══

  it('returns 1 group without nextBlock', () => {
    const canvas = computeSlotCanvas({
      matrix: createMockMatrix(),
      activeSlotGroup: createMockSlotGroup(),
      lines: mockLines,
      fontScale: 1.0,
      viewportWidth: 1200,
      viewportHeight: 600,
      plateWidth: 80,
    });
    expect(canvas.groups).toHaveLength(1);
    expect(canvas.groups[0].isPreview).toBe(false);
  });

  it('returns 2 groups with nextBlock', () => {
    const canvas = computeSlotCanvas({
      matrix: createMockMatrix(),
      activeSlotGroup: createMockSlotGroup(),
      nextBlock: mockNextBlock,
      lines: mockLines,
      fontScale: 1.0,
      viewportWidth: 1200,
      viewportHeight: 600,
      plateWidth: 80,
    });
    expect(canvas.groups).toHaveLength(2);
    expect(canvas.groups[1].isPreview).toBe(true);
  });

  it('active group Y = centered in viewport', () => {
    const canvas = computeSlotCanvas({
      matrix: createMockMatrix(),
      activeSlotGroup: createMockSlotGroup({ totalHeight: 256 }),
      lines: mockLines,
      fontScale: 1.0,
      viewportWidth: 1200,
      viewportHeight: 600,
      plateWidth: 80,
    });
    // Y = 600/2 - 256/2 = 300 - 128 = 172
    expect(canvas.groups[0].y).toBe(172);
  });

  it('active group width = viewportWidth × plateWidth%', () => {
    const canvas = computeSlotCanvas({
      matrix: createMockMatrix(),
      activeSlotGroup: createMockSlotGroup(),
      lines: mockLines,
      fontScale: 1.0,
      viewportWidth: 1200,
      viewportHeight: 600,
      plateWidth: 80,
    });
    // 1200 × 0.8 = 960
    expect(canvas.groups[0].width).toBe(960);
  });

  it('active group opacity = 1.0', () => {
    const canvas = computeSlotCanvas({
      matrix: createMockMatrix(),
      activeSlotGroup: createMockSlotGroup(),
      lines: mockLines,
      fontScale: 1.0,
      viewportWidth: 1200,
      viewportHeight: 600,
      plateWidth: 80,
    });
    expect(canvas.groups[0].opacity).toBe(1.0);
  });

  // ═══ Preview group ═══

  it('preview group opacity = 0.3 when shouldGrowPreview=false', () => {
    const canvas = computeSlotCanvas({
      matrix: createMockMatrix(),
      activeSlotGroup: createMockSlotGroup(),
      nextBlock: mockNextBlock,
      lines: mockLines,
      fontScale: 1.0,
      viewportWidth: 1200,
      viewportHeight: 600,
      plateWidth: 80,
      shouldGrowPreview: false,
    });
    expect(canvas.groups[1].opacity).toBe(0.3);
  });

  it('preview group opacity = 0.95 when shouldGrowPreview=true', () => {
    const canvas = computeSlotCanvas({
      matrix: createMockMatrix(),
      activeSlotGroup: createMockSlotGroup(),
      nextBlock: mockNextBlock,
      lines: mockLines,
      fontScale: 1.0,
      viewportWidth: 1200,
      viewportHeight: 600,
      plateWidth: 80,
      shouldGrowPreview: true,
    });
    expect(canvas.groups[1].opacity).toBe(0.95);
  });

  it('preview group Y = activeGroupBottom + interBlockGap', () => {
    const canvas = computeSlotCanvas({
      matrix: createMockMatrix(),
      activeSlotGroup: createMockSlotGroup({ totalHeight: 256 }),
      nextBlock: mockNextBlock,
      lines: mockLines,
      fontScale: 1.0,
      viewportWidth: 1200,
      viewportHeight: 600,
      plateWidth: 80,
      interBlockGap: 24,
    });
    // activeY = 172, activeGroupBottom = 172 + 256 = 428
    // previewY = 428 + 24 = 452
    expect(canvas.groups[1].y).toBe(452);
  });

  it('preview group has nextBlock color', () => {
    const canvas = computeSlotCanvas({
      matrix: createMockMatrix(),
      activeSlotGroup: createMockSlotGroup(),
      nextBlock: mockNextBlock,
      lines: mockLines,
      fontScale: 1.0,
      viewportWidth: 1200,
      viewportHeight: 600,
      plateWidth: 80,
    });
    expect(canvas.groups[1].blockColor).toBe('#F44336'); // chorus
  });

  it('preview group has 1 content slot', () => {
    const canvas = computeSlotCanvas({
      matrix: createMockMatrix(),
      activeSlotGroup: createMockSlotGroup(),
      nextBlock: mockNextBlock,
      lines: mockLines,
      fontScale: 1.0,
      viewportWidth: 1200,
      viewportHeight: 600,
      plateWidth: 80,
    });
    expect(canvas.groups[1].slots).toHaveLength(1);
    expect(canvas.groups[1].slots[0].text).toBe('Chorus one');
  });

  // ═══ Zoom ═══

  it('zoom=1.5 scales height and Y position', () => {
    const canvas = computeSlotCanvas({
      matrix: createMockMatrix(),
      activeSlotGroup: createMockSlotGroup({ totalHeight: 256 }),
      lines: mockLines,
      fontScale: 1.0,
      viewportWidth: 1200,
      viewportHeight: 600,
      plateWidth: 80,
      zoom: 1.5,
    });
    // scaledHeight = 256 * 1.5 = 384
    // activeY = 300 - 192 = 108
    expect(canvas.groups[0].height).toBe(384);
    expect(canvas.groups[0].y).toBe(108);
  });

  // ═══ SlotCanvas metadata ═══

  it('key includes zoom and viewport dimensions', () => {
    const canvas = computeSlotCanvas({
      matrix: createMockMatrix(),
      activeSlotGroup: createMockSlotGroup(),
      lines: mockLines,
      fontScale: 1.0,
      viewportWidth: 1200,
      viewportHeight: 600,
      plateWidth: 80,
      zoom: 1.5,
    });
    expect(canvas.key).toContain('1.5');
    expect(canvas.key).toContain('1200x600');
  });

  it('canvas viewportWidth/Height match params', () => {
    const canvas = computeSlotCanvas({
      matrix: createMockMatrix(),
      activeSlotGroup: createMockSlotGroup(),
      lines: mockLines,
      fontScale: 1.0,
      viewportWidth: 1200,
      viewportHeight: 600,
      plateWidth: 80,
    });
    expect(canvas.viewportWidth).toBe(1200);
    expect(canvas.viewportHeight).toBe(600);
  });
});
