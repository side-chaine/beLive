import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DeckState {
  expanded: boolean;
  activeTabId: string;
  toggle: () => void;
  setTab: (id: string) => void;
}

export const useDeckStore = create<DeckState>()(
  persist(
    (set) => ({
      expanded: false,
      activeTabId: 'mix',
      toggle: () => set(s => ({ expanded: !s.expanded })),
      setTab: (id) => set({ activeTabId: id, expanded: true }),
    }),
    { name: 'bl-deck', partialize: (s) => ({ expanded: s.expanded, activeTabId: s.activeTabId }) }
  )
);
