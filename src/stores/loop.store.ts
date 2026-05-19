import { create } from 'zustand';
import { useMarkersStore } from './markers.store';
import { useBlocksStore } from './blocks.store';
import { useLyricsStore } from './lyrics.store';
import type { TextBlock } from './blocks.store';
import { getBlockTimeRange, getMergedBlockTimeRange } from '../utils/block-time-range';
import { createSubBlocks } from '../utils/block-utils';

interface LoopState {
  isLooping: boolean;
  loopBlockIds: string[];
  loopSubBlockKeys: string[];
  loopStartTime: number | null;
  loopEndTime: number | null;
  loopStartLine: number | null;
  loopEndLine: number | null;
  toggleBlock: (block: TextBlock) => void;
  toggleSubBlock: (block: TextBlock, subIndex: number, lines?: string[]) => void;
  rebindToBlock: (block: TextBlock) => void;
  replaceLoop: (block: TextBlock) => void;
  setBoundaryLines: (startLine: number, endLine: number) => void;
  clearLoop: () => void;
}

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

function recalculateFromSubBlockKeys(keys: string[]) {
  if (keys.length === 0) {
    return {
      isLooping: false,
      loopBlockIds: [],
      loopSubBlockKeys: [],
      loopStartTime: null as number | null,
      loopEndTime: null as number | null,
      loopStartLine: null as number | null,
      loopEndLine: null as number | null,
    };
  }
  const markers = useMarkersStore.getState().markers as any[];
  const allBlocks = useBlocksStore.getState().blocks;
  const lines = useLyricsStore.getState().lines;
  const blockIds = [...new Set(keys.map(k => k.split(':')[0]))];
  const loopBlocks = allBlocks.filter(b => blockIds.includes(b.id));
  const allLineIndices: number[] = [];
  for (const b of loopBlocks) {
    const subBlocks = createSubBlocks(b.lineIndices, 6, lines);
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
    loopSubBlockKeys: keys,
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
        const prevSubs = createSubBlocks(prevBlock.lineIndices, 6, lines);
        const nextSubs = createSubBlocks(nextBlock.lineIndices, 6, lines);
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

  toggleSubBlock: (block, subIndex, lines) => {
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
      set(recalculateFromSubBlockKeys(newKeys));
    } else {
      if (loopSubBlockKeys.length > 0 && !isSubBlockAdjacent(key, loopSubBlockKeys)) {
        return;
      }
      const newKeys = [...loopSubBlockKeys, key];
      set(recalculateFromSubBlockKeys(newKeys));
    }
  },

  toggleBlock: (block) => {
    const { loopBlockIds, loopSubBlockKeys } = get();
    const markers = useMarkersStore.getState().markers as any[];
    const allBlocks = useBlocksStore.getState().blocks;
    const lines = useLyricsStore.getState().lines;
    const isSelected = loopBlockIds.includes(block.id);
    const subBlocks = createSubBlocks(block.lineIndices, 6, lines);
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
      set(recalculateFromSubBlockKeys(newKeys));
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
      set(recalculateFromSubBlockKeys(newKeys));
    }
  },

  rebindToBlock: (block) => {
    const markers = useMarkersStore.getState().markers as any[];
    const lines = useLyricsStore.getState().lines;
    const range = getBlockTimeRange(block, markers);
    if (!range) return;
    const subBlocks = createSubBlocks(block.lineIndices, 6, lines);
    const newKeys = subBlocks.map((_, si) => `${block.id}:${si}`);
    set({
      isLooping: true,
      loopBlockIds: [block.id],
      loopSubBlockKeys: newKeys,
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
    const subBlocks = createSubBlocks(block.lineIndices, 6, lines);
    const newKeys = subBlocks.map((_, si) => `${block.id}:${si}`);
    set({
      isLooping: true,
      loopBlockIds: [block.id],
      loopSubBlockKeys: newKeys,
      loopStartTime: range.startTime,
      loopEndTime: range.endTime,
      loopStartLine: Math.min(...block.lineIndices),
      loopEndLine: Math.max(...block.lineIndices),
    });
  },

  setBoundaryLines: (startLine, endLine) => {
    const markers = useMarkersStore.getState().markers as any[];
    const allBlocks = useBlocksStore.getState().blocks;
    const lines = useLyricsStore.getState().lines;
    const newSubBlockKeys: string[] = [];
    for (const b of allBlocks) {
      const subBlocks = createSubBlocks(b.lineIndices, 6, lines);
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
    set({
      loopStartLine: startLine,
      loopEndLine: endLine,
      loopStartTime: range?.startTime ?? get().loopStartTime,
      loopEndTime: range?.endTime ?? get().loopEndTime,
      loopSubBlockKeys: newSubBlockKeys,
      loopBlockIds: newBlockIds,
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
    });
  },
}));