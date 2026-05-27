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

export type BillyMood = 'friendly' | 'professional' | 'cheerleader';

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
