import { create } from 'zustand';

interface CoachPanelState {
  open: boolean;
  setOpen: (v: boolean) => void;
}

export const useCoachPanelStore = create<CoachPanelState>((set) => ({
  open: false,
  setOpen: (v) => set({ open: v }),
}));
