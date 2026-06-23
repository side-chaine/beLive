// @TC-109-17: Comment polling store — conditional GET with ETag
// Polls comments every 30s, pauses when tab hidden.
// Uses If-None-Match for 304 (no data transfer when unchanged).

import { create } from 'zustand';
import { useFeedStore } from '../catalog/feed/feed.store';

const FEED_API = import.meta.env.VITE_GATEWAY_URL || 'https://belive-gateway.nikitosss007.workers.dev';
const POLL_INTERVAL = 30_000; // 30s
const ACTIVE_POLL_INTERVAL = 10_000; // 10s when panel open

interface PollingState {
  /** postId → ETag */
  etags: Record<string, string>;
  /** postId → interval ID */
  activePolls: Record<string, ReturnType<typeof setInterval>>;
  /** Is the comments panel open */
  panelOpen: boolean;
  /** Current post being viewed */
  activePostId: string | null;

  /** Start polling for a post */
  startPolling: (postId: string) => void;
  /** Stop polling for a post */
  stopPolling: (postId: string) => void;
  /** Stop all polling */
  stopAllPolling: () => void;
  /** Set panel state */
  setPanelOpen: (open: boolean) => void;
  /** Visibility change handler */
  handleVisibilityChange: () => void;
}

export const useCommentPollingStore = create<PollingState>((set, get) => ({
  etags: {},
  activePolls: {},
  panelOpen: false,
  activePostId: null,

  startPolling: (postId: string) => {
    const { activePolls } = get();
    if (activePolls[postId]) return; // Already polling

    const poll = async () => {
      try {
        const { etags } = get();
        const headers: Record<string, string> = {};
        const etag = etags[postId];
        if (etag) {
          headers['If-None-Match'] = etag;
        }

        const res = await fetch(`${FEED_API}/api/feed/posts/${postId}/comments`, { headers });

        if (res.status === 304) {
          // No changes — ETag matched
          return;
        }

        if (res.ok) {
          const data = await res.json();
          // Update ETag
          const newEtag = res.headers.get('ETag');
          set(s => ({
            etags: { ...s.etags, [postId]: newEtag || '' },
          }));

          // Update feed store comments (replace, append newer)
          const comments = (data.comments || []).slice().reverse();
          useFeedStore.getState().setCommentsForPost(postId, comments);
        }
      } catch (err) {
        console.warn('[commentPolling] Poll error:', err);
      }
    };

    // Initial fetch
    poll();

    // Start interval
    const interval = setInterval(poll, POLL_INTERVAL);
    set(s => ({
      activePolls: { ...s.activePolls, [postId]: interval },
    }));
  },

  stopPolling: (postId: string) => {
    const { activePolls } = get();
    const interval = activePolls[postId];
    if (interval) {
      clearInterval(interval);
      const newPolls = { ...activePolls };
      delete newPolls[postId];
      set({ activePolls: newPolls });
    }
  },

  stopAllPolling: () => {
    const { activePolls } = get();
    Object.values(activePolls).forEach(interval => clearInterval(interval));
    set({ activePolls: {}, etags: {} });
  },

  setPanelOpen: (open: boolean) => {
    set({ panelOpen: open });
  },

  handleVisibilityChange: () => {
    if (document.hidden) {
      // Tab hidden — stop all polling
      const { activePolls } = get();
      Object.values(activePolls).forEach(interval => clearInterval(interval));
      set({ activePolls: {} });
    } else {
      // Tab visible — resume polling for active post
      const { activePostId } = get();
      if (activePostId) {
        get().startPolling(activePostId);
      }
    }
  },
}));

// React hook to attach visibility listener (call once in app root)
export function useVisibilityPolling() {
  const handleVisibilityChange = useCommentPollingStore(s => s.handleVisibilityChange);

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }
}
