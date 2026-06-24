// @TC-MET-05: Metrics Sync Service — client-side sync with retry + idempotency
// Sends metrics to gateway, handles offline queue, retry with backoff

import { useMetricsStore } from '../stores/metrics.store';
import { useUserProfileStore } from '../stores/user-profile.store';

interface MetricsSyncPayload {
  clientMetrics: {
    rehearsals: number;
    practiceSessions: number;
    exercisesCompleted: number;
    totalPlayTimeMs: number;
    genres: { genre: string; count: number }[];
  };
  timezoneOffset: number;
}

let syncPromise: Promise<boolean> | null = null;
let pendingDirty = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const BACKOFF_BASE = 800;
const BACKOFF_CAP = 16000;
const MAX_RETRIES = 5;

/**
 * Schedule a sync with coalescing + debounce.
 */
export function scheduleSync(): void {
  pendingDirty = true;

  // If already syncing — piggyback (don't start another)
  if (syncPromise) return;

  // Debounce 2s before firing
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    if (pendingDirty) executeSync();
  }, 2000);
}

async function executeSync(retry = 0): Promise<boolean> {
  const user = useUserProfileStore.getState().currentUser;
  // Guests don't sync to server
  if (!user?.authToken || user.isGuest) return false;

  if (syncPromise) return syncPromise;

  syncPromise = _doSync(retry);
  const result = await syncPromise;
  syncPromise = null;
  return result;
}

async function _doSync(retry: number): Promise<boolean> {
  const store = useMetricsStore.getState();

  const body: MetricsSyncPayload = {
    clientMetrics: {
      rehearsals: store.rehearsals,
      practiceSessions: store.practiceSessions,
      exercisesCompleted: store.exercisesCompleted,
      totalPlayTimeMs: store.totalPlayTimeMs,
      genres: store.genres.map(g => ({ genre: g.name, count: g.count })),
    },
    timezoneOffset: new Date().getTimezoneOffset(),
  };

  const gatewayUrl = import.meta.env.VITE_GATEWAY_URL || 'https://belive-gateway.nikitosss007.workers.dev';
  const token = useUserProfileStore.getState().currentUser?.authToken;

  try {
    const res = await fetch(`${gatewayUrl}/api/metrics/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await res.json();
      // Update server-authoritative fields
      if (data.elo != null) store.setElo(data.elo);
      pendingDirty = false;
      return true;
    }

    if (res.status === 429) {
      // Rate limited — honor Retry-After or backoff
      const retryAfter = res.headers.get('Retry-After');
      if (retryAfter) {
        await sleep(parseInt(retryAfter) * 1000);
        return _doSync(0); // Reset retry count after Retry-After wait
      }
      // No Retry-After — fall through to backoff
    }

    // Non-retryable errors (4xx except 429/408)
    if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
      return false;
    }

    // Retryable (5xx, 408, 429 without header, network error)
    throw new Error(`HTTP ${res.status}`);
  } catch {
    if (retry >= MAX_RETRIES) return false;

    // Exponential backoff with jitter ±50%
    const delay = Math.min(BACKOFF_BASE * Math.pow(2, retry), BACKOFF_CAP);
    const jitter = delay * (0.5 + Math.random() * 0.5);
    await sleep(jitter);
    return _doSync(retry + 1);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Online / Offline detection ───
export function initSyncLifecycle(): () => void {
  const onOnline = () => {
    if (pendingDirty) scheduleSync();
  };
  window.addEventListener('online', onOnline);

  return () => {
    window.removeEventListener('online', onOnline);
    if (debounceTimer) clearTimeout(debounceTimer);
    syncPromise = null;
  };
}
