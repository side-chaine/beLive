import { create } from 'zustand';
import type { FeedPost } from './feed.types';

// ─── Store ───

interface FeedUIState {
  /** Currently active/selected post ID (for comments panel) */
  activePostId: string | null;
  /** Whether the post composer is open */
  composerOpen: boolean;
  /** Post being edited (if any) */
  editingPost: FeedPost | null;

  setActivePost: (postId: string | null) => void;
  setComposerOpen: (open: boolean) => void;
  setEditingPost: (post: FeedPost | null) => void;
}

export const useFeedUIStore = create<FeedUIState>((set) => ({
  activePostId: null,
  composerOpen: false,
  editingPost: null,

  setActivePost: (postId) => set({ activePostId: postId }),
  setComposerOpen: (open) => set({ composerOpen: open }),
  setEditingPost: (post) => set({ editingPost: post }),
}));
