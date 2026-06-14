// @TC-088: Zustand feed store with SWR pattern
// TC-FEED-01: Stub — returns empty data, no fetch (gateway not deployed)

import { create } from 'zustand';
import type { FeedItem, FeedSection } from './feed.types';

interface FeedState {
  sections: FeedSection[];
  items: FeedItem[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  fetchFeed: (force?: boolean) => Promise<void>;
  _backgroundRefresh: () => Promise<void>;
}

export const useFeedStore = create<FeedState>((set) => ({
  sections: [],
  items: [],
  status: 'ready',

  fetchFeed: async () => {
    set({ status: 'ready', sections: [], items: [] });
  },

  _backgroundRefresh: async () => {},
}));
