// beLive Theme System — ThemeProvider
// Sprint 7 | Phase 1
// NO React Context! Applies CSS vars to :root via useEffect
// INV-2.1-THEME: Components don't know about theme — only var(--bl-*)

import { useEffect } from 'react'
import { useThemeStore } from '../store/theme-store'

/**
 * ThemeProvider — mount once at app root.
 * Calls hydrate() to apply CSS vars on :root.
 * No Context, no children wrapper overhead.
 * Re-applies mode when activeMode changes (e.g. from mode.bridge).
 */
export function ThemeProvider() {
  const hydrate = useThemeStore((s) => s.hydrate)
  const activeMode = useThemeStore((s) => s.activeMode)
  const setMode = useThemeStore((s) => s.setMode)

  // Initial hydration — apply theme + mode CSS vars
  useEffect(() => {
    hydrate()
  }, [hydrate])

  // Re-apply mode when it changes (synced from mode.bridge)
  useEffect(() => {
    setMode(activeMode)
  }, [activeMode, setMode])

  // Render nothing — this component is a side-effect only
  return null
}
