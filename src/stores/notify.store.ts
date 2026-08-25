import { create } from 'zustand';

interface NotifyState {
  lastHash: string;
  arrivedAt: number;
  seenAt: number;
  setArrival: (hash: string) => void;
  markSeen: () => void;
}

export const useNotifyStore = create<NotifyState>()((set) => ({
  lastHash: '',
  arrivedAt: 0,
  seenAt: 0,
  setArrival: (hash) => set({ lastHash: hash, arrivedAt: Date.now() }),
  markSeen: () => set({ seenAt: Date.now() }),
}));
