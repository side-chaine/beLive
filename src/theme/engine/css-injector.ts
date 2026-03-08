// beLive Theme System — CSS Injector Engine
// Sprint 7 | Phase 1
// Converts BeLiveTheme → CSS custom properties on :root
// Uses requestAnimationFrame for batched single-reflow application

import type { BeLiveTheme, AppMode } from '../types'

// ─── Utility ──────────────────────────────────────────────────
function camelToKebab(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

// ─── Flattener (handles 1 level of nesting) ───────────────────
function flattenObject(
  obj: Record<string, unknown>,
  prefix: string
): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      vars[`${prefix}-${camelToKebab(key)}`] = value
    } else if (typeof value === 'object' && value !== null) {
      for (const [subKey, subValue] of Object.entries(
        value as Record<string, string>
      )) {
        vars[`${prefix}-${camelToKebab(key)}-${camelToKebab(subKey)}`] = subValue
      }
    }
  }
  return vars
}

// ─── Build full CSS vars map from theme ───────────────────────
function buildCSSVars(theme: BeLiveTheme): Record<string, string> {
  const vars: Record<string, string> = {}

  // Token layers
  Object.assign(vars, flattenObject(theme.primitive as unknown as Record<string, unknown>, '--bl-p'))
  Object.assign(vars, flattenObject(theme.semantic as unknown as Record<string, unknown>, '--bl-s'))
  Object.assign(vars, flattenObject(theme.component as unknown as Record<string, unknown>, '--bl-c'))

  // Design tokens
  Object.assign(vars, flattenObject(theme.typography as unknown as Record<string, unknown>, '--bl-typography'))
  Object.assign(vars, flattenObject(theme.spacing as unknown as Record<string, unknown>, '--bl-spacing'))
  Object.assign(vars, flattenObject(theme.radii as unknown as Record<string, unknown>, '--bl-radius'))
  Object.assign(vars, flattenObject(theme.transitions as unknown as Record<string, unknown>, '--bl-transition'))

  // ─── Convenience aliases (most used in components) ────────
  vars['--bl-accent']         = theme.semantic.accentPrimary
  vars['--bl-accent-text']    = theme.semantic.accentText
  vars['--bl-surface-base']   = theme.semantic.surfaceBase
  vars['--bl-surface-raised'] = theme.semantic.surfaceRaised
  vars['--bl-text-primary']   = theme.semantic.textPrimary
  vars['--bl-text-secondary'] = theme.semantic.textSecondary
  vars['--bl-text-muted']     = theme.semantic.textMuted
  vars['--bl-border-default'] = theme.semantic.borderDefault

  // ─── Block color shortcuts ────────────────────────────────
  vars['--bl-block-verse']     = theme.primitive.blockVerse
  vars['--bl-block-prechorus'] = theme.primitive.blockPrechorus
  vars['--bl-block-chorus']    = theme.primitive.blockChorus
  vars['--bl-block-bridge']    = theme.primitive.blockBridge
  vars['--bl-block-intro']     = theme.primitive.blockIntro
  vars['--bl-block-outro']     = theme.primitive.blockOutro
  vars['--bl-block-unknown']   = theme.primitive.blockUnknown

  return vars
}

// ─── Apply vars to :root via rAF (single reflow) ─────────────
function setVars(vars: Record<string, string>): void {
  requestAnimationFrame(() => {
    const root = document.documentElement
    for (const [prop, value] of Object.entries(vars)) {
      root.style.setProperty(prop, value)
    }
  })
}

// ─── Public API ───────────────────────────────────────────────

/** Apply full theme — sets ALL CSS vars + data-theme attribute */
export function applyTheme(theme: BeLiveTheme): void {
  const vars = buildCSSVars(theme)
  setVars(vars)
  document.documentElement.setAttribute('data-theme', theme.id)
}

/** Apply mode overrides — updates accent/surface per mode */
export function applyMode(theme: BeLiveTheme, mode: AppMode): void {
  const overrides = theme.modes[mode]
  const vars: Record<string, string> = {}

  if (overrides.accent)      vars['--bl-accent']       = overrides.accent
  if (overrides.accentText)  vars['--bl-accent-text']   = overrides.accentText
  if (overrides.surfaceBase) vars['--bl-surface-base']  = overrides.surfaceBase

  setVars(vars)
  document.documentElement.setAttribute('data-mode', mode)
}

/** Remove all theme vars from :root (cleanup) */
export function removeTheme(): void {
  const root = document.documentElement
  const toRemove: string[] = []
  for (let i = 0; i < root.style.length; i++) {
    if (root.style[i].startsWith('--bl-')) {
      toRemove.push(root.style[i])
    }
  }
  toRemove.forEach(prop => root.style.removeProperty(prop))
  root.removeAttribute('data-theme')
  root.removeAttribute('data-mode')
}
