/**
 * Stem Store — N-Stem Runtime State
 *
 * WAVE W0: Zustand store skeleton.
 * Zero side effects on creation. No audio engine coupling.
 *
 * Architecture decisions (❄️ FROZEN):
 * - stemVolumes/mutes/solos/pans keyed by stem ID (not hardcoded)
 * - captureSnapshot/restoreSnapshot for exercise/solo/mode transitions
 * - loadedStems replaces hasVocals boolean
 * - Backward compat: instrumentalVolume/vocalsVolume remain as derived getters
 */

import { create } from 'zustand';
import type {
  StemSnapshot,
  StemDisplayOrder,
  StemAutomationData,
} from './stemTypes';
import { BUILTIN_STEMS, sortStemsForDisplay } from './stemTypes';

// ─── State Interface ──────────────────────────────────────

interface StemState {
  /** Currently loaded stem IDs (replaces hasVocals: boolean) */
  loadedStems: string[];

  /** Per-stem volume (0-1), keyed by stem ID */
  stemVolumes: Record<string, number>;

  /** Per-stem mute state, keyed by stem ID */
  stemMutes: Record<string, boolean>;

  /** Per-stem solo state, keyed by stem ID */
  stemSolos: Record<string, boolean>;

  /** Per-stem pan (-1 = full left, 0 = center, 1 = full right) */
  stemPans: Record<string, number>;

  /** Stems mode enabled (true = stems mode, false = instrumental mode) */
  stemsEnabled: boolean;

  /** TC-8.6A: On-demand stems loading state */
  stemsLoading: boolean;

  /** TC-10.6: Stems mode preference (tumbler state) — true = load & show stem faders */
  stemsMode: boolean;

  /** TC-10.12: True after first IDB restore — prevents IDB override on track switch */
  _stemsBootRestored: boolean;

  /** Per-track display order (persisted in TrackRecord) */
  stemDisplayOrder: StemDisplayOrder[] | null;

  /** Per-track automation data (persisted in TrackRecord) */
  stemAutomation: StemAutomationData | null;

  /** Last captured snapshot (for exercise/solo/mode transitions) */
  _lastSnapshot: StemSnapshot | null;

  // ─── Actions ────────────────────────────────────────────

  /** Initialize stem state when track loads */
  initStems: (stemIds: string[], stemsEnabled?: boolean) => void;

  /** Add a single stem without resetting existing state */
  addStem: (stemId: string) => void;

  /** Clear all stem state when track unloads */
  clearStems: () => void;

  /** Toggle stems mode (true = stems play, false = instrumental mode) */
  setStemsEnabled: (enabled: boolean) => void;

  /** TC-8.6A: Set stems loading state */
  setStemsLoading: (loading: boolean) => void;

  /** TC-10.6: Tumbler preference — show/hide stem faders */
  setStemsMode: (mode: boolean) => void;

  /** Set volume for a specific stem */
  setStemVolume: (stemId: string, volume: number) => void;

  /** Set mute for a specific stem */
  setStemMute: (stemId: string, mute: boolean) => void;

  /** Toggle mute for a specific stem */
  toggleStemMute: (stemId: string) => void;

  /** Set solo for a specific stem */
  setStemSolo: (stemId: string, solo: boolean) => void;

  /** Toggle solo for a specific stem */
  toggleStemSolo: (stemId: string) => void;

  /** Set pan for a specific stem */
  setStemPan: (stemId: string, pan: number) => void;

  /** Set display order (from TrackRecord persistence) */
  setStemDisplayOrder: (order: StemDisplayOrder[] | null) => void;

  /** Set automation data (from TrackRecord persistence) */
  setStemAutomation: (data: StemAutomationData | null) => void;

  /** Capture current state as a snapshot */
  captureSnapshot: () => StemSnapshot;

  /** Restore state from a snapshot */
  restoreSnapshot: (snapshot: StemSnapshot) => void;

  /** Get ordered stem IDs for display */
  getOrderedStemIds: () => string[];

  // ─── Backward Compat Getters ────────────────────────────

  /** @deprecated Use stemVolumes['instrumental'] instead */
  instrumentalVolume: number;
  /** @deprecated Use stemVolumes['vocals'] instead */
  vocalsVolume: number;
  /** @deprecated Use loadedStems.includes('vocals') instead */
  hasVocals: boolean;
}

// ─── Store ────────────────────────────────────────────────

