import { create } from 'zustand';

interface BlockSceneStore {
  isOpen: boolean;
  selectedBlockIndex: number | null;
  expandedBlockIndex: number | null;
  selectedLineIndex: number | null;

  setOpen: (v: boolean) => void;
  setSelectedBlockIndex: (i: number | null) => void;
  setExpandedBlockIndex: (i: number | null) => void;
  setSelectedLineIndex: (i: number | null) => void;
}

const initialState = {
  isOpen: false,
  selectedBlockIndex: null,
  expandedBlockIndex: null,
  selectedLineIndex: null,
};

export const useBlockSceneStore = create<BlockSceneStore>((set) => ({
  ...initialState,

  setOpen: (isOpen) => set({
    isOpen,
    ...(!isOpen ? { selectedBlockIndex: null, expandedBlockIndex: null, selectedLineIndex: null } : {}),
  }),

  setSelectedBlockIndex: (selectedBlockIndex) => set({ selectedBlockIndex }),

  setExpandedBlockIndex: (expandedBlockIndex) => set({
    expandedBlockIndex,
    ...(expandedBlockIndex === null ? { selectedLineIndex: null } : {}),
  }),

  setSelectedLineIndex: (selectedLineIndex) => set({ selectedLineIndex }),
}));
