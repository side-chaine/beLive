import { create } from 'zustand';
import { useMarkersStore } from './markers.store';
import { useBlocksStore } from './blocks.store';
import type { TextBlock } from './blocks.store';

interface LoopState {
  isLooping: boolean;
  loopBlockIds: string[];
  loopStartTime: number | null;
  loopEndTime: number | null;
  loopStartLine: number | null;
  loopEndLine: number | null;
  toggleBlock: (block: TextBlock) => void;
  rebindToBlock: (block: TextBlock) => void;
  setBoundaryLines: (startLine: number, endLine: number) => void;
  clearLoop: () => void;
}

export const useLoopStore = create<LoopState>((set, get) => ({
  isLooping: false,
  loopBlockIds: [],
  loopStartTime: null,
  loopEndTime: null,
  loopStartLine: null,
  loopEndLine: null,

  toggleBlock: (block) => {
    const { loopBlockIds } = get();
    const markers = useMarkersStore.getState().markers as any[];
    const allBlocks = useBlocksStore.getState().blocks;

    const isSelected = loopBlockIds.includes(block.id);

    if (isSelected) {
      const newIds = loopBlockIds.filter(id => id !== block.id);
      if (newIds.length === 0) {
        set({ isLooping: false, loopBlockIds: [], loopStartTime: null, loopEndTime: null, loopStartLine: null, loopEndLine: null });
        return;
      }
      const selected = allBlocks.filter(b => newIds.includes(b.id));
      let minStart = Infinity;
      let maxEnd = -Infinity;
      for (const b of selected) {
        const first = Math.min(...b.lineIndices);
        const last = Math.max(...b.lineIndices);
        const sm = markers.find((m: any) => m.lineIndex === first);
        const em = markers.find((m: any) => m.lineIndex > last);
        if (sm) {
          minStart = Math.min(minStart, sm.time);
          maxEnd = Math.max(maxEnd, em ? em.time : sm.time + 30);
        }
      }
      const allLineIndices = selected.flatMap(b => b.lineIndices);
      set({ isLooping: true, loopBlockIds: newIds, loopStartTime: minStart, loopEndTime: maxEnd, loopStartLine: Math.min(...allLineIndices), loopEndLine: Math.max(...allLineIndices) });
      return;
    }

    if (loopBlockIds.length > 0) {
      const blockIdx = allBlocks.findIndex(b => b.id === block.id);
      const isAdjacent = loopBlockIds.some(id => {
        const idx = allBlocks.findIndex(b => b.id === id);
        return Math.abs(idx - blockIdx) === 1;
      });
      if (!isAdjacent) return;
    }

    const newIds = [...loopBlockIds, block.id];

    const selected = allBlocks.filter(b => newIds.includes(b.id));
    let minStart = Infinity;
    let maxEnd = -Infinity;

    for (const b of selected) {
      const first = Math.min(...b.lineIndices);
      const last = Math.max(...b.lineIndices);
      const sm = markers.find((m: any) => m.lineIndex === first);
      const em = markers.find((m: any) => m.lineIndex > last);
      if (sm) {
        minStart = Math.min(minStart, sm.time);
        maxEnd = Math.max(maxEnd, em ? em.time : sm.time + 30);
      }
    }

    if (minStart === Infinity) return;

    const allLineIndices = selected.flatMap(b => b.lineIndices);

    set({
      isLooping: true,
      loopBlockIds: newIds,
      loopStartTime: minStart,
      loopEndTime: maxEnd,
      loopStartLine: Math.min(...allLineIndices),
      loopEndLine: Math.max(...allLineIndices),
    });
  },

  rebindToBlock: (block) => {
    const markers = useMarkersStore.getState().markers as any[];
    const first = Math.min(...block.lineIndices);
    const last = Math.max(...block.lineIndices);
    const sm = markers.find((m: any) => m.lineIndex === first);
    if (!sm) return;
    const em = markers.find((m: any) => m.lineIndex > last);

    set({
      isLooping: true,
      loopBlockIds: [block.id],
      loopStartTime: sm.time,
      loopEndTime: em ? em.time : sm.time + 30,
      loopStartLine: first,
      loopEndLine: last,
    });
  },

  setBoundaryLines: (startLine, endLine) => {
    const markers = useMarkersStore.getState().markers as any[];
    const sm = markers.find((m: any) => m.lineIndex === startLine);
    const em = markers.find((m: any) => m.lineIndex > endLine);
    set({
      loopStartLine: startLine,
      loopEndLine: endLine,
      loopStartTime: sm ? sm.time : get().loopStartTime,
      loopEndTime: em ? em.time : get().loopEndTime,
    });
  },

  clearLoop: () => {
    set({ isLooping: false, loopBlockIds: [], loopStartTime: null, loopEndTime: null, loopStartLine: null, loopEndLine: null });
  },
}));