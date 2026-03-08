// beLive Theme System — Component Tokens (Per-element)
// Sprint 7 | Phase 1

import type { ComponentTokens } from '../types'
import { primitiveTokens as p } from './primitive'
import { semanticTokens as s } from './semantic'

export const componentTokens: ComponentTokens = {
  header: {
    bg:     s.surfaceRaised,
    text:   s.textPrimary,
    border: s.borderDefault,
  },

  transport: {
    bg:            s.surfaceRaised,
    progressTrack: p.neutral30,
    progressFill:  s.accentPrimary,
    buttonDefault: s.textSecondary,
    buttonActive:  s.accentPrimary,
  },

  lyrics: {
    bg:           'transparent',
    activeLine:   s.textPrimary,
    inactiveLine: s.textMuted,
    futureLine:   s.textSecondary,
  },

  controlPanel: {
    bg:          s.surfaceRaised,
    buttonBg:    p.neutral20,
    buttonText:  s.textPrimary,
    buttonHover: p.neutral30,
  },
} as const
