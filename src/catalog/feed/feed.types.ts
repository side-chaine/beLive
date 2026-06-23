// @TC-098-01: Feed & Battle Engine — Wave 1 types
// 4 типа: post, track, battle, event
// S1-S6 verified by 007

export type FeedPostType = 'post' | 'track' | 'battle' | 'event';

export const POST_TYPE_CONFIG: Record<FeedPostType, {
  label: string;
  emoji: string;
  color: string;
}> = {
  post:   { label: 'ПОСТ',   emoji: '⚪', color: '#9E9E9E' },
  track:  { label: 'ТРЕК',   emoji: '🔵', color: '#2196F3' },
  battle: { label: 'БИТВА',  emoji: '🔥', color: '#FF6B00' },
  event:  { label: 'АФИША',  emoji: '🔴', color: '#FF4444' },
};

// ─── Mini-TrackMap ───
export interface MiniBlock {
  id: string;
  label: string;
  color: string;
  startPercent: number;
  widthPercent: number;
  isActive?: boolean;
}

// ─── Battle ───
export interface BattleSubmission {
  id: string;
  userId: string;
  userName: string;
  userAvatarUrl: string;
  vocalTgFileId: string;
  votes: number;
  isAuthor: boolean;
  isWinner?: boolean;
  submittedAt: number;
}

// ─── ELO placeholder (Wave 2+) ───
export type EloCategory = 'vocal' | 'performance' | 'creativity' | 'collab';

export interface EloEntry {
  userId: string;
  userName: string;
  avatarUrl: string;
  category: EloCategory;
  elo: number;
  matches: number;
  wins: number;
  rank?: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
}

export function eloToRank(elo: number): EloEntry['rank'] {
  if (elo >= 2400) return 'diamond';
  if (elo >= 2000) return 'platinum';
  if (elo >= 1600) return 'gold';
  if (elo >= 1200) return 'silver';
  return 'bronze';
}

// ─── FeedPost (основной тип) ───
export interface FeedPost {
  id: string;
  type: FeedPostType;

  authorId: string;
  authorName: string;
  authorAvatarUrl: string;

  title: string;
  text?: string;
  coverUrl?: string;
  coverR2Key?: string;
  tags?: string[];

  trackId?: string | null;
  blocksData?: MiniBlock[];

  baseTrackId?: string;
  battleBlockId?: string;
  submissions?: BattleSubmission[];
  maxSubmissions?: number;
  battleStatus?: 'open' | 'closed';

  eventDate?: string;
  eventPrice?: string;
  eventLocation?: string;

  likesCount: number;
  commentsCount: number;
  isLikedByUser: boolean;
  reactions?: { emoji: string; count: number }[];

  createdAt: number;
  updatedAt?: number | null;  // TC-107-09: edit timestamp
  sourceType?: 'manual' | 'agent' | 'tg-bot';
}

// ─── FeedComment (TC-108-01) ───
export interface FeedComment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string;
  text: string;
  parentId?: string | null;
  timecodePin?: number | null;
  feedbackTag?: string | null;
  createdAt: string;  // ISO string from D1
}

// ─── Helpers ───
export function getFeedCoverUrl(r2Key?: string | null): string | undefined {
  if (!r2Key) return undefined;
  return `https://app.mybelive.com/cdn-cgi/image/width=400,format=webp/${r2Key}`;
}

// ═══ Backward compat (kept for HeroStack/EventList/TrackScroll) ═══
export type FeedItemType = 'post' | 'event' | 'service' | 'track' | 'poll' | 'leaderboard';

export interface PollData {
  options: { id: string; title: string; votes?: number }[];
}

export interface LeaderboardData {
  category: string;
  topUsers: { id: string; name: string; elo: number }[];
}

export type FeedItemData = PollData | LeaderboardData | null;

export interface FeedItemBase {
  id: string;
  type: FeedItemType;
  title: string;
  subtitle?: string;
  description?: string;
  coverUrl?: string;
  coverR2Key?: string;
  priority: number;
  sourceUrl?: string;
  data?: FeedItemData;
  sectionId?: string;
}

export interface FeedTrack extends FeedItemBase {
  type: 'track';
  localTrackId?: string;
}

export interface FeedEvent extends FeedItemBase {
  type: 'event';
  eventDate?: string;
  price?: string;
}

export type FeedItem = FeedTrack | FeedEvent | FeedItemBase;

export interface FeedSection {
  id: string;
  title: string;
  type: 'hero-stack' | 'list' | 'scroll';
  sortOrder: number;
}
