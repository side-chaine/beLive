import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DeckState {
  expanded: boolean;
  activeTabId: string;
  pianoWasOpen: boolean;
  visualMode: boolean;
  toggle: () => void;
  setTab: (id: string) => void;
  setPianoWasOpen: (v: boolean) => void;
  clearTab: () => void;
  enterVisualMode: () => void;
  exitVisualMode: () => void;
}

export const useDeckStore = create<DeckState>()(
  persist(
    (set) => ({
      expanded: false,
      activeTabId: '',
      pianoWasOpen: false,
      visualMode: false,
      toggle: () => set(s => ({ expanded: !s.expanded })),
      setTab: (id) => set({ activeTabId: id, expanded: true }),
      setPianoWasOpen: (v) => set({ pianoWasOpen: v }),
      clearTab: () => set({ activeTabId: '', expanded: false }),
      enterVisualMode: () => set({ visualMode: true, expanded: true }),
      exitVisualMode: () => set({ visualMode: false, expanded: true }),
    }),
    { name: 'bl-deck', partialize: (s) => ({ 
      expanded: s.expanded, 
      activeTabId: s.activeTabId 
    }) }
  )
);
