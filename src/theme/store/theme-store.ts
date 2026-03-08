// beLive Theme System — Zustand Store
// Sprint 7 | Phase 1
// Persists only themeId + mode (~50 bytes)
// INV-2.0-E: Yjs-ready (no DOM side effects in setState)

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppMode, BeLiveTheme } from '../types'
import { defaultTheme } from '../themes/default'
import { getThemeById } from '../themes/index'
import { applyTheme, applyMode } from '../engine/css-injector'

// ─── Store Interface ──────────────────────────────────────────
interface ThemeState {
  activeThemeId: string
  activeMode: AppMode

  // Actions
  setMode: (mode: AppMode) => void
  setTheme: (themeId: string) => void
  getActiveTheme: () => BeLiveTheme

  // Init (called once from ThemeProvider)
  hydrate: () => void
}

// ─── Store ────────────────────────────────────────────────────
export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      activeThemeId: 'default',
      activeMode: 'rehearsal',

      setMode: (mode: AppMode) => {
        set({ activeMode: mode })
        const theme = get().getActiveTheme()
        applyMode(theme, mode)
      },

      setTheme: (themeId: string) => {
        const theme = getThemeById(themeId)
        if (!theme) {
          console.warn(`Theme "${themeId}" not found, using default`)
          return
        }
        set({ activeThemeId: themeId })
        applyTheme(theme)
        applyMode(theme, get().activeMode)
      },

      getActiveTheme: (): BeLiveTheme => {
        const { activeThemeId } = get()
        return getThemeById(activeThemeId)
      },

      hydrate: () => {
        const { activeThemeId, activeMode } = get()
        const theme = getThemeById(activeThemeId)
        applyTheme(theme)
        applyMode(theme, activeMode)
      },
    }),
    {
      name: 'bl-theme',
      partialize: (state) => ({
        activeThemeId: state.activeThemeId,
        activeMode: state.activeMode,
      }),
    }
  )
)