export const useStemStore = create<StemState>((set, get) => ({
  loadedStems: [],
  stemVolumes: {},
  stemMutes: {},
  stemSolos: {},
  stemPans: {},
  stemsEnabled: false, // W10-001: default = instrumental mode
  stemsLoading: false, // TC-8.6A: not loading by default
  stemsMode: false, // TC-10.6: tumbler preference (show/hide stem faders)
  _stemsBootRestored: false, // TC-10.12: not yet restored from IDB
  stemDisplayOrder: null,
  stemAutomation: null,
  _lastSnapshot: null,

  // ─── Init / Clear ───────────────────────────────────────

  initStems: (stemIds: string[], stemsEnabled?: boolean) => {
    const volumes: Record<string, number> = {};
    const mutes: Record<string, boolean> = {};
    const solos: Record<string, boolean> = {};
    const pans: Record<string, number> = {};

    for (const id of stemIds) {
      volumes[id] = 1;  // unity volume
      mutes[id] = false;
      solos[id] = false;
      pans[id] = 0;     // center
    }

    set({
      loadedStems: stemIds,
      stemVolumes: volumes,
      stemMutes: mutes,
      stemSolos: solos,
      stemPans: pans,
      // TC-10.9: Preserve stemsEnabled across track loads (like stemsMode)
      // If no explicit value passed, keep current state instead of resetting to false
      stemsEnabled: stemsEnabled ?? get().stemsEnabled,
      // TC-10.6: Preserve stemsMode (tumbler preference) across track loads
      stemsMode: get().stemsMode,
      // TC-10.12: Preserve boot restore flag across track loads
      _stemsBootRestored: get()._stemsBootRestored,
      stemDisplayOrder: null,
      stemAutomation: null,
      _lastSnapshot: null,
    });
  },

  addStem: (stemId: string) => {
    const current = get();
    if (current.loadedStems.includes(stemId)) return;

    set({
      loadedStems: [...current.loadedStems, stemId],
      stemVolumes: { ...current.stemVolumes, [stemId]: 1 },
      stemMutes: { ...current.stemMutes, [stemId]: false },
      stemSolos: { ...current.stemSolos, [stemId]: false },
      stemPans: { ...current.stemPans, [stemId]: 0 },
    });
  },

  clearStems: () => {
    set({
      loadedStems: [],
      stemVolumes: {},
      stemMutes: {},
      stemSolos: {},
      stemPans: {},
      stemsEnabled: false, // W10-001: reset on clear
      stemDisplayOrder: null,
      stemAutomation: null,
      _lastSnapshot: null,
    });
  },

  // W10-001: Toggle stems mode
  setStemsEnabled: (enabled: boolean) => {
    set({ stemsEnabled: enabled });
  },

  // TC-8.6A: Set stems loading state
  setStemsLoading: (loading: boolean) => set({ stemsLoading: loading }),

  // TC-10.6: Tumbler preference — show/hide stem faders
  setStemsMode: (mode: boolean) => set({ stemsMode: mode }),

  // ─── Volume ─────────────────────────────────────────────

  setStemVolume: (stemId: string, volume: number) => {
    set((s) => ({
      stemVolumes: { ...s.stemVolumes, [stemId]: Math.max(0, Math.min(1, volume)) },
    }));
  },

  // ─── Mute ───────────────────────────────────────────────

  setStemMute: (stemId: string, mute: boolean) => {
    set((s) => ({
      stemMutes: { ...s.stemMutes, [stemId]: mute },
    }));
  },

  toggleStemMute: (stemId: string) => {
    set((s) => ({
      stemMutes: { ...s.stemMutes, [stemId]: !s.stemMutes[stemId] },
    }));
  },

  // ─── Solo ───────────────────────────────────────────────

  setStemSolo: (stemId: string, solo: boolean) => {
    set((s) => ({
      stemSolos: { ...s.stemSolos, [stemId]: solo },
    }));
  },

  toggleStemSolo: (stemId: string) => {
    set((s) => ({
      stemSolos: { ...s.stemSolos, [stemId]: !s.stemSolos[stemId] },
    }));
  },

  // ─── Pan ────────────────────────────────────────────────

  setStemPan: (stemId: string, pan: number) => {
    set((s) => ({
      stemPans: { ...s.stemPans, [stemId]: Math.max(-1, Math.min(1, pan)) },
    }));
  },

  // ─── Display Order ──────────────────────────────────────

  setStemDisplayOrder: (order: StemDisplayOrder[] | null) => {
    set({ stemDisplayOrder: order });
  },

  // ─── Automation ─────────────────────────────────────────

  setStemAutomation: (data: StemAutomationData | null) => {
    set({ stemAutomation: data });
  },

  // ─── Snapshot ───────────────────────────────────────────

  captureSnapshot: (): StemSnapshot => {
    const s = get();
    const snapshot: StemSnapshot = {
      volumes: { ...s.stemVolumes },
      mutes: { ...s.stemMutes },
      solos: { ...s.stemSolos },
      pans: { ...s.stemPans },
      timestamp: performance.now(),
    };
    set({ _lastSnapshot: snapshot });
    return snapshot;
  },

  restoreSnapshot: (snapshot: StemSnapshot) => {
    set({
      stemVolumes: { ...snapshot.volumes },
      stemMutes: { ...snapshot.mutes },
      stemSolos: { ...snapshot.solos },
      stemPans: { ...snapshot.pans },
    });
  },

  // ─── Display Order Helper ───────────────────────────────

  getOrderedStemIds: (): string[] => {
    const s = get();
    if (s.stemDisplayOrder && s.stemDisplayOrder.length > 0) {
      // User has custom order — use it
      const orderMap = new Map(s.stemDisplayOrder.map(o => [o.stemId, o.position]));
      return [...s.loadedStems].sort((a, b) => {
        return (orderMap.get(a) ?? 999) - (orderMap.get(b) ?? 999);
      });
    }
    // Default: sort by role order
    return sortStemsForDisplay(s.loadedStems);
  },

  // ─── Backward Compat Getters ────────────────────────────

  get instrumentalVolume(): number {
    return get().stemVolumes['instrumental'] ?? 1;
  },

  get vocalsVolume(): number {
    return get().stemVolumes['vocals'] ?? 1;
  },

  get hasVocals(): boolean {
    return get().loadedStems.includes('vocals');
  },
}));
