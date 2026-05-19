import type { CoverArtTheme } from '../types/cover-theme.types';
import { DEFAULT_COVER_THEME } from '../types/cover-theme.types';

// ─── Hex → RGB conversion ───

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

// ─── Compute CSS vars from theme ───
// Одна функция для обоих случаев (Центр2 усиление: DRY)
// hasArt=false → все derived values = transparent (нулевой визуальный эффект)
// hasArt=true → derived values содержат cover-derived цвета

function computeVars(theme: CoverArtTheme, hasArt: boolean): Record<string, string> {
  const { r, g, b } = hexToRgb(theme.primary);

  return {
    '--bl-cover-primary': theme.primary,
    '--bl-cover-secondary': theme.secondary,
    '--bl-cover-accent': theme.accent,
    '--bl-cover-is-dark': theme.isDark ? '1' : '0',
    '--bl-cover-has-art': hasArt ? '1' : '0',
    '--bl-cover-text': theme.text,
    '--bl-cover-glow': hasArt ? `rgba(${r}, ${g}, ${b}, 0.25)` : 'transparent',
    '--bl-cover-glow-strong': hasArt ? `rgba(${r}, ${g}, ${b}, 0.45)` : 'transparent',
    '--bl-cover-border': hasArt ? `rgba(${r}, ${g}, ${b}, 0.35)` : 'transparent',
    '--bl-cover-bg-tint': hasArt ? `rgba(${r}, ${g}, ${b}, 0.06)` : 'transparent',
    '--bl-cover-bg-tint-strong': hasArt ? `rgba(${r}, ${g}, ${b}, 0.12)` : 'transparent',
    '--bl-cover-header-bg': hasArt ? `rgba(${r}, ${g}, ${b}, 0.05)` : 'transparent',
    '--bl-cover-button-bg': hasArt ? `rgba(${r}, ${g}, ${b}, 0.15)` : 'transparent',
    '--bl-cover-button-bg-hover': hasArt ? `rgba(${r}, ${g}, ${b}, 0.25)` : 'transparent',
    '--bl-cover-fader-color': theme.accent,
  };
}

// ─── Main publication function ───

export function applyCoverTheme(theme: CoverArtTheme | null): void {
  requestAnimationFrame(() => {
    const root = document.documentElement;
    const vars = theme
      ? computeVars(theme, true)
      : computeVars(DEFAULT_COVER_THEME, false);

    for (const [prop, value] of Object.entries(vars)) {
      root.style.setProperty(prop, value);
    }
  });
}
