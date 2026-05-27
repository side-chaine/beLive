/**
 * User Profile Types
 * Guest model with progressive profile — offline-first, no passwords/email.
 */

export type AuthState = 'guest' | 'named' | 'returning';

export interface UserProfile {
  id: string;
  name: string;
  emoji?: string;
  createdAt: string;
  lastSeenAt: string;
  preferences?: UserProfilePreferences;
  isGuest: boolean;
  pinHash?: string;
  /** Server-side ID, появляется при миграции на сервер */
  serverId?: string;
  /** Статус миграции: local → migrating → synced */
  migrationStatus?: 'local' | 'migrating' | 'synced';
}

export interface OnboardingStep {
  step: 'welcome' | 'name' | 'avatar' | 'done';
  completed: boolean;
}

export function isUserProfile(obj: unknown): obj is UserProfile {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    (o.emoji === undefined || typeof o.emoji === 'string') &&
    typeof o.createdAt === 'string' &&
    typeof o.lastSeenAt === 'string'
  );
}

export type BillyMood = 'quiet' | 'helpful' | 'attentive';

export interface UserStats {
  userId: string;
  serverId?: string;
  totalTracks: number;
  totalSessions: number;
  totalPracticeMinutes: number;
  currentStreak: number;
  longestStreak: number;
  lastPracticeDate: string | null;
  milestones: UserMilestone[];
  updatedAt: string;
}

export interface UserMilestone {
  id: string;
  type: MilestoneType;
  achievedAt: string;
  data?: Record<string, unknown>;
}

export type MilestoneType =
  | 'first_track'
  | 'first_sync'
  | 'first_recording'
  | 'streak_3'
  | 'streak_7'
  | 'streak_30';

export interface UserProfilePreferences {
  theme?: string;
  language?: string;
  billyMood?: BillyMood;
}

export interface GuestMigrationResult {
  profileId: string;
  tracksMigrated: number;
  settingsMigrated: number;
}

export interface UserState {
  currentUserId: string | null;
  isOnboarded: boolean;
  showOnboarding: boolean;
}
