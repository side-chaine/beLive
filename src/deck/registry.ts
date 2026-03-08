import { lazy, type LazyExoticComponent, type ComponentType } from 'react';
import type { DeckModule, AppMode } from './types';

/* ── Storage ──────────────────────────────────────── */
const modules: DeckModule[] = [];
const lazyCache = new Map<string, LazyExoticComponent<ComponentType>>();

/* ── Registration ─────────────────────────────────── */

/** Register a deck module. Duplicate ids silently ignored. */
export function registerModule(mod: DeckModule): void {
  if (modules.some(m => m.id === mod.id)) return;
  modules.push(mod);
  modules.sort((a, b) => a.order - b.order);
}

/* ── Queries ──────────────────────────────────────── */

/** All registered modules (sorted by order) */
export function getModules(): readonly DeckModule[] {
  return modules;
}

/** Modules visible in a specific app mode */
export function getModulesForMode(mode: AppMode): DeckModule[] {
  return modules.filter(m => m.modes.includes(mode));
}

/** Find module definition by id */
export function getModuleById(id: string): DeckModule | undefined {
  return modules.find(m => m.id === id);
}

/**
 * Get cached React.lazy component for a module.
 * Created once on first call, same reference returned after.
 * Returns null if module id not found.
 */
export function getLazyComponent(
  id: string
): LazyExoticComponent<ComponentType> | null {
  const mod = modules.find(m => m.id === id);
  if (!mod) return null;
  let cached = lazyCache.get(id);
  if (!cached) {
    cached = lazy(mod.load);
    lazyCache.set(id, cached);
  }
  return cached;
}
