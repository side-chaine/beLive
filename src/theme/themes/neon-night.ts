// beLive Theme System — Neon Night Theme
// Sprint 7 | Phase 2
// Bright neon colors for a vibrant experience

import type { BeLiveTheme } from '../types';
import { defaultTheme } from './default';
import { resolveTheme } from '../engine/resolver';

export const neonNightTheme: BeLiveTheme = resolveTheme({
  id: 'neon-night',
  name: 'Neon Night',
  version: '1.0.0',
  primitive: {
    neutral0: '#0a001a',
    neutral5: '#120024',
    neutral10: '#1a0033',
    neutral20: '#2d0057',
    neutral80: '#cc99ff',
    neutral90: '#e6ccff',
    neutral95: '#f2e6ff',
    neutral100: '#ffffff',
  },
  semantic: {
    accentPrimary: '#ff00ff',
    accentText: '#ffffff',
    surfaceBase: '#0a001a',
    surfaceRaised: '#1a0033',
    surfaceOverlay: 'rgba(255, 0, 255, 0.08)',
    surfaceSunken: '#050010',
    textPrimary: '#ffffff',
    textSecondary: '#cc99ff',
    textMuted: '#8855aa',
  },
  modes: {
    concert: { accent: '#ff0044', accentText: '#ffffff' },
    karaoke: { accent: '#ff00ff', accentText: '#ffffff' },
    rehearsal: { accent: '#00ffff', accentText: '#000000' },
    live: { accent: '#ffff00', accentText: '#000000' },
  },
});
