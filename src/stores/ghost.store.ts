import { create } from 'zustand';

export interface GhostTrack {
  id: string;
  title: string;
  artist?: string;
  phase: 'download' | 'extract' | 'import' | 'done';
  progress: number;
  coverUrl?: string;
}

interface GhostState {
  ghosts: GhostTrack[];
  addGhost: (g: GhostTrack) => void;
  updateGhost: (id: string, patch: Partial<GhostTrack>) => void;
  removeGhost: (id: string) => void;
}

export const useGhostStore = create<GhostState>((set) => ({
  ghosts: [],
  addGhost: (g) => set((s) => ({ ghosts: [...s.ghosts, g] })),
  updateGhost: (id, patch) => set((s) => ({
    ghosts: s.ghosts.map((g) => g.id === id ? { ...g, ...patch } : g),
  })),
  removeGhost: (id) => set((s) => ({
    ghosts: s.ghosts.filter((g) => g.id !== id),
  })),
}));
