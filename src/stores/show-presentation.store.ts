import { create } from 'zustand';

// ── Store ──

interface ShowPresentationState {
  /** Whether presentation mode is active */
  isPresenting: boolean;
  /** Whether the slide overlay is visible */
  showSlide: boolean;
  /** Dock position for the presentation overlay */
  dockPosition: { x: number; y: number };

  /** Start presentation mode */
  startPresentation: () => void;
  /** Stop presentation mode */
  stopPresentation: () => void;
  /** Toggle slide overlay */
  toggleSlide: () => void;
  /** Set dock position */
  setDockPosition: (pos: { x: number; y: number }) => void;
}

export const useShowPresentationStore = create<ShowPresentationState>()((set, get) => ({
  isPresenting: false,
  showSlide: false,
  dockPosition: { x: -1, y: -1 },  // -1 = auto (default position)

  startPresentation: () => {
    // Load saved dock position
    let dockPos = { x: -1, y: -1 };
    try {
      const saved = localStorage.getItem('rec_studio_dock_pos_v1');
      if (saved) dockPos = JSON.parse(saved);
    } catch {}

    set({
      isPresenting: true,
      showSlide: false,
      dockPosition: dockPos,
    });
  },

  stopPresentation: () => {
    const state = get();
    if (!state.isPresenting) return;
    set({ isPresenting: false, showSlide: false });
  },

  toggleSlide: () => {
    const state = get();
    if (!state.isPresenting) return;
    set({ showSlide: !state.showSlide });
  },

  setDockPosition: (pos) => {
    set({ dockPosition: pos });
    // Persist
    try { localStorage.setItem('rec_studio_dock_pos_v1', JSON.stringify(pos)); } catch {}
  },
}));
