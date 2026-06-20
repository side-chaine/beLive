// @TC-098-06: Feed persistence — localStorage for likes + batch sync queue
// Prevents KV write starvation: likes stored locally, batched to KV later

const STORAGE_KEY = 'bl_feed_likes';
const PENDING_KEY = 'bl_feed_pending';

export interface LikeRecord {
  postId: string;
  isLiked: boolean;
  timestamp: number;
}

export function loadLikes(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveLike(postId: string, isLiked: boolean): void {
  try {
    const likes = loadLikes();
    likes[postId] = isLiked;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(likes));
    enqueuePending(postId, isLiked);
  } catch {
    // localStorage full or unavailable — silent fail
  }
}

function enqueuePending(postId: string, isLiked: boolean): void {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    const queue: LikeRecord[] = raw ? JSON.parse(raw) : [];
    queue.push({ postId, isLiked, timestamp: Date.now() });
    // Keep only last 100 pending items
    if (queue.length > 100) queue.splice(0, queue.length - 100);
    localStorage.setItem(PENDING_KEY, JSON.stringify(queue));
  } catch {
    // silent fail
  }
}

export function getPendingSync(): LikeRecord[] {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearPendingSync(): void {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    // silent fail
  }
}
