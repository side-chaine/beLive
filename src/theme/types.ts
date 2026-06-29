// beLive Theme System — Type Definitions
// Sprint 7 | Phase 1

// ─── App Mode ─────────────────────────────────────────────────
export type AppMode = 'concert' | 'karaoke' | 'rehearsal' | 'live'

// ─── Block Types ──────────────────────────────────────────────
// Импортируется из SSOT (block-taxonomy.ts)
import type { BlockType } from '../blocks/parser/block-taxonomy';
export { BlockType };

// ─── Primitive Tokens ─────────────────────────────────────────
export interface PrimitiveTokens {
  readonly neutral0: string
  readonly neutral5: string
  readonly neutral10: string
  readonly neutral15: string
  readonly neutral20: string
  readonly neutral30: string
  readonly neutral40: string
  readonly neutral50: string
  readonly neutral60: string
  readonly neutral70: string
  readonly neutral80: string
  readonly neutral90: string
  readonly neutral95: string
  readonly neutral100: string

  readonly blue50: string
  readonly purple50: string
  readonly orange50: string
  readonly red50: string
  readonly green50: string

  readonly blockVerse: string
  readonly blockPrechorus: string
  readonly blockChorus: string
  readonly blockBridge: string
  readonly blockIntro: string
  readonly blockOutro: string
  readonly blockUnknown: string
}

// ─── Semantic Tokens ──────────────────────────────────────────
export interface SemanticTokens {
  readonly surfaceBase: string
  readonly surfaceRaised: string
  readonly surfaceOverlay: string
  readonly surfaceSunken: string

  readonly textPrimary: string
  readonly textSecondary: string
  readonly textMuted: string
  readonly textInverse: string

  readonly accentPrimary: string
  readonly accentSecondary: string
  readonly accentText: string

  readonly borderDefault: string
  readonly borderStrong: string
  readonly borderAccent: string

  readonly statusSuccess: string
  readonly statusWarning: string
  readonly statusError: string
  readonly statusInfo: string
}

// ─── Component Tokens ─────────────────────────────────────────
export interface ComponentTokens {
  readonly header: {
    readonly bg: string
    readonly text: string
    readonly border: string
  }
  readonly transport: {
    readonly bg: string
    readonly progressTrack: string
    readonly progressFill: string
    readonly buttonDefault: string
    readonly buttonActive: string
  }
  readonly lyrics: {
    readonly bg: string
    readonly activeLine: string
    readonly inactiveLine: string
    readonly futureLine: string
  }
  readonly controlPanel: {
    readonly bg: string
    readonly buttonBg: string
    readonly buttonText: string
    readonly buttonHover: string
  }
}

// ─── Mode Overrides ───────────────────────────────────────────
export interface ModeOverrides {
  readonly accent?: string
  readonly accentText?: string
  readonly surfaceBase?: string
}

// ─── Typography ───────────────────────────────────────────────
export interface TypographyTokens {
  readonly fontFamily: string
  readonly fontFamilyMono: string
  readonly fontSizeBase: string
  readonly fontSizeSm: string
  readonly fontSizeLg: string
  readonly fontSizeXl: string
  readonly lineHeight: string
}

// ─── Layout ───────────────────────────────────────────────────
export interface SpacingTokens {
  readonly xs: string
  readonly sm: string
  readonly md: string
  readonly lg: string
  readonly xl: string
}

export interface RadiiTokens {
  readonly sm: string
  readonly md: string
  readonly lg: string
  readonly full: string
}

export interface TransitionTokens {
  readonly fast: string
  readonly normal: string
  readonly slow: string
}

// ─── Audio Reactive (reserved for Phase 2-3) ─────────────────
export interface AudioReactiveConfig {
  readonly enabled: boolean
  readonly preset: 'minimal' | 'subtle' | 'immersive' | 'aggressive' | 'concert'
  readonly intensity: number
  readonly components?: Readonly<Record<string,
    'bass' | 'mid' | 'high' | 'beat' | 'energy' | 'none'
  >>
}

// ─── Full Theme ───────────────────────────────────────────────
export interface BeLiveTheme {
  readonly id: string
  readonly name: string
  readonly version: string

  readonly primitive: PrimitiveTokens
  readonly semantic: SemanticTokens
  readonly component: ComponentTokens

  readonly modes: {
    readonly concert: ModeOverrides
    readonly karaoke: ModeOverrides
    readonly rehearsal: ModeOverrides
    readonly live: ModeOverrides
  }

  readonly typography: TypographyTokens
  readonly spacing: SpacingTokens
  readonly radii: RadiiTokens
  readonly transitions: TransitionTokens

  readonly reactive?: AudioReactiveConfig
}

// ─── Utility Types ────────────────────────────────────────────
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

export type ThemeInput = DeepPartial<
  Omit<BeLiveTheme, 'id' | 'name' | 'version'>
> & {
  id: string
  name: string
  version?: string
}

export type ResolvedTheme = Readonly<BeLiveTheme>
