// beLive Theme System — Theme Resolver
// Sprint 7 | Phase 2
// Merges partial custom themes with default fallback
// Ensures all 95 CSS variables are always defined

import { defaultTheme } from '../themes/default';
import type { BeLiveTheme } from '../types';

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

function deepMerge<T extends Record<string, any>>(
  base: T,
  override: DeepPartial<T>
): T {
  const result = { ...base };
  for (const key of Object.keys(override) as (keyof T)[]) {
    const val = override[key];
    if (
      val !== null &&
      val !== undefined &&
      typeof val === 'object' &&
      !Array.isArray(val) &&
      typeof base[key] === 'object' &&
      !Array.isArray(base[key])
    ) {
      result[key] = deepMerge(
        base[key] as Record<string, any>,
        val as Record<string, any>
      ) as T[keyof T];
    } else if (val !== undefined) {
      result[key] = val as T[keyof T];
    }
  }
  return result;
}

export function resolveTheme(partial: DeepPartial<BeLiveTheme>): BeLiveTheme {
  const merged = deepMerge(defaultTheme, partial) as any;
  if (!merged.id) {
    merged.id = 'custom-' + Date.now();
  }
  if (!merged.name) {
    merged.name = 'Custom Theme';
  }
  if (!merged.version) {
    merged.version = '1.0.0';
  }
  return merged as BeLiveTheme;
}

export type { DeepPartial };