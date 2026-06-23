// @TC-101-02: Feed store — real API (belive-gateway) + optimistic updates

import { create } from 'zustand';
import type { FeedPost, FeedComment } from './feed.types';
import { loadLikes, saveLike } from './feed.persistence';
import { useUserProfileStore } from '../../stores/user-profile.store';

const FEED_API = import.meta.env.VITE_GATEWAY_URL || 'https://belive-gateway.nikitosss007.workers.dev';

// ─── Auth headers helper (TC-107-04) ───
function getAuthHeaders(): Record<string, string> {
  const token = useUserProfileStore.getState().currentUser?.authToken;
  if (!token) throw new Error('AUTH_REQUIRED');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

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
  deletePost: (postId: string) => Promise<void>;
  editingPost: FeedPost | null;
  setEditingPost: (post: FeedPost | null) => void;
  editPost: (postId: string, patch: { title?: string; text?: string; tags?: string[] }) => Promise<void>;
  setActivePost: (postId: string | null) => void;
  setComposerOpen: (open: boolean) => void;
  voteSubmission: (postId: string, submissionId: string) => void;
  closeBattle: (postId: string) => void;
  // TC-108-04: Comments
  comments: Record<string, FeedComment[]>;
  commentsStatus: Record<string, 'idle' | 'loading' | 'ready' | 'error'>;
  // TC-109-18: Reactions
  postReactions: Record<string, Record<string, boolean>>;  // postId → { emoji: active }
  reactionCounts: Record<string, Record<string, number>>;  // postId → { emoji: count }
  fetchReactions: (postId: string) => Promise<void>;
  toggleReaction: (postId: string, emoji: string) => Promise<void>;
  fetchComments: (postId: string) => Promise<void>;
  /** Fetch top-level comments + replies for each */
  fetchCommentsWithReplies: (postId: string) => Promise<void>;
  /** Fetch replies for a specific top-level comment */
  fetchReplies: (postId: string, commentId: string) => Promise<void>;
  /** Set comments from external source (e.g. polling store) */
  setCommentsForPost: (postId: string, comments: FeedComment[]) => void;
  /** Create comment with optional parentId for replies */
  createComment: (postId: string, text: string, parentId?: string) => Promise<void>;
  deleteComment: (postId: string, commentId: string) => Promise<void>;
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
    updatedAt: p.updated_at ? new Date(p.updated_at).getTime() : null,
    sourceType: p.source_type,
  };
}

