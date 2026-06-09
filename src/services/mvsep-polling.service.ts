/**
 * MVSEP Polling Service — Adaptive polling for stem separation jobs
 * TC-MVSEP-005: Singleton service for MVSEP job lifecycle management
 */

import {
  pollStatus,
  downloadStems,
  getPollMaxTime,
} from './mvsep.service';
import {
  useMvsepStore,
} from '../stores/mvsep.store';
import {
  completeMvsepTrack,
} from './upload.service';
import {
  getMvsepProcessingTracks,
  updateTrackField,
} from './idb.service';

// ─── Types ───────────────────────────────────────────────────

interface PollingJob {
  hash: string;
  trackId: number;
  timer: ReturnType<typeof setTimeout> | null;
  startTime: number;
  pollCount: number;
}

// ─── Constants ───────────────────────────────────────────────

const MAX_POLL_TIME = getPollMaxTime(); // 20 min

// Adaptive intervals based on poll count
function getAdaptiveDelay(pollCount: number): number {
  if (pollCount < 3) return 10_000;   // 0-2: 10s
  if (pollCount < 6) return 15_000;   // 3-5: 15s
  if (pollCount < 11) return 30_000;  // 6-10: 30s
  return 60_000;                       // 11+: 60s
}

// ─── Singleton Service ───────────────────────────────────────

class MvsepPollingService {
  private active: Map<string, PollingJob> = new Map();

  /**
   * Start polling a MVSEP job.
   * No-op if already polling this hash.
   */
  startPolling(hash: string, trackId: number): void {
    if (this.active.has(hash)) return; // already polling

    const job: PollingJob = {
      hash,
      trackId,
      timer: null,
      startTime: Date.now(),
      pollCount: 0,
    };

    this.active.set(hash, job);

    // First poll after 10 seconds
    job.timer = setTimeout(() => this.tick(hash), 10_000);
  }

  /**
   * Stop polling a MVSEP job.
   * Cleans up timer and removes from active map.
   */
  stopPolling(hash: string): void {
    const job = this.active.get(hash);
    if (job) {
      if (job.timer) clearTimeout(job.timer);
      this.active.delete(hash);
    }

    // Also remove from store
    useMvsepStore.getState().removeJob(hash);
  }

  /**
   * Boot recovery: resume orphaned MVSEP jobs.
   * Called on app startup to continue processing after tab close.
   */
  async resumeOrphanedJobs(): Promise<void> {
    try {
      const processing = await getMvsepProcessingTracks();

      for (const track of processing) {
        if (!track.mvsepHash) {
          // No hash — mark as failed
          await updateTrackField(track.id, { mvsepStatus: 'timeout' });
          continue;
        }

        // Check if job has expired
        const submittedAt = track.mvsepSubmittedAt
          ? new Date(track.mvsepSubmittedAt).getTime()
          : 0;

        if (Date.now() - submittedAt > MAX_POLL_TIME) {
          // Expired — mark as timeout
          await updateTrackField(track.id, { mvsepStatus: 'timeout' });
          continue;
        }

        // Resume polling
        this.startPolling(track.mvsepHash, track.id);
      }
    } catch (err) {
      console.error('[MvsepPolling] resumeOrphanedJobs error:', err);
    }
  }

  /**
   * Single polling tick.
   */
  private async tick(hash: string): Promise<void> {
    const job = this.active.get(hash);
    if (!job) return;

    // Timeout check
    if (Date.now() - job.startTime > MAX_POLL_TIME) {
      await this.handleTimeout(hash, job.trackId);
      return;
    }

    try {
      const status = await pollStatus(hash);
      job.pollCount++;

      // Update store
      const storeStatus = mapStatusToInternal(status);
      useMvsepStore.getState().updateJobStatus(hash, storeStatus);

      if (status === 'done') {
        await this.handleDone(hash, job.trackId);
      } else if (status === 'failed' || status === 'not_found') {
        await this.handleFailed(hash, job.trackId, `MVSEP: ${status}`);
      } else if (status === 'error') {
        await this.handleFailed(hash, job.trackId, 'MVSEP API error');
      } else {
        // waiting / processing — schedule next poll
        const delay = getAdaptiveDelay(job.pollCount);
        job.timer = setTimeout(() => this.tick(hash), delay);
      }
    } catch (err: any) {
      console.error('[MvsepPolling] tick error:', err);
      await this.handleFailed(hash, job.trackId, err.message);
    }
  }

  /**
   * Handle successful MVSEP job — download stems and complete track.
   */
  private async handleDone(hash: string, trackId: number): Promise<void> {
    useMvsepStore.getState().updateJobStatus(hash, 'downloading');

    try {
      const stemsMap = await downloadStems(hash);

      const total = stemsMap.size;
      useMvsepStore.getState().updateDownloadProgress(hash, 0, total);

      let downloaded = 0;
      // downloadStems already downloaded all — just report progress
      for (const [] of stemsMap) {
        downloaded++;
        useMvsepStore.getState().updateDownloadProgress(hash, downloaded, total);
      }

      useMvsepStore.getState().updateJobStatus(hash, 'importing');

      await completeMvsepTrack(trackId, stemsMap);

      useMvsepStore.getState().updateJobStatus(hash, 'done');

      // Clean up
      this.stopPolling(hash);
    } catch (err: any) {
      console.error('[MvsepPolling] handleDone error:', err);
      await this.handleFailed(hash, trackId, `Import failed: ${err.message}`);
    }
  }

  /**
   * Handle MVSEP timeout.
   */
  private async handleTimeout(hash: string, trackId: number): Promise<void> {
    useMvsepStore.getState().updateJobStatus(hash, 'timeout');

    try {
      await updateTrackField(trackId, { mvsepStatus: 'timeout' });
    } catch (err) {
      console.error('[MvsepPolling] handleTimeout IDB error:', err);
    }

    this.stopPolling(hash);
  }

  /**
   * Handle MVSEP failure.
   */
  private async handleFailed(hash: string, trackId: number, error: string): Promise<void> {
    useMvsepStore.getState().updateJobStatus(hash, 'failed', error);

    try {
      await updateTrackField(trackId, { mvsepStatus: 'failed' });
    } catch (err) {
      console.error('[MvsepPolling] handleFailed IDB error:', err);
    }

    this.stopPolling(hash);
  }
}

// ─── Helpers ─────────────────────────────────────────────────

function mapStatusToInternal(
  status: string
): 'queued' | 'processing' | 'failed' {
  if (status === 'waiting') return 'queued';
  if (status === 'processing') return 'processing';
  return 'failed';
}

// ─── Export singleton ────────────────────────────────────────

export const mvsepPollingService = new MvsepPollingService();
