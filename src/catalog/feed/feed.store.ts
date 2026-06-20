// @TC-098-01: Feed & Battle Engine — Wave 1 store
// ULID-like ID + MERGE fetch + _mocked flag + 4 mock-poста

import { create } from 'zustand';
import type { FeedPost } from './feed.types';
import { loadLikes, saveLike } from './feed.persistence';

// ─── ULID-like ID generation ───
function generateId(): string {
  const now = Date.now();
  const time = now.toString(36).toUpperCase().padStart(10, '0');
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map(b => b.toString(36))
    .join('')
    .toUpperCase()
    .slice(0, 6);
  return `${time}${rand}`;
}

// ─── Store ───
interface FeedState {
  posts: FeedPost[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  activePostId: string | null;
  composerOpen: boolean;

  fetchFeed: () => Promise<void>;
  createPost: (data: Omit<FeedPost, 'id' | 'createdAt' | 'likesCount' | 'commentsCount' | 'isLikedByUser'>) => void;
  toggleLike: (postId: string) => void;
  setActivePost: (postId: string | null) => void;
  setComposerOpen: (open: boolean) => void;
  voteSubmission: (postId: string, submissionId: string) => void;
  closeBattle: (postId: string) => void;
}

export const useFeedStore = create<FeedState>((set, get) => ({
  posts: [],
  status: 'idle',
  activePostId: null,
  composerOpen: false,

  fetchFeed: async () => {
    if (get().status === 'loading') return;
    set({ status: 'loading' });
    try {
      const savedLikes = loadLikes();
      const userPosts = get().posts.map(p => ({
        ...p,
        isLikedByUser: savedLikes[p.id] ?? p.isLikedByUser,
      }));
      set({ posts: userPosts, status: 'ready' });
    } catch {
      set({ status: 'error' });
    }
  },

  createPost: (data) => {
    const post: FeedPost = {
      ...data,
      id: generateId(),
      createdAt: Date.now(),
      likesCount: 0,
      commentsCount: 0,
      isLikedByUser: false,
    };
    set(s => ({ posts: [post, ...s.posts] }));
  },

  toggleLike: (postId) => {
    set(s => {
      const post = s.posts.find(p => p.id === postId);
      if (!post) return s;
      const newLiked = !post.isLikedByUser;
      saveLike(postId, newLiked);
      return {
        posts: s.posts.map(p =>
          p.id === postId
            ? { ...p, isLikedByUser: newLiked, likesCount: newLiked ? p.likesCount + 1 : p.likesCount - 1 }
            : p
        ),
      };
    });
  },

  voteSubmission: (postId, submissionId) => {
    set(s => ({
      posts: s.posts.map(p =>
        p.id !== postId || p.type !== 'battle' ? p : {
          ...p,
          submissions: p.submissions?.map(sub =>
            sub.id === submissionId
              ? { ...sub, votes: sub.votes + 1 }
              : sub
          ),
        }
      ),
    }));
  },

  closeBattle: (postId) => {
    set(s => ({
      posts: s.posts.map(p =>
        p.id !== postId || p.type !== 'battle' ? p : {
          ...p,
          battleStatus: 'closed',
          submissions: p.submissions?.map(sub => ({
            ...sub,
            isWinner: sub.id === p.submissions!.reduce((a, b) => a.votes > b.votes ? a : b).id,
          })),
        }
      ),
    }));
  },

  setActivePost: (postId) => set({ activePostId: postId }),
  setComposerOpen: (open) => set({ composerOpen: open }),
}));
