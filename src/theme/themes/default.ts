// beLive Theme System — Default Theme
// Sprint 7 | Phase 1
// Assembles all token layers into a complete BeLiveTheme

import type { BeLiveTheme } from '../types'
import { primitiveTokens } from '../tokens/primitive'
import { semanticTokens } from '../tokens/semantic'
import { componentTokens } from '../tokens/component'

export const defaultTheme: BeLiveTheme = {
  id: 'default',
  name: 'beLive Dark',
  version: '1.0.0',

  primitive: primitiveTokens,
  semantic: semanticTokens,
  component: componentTokens,

  // ─── Mode Overrides ────────────────────────────────────────
  // Each mode can override accent + surface
  // These map to --bl-accent / --bl-accent-text / --bl-surface-base
  modes: {
    concert: {
      accent:      '#e74c3c',   // red
      accentText:  '#ffffff',
    },
    karaoke: {
      accent:      '#9b59b6',   // purple
      accentText:  '#ffffff',
    },
    rehearsal: {
      accent:      '#3498db',   // blue
      accentText:  '#ffffff',
    },
    live: {
      accent:      '#e67e22',   // orange
      accentText:  '#ffffff',
    },
  },

  // ─── Typography ────────────────────────────────────────────
  typography: {
    fontFamily:     "'Inter', 'SF Pro Display', -apple-system, sans-serif",
    fontFamilyMono: "'SF Mono', 'Fira Code', monospace",
    fontSizeBase:   '14px',
    fontSizeSm:     '12px',
    fontSizeLg:     '16px',
    fontSizeXl:     '20px',
    lineHeight:     '1.5',
  },

  // ─── Spacing ───────────────────────────────────────────────
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
  },

  // ─── Radii ─────────────────────────────────────────────────
  radii: {
    sm:   '4px',
    md:   '8px',
    lg:   '12px',
    full: '9999px',
  },

  // ─── Transitions ───────────────────────────────────────────
  transitions: {
    fast:   '150ms ease',
    normal: '250ms ease',
    slow:   '400ms ease',
  },

  // ─── Audio Reactive (Phase 2-3, disabled by default) ──────
  reactive: {
    enabled: false,
    preset: 'subtle',
    intensity: 0.5,
  },
} as const
