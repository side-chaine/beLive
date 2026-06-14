// @TC-088: Aurora Stage feed types

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
  /** @TC-088: R2 key for cover image (populated by Telegram bot) */
  coverR2Key?: string;
  priority: number;
  sourceUrl?: string;
  data?: FeedItemData;
  /** @TC-088: Links item to a section; populated by Worker from feed_section_items */
  sectionId?: string;
}

/** @TC-088: Формирует CDN URL для обложки из R2 ключа через CF Image Resizing */
export function getFeedCoverUrl(r2Key?: string | null): string | undefined {
  if (!r2Key) return undefined;
  return `https://app.mybelive.com/cdn-cgi/image/width=400,format=webp/${r2Key}`;
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
