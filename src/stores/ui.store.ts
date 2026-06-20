import { create } from 'zustand';

// ─── FEED-REARCH: App mode + feed panel state ───

export type AppMode = 'studio' | 'feed';
export type RightSlotType = 'catalog' | 'comments' | 'trackmap-vertical';
export type CatalogTab = 'catalog' | 'my-music' | 'upload';
export type RightPanelMode = 'catalog' | 'comments';

interface UIState {
  catalogOpen: boolean;
  karaokeLinesCount: 2 | 4;
  karaokeLyricsScale: number;
  activeFeedColumn: number;
  catalogTab: CatalogTab;
  rightPanelMode: RightPanelMode;
  appMode: AppMode;
  feedCol0Visible: boolean;
  feedCol2Visible: boolean;
  rightSlot: RightSlotType;
  setCatalogOpen: (v: boolean) => void;
  setKaraokeLinesCount: (count: 2 | 4) => void;
  setKaraokeLyricsScale: (scale: number) => void;
  setActiveFeedColumn: (col: number) => void;
  setCatalogTab: (tab: CatalogTab) => void;
  setRightPanelMode: (mode: RightPanelMode) => void;
  setAppMode: (mode: AppMode) => void;
  setFeedCol0Visible: (v: boolean) => void;
  setFeedCol2Visible: (v: boolean) => void;
  setRightSlot: (slot: RightSlotType) => void;
}

export const useUIStore = create<UIState>((set) => ({
  catalogOpen: false,
  karaokeLinesCount: 2,
  karaokeLyricsScale: 120,
  activeFeedColumn: 1,
  catalogTab: 'catalog',
  rightPanelMode: 'catalog',
  appMode: 'studio',
  feedCol0Visible: true,
  feedCol2Visible: true,
  rightSlot: 'catalog',
  setCatalogOpen: (v) => set({ catalogOpen: v }),
  setKaraokeLinesCount: (count) => set({ karaokeLinesCount: count }),
  setKaraokeLyricsScale: (scale) => set({ karaokeLyricsScale: scale }),
  setActiveFeedColumn: (col) => set({ activeFeedColumn: col }),
  setCatalogTab: (tab) => set({ catalogTab: tab }),
  setRightPanelMode: (mode) => set({ rightPanelMode: mode }),
  setAppMode: (mode) => set({ appMode: mode }),
  setFeedCol0Visible: (v) => set({ feedCol0Visible: v }),
  setFeedCol2Visible: (v) => set({ feedCol2Visible: v }),
  setRightSlot: (slot) => set({ rightSlot: slot }),
}));
