import { describe, it, expect } from 'vitest';
import { getBlockTimeRange, getMergedBlockTimeRange, isBlockTakesReady } from '../block-time-range';

const markers = [
  { id: '1', lineIndex: 0, time: 0, text: 'line 0' },
  { id: '2', lineIndex: 2, time: 10, text: 'line 2' },
  { id: '3', lineIndex: 5, time: 25, text: 'line 5' },
  { id: '4', lineIndex: 8, time: 40, text: 'line 8' },
];

describe('getBlockTimeRange', () => {
  it('returns correct range for block with start and end markers', () => {
    const block = { lineIndices: [2, 3, 4] };
    const result = getBlockTimeRange(block, markers);
    expect(result).toEqual({ startTime: 10, endTime: 25 });
  });

  it('returns null when no start marker found', () => {
    const block = { lineIndices: [99] };
    expect(getBlockTimeRange(block, markers)).toBeNull();
  });

  it('returns null for empty lineIndices', () => {
    const block = { lineIndices: [] };
    expect(getBlockTimeRange(block, markers)).toBeNull();
  });

  it('returns null for empty markers', () => {
    const block = { lineIndices: [0, 1] };
    expect(getBlockTimeRange(block, [])).toBeNull();
  });

  it('uses fallback 30s for last block without end marker', () => {
    const block = { lineIndices: [8, 9, 10] };
    const result = getBlockTimeRange(block, markers);
    expect(result).toEqual({ startTime: 40, endTime: 70 });
  });

  it('uses trackDuration as cap for last block fallback', () => {
    const block = { lineIndices: [8, 9, 10] };
    const result = getBlockTimeRange(block, markers, 50);
    expect(result).toEqual({ startTime: 40, endTime: 50 });
  });

  it('handles single-line block', () => {
    const block = { lineIndices: [0] };
    const result = getBlockTimeRange(block, markers);
    expect(result).toEqual({ startTime: 0, endTime: 10 });
  });
});

describe('getMergedBlockTimeRange', () => {
  it('merges adjacent blocks', () => {
    const blocks = [
      { lineIndices: [0, 1] },
      { lineIndices: [2, 3, 4] },
    ];
    const result = getMergedBlockTimeRange(blocks, markers);
    expect(result).toEqual({ startTime: 0, endTime: 25 });
  });

  it('returns null when no blocks have markers', () => {
    const blocks = [{ lineIndices: [99] }];
    expect(getMergedBlockTimeRange(blocks, markers)).toBeNull();
  });

  it('skips blocks without markers in merge', () => {
    const blocks = [
      { lineIndices: [99] },
      { lineIndices: [2, 3, 4] },
    ];
    const result = getMergedBlockTimeRange(blocks, markers);
    expect(result).toEqual({ startTime: 10, endTime: 25 });
  });
});

describe('isBlockTakesReady', () => {
  it('returns true for valid block with markers', () => {
    const block = { lineIndices: [2, 3, 4] };
    expect(isBlockTakesReady(block, markers)).toBe(true);
  });

  it('returns false for block without markers', () => {
    const block = { lineIndices: [99] };
    expect(isBlockTakesReady(block, markers)).toBe(false);
  });

  it('returns false for empty lineIndices', () => {
    const block = { lineIndices: [] as number[] };
    expect(isBlockTakesReady(block, markers)).toBe(false);
  });

  it('returns false for block with duration less than 1 second', () => {
    const tightMarkers = [
      { id: '1', lineIndex: 0, time: 10.0, text: 'line 0' },
      { id: '2', lineIndex: 1, time: 10.5, text: 'line 1' },
    ];
    const block = { lineIndices: [0] };
    expect(isBlockTakesReady(block, tightMarkers)).toBe(false);
  });

  it('returns true for block with exactly 1 second duration', () => {
    const exactMarkers = [
      { id: '1', lineIndex: 0, time: 10.0, text: 'line 0' },
      { id: '2', lineIndex: 1, time: 11.0, text: 'line 1' },
    ];
    const block = { lineIndices: [0] };
    expect(isBlockTakesReady(block, exactMarkers)).toBe(true);
  });
});

import { selectBlockByTime } from '../block-time-range';

describe('selectBlockByTime (TC-DS-09)', () => {
  const ranges = [
    { blockId: 'A', startTime: 0,  endTime: 10 },
    { blockId: 'B', startTime: 15, endTime: 25 },
    { blockId: 'C', startTime: 30, endTime: 40 },
  ];

  it('exact match — playhead within block B', () => {
    expect(selectBlockByTime(ranges, 18)).toBe('B');
  });

  it('exact match — playhead at block start', () => {
    expect(selectBlockByTime(ranges, 15)).toBe('B');
  });

  it('exact match — playhead at block end boundary', () => {
    expect(selectBlockByTime(ranges, 10)).toBe('B');
  });

  it('gap — closer to previous block', () => {
    expect(selectBlockByTime(ranges, 11)).toBe('A');
  });

  it('gap — closer to next block', () => {
    expect(selectBlockByTime(ranges, 14)).toBe('B');
  });

  it('gap — equidistant → tie-break forward', () => {
    expect(selectBlockByTime(ranges, 12.5)).toBe('B');
  });

  it('gap — before first block → selects first', () => {
    expect(selectBlockByTime(ranges, -5)).toBe('A');
  });

  it('gap — after last block → selects last', () => {
    expect(selectBlockByTime(ranges, 50)).toBe('C');
  });

  it('empty ranges → null', () => {
    expect(selectBlockByTime([], 10)).toBeNull();
  });

  it('single range, playhead before it → selects it', () => {
    expect(selectBlockByTime([{ blockId: 'X', startTime: 5, endTime: 10 }], 0)).toBe('X');
  });
});
