import { create } from 'zustand';

interface ToastItem { level: 'info' | 'warn' | 'error'; title: string; message: string }

interface NotifyState {
  lastHash: string;
  arrivedAt: number;
  seenAt: number;
  setArrival: (hash: string) => void;
  markSeen: () => void;
  pushToast: (t: ToastItem) => void;   // MICRO-PACK-FALLBACK
}

export const useNotifyStore = create<NotifyState>()((set) => ({
  lastHash: '',
  arrivedAt: 0,
  seenAt: 0,
  setArrival: (hash) => set({ lastHash: hash, arrivedAt: Date.now() }),
  markSeen: () => set({ seenAt: Date.now() }),
  pushToast: (t) => {
    // MICRO-PACK-FALLBACK: wire to existing showAppNotification if available, else console.error
    const w = window as any;
    try {
      if (w.showAppNotification) {
        w.showAppNotification(`${t.title}: ${t.message}`, t.level === 'error' ? 'error' : t.level === 'warn' ? 'error' : 'info');
        return;
      }
    } catch {}
    console.error(`[notify.toast] ${t.level}: ${t.title} — ${t.message}`);
  },
}));
