// @TC-101-02: Feed store — real API (belive-gateway) + optimistic updates

import { create } from 'zustand';
import type { FeedPost } from './feed.types';
import { loadLikes, saveLike } from './feed.persistence';

const FEED_API = 'https://belive-gateway.nikitosss007.workers.dev';

// ─── Store ───
interface FeedState {
  posts: FeedPost[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  activePostId: string | null;
  composerOpen: boolean;
  _mocked: boolean;

  fetchFeed: () => Promise<void>;
  createPost: (data: Omit<FeedPost, 'id' | 'createdAt' | 'likesCount' | 'commentsCount' | 'isLikedByUser'>) => Promise<void>;
  toggleLike: (postId: string) => void;
  setActivePost: (postId: string | null) => void;
  setComposerOpen: (open: boolean) => void;
  voteSubmission: (postId: string, submissionId: string) => void;
  closeBattle: (postId: string) => void;
}

function mapPost(p: any): FeedPost {
  return {
    id: p.id,
    type: p.type,
    authorId: p.author_id,
    authorName: p.author_name,
    authorAvatarUrl: p.author_avatar || '',
    title: p.title,
    text: p.body,
    coverUrl: undefined,
    tags: p.tags || [],
    trackId: p.track_id,
    blocksData: p.blocks_data || [],
    baseTrackId: p.base_track_id,
    battleBlockId: p.battle_block_id,
    battleStatus: p.battle_status,
    maxSubmissions: p.max_submissions,
    submissions: [],
    eventDate: p.event_date,
    eventPrice: p.event_price,
    eventLocation: p.event_location,
    likesCount: p.likes_count || 0,
    commentsCount: p.comments_count || 0,
    isLikedByUser: false,
    createdAt: new Date(p.created_at).getTime(),
    sourceType: p.source_type,
  };
}

export const useFeedStore = create<FeedState>((set, get) => ({
  posts: [],
  status: 'idle',
  activePostId: null,
  composerOpen: false,
  _mocked: false,

  fetchFeed: async () => {
    if (get().status === 'loading') return;
    set({ status: 'loading' });
    try {
      const res = await fetch(`${FEED_API}/api/feed/posts`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const posts = data.posts.map(mapPost);
      const savedLikes = loadLikes();
      const withLikes = posts.map(p => ({
        ...p,
        isLikedByUser: savedLikes[p.id] ?? p.isLikedByUser,
      }));
      set({ posts: withLikes, status: 'ready', _mocked: false });
    } catch (err) {
      console.error('[feed.store] fetchFeed error:', err);
      set({ status: 'error' });
    }
  },

  createPost: async (data) => {
    // Optimistic: сразу показываем в UI
    const tempId = `temp-${Date.now()}`;
    const tempPost: FeedPost = {
      ...data,
      id: tempId,
      likesCount: 0,
      commentsCount: 0,
      isLikedByUser: false,
      createdAt: Date.now(),
    };
    set(s => ({ posts: [tempPost, ...s.posts] }));

    try {
      const res = await fetch(`${FEED_API}/api/feed/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: data.type,
          title: data.title,
          text: data.text,
          authorId: data.authorId,
          authorName: data.authorName,
          authorAvatarUrl: data.authorAvatarUrl,
          tags: data.tags,
          trackId: data.trackId,
          blocksData: data.blocksData,
          sourceType: 'manual',
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const created = await res.json();

      // Заменить temp пост на реальный с server ID
      const serverPost = mapPost(created);
      set(s => ({
        posts: s.posts.map(p =>
          p.id === tempId ? { ...serverPost, isLikedByUser: false } : p
        ),
      }));

      // Обновить ленту (fetch свежих постов)
      get().fetchFeed();
    } catch (err) {
      console.error('[feed.store] createPost error:', err);
      // Пометить как failed
      set(s => ({
        posts: s.posts.map(p =>
          p.id === tempId ? { ...p, syncStatus: 'failed' as any } : p
        ),
      }));
    }
  },

  toggleLike: async (postId) => {
    const post = get().posts.find(p => p.id === postId);
    if (!post) return;
    const newLiked = !post.isLikedByUser;
    // Optimistic
    set(s => ({
      posts: s.posts.map(p =>
        p.id === postId
          ? { ...p, isLikedByUser: newLiked, likesCount: newLiked ? p.likesCount + 1 : p.likesCount - 1 }
          : p
      ),
    }));
    saveLike(postId, newLiked);
    // Sync to server
    try {
      const res = await fetch(`${FEED_API}/api/feed/likes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, userId: 'user-local' }),
      });
      if (res.ok) {
        const data = await res.json();
        // Update likes_count from server response
        set(s => ({
          posts: s.posts.map(p =>
            p.id === postId ? { ...p, likesCount: data.likes_count } : p
          ),
        }));
      }
    } catch (err) {
      console.error('[feed.store] toggleLike error:', err);
    }
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
