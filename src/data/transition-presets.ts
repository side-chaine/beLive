// ═══════════════════════════════════════════════════
// TRANSITION PRESETS — Bank of 5 built-in presets
// Сериализуются в JSON, едут в ZIP треках
// ═══════════════════════════════════════════════════

import type { TransitionPreset } from '../slot-matrix/transition-preset.types';

export const TRANSITION_PRESETS: Record<string, TransitionPreset> = {

  // ═══ "Smooth" — текущее поведение (default) ═══
  smooth: {
    id: 'smooth',
    name: 'Smooth',
    version: 1,
    appear: {
      duration: 0.5,
      easing: 'ease-out',
      slideFrom: 12,
      startOpacity: 0,
      endOpacity: 0.95,
    },
    travel: {
      duration: 0.8,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      spotlight: {
        enabled: false,
        intensity: 0,
        glowSize: 0,
        glowOpacity: 0,
        dimOthers: false,
        othersOpacity: 1,
      },
    },
    dissolve: {
      mode: 'fade',
      duration: 0.3,
      stagger: 0,
      waveDirection: 'top-down',
      scale: 1,
      endOpacity: 0.3,
    },
    enter: {
      mode: 'fade',
      duration: 0.3,
      stagger: 0,
      waveDirection: 'top-down',
      startOpacity: 0,
      slideY: 8,
    },
    timing: {
      triggerOffset: 1.0,
      subBlockOffsetRatio: 0.6,
      triggerWindow: 1.5,
      idleGap: 8,
      dissolveStart: 'at-switch',
      enterDelay: 0,
    },
  },

  // ═══ "Bounce" — ПС с отскоком ═══
  bounce: {
    id: 'bounce',
    name: 'Bounce',
    version: 1,
    appear: {
      duration: 0.2,
      easing: 'ease-out',
      slideFrom: 8,
      startOpacity: 0,
      endOpacity: 0.95,
    },
    travel: {
      duration: 0.8,
      easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      spotlight: {
        enabled: false,
        intensity: 0,
        glowSize: 0,
        glowOpacity: 0,
        dimOthers: false,
        othersOpacity: 1,
      },
    },
    dissolve: {
      mode: 'fade',
      duration: 0.15,
      stagger: 0,
      waveDirection: 'top-down',
      scale: 1,
      endOpacity: 0.2,
    },
    enter: {
      mode: 'fade',
      duration: 0.2,
      stagger: 0,
      waveDirection: 'top-down',
      startOpacity: 0,
      slideY: 12,
    },
    timing: {
      triggerOffset: 1.0,
      subBlockOffsetRatio: 0.6,
      triggerWindow: 1.5,
      idleGap: 8,
      dissolveStart: 'at-switch',
      enterDelay: 0,
    },
  },

  // ═══ "Spotlight" — ПС с прожектором, фон затемняется ═══
  spotlight: {
    id: 'spotlight',
    name: 'Spotlight',
    version: 1,
    appear: {
      duration: 0.3,
      easing: 'ease-out',
      slideFrom: 10,
      startOpacity: 0,
      endOpacity: 1.0,
    },
    travel: {
      duration: 0.8,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      spotlight: {
        enabled: true,
        intensity: 0.7,
        glowSize: 30,
        glowOpacity: 0.8,
        dimOthers: true,
        othersOpacity: 0.15,
      },
    },
    dissolve: {
      mode: 'fade',
      duration: 0.4,
      stagger: 0,
      waveDirection: 'top-down',
      scale: 1,
      endOpacity: 0.15,
    },
    enter: {
      mode: 'fade',
      duration: 0.3,
      stagger: 0,
      waveDirection: 'top-down',
      startOpacity: 0,
      slideY: 0,
    },
    timing: {
      triggerOffset: 1.0,
      subBlockOffsetRatio: 0.6,
      triggerWindow: 1.5,
      idleGap: 8,
      dissolveStart: 'at-switch',
      enterDelay: 0,
    },
  },

  // ═══ "Snap" — быстрый и точный ═══
  snap: {
    id: 'snap',
    name: 'Snap',
    version: 1,
    appear: {
      duration: 0.15,
      easing: 'ease-out',
      slideFrom: 0,
      startOpacity: 0,
      endOpacity: 1.0,
    },
    travel: {
      duration: 0.4,
      easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      spotlight: {
        enabled: false,
        intensity: 0,
        glowSize: 0,
        glowOpacity: 0,
        dimOthers: false,
        othersOpacity: 1,
      },
    },
    dissolve: {
      mode: 'fade',
      duration: 0.1,
      stagger: 0,
      waveDirection: 'top-down',
      scale: 1,
      endOpacity: 0.1,
    },
    enter: {
      mode: 'fade',
      duration: 0.1,
      stagger: 0,
      waveDirection: 'top-down',
      startOpacity: 0,
      slideY: 0,
    },
    timing: {
      triggerOffset: 0.6,
      subBlockOffsetRatio: 0.5,
      triggerWindow: 1.2,
      idleGap: 6,
      dissolveStart: 'at-switch',
      enterDelay: 0,
    },
  },

  // ═══ "Gentle" — медленный и мягкий ═══
  gentle: {
    id: 'gentle',
    name: 'Gentle',
    version: 1,
    appear: {
      duration: 0.8,
      easing: 'ease-out',
      slideFrom: 6,
      startOpacity: 0,
      endOpacity: 0.9,
    },
    travel: {
      duration: 1.2,
      easing: 'ease-in-out',
      spotlight: {
        enabled: false,
        intensity: 0,
        glowSize: 0,
        glowOpacity: 0,
        dimOthers: false,
        othersOpacity: 1,
      },
    },
    dissolve: {
      mode: 'fade',
      duration: 0.6,
      stagger: 0,
      waveDirection: 'top-down',
      scale: 1,
      endOpacity: 0.4,
    },
    enter: {
      mode: 'fade',
      duration: 0.5,
      stagger: 0,
      waveDirection: 'top-down',
      startOpacity: 0,
      slideY: 4,
    },
    timing: {
      triggerOffset: 1.5,
      subBlockOffsetRatio: 0.7,
      triggerWindow: 1.8,
      idleGap: 10,
      dissolveStart: 'travel-mid',
      enterDelay: 0,
    },
  },
};

/** Default preset — current behavior, zero visual change */
export const DEFAULT_PRESET = TRANSITION_PRESETS.smooth;

/** Current schema version — bump when breaking change */
export const CURRENT_PRESET_VERSION = 1;
