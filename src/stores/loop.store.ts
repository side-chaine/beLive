import { create } from 'zustand';
import { useMarkersStore } from './markers.store';
import { useBlocksStore } from './blocks.store';
import { useLyricsStore } from './lyrics.store';
import type { TextBlock } from './blocks.store';
import { getBlockTimeRange } from '../utils/block-time-range';
import { createSubBlocks } from '../utils/block-utils';
import { MAX_SUB_BLOCK_LINES } from '../slot-matrix/slot-matrix.utils';

// v2 (рефактор, 07.11): канонический набор sub-ключей — единственная правда
// (как в v1, чтобы не сломать LoopEngineV3 / RehearsalLyrics / slot-matrix).
// Отличия от v1, доказанные дифф-тестом v1↔v2 (36/36):
//  1) ключи ВСЕГДА хранятся в порядке трека (исчез «латентный бардак» порядка вставки);
//  2) setBoundaryLines на пустой петле больше не оставляет зомби-состояние (isLooping=false при keys≠[]).
// Настоящее «развязывание» уровней (петля ≠ суб-блоки) достигается в селекторах и
// компонентах LoopContour / SubSegmentRow, которые читают разные срезы этого же стора.
const MAX_SUB = MAX_SUB_BLOCK_LINES;

interface LoopState {
  isLooping: boolean;
  loopBlockIds: string[];
  loopSubBlockKeys: string[];
  loopStartTime: number | null;
  loopEndTime: number | null;
  loopStartLine: number | null;
  loopEndLine: number | null;
  loopOrigin: 'ui' | 'canvas' | null;
  toggleBlock: (block: TextBlock) => void;
  toggleSubBlock: (block: TextBlock, subIndex: number, lines?: string[]) => void;
  rebindToBlock: (block: TextBlock) => void;
  replaceLoop: (block: TextBlock) => void;
  setBoundaryLines: (startLine: number, endLine: number) => void;
  clearLoop: () => void;
  setRawLoop: (start: number, end: number) => void;
}

/** Ключи всегда в порядке трека — единый источник правды. */
function sortByBlockOrder(keys: string[]): string[] {
  const allBlocks = useBlocksStore.getState().blocks;
  return [...keys].sort((a, b) => {
    const [aBlock, aSub] = a.split(':');
    const [bBlock, bSub] = b.split(':');
    const aBlockIdx = allBlocks.findIndex(bl => bl.id === aBlock);
    const bBlockIdx = allBlocks.findIndex(bl => bl.id === bBlock);
    if (aBlockIdx !== bBlockIdx) return aBlockIdx - bBlockIdx;
    return parseInt(aSub) - parseInt(bSub);
  });
}

/** Пересчёт наблюдаемого состояния из канонического набора sub-keys. */
function recalculateFromSubBlockKeys(keys: string[]) {
  if (keys.length === 0) {
    return {
      isLooping: false,
      loopBlockIds: [] as string[],
      loopSubBlockKeys: [] as string[],
      loopStartTime: null as number | null,
      loopEndTime: null as number | null,
      loopStartLine: null as number | null,
      loopEndLine: null as number | null,
      loopOrigin: null,
    };
  }
  const markers = useMarkersStore.getState().markers as any[];
  const allBlocks = useBlocksStore.getState().blocks;
  const lines = useLyricsStore.getState().lines;
  const blockIds = [...new Set(keys.map(k => k.split(':')[0]))];
  const loopBlocks = allBlocks.filter(b => blockIds.includes(b.id));
  const allLineIndices: number[] = [];
  for (const b of loopBlocks) {
    const subBlocks = createSubBlocks(b.lineIndices, MAX_SUB, lines);
    for (const key of keys) {
      const [bId, sIdx] = [key.split(':')[0], parseInt(key.split(':')[1])];
      if (bId === b.id && subBlocks[sIdx]) {
        allLineIndices.push(...subBlocks[sIdx].lineIndices);
      }
    }
  }
  const uniqueIndices = [...new Set(allLineIndices)].sort((a, b) => a - b);
  const startLine = uniqueIndices[0];
  const endLine = uniqueIndices[uniqueIndices.length - 1];
  const virtualBlock = { lineIndices: uniqueIndices };
  const range = getBlockTimeRange(virtualBlock, markers);
  return {
    isLooping: true,
    loopBlockIds: blockIds,
    loopSubBlockKeys: sortByBlockOrder(keys),
    loopStartTime: range?.startTime ?? null,
    loopEndTime: range?.endTime ?? null,
    loopStartLine: startLine,
    loopEndLine: endLine,
  };
}

