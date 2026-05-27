import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserProfile, UserState } from '../types/user.types';

// Генерация UUID v4
function generateId(): string {
  return crypto.randomUUID?.() ?? 
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

interface UserProfileStoreState extends UserState {
  // Данные
  currentUser: UserProfile | null;
  
  // Computed-like getters
  isLoggedIn: boolean;
  isGuest: boolean;
  isReturning: boolean;
  userName: string;
  userAvatar: string;
  
  // Actions
  createProfile: (name: string, emoji: string) => UserProfile;
  updateProfile: (updates: Partial<UserProfile>) => void;
  updatePreferences: (prefs: Partial<UserProfile['preferences']>) => void;
  setOnboarded: () => void;
  setShowOnboarding: (show: boolean) => void;
  logout: () => void;
  deleteProfile: () => void;
}

const initialState = {
  currentUserId: null as string | null,
  isOnboarded: false,
  showOnboarding: false,
  currentUser: null as UserProfile | null,
  isLoggedIn: false,
  isGuest: true,
  isReturning: false,
  userName: '',
  userAvatar: '🎤',
};

export const useUserProfileStore = create<UserProfileStoreState>()(
  persist((set, get) => ({
    ...initialState,
    
    createProfile: (name: string, emoji: string) => {
      const profile: UserProfile = {
        id: generateId(),
        name,
        emoji,
        isGuest: false,
        createdAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        preferences: {},
      };
      set({
        currentUser: profile,
        currentUserId: profile.id,
        isLoggedIn: true,
        isGuest: false,
        isReturning: false,
        userName: name,
        userAvatar: emoji,
        isOnboarded: true,
        showOnboarding: false,
      });
      return profile;
    },
    
    updateProfile: (updates) => {
      const current = get().currentUser;
      if (!current) return;
      const updated = { ...current, ...updates, lastSeenAt: new Date().toISOString() };
      set({
        currentUser: updated,
        userName: updated.name,
        userAvatar: updated.emoji ?? '🎤',
      });
    },
    
    updatePreferences: (prefs) => {
      const current = get().currentUser;
      if (!current) return;
      const updated = {
        ...current,
        preferences: { ...current.preferences, ...prefs },
        lastSeenAt: new Date().toISOString(),
      };
      set({ currentUser: updated });
    },
    
    setOnboarded: () => {
      set({ isOnboarded: true, showOnboarding: false });
    },
    
    setShowOnboarding: (show) => {
      set({ showOnboarding: show });
    },
    
    logout: () => {
      set({
        ...initialState,
        isReturning: true,
      });
    },
    
    deleteProfile: () => {
      set(initialState);
    },
  }), {
    name: 'belive:user-profile',
    version: 1,
    onRehydrateStorage: () => (state) => {
      if (state?.currentUser) {
        state.isLoggedIn = true;
        state.isGuest = state.currentUser.isGuest;
        state.isReturning = true;
        state.userName = state.currentUser.name;
        state.userAvatar = state.currentUser.emoji ?? '🎤';
      }
    },
  })
);
