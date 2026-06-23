import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── FEED-REARCH: App mode + feed panel state ───

export type AppMode = 'studio' | 'feed';
export type CatalogTab = 'catalog' | 'my-music' | 'upload';

export interface FeedColWidths {
  col0: number | null;  // null = default (viewport-based), number = custom px
  col2: number | null;
}

interface UIState {
  catalogOpen: boolean;
  karaokeLinesCount: 2 | 4;
  karaokeLyricsScale: number;
  activeFeedColumn: number;
  catalogTab: CatalogTab;
  appMode: AppMode;
  feedCol0Visible: boolean;
  feedCol2Visible: boolean;
  feedColWidths: FeedColWidths;
  setCatalogOpen: (v: boolean) => void;
  setKaraokeLinesCount: (count: 2 | 4) => void;
  setKaraokeLyricsScale: (scale: number) => void;
  setActiveFeedColumn: (col: number) => void;
  setCatalogTab: (tab: CatalogTab) => void;
  setAppMode: (mode: AppMode) => void;
  setFeedCol0Visible: (v: boolean) => void;
  setFeedCol2Visible: (v: boolean) => void;
  setFeedColWidths: (w: Partial<FeedColWidths>) => void;
  resetFeedColWidths: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      catalogOpen: false,
      karaokeLinesCount: 2,
      karaokeLyricsScale: 120,
      activeFeedColumn: 1,
      catalogTab: 'catalog',
      appMode: 'studio',
      feedCol0Visible: true,
      feedCol2Visible: true,
      feedColWidths: { col0: null, col2: null },
      setCatalogOpen: (v) => set({ catalogOpen: v }),
      setKaraokeLinesCount: (count) => set({ karaokeLinesCount: count }),
      setKaraokeLyricsScale: (scale) => set({ karaokeLyricsScale: scale }),
      setActiveFeedColumn: (col) => set({ activeFeedColumn: col }),
      setCatalogTab: (tab) => set({ catalogTab: tab }),
      setAppMode: (mode) => set({ appMode: mode }),
      setFeedCol0Visible: (v) => set({ feedCol0Visible: v }),
      setFeedCol2Visible: (v) => set({ feedCol2Visible: v }),
      setFeedColWidths: (w) => set((s) => ({
        feedColWidths: {
          col0: w.col0 !== undefined ? w.col0 : s.feedColWidths.col0,
          col2: w.col2 !== undefined ? w.col2 : s.feedColWidths.col2,
        },
      })),
      resetFeedColWidths: () => set({ feedColWidths: { col0: null, col2: null } }),
    }),
    {
      name: 'bl-ui-store',
      partialize: (state) => ({
        feedCol0Visible: state.feedCol0Visible,
        feedCol2Visible: state.feedCol2Visible,
        feedColWidths: state.feedColWidths,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.feedColWidths && typeof window !== 'undefined') {
          const vw = window.innerWidth;
          if (state.feedColWidths.col0 != null && state.feedColWidths.col0 > vw * 0.5)
            state.feedColWidths.col0 = null;
          if (state.feedColWidths.col2 != null && state.feedColWidths.col2 > vw * 0.5)
            state.feedColWidths.col2 = null;
        }
      },
    }
  )
);
