// beLive Theme System — Theme Registry
// Sprint 7 | Phase 2
// Central registry for all available themes

import { defaultTheme } from './default';
import { neonNightTheme } from './neon-night';
import type { BeLiveTheme } from '../types';

export const themeRegistry: Record<string, BeLiveTheme> = {
  'default': defaultTheme,
  'neon-night': neonNightTheme,
};

export function getThemeById(id: string): BeLiveTheme {
  return themeRegistry[id] ?? defaultTheme;
}

export { defaultTheme, neonNightTheme };
