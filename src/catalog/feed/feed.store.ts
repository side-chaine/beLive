// @TC-088: Zustand feed store with SWR pattern

import { create } from 'zustand';
import type { FeedItem, FeedSection } from './feed.types';

interface FeedState {
  sections: FeedSection[];
  items: FeedItem[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  fetchFeed: (force?: boolean) => Promise<void>;
  _backgroundRefresh: () => Promise<void>;
}

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || '';

export const useFeedStore = create<FeedState>((set, get) => ({
  sections: [],
  items: [],
  status: 'idle',

  fetchFeed: async (force = false) => {
    if (get().status === 'loading') return;

    // SWR: if data exists, show immediately, refresh in background
    if (!force && get().items.length > 0) {
      get()._backgroundRefresh();
      return;
    }

    set({ status: 'loading' });
    try {
      const res = await fetch(`${GATEWAY_URL}/api/feed`, { cache: force ? 'no-cache' : 'default' });
      if (!res.ok) throw new Error('Network error');
      const data = await res.json();
      set({ sections: data.sections, items: data.items, status: 'ready' });
    } catch (e) {
      console.error('Feed fetch error', e);
      set({ status: 'error' });
    }
  },

  _backgroundRefresh: async () => {
    try {
      const res = await fetch(`${GATEWAY_URL}/api/feed`, { cache: 'no-cache' });
      if (!res.ok) return;
      const data = await res.json();
      set({ sections: data.sections, items: data.items });
    } catch (e) {
      console.log('SWR background refresh failed', e);
    }
  },
}));
