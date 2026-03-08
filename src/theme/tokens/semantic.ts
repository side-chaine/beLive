// beLive Theme System — Semantic Tokens (Purpose-based)
// Sprint 7 | Phase 1

import type { SemanticTokens } from '../types'
import { primitiveTokens as p } from './primitive'

export const semanticTokens: SemanticTokens = {
  // ─── Surfaces ────────────────────────────────────────────
  surfaceBase:    p.neutral5,
  surfaceRaised:  p.neutral15,
  surfaceOverlay: p.neutral20,
  surfaceSunken:  p.neutral0,

  // ─── Text ────────────────────────────────────────────────
  textPrimary:   p.neutral100,
  textSecondary: p.neutral70,
  textMuted:     p.neutral50,
  textInverse:   p.neutral0,

  // ─── Accent ──────────────────────────────────────────────
  accentPrimary:   p.purple50,
  accentSecondary: p.blue50,
  accentText:      p.neutral100,

  // ─── Borders ─────────────────────────────────────────────
  borderDefault: p.neutral30,
  borderStrong:  p.neutral50,
  borderAccent:  p.purple50,

  // ─── Status ──────────────────────────────────────────────
  statusSuccess: p.green50,
  statusWarning: p.orange50,
  statusError:   p.red50,
  statusInfo:    p.blue50,
} as const
