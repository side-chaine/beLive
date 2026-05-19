// ═══════════════════════════════════════════════════
// TRANSITION PRESET VALIDATION
// Санитизация любого JSON из ZIP в безопасный TransitionPreset
// ═══════════════════════════════════════════════════

import type { TransitionPreset, EasingValue } from './transition-preset.types';
import { DEFAULT_PRESET, CURRENT_PRESET_VERSION, TRANSITION_PRESETS } from '../data/transition-presets';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

const NAMED_EASINGS = ['ease', 'ease-in', 'ease-out', 'ease-in-out', 'linear'];

function parseEasing(raw: unknown): EasingValue {
  if (typeof raw !== 'string') return 'ease-out';
  if (NAMED_EASINGS.includes(raw)) return raw;
  if (raw.startsWith('cubic-bezier(')) {
    const m = raw.match(/cubic-bezier\(\s*([^)]+)\s*\)/);
    if (m) {
      const vals = m[1].split(',').map(v => parseFloat(v.trim()));
      if (vals.length === 4 && vals.every(v => !isNaN(v))) return raw;
    }
  }
  return 'ease-out';
}

function validateMode<M extends string>(raw: unknown, allowed: readonly M[], fallback: M): M {
  return typeof raw === 'string' && (allowed as readonly string[]).includes(raw) ? raw as M : fallback;
}

function validateId(raw: unknown): string {
  if (typeof raw !== 'string') return 'custom';
  return /^[a-z0-9-]+$/.test(raw) ? raw : 'custom';
}

/**
 * Валидирует и санитизирует TransitionPreset из любого источника (ZIP, network, etc).
 * - Если ID совпадает со встроенным пресетом → вернуть встроенный (fast path)
 * - Если version > current → warning + default
 * - Все числа clamp к допустимым диапазонам
 * - Easing валидируется: named keywords + cubic-bezier формат
 * - ID валидируется: только [a-z0-9-]
 * - Fallback: DEFAULT_PRESET
 */
export function validateTransitionPreset(raw: unknown): TransitionPreset {
  if (!raw || typeof raw !== 'object') return DEFAULT_PRESET;
  const p = raw as Record<string, any>;

  // Built-in preset shortcut — если ID известен, вернуть эталон
  if (typeof p.id === 'string' && TRANSITION_PRESETS[p.id]) {
    return TRANSITION_PRESETS[p.id];
  }

  // Version guard
  if (p.version && Number(p.version) > CURRENT_PRESET_VERSION) {
    console.warn('[TransitionPreset] Unknown version', p.version);
    return DEFAULT_PRESET;
  }

  return {
    id: validateId(p.id),
    name: String(p.name ?? 'Custom'),
    version: CURRENT_PRESET_VERSION,

    appear: {
      duration: clamp(Number(p.appear?.duration ?? 0.5), 0, 3),
      easing: parseEasing(p.appear?.easing),
      slideFrom: clamp(Number(p.appear?.slideFrom ?? 12), 0, 100),
      startOpacity: clamp(Number(p.appear?.startOpacity ?? 0), 0, 1),
      endOpacity: clamp(Number(p.appear?.endOpacity ?? 0.95), 0, 1),
    },

    travel: {
      duration: clamp(Number(p.travel?.duration ?? 0.8), 0.1, 5),
      easing: parseEasing(p.travel?.easing),
      spotlight: {
        enabled: Boolean(p.travel?.spotlight?.enabled ?? false),
        intensity: clamp(Number(p.travel?.spotlight?.intensity ?? 0), 0, 1),
        glowSize: clamp(Number(p.travel?.spotlight?.glowSize ?? 0), 0, 80),
        glowOpacity: clamp(Number(p.travel?.spotlight?.glowOpacity ?? 0), 0, 1),
        dimOthers: Boolean(p.travel?.spotlight?.dimOthers ?? false),
        othersOpacity: clamp(Number(p.travel?.spotlight?.othersOpacity ?? 1), 0, 1),
      },
    },

    dissolve: {
      mode: validateMode(p.dissolve?.mode, ['none', 'fade', 'wave', 'scale'] as const, 'none'),
      duration: clamp(Number(p.dissolve?.duration ?? 0), 0, 3),
      stagger: clamp(Number(p.dissolve?.stagger ?? 0), 0, 0.5),
      waveDirection: validateMode(p.dissolve?.waveDirection, ['top-down', 'bottom-up'] as const, 'top-down'),
      scale: clamp(Number(p.dissolve?.scale ?? 1), 0.5, 1.5),
      endOpacity: clamp(Number(p.dissolve?.endOpacity ?? 0), 0, 1),
    },

    enter: {
      mode: validateMode(p.enter?.mode, ['none', 'fade', 'wave', 'slide-up'] as const, 'none'),
      duration: clamp(Number(p.enter?.duration ?? 0), 0, 3),
      stagger: clamp(Number(p.enter?.stagger ?? 0), 0, 0.5),
      waveDirection: validateMode(p.enter?.waveDirection, ['top-down', 'bottom-up'] as const, 'top-down'),
      startOpacity: clamp(Number(p.enter?.startOpacity ?? 0), 0, 1),
      slideY: clamp(Number(p.enter?.slideY ?? 0), 0, 40),
    },

    timing: {
      triggerOffset: clamp(Number(p.timing?.triggerOffset ?? 1.0), 0.2, 3),
      subBlockOffsetRatio: clamp(Number(p.timing?.subBlockOffsetRatio ?? 0.6), 0.1, 1),
      triggerWindow: clamp(Number(p.timing?.triggerWindow ?? 1.5), 0.5, 5),
      idleGap: clamp(Number(p.timing?.idleGap ?? 8), 0, 30),
      dissolveStart: validateMode(p.timing?.dissolveStart, ['at-switch', 'travel-mid', 'travel-end'] as const, 'at-switch'),
      enterDelay: clamp(Number(p.timing?.enterDelay ?? 0), 0, 1),
    },
  };
}