export const useFeedStore = create<FeedState>((set, get) => ({
  posts: [],
  status: 'idle',
  activePostId: null,
  composerOpen: false,
  _mocked: false,
  comments: {},
  commentsStatus: {},
  postReactions: {},
  reactionCounts: {},
  editingPost: null,

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
    // Legacy guard (002 N4): пользователи без authToken — toast + no request
    const token = useUserProfileStore.getState().currentUser?.authToken;
    if (!token) {
      console.warn('[feed.store] createPost: no authToken — legacy user');
      // UI toast handled by component layer; here we just abort
      return;
    }

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
        headers: getAuthHeaders(),
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

    // Legacy guard (002 N4): без authToken — не отправляем
    const token = useUserProfileStore.getState().currentUser?.authToken;
    if (!token) {
      console.warn('[feed.store] toggleLike: no authToken — legacy user');
      return;
    }

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
        headers: getAuthHeaders(),
        body: JSON.stringify({ postId }),  // userId убран — сервер берёт из JWT
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

  deletePost: async (postId) => {
    // Legacy guard: без authToken — abort
    const token = useUserProfileStore.getState().currentUser?.authToken;
    if (!token) {
      console.warn('[feed.store] deletePost: no authToken');
      return;
    }

    // VERDICT 009 R2: сохранить deletedPost ДО optimistic removal
    // Нужно для partial-merge rollback (не затирает concurrent fetchFeed)
    const deletedPost = get().posts.find(p => p.id === postId);
    if (!deletedPost) return;

    // Optimistic removal
    set(s => ({ posts: s.posts.filter(p => p.id !== postId) }));

    try {
      const res = await fetch(`${FEED_API}/api/feed/posts/${postId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Success — пост уже удалён из state, ничего не делаем
    } catch (err) {
      console.error('[feed.store] deletePost error:', err);

      // VERDICT 009 R2: partial-merge rollback — НЕ затираем concurrent fetchFeed
      set(s => {
        const exists = s.posts.some(p => p.id === postId);
        if (exists) return s; // fetchFeed уже обновил — не затираем свежие данные
        return { posts: [deletedPost, ...s.posts] };
      });
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

  setEditingPost: (post) => set({ editingPost: post }),

  // ─── TC-108-04: Comments actions ───

  fetchComments: async (postId) => {
    if (get().commentsStatus[postId] === 'loading') return;
    set(s => ({ commentsStatus: { ...s.commentsStatus, [postId]: 'loading' } }));
    try {
      const res = await fetch(`${FEED_API}/api/feed/posts/${postId}/comments`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const comments = (data.comments || []).slice().reverse();
      set(s => ({
        comments: { ...s.comments, [postId]: comments },
        commentsStatus: { ...s.commentsStatus, [postId]: 'ready' },
      }));
    } catch (err) {
      console.error('[feed.store] fetchComments error:', err);
      set(s => ({ commentsStatus: { ...s.commentsStatus, [postId]: 'error' } }));
    }
  },

  setCommentsForPost: (postId, comments) => {
    set(s => ({
      comments: { ...s.comments, [postId]: comments },
      commentsStatus: { ...s.commentsStatus, [postId]: 'ready' },
    }));
  },

  fetchCommentsWithReplies: async (postId) => {
    if (get().commentsStatus[postId] === 'loading') return;
    set(s => ({ commentsStatus: { ...s.commentsStatus, [postId]: 'loading' } }));
    try {
      // 1. Fetch top-level comments
      const res = await fetch(`${FEED_API}/api/feed/posts/${postId}/comments`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const comments = (data.comments || []).slice().reverse();

      // 2. Fetch replies for each top-level comment in parallel
      const replyPromises = comments.map(c =>
        fetch(`${FEED_API}/api/feed/posts/${postId}/comments/${c.id}/replies`)
          .then(r => r.ok ? r.json() : { replies: [] })
          .then(d => ({ parentId: c.id, replies: d.replies || [] }))
          .catch(() => ({ parentId: c.id, replies: [] }))
      );
      const replyResults = await Promise.all(replyPromises);

      // 3. Merge replies into comments array
      const allComments = [...comments];
      for (const r of replyResults) {
        for (const reply of r.replies) {
          allComments.push(reply);
        }
      }

      set(s => ({
        comments: { ...s.comments, [postId]: allComments },
        commentsStatus: { ...s.commentsStatus, [postId]: 'ready' },
      }));
    } catch (err) {
      console.error('[feed.store] fetchCommentsWithReplies error:', err);
      set(s => ({ commentsStatus: { ...s.commentsStatus, [postId]: 'error' } }));
    }
  },

  fetchReplies: async (postId, commentId) => {
    try {
      const res = await fetch(`${FEED_API}/api/feed/posts/${postId}/comments/${commentId}/replies`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Merge replies into existing comments (replace old ones if any)
      set(s => {
        const existing = s.comments[postId] || [];
        // Remove old replies for this parent
        const withoutOldReplies = existing.filter(c => c.parentId !== commentId);
        return {
          comments: {
            ...s.comments,
            [postId]: [...withoutOldReplies, ...(data.replies || [])],
          },
        };
      });
    } catch (err) {
      console.warn('[feed.store] fetchReplies error:', err);
    }
  },

  createComment: async (postId, text, parentId?) => {
    // Legacy guard
    const token = useUserProfileStore.getState().currentUser?.authToken;
    if (!token) {
      console.warn('[feed.store] createComment: no authToken');
      return;
    }

    const user = useUserProfileStore.getState().currentUser;
    const tempId = `temp-${Date.now()}`;
    const now = new Date().toISOString();

    const tempComment: FeedComment = {
      id: tempId, postId,
      authorId: user?.id || '',
      authorName: user?.name || 'Пользователь',
      authorAvatarUrl: user?.avatarUrl || '',
      text, createdAt: now,
      parentId: parentId || null,
    };

    set(s => ({
      comments: {
        ...s.comments,
        [postId]: [...(s.comments[postId] || []), tempComment],
      },
      posts: s.posts.map(p =>
        p.id === postId ? { ...p, commentsCount: p.commentsCount + 1 } : p
      ),
    }));

    try {
      const res = await fetch(`${FEED_API}/api/feed/posts/${postId}/comments`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ text, parentId: parentId || undefined }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const created = await res.json();
      set(s => ({
        comments: {
          ...s.comments,
          [postId]: (s.comments[postId] || []).map(c =>
            c.id === tempId ? created : c
          ),
        },
      }));
    } catch (err) {
      console.error('[feed.store] createComment error:', err);
      set(s => ({
        comments: {
          ...s.comments,
          [postId]: (s.comments[postId] || []).filter(c => c.id !== tempId),
        },
        posts: s.posts.map(p =>
          p.id === postId ? { ...p, commentsCount: Math.max(0, p.commentsCount - 1) } : p
        ),
      }));
    }
  },

  deleteComment: async (postId, commentId) => {
    const token = useUserProfileStore.getState().currentUser?.authToken;
    if (!token) {
      console.warn('[feed.store] deleteComment: no authToken');
      return;
    }

    const deletedComment = get().comments[postId]?.find(c => c.id === commentId);
    if (!deletedComment) return;

    set(s => ({
      comments: {
        ...s.comments,
        [postId]: (s.comments[postId] || []).filter(c => c.id !== commentId),
      },
      posts: s.posts.map(p =>
        p.id === postId ? { ...p, commentsCount: Math.max(0, p.commentsCount - 1) } : p
      ),
    }));

    try {
      const res = await fetch(`${FEED_API}/api/feed/posts/${postId}/comments/${commentId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.error('[feed.store] deleteComment error:', err);
      set(s => ({
        comments: {
          ...s.comments,
          [postId]: [...(s.comments[postId] || []), deletedComment],
        },
        posts: s.posts.map(p =>
          p.id === postId ? { ...p, commentsCount: p.commentsCount + 1 } : p
        ),
      }));
    }
  },

  // ─── TC-109-18: Reactions ───
  fetchReactions: async (postId) => {
    try {
      const token = useUserProfileStore.getState().currentUser?.authToken;
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(`${FEED_API}/api/feed/reactions?target_type=post&target_ids=${postId}`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const postReactionsData = data.reactions?.[postId] || {};

      // User's reactions from server (authenticated)
      const userEmojis: string[] = data.userReactions?.[postId] || [];
      const myReactions: Record<string, boolean> = {};
      for (const emoji of userEmojis) {
        myReactions[emoji] = true;
      }

      set(s => ({
        reactionCounts: { ...s.reactionCounts, [postId]: postReactionsData },
        postReactions: { ...s.postReactions, [postId]: myReactions },
      }));
    } catch (err) {
      console.warn('[feed.store] fetchReactions error:', err);
    }
  },

  toggleReaction: async (postId, emoji) => {
    const token = useUserProfileStore.getState().currentUser?.authToken;
    if (!token) return;

    // Optimistic update
    const prevReactions = get().postReactions[postId] || {};
    const wasActive = !!prevReactions[emoji];
    const newReactions = { ...prevReactions, [emoji]: !wasActive };

    set(s => ({
      postReactions: { ...s.postReactions, [postId]: newReactions },
      reactionCounts: {
        ...s.reactionCounts,
        [postId]: {
          ...(s.reactionCounts[postId] || {}),
          [emoji]: Math.max(0, ((s.reactionCounts[postId] || {})[emoji] || 0) + (wasActive ? -1 : 1)),
        },
      },
    }));

    try {
      const res = await fetch(`${FEED_API}/api/feed/reactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ targetType: 'post', targetId: postId, emoji }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Use server response to set definitive state
      const result = await res.json();
      const serverReacted = result.reacted === true;

      // FIX: correct reactionCounts when server disagrees with optimistic
      const expectedReacted = !wasActive;
      const countCorrection = serverReacted === expectedReacted
        ? 0
        : (serverReacted ? 2 : -2);

      set(s => {
        const current = s.postReactions[postId] || {};
        const serverReactions = { ...current, [emoji]: serverReacted };
        return {
          postReactions: { ...s.postReactions, [postId]: serverReactions },
          reactionCounts: {
            ...s.reactionCounts,
            [postId]: {
              ...(s.reactionCounts[postId] || {}),
              [emoji]: Math.max(0, ((s.reactionCounts[postId] || {})[emoji] || 0) + countCorrection),
            },
          },
        };
      });
    } catch (err) {
      // Rollback to pre-optimistic state
      const rollbackReactions = { ...prevReactions };
      delete rollbackReactions[emoji]; // if wasActive, it stays gone; if not, it stays gone
      if (wasActive) rollbackReactions[emoji] = true; // restore

      set(s => ({
        postReactions: { ...s.postReactions, [postId]: prevReactions },
        reactionCounts: {
          ...s.reactionCounts,
          [postId]: {
            ...(s.reactionCounts[postId] || {}),
            [emoji]: ((s.reactionCounts[postId] || {})[emoji] || 0),
          },
        },
      }));
      console.warn('[feed.store] toggleReaction error:', err);
    }
  },

  editPost: async (postId, patch) => {
    const token = useUserProfileStore.getState().currentUser?.authToken;
    if (!token) {
      console.warn('[feed.store] editPost: no authToken');
      return;
    }

    // Optimistic: обновить в локальном state
    const prev = get().posts;
    set(s => ({
      posts: s.posts.map(p =>
        p.id === postId ? { ...p, ...patch } : p
      ),
    }));

    try {
      const res = await fetch(`${FEED_API}/api/feed/posts/${postId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Заменить optimistic на ответ сервера
      const updated = await res.json();
      set(s => ({
        posts: s.posts.map(p =>
          p.id === postId ? { ...mapPost(updated), isLikedByUser: p.isLikedByUser } : p
        ),
      }));
    } catch (err) {
      // Rollback
      set({ posts: prev });
      console.error('[feed.store] editPost error:', err);
    }
  },
}));
