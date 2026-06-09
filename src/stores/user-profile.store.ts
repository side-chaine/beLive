import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserProfile, UserState, OnboardingProgress } from '../types/user.types';

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
  createProfile: (name: string, emoji: string, isGuest?: boolean) => UserProfile;
  updateProfile: (updates: Partial<UserProfile>) => void;
  updatePreferences: (prefs: Partial<UserProfile['preferences']>) => void;
  setOnboarded: () => void;
  setShowOnboarding: (show: boolean) => void;
  logout: () => void;
  deleteProfile: () => void;

  // OAuth
  createOAuthProfile: (data: {
    name: string; email: string; avatarUrl?: string;
    serverId?: string; authToken: string;
  }) => UserProfile;

  // Onboarding
  catalogOnboardingComplete: boolean;
  onboardingProgress: OnboardingProgress;
  setCatalogOnboardingComplete: (v: boolean) => void;
  setOnboardingProgress: (p: Partial<OnboardingProgress>) => void;
  setMvsepApiKey: (key: string | null) => void;
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
  catalogOnboardingComplete: false,
  onboardingProgress: { step1Done: false, step2Done: false, activeStep: 1 },
};

export const useUserProfileStore = create<UserProfileStoreState>()(
  persist((set, get) => ({
    ...initialState,
    
    createProfile: (name: string, emoji: string, isGuest: boolean = false) => {
      const profile: UserProfile = {
        id: generateId(),
        name,
        emoji,
        isGuest,
        createdAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        preferences: {},
      };
      set({
        currentUser: profile,
        currentUserId: profile.id,
        isLoggedIn: true,
        isGuest,
        isReturning: false,
        userName: name,
        userAvatar: emoji,
        isOnboarded: true,
        showOnboarding: false,
      });
      return profile;
    },
    
    createOAuthProfile: (data) => {
      const profile: UserProfile = {
        id: data.serverId || generateId(),
        name: data.name,
        avatarUrl: data.avatarUrl,
        email: data.email,
        authProvider: 'google',
        serverId: data.serverId,
        authToken: data.authToken,
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
        userName: data.name,
        userAvatar: data.avatarUrl ? '' : '🎤',
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

    setCatalogOnboardingComplete: (v) => set({ catalogOnboardingComplete: v }),

    setOnboardingProgress: (p) => set((s) => ({
      onboardingProgress: { ...s.onboardingProgress, ...p }
    })),

    setMvsepApiKey: (key: string | null) =>
      set((state) => {
        if (!state.currentUser) return state;
        return {
          currentUser: {
            ...state.currentUser,
            mvsepApiKey: key,
          },
        };
      }),
  }), {
    name: 'belive:user-profile',
    version: 2,
    migrate: (persisted: any, version: number) => {
      // v1 → v2: добавить новые поля, не теряя старые
      if (version === 1) {
        return {
          ...persisted,
          catalogOnboardingComplete: persisted.catalogOnboardingComplete ?? false,
          onboardingProgress: persisted.onboardingProgress ?? {
            step1Done: false, step2Done: false, activeStep: 1,
          },
        };
      }
      return persisted;
    },
    partialize: (state) => ({
      currentUserId: state.currentUserId,
      isOnboarded: state.isOnboarded,
      showOnboarding: state.showOnboarding,
      currentUser: state.currentUser,
      isLoggedIn: state.isLoggedIn,
      isGuest: state.isGuest,
      isReturning: state.isReturning,
      userName: state.userName,
      userAvatar: state.userAvatar,
      catalogOnboardingComplete: state.catalogOnboardingComplete,
      onboardingProgress: state.onboardingProgress,
    }),
    onRehydrateStorage: () => (state) => {
      if (state?.currentUser) {
        state.isLoggedIn = true;
        state.isGuest = state.currentUser.isGuest;
        state.isReturning = true;
        state.userName = state.currentUser.name;
        state.userAvatar = state.currentUser.emoji ?? '🎤';
        state.catalogOnboardingComplete ??= false;
        state.onboardingProgress ??= { step1Done: false, step2Done: false, activeStep: 1 };
      }
    },
  })
);
