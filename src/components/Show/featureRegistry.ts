import type { FeatureSnapshot } from '../../types/show.types';
import { useDeckStore } from '../../stores/deck.store';
import { getModuleById } from '../../deck/registry';

export interface FeatureDefinition {
  id: string;
  label: string;
  category: string;
  execute: (preset?: Record<string, unknown>) => void;
  deactivate: () => void;
}

const registry = new Map<string, FeatureDefinition>();

// ── Snapshot management ──

/** Последний snapshot для restore при deactivate */
let _lastSnapshot: FeatureSnapshot | null = null;

export function captureSnapshot(): FeatureSnapshot {
  const deck = useDeckStore.getState();
  return {
    activeTabId: deck.activeTabId,
    expanded: deck.expanded,
  };
}

export function restoreSnapshot(snap: FeatureSnapshot): void {
  const deck = useDeckStore.getState();
  // Fallback: если activeTabId невалиден → очистить
  const validTab = snap.activeTabId ? getModuleById(snap.activeTabId) : null;
  if (validTab) {
    deck.setTab(snap.activeTabId);
  } else {
    deck.clearTab();
  }
}

// ── Registry functions ──

export function registerFeature(def: FeatureDefinition): void {
  if (registry.has(def.id)) return; // dedup
  registry.set(def.id, def);
}

export function getFeature(id: string): FeatureDefinition | undefined {
  return registry.get(id);
}

export function getAllFeatures(): FeatureDefinition[] {
  return Array.from(registry.values());
}

export function getFeaturesByCategory(category: string): FeatureDefinition[] {
  return Array.from(registry.values()).filter(f => f.category === category);
}

// ═══════════════════════════════════════
// MVP записи
// ═══════════════════════════════════════

registerFeature({
  id: 'open-studio-mixer',
  label: 'Открыть микшер Studio',
  category: 'mixer',
  execute: (preset) => {
    const snapshot = captureSnapshot();
    // Сохранить snapshot для deactivate
    _lastSnapshot = snapshot;
    useDeckStore.getState().setTab('mixer');
    console.log('[FeatureRegistry] open-studio-mixer, preset:', preset);
  },
  deactivate: () => {
    if (_lastSnapshot) {
      restoreSnapshot(_lastSnapshot);
      _lastSnapshot = null;
    } else {
      useDeckStore.getState().clearTab();
    }
  },
});
