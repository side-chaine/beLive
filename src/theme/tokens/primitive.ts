// beLive Theme System — Primitive Tokens (Palette)
// Sprint 7 | Phase 1
// Source: legacy styles.css + block colors from UI audit

import type { PrimitiveTokens } from '../types'

export const primitiveTokens: PrimitiveTokens = {
  // ─── Neutrals (dark theme base) ──────────────────────────
  neutral0:   '#000000',
  neutral5:   '#0a0a0a',
  neutral10:  '#111111',
  neutral15:  '#1a1a1a',
  neutral20:  '#222222',
  neutral30:  '#333333',
  neutral40:  '#444444',
  neutral50:  '#666666',
  neutral60:  '#888888',
  neutral70:  '#aaaaaa',
  neutral80:  '#cccccc',
  neutral90:  '#e0e0e0',
  neutral95:  '#f0f0f0',
  neutral100: '#ffffff',

  // ─── Brand / Accent ──────────────────────────────────────
  blue50:   '#3498db',
  purple50: '#9b59b6',
  orange50: '#e67e22',
  red50:    '#e74c3c',
  green50:  '#2ecc71',

  // ─── Block Type Colors (from legacy UI) ──────────────────
  // Source: modal-block-editor.js + Nikita screenshots
  blockVerse:     '#4CAF50',
  blockPrechorus: '#FFEB3B',
  blockChorus:    '#F44336',
  blockBridge:    '#9C27B0',
  blockIntro:     '#2196F3',
  blockOutro:     '#00BCD4',
  blockUnknown:   '#9E9E9E',
} as const