function isSubBlockAdjacent(key: string, existingKeys: string[]): boolean {
  if (existingKeys.length === 0) return true;
  const [blockId, subIdx] = [key.split(':')[0], parseInt(key.split(':')[1])];
  for (const existingKey of existingKeys) {
    const [eBlockId, eSubIdx] = [existingKey.split(':')[0], parseInt(existingKey.split(':')[1])];
    if (blockId === eBlockId && Math.abs(subIdx - eSubIdx) === 1) return true;
    if (blockId !== eBlockId) {
      const allBlocks = useBlocksStore.getState().blocks;
      const blockIdx = allBlocks.findIndex(b => b.id === blockId);
      const eBlockIdx = allBlocks.findIndex(b => b.id === eBlockId);
      if (Math.abs(blockIdx - eBlockIdx) === 1) {
        const lines = useLyricsStore.getState().lines;
        const prevBlockId = blockIdx < eBlockIdx ? blockId : eBlockId;
        const nextBlockId = blockIdx < eBlockIdx ? eBlockId : blockId;
        const prevSubIdx = blockIdx < eBlockIdx ? subIdx : eSubIdx;
        const nextSubIdx = blockIdx < eBlockIdx ? eSubIdx : subIdx;
        const prevBlock = allBlocks.find(b => b.id === prevBlockId);
        const nextBlock = allBlocks.find(b => b.id === nextBlockId);
        if (!prevBlock || !nextBlock) continue;
        const prevSubs = createSubBlocks(prevBlock.lineIndices, MAX_SUB, lines);
        if (prevSubIdx === prevSubs.length - 1 && nextSubIdx === 0) return true;
      }
    }
  }
  return false;
}

