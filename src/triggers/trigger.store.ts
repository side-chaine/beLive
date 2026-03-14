import { create } from 'zustand';

interface TriggerStoreState {
  // Word state
  activeWordId: string | null;
  activeWordText: string | null;
  activeWordConfidence: number;
  // Note: activeWordProgress removed from store — now CSS-var driven only
  // Progress is published via --bl-word-progress for hot-path performance

  // Line state
  triggerLineIndex: number;

  // Meta
  isActive: boolean;
  showDebug: boolean;

  // Actions
  toggleDebug: () => void;
}

export const useTriggerStore = create<TriggerStoreState>((set) => ({
  activeWordId: null,
  activeWordText: null,
  activeWordConfidence: 0,
  triggerLineIndex: -1,
  isActive: false,
  showDebug: false,
  toggleDebug: () => set((s) => ({ showDebug: !s.showDebug })),
}));
