import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { TakeMeta, BlockTakes, PreviewMode, ViewMode } from './takes.types';
import { emptyBlockTakes } from './takes.types';
import { takeAssets } from './takes.assets';

interface TakesState {
  // === View state ===
  activeBlockId: string | null;
  isPanelOpen: boolean;

  // === Recording state ===
  isRecording: boolean;
  recordingSlot: number | null;

  // === Data (lightweight metadata only) ===
  blockTakesMap: Record<string, BlockTakes>;

  // === Asset cache invalidation signal (metadata-only) ===
  assetRevision: number;

  // === Preview state ===
  previewMode: PreviewMode;

  // === View source mode ===
  viewMode: ViewMode;

  // === Actions ===
  openPanel: (blockId: string) => void;
  closePanel: () => void;
  setActiveBlock: (blockId: string) => void;

  startRecording: (blockId: string, slot: number) => void;
  finishRecording: (meta: TakeMeta) => void;
  cancelRecording: () => void;

  deleteTake: (blockId: string, slot: number) => void;
  selectTake: (blockId: string, slot: number | null) => void;
  setPreviewMode: (mode: PreviewMode) => void;
  setViewMode: (mode: ViewMode) => void;
  bumpAssetRevision: () => void;

  // === Queries ===
  getBlockTakes: (blockId: string) => BlockTakes;
  getNextEmptySlot: (blockId: string) => number | null;

  // === Lifecycle ===
  cleanup: () => void;
}

export const useTakesStore = create<TakesState>()(
  subscribeWithSelector((set, get) => ({
    activeBlockId: null,
    isPanelOpen: false,
    isRecording: false,
    recordingSlot: null,
    blockTakesMap: {},
    assetRevision: 0,
    previewMode: 'context' as PreviewMode,
    viewMode: 'voc' as ViewMode,

    openPanel: (blockId) => set({
      isPanelOpen: true,
      activeBlockId: blockId,
    }),

    closePanel: () => set({ isPanelOpen: false }),

    setActiveBlock: (blockId) => set({ activeBlockId: blockId }),

    startRecording: (blockId, slot) => set({
      isRecording: true,
      recordingSlot: slot,
      activeBlockId: blockId,
    }),

    finishRecording: (meta) => {
      const state = get();
      const bt = state.getBlockTakes(meta.blockId);
      const newTakes = [...bt.takes] as BlockTakes['takes'];
      newTakes[meta.slot] = meta;

      set({
        isRecording: false,
        recordingSlot: null,
        blockTakesMap: {
          ...state.blockTakesMap,
          [meta.blockId]: { ...bt, takes: newTakes },
        },
      });
    },

    cancelRecording: () => set({
      isRecording: false,
      recordingSlot: null,
    }),

    deleteTake: (blockId, slot) => {
      const state = get();
      const bt = state.getBlockTakes(blockId);
      const take = bt.takes[slot];
      if (!take) return;

      // Clean up assets
      takeAssets.delete(take.id);

      const newTakes = [...bt.takes] as BlockTakes['takes'];
      newTakes[slot] = null;

      set({
        blockTakesMap: {
          ...state.blockTakesMap,
          [blockId]: {
            ...bt,
            takes: newTakes,
            selectedSlot: bt.selectedSlot === slot ? null : bt.selectedSlot,
          },
        },
      });
    },

    selectTake: (blockId, slot) => {
      const state = get();
      const bt = state.getBlockTakes(blockId);
      set({
        blockTakesMap: {
          ...state.blockTakesMap,
          [blockId]: { ...bt, selectedSlot: slot },
        },
      });
    },

    setPreviewMode: (mode) => set({ previewMode: mode }),

    setViewMode: (mode) => set({ viewMode: mode }),

    bumpAssetRevision: () => {
      const state = get();
      set({ assetRevision: state.assetRevision + 1 });
    },

    getBlockTakes: (blockId) => {
      return get().blockTakesMap[blockId] ?? emptyBlockTakes(blockId);
    },

    getNextEmptySlot: (blockId) => {
      const bt = get().getBlockTakes(blockId);
      for (let i = 0; i < 3; i++) {
        if (bt.takes[i] === null) return i;
      }
      return null;
    },

    cleanup: () => {
      takeAssets.clear();
      set({
        activeBlockId: null,
        isPanelOpen: false,
        isRecording: false,
        recordingSlot: null,
        blockTakesMap: {},
        assetRevision: 0,
        viewMode: 'voc',
      });
    },
  }))
);