export const useLoopStore = create<LoopState>((set, get) => ({
  isLooping: false,
  loopBlockIds: [],
  loopSubBlockKeys: [],
  loopStartTime: null,
  loopEndTime: null,
  loopStartLine: null,
  loopEndLine: null,
  loopOrigin: null,

  toggleSubBlock: (block, subIndex) => {
    const key = `${block.id}:${subIndex}`;
    const { loopSubBlockKeys } = get();
    if (loopSubBlockKeys.includes(key)) {
      const sorted = sortByBlockOrder(loopSubBlockKeys);
      if (key !== sorted[0] && key !== sorted[sorted.length - 1]) {
        return;
      }
      const newKeys = loopSubBlockKeys.filter(k => k !== key);
      if (newKeys.length === 0) {
        get().clearLoop();
        return;
      }
      set({ ...recalculateFromSubBlockKeys(newKeys), loopOrigin: 'ui' });
    } else {
      if (loopSubBlockKeys.length > 0 && !isSubBlockAdjacent(key, loopSubBlockKeys)) {
        return;
      }
      const newKeys = [...loopSubBlockKeys, key];
      set({ ...recalculateFromSubBlockKeys(newKeys), loopOrigin: 'ui' });
    }
  },

  toggleBlock: (block) => {
    const { loopBlockIds, loopSubBlockKeys } = get();
    const allBlocks = useBlocksStore.getState().blocks;
    const lines = useLyricsStore.getState().lines;
    const isSelected = loopBlockIds.includes(block.id);
    const subBlocks = createSubBlocks(block.lineIndices, MAX_SUB, lines);
    const blockSubKeys = subBlocks.map((_, si) => `${block.id}:${si}`);
    if (isSelected) {
      const sortedBlockIds = [...new Set(loopSubBlockKeys.map(k => k.split(':')[0]))];
      const sortedByOrder = sortByBlockOrder(sortedBlockIds.map(id => `${id}:0`)).map(k => k.split(':')[0]);
      const isFirstBlock = sortedByOrder[0] === block.id;
      const isLastBlock = sortedByOrder[sortedByOrder.length - 1] === block.id;
      if (!isFirstBlock && !isLastBlock) return;
      const newKeys = loopSubBlockKeys.filter(k => !blockSubKeys.includes(k));
      if (newKeys.length === 0) {
        get().clearLoop();
        return;
      }
      set({ ...recalculateFromSubBlockKeys(newKeys), loopOrigin: 'ui' });
    } else {
      if (loopBlockIds.length > 0) {
        const blockIdx = allBlocks.findIndex(b => b.id === block.id);
        const isAdjacent = loopBlockIds.some(id => {
          const idx = allBlocks.findIndex(b => b.id === id);
          return Math.abs(idx - blockIdx) === 1;
        });
        if (!isAdjacent) return;
      }
      const newKeys = [...loopSubBlockKeys, ...blockSubKeys];
      set({ ...recalculateFromSubBlockKeys(newKeys), loopOrigin: 'ui' });
    }
  },

  rebindToBlock: (block) => {
    const markers = useMarkersStore.getState().markers as any[];
    const lines = useLyricsStore.getState().lines;
    const range = getBlockTimeRange(block, markers);
    if (!range) return;
    const subBlocks = createSubBlocks(block.lineIndices, MAX_SUB, lines);
    const newKeys = subBlocks.map((_, si) => `${block.id}:${si}`);
    set({
      isLooping: true,
      loopBlockIds: [block.id],
      loopSubBlockKeys: sortByBlockOrder(newKeys),
      loopStartTime: range.startTime,
      loopEndTime: range.endTime,
      loopStartLine: Math.min(...block.lineIndices),
      loopEndLine: Math.max(...block.lineIndices),
    });
  },

  replaceLoop: (block) => {
    const markers = useMarkersStore.getState().markers as any[];
    const lines = useLyricsStore.getState().lines;
    const range = getBlockTimeRange(block, markers);
    if (!range) return;
    const subBlocks = createSubBlocks(block.lineIndices, MAX_SUB, lines);
    const newKeys = subBlocks.map((_, si) => `${block.id}:${si}`);
    set({
      isLooping: true,
      loopBlockIds: [block.id],
      loopSubBlockKeys: sortByBlockOrder(newKeys),
      loopStartTime: range.startTime,
      loopEndTime: range.endTime,
      loopStartLine: Math.min(...block.lineIndices),
      loopEndLine: Math.max(...block.lineIndices),
      loopOrigin: 'ui',
    });
  },

  setBoundaryLines: (startLine, endLine) => {
    const markers = useMarkersStore.getState().markers as any[];
    const allBlocks = useBlocksStore.getState().blocks;
    const lines = useLyricsStore.getState().lines;
    const newSubBlockKeys: string[] = [];
    for (const b of allBlocks) {
      const subBlocks = createSubBlocks(b.lineIndices, MAX_SUB, lines);
      for (let si = 0; si < subBlocks.length; si++) {
        const sub = subBlocks[si];
        const hasOverlap = sub.lineIndices.some(li => li >= startLine && li <= endLine);
        if (hasOverlap) {
          newSubBlockKeys.push(`${b.id}:${si}`);
        }
      }
    }
    const newBlockIds = [...new Set(newSubBlockKeys.map(k => k.split(':')[0]))];
    const uniqueIndices: number[] = [];
    for (let li = startLine; li <= endLine; li++) {
      uniqueIndices.push(li);
    }
    const virtualBlock = { lineIndices: uniqueIndices };
    const range = getBlockTimeRange(virtualBlock, markers);
    // v2: не оставляем зомби-состояние (v1 оставлял isLooping=false при keys≠[])
    set({
      isLooping: true,
      loopStartLine: startLine,
      loopEndLine: endLine,
      loopStartTime: range?.startTime ?? get().loopStartTime,
      loopEndTime: range?.endTime ?? get().loopEndTime,
      loopSubBlockKeys: sortByBlockOrder(newSubBlockKeys),
      loopBlockIds: newBlockIds,
      loopOrigin: 'ui',
    });
  },

  clearLoop: () => {
    set({
      isLooping: false,
      loopBlockIds: [],
      loopSubBlockKeys: [],
      loopStartTime: null,
      loopEndTime: null,
      loopStartLine: null,
      loopEndLine: null,
      loopOrigin: null,
    });
  },

  setRawLoop: (start, end) => set({
    isLooping: true,
    loopStartTime: start,
    loopEndTime: end,
    loopOrigin: 'canvas',
  }),
}));
