// ═══════════════════════════════════════════════════
// PLATE BRIDGE — plate.store → IDB auto-save
// Синхронизирует transitionPreset: plate.store → TrackRecord
// Debounce 300ms — батчит быстрые клики
// Guard: нет трека — некуда писать
// ═══════════════════════════════════════════════════

import { usePlateStore } from '../stores/plate.store';
import { useTrackStore } from '../stores/track.store';
import { updateTrackField } from '../services/idb.service';

const DEBOUNCE_MS = 300;

let unsub: (() => void) | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function syncToIDB(presetId: string) {
  const trackMeta = useTrackStore.getState().currentTrack;
  if (!trackMeta?.id) return; // Нет трека — некуда писать

  const trackId = parseInt(trackMeta.id, 10);
  if (isNaN(trackId)) return;

  updateTrackField(trackId, { transitionPreset: presetId });
}

export function initPlateBridge() {
  if (unsub) return; // Guard: single initialization

  // Subscribe to preset changes
  unsub = usePlateStore.subscribe((state, prev) => {
    if (state.transitionPreset !== prev.transitionPreset) {
      // Debounce: batch rapid clicks
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        syncToIDB(state.transitionPreset);
        debounceTimer = null;
      }, DEBOUNCE_MS);
    }
  });
}

export function destroyPlateBridge() {
  if (unsub) {
    unsub();
    unsub = null;
  }
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}
