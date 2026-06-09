/**
 * MVSEP Store — State machine for stem separation jobs
 * TC-MVSEP-002: Zustand store for MVSEP job tracking
 */

import { create } from 'zustand';
import type { MvsepKeySource } from '../services/mvsep.service';

// ─── Types ───────────────────────────────────────────────────

export type MvsepInternalStatus =
  | 'uploading'
  | 'queued'
  | 'processing'
  | 'downloading'
  | 'importing'
  | 'done'
  | 'failed'
  | 'timeout'
  | 'limit_reached'
  | 'concurrent'
  | 'auth_required';

export interface MvsepJobState {
  hash: string;
  trackId: number;
  fileName: string;
  status: MvsepInternalStatus;
  keySource: MvsepKeySource;
  submittedAt: number;           // Date.now()
  lastPolledAt: number;
  downloadProgress: {            // For downloading state
    downloaded: number;
    total: number;
  };
  error?: string;
}

interface MvsepDailyUsage {
  count: number;
  date: string; // YYYY-MM-DD
}

interface MvsepState {
  activeJobs: Map<string, MvsepJobState>;  // hash → job
  dailyUsage: MvsepDailyUsage;
}

interface MvsepActions {
  addJob: (hash: string, trackId: number, fileName: string, keySource: MvsepKeySource) => void;
  updateJobStatus: (hash: string, status: MvsepInternalStatus, error?: string) => void;
  updateDownloadProgress: (hash: string, downloaded: number, total: number) => void;
  removeJob: (hash: string) => void;
  setDailyUsage: (usage: MvsepDailyUsage) => void;
  resetDailyUsageIfNewDay: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Estimated progress for UX display.
 * Not precise — based on elapsed time for processing, real for downloading.
 */
export function getEstimatedProgress(job: MvsepJobState): number {
  if (job.status === 'uploading') return 5;
  if (job.status === 'queued') return 10;
  if (job.status === 'processing') {
    const elapsed = Date.now() - job.submittedAt;
    const estimatedTotal = 3 * 60 * 1000; // 3 min average
    const progress = Math.min(90, 10 + (elapsed / estimatedTotal) * 80);
    return Math.round(progress);
  }
  if (job.status === 'downloading') {
    const { downloaded, total } = job.downloadProgress;
    if (total === 0) return 92;
    return 90 + Math.round((downloaded / total) * 8);
  }
  if (job.status === 'importing') return 98;
  if (job.status === 'done') return 100;
  return 0;
}

/**
 * Elapsed time string for UX: "2:34"
 */
export function getElapsedString(submittedAt: number): string {
  const seconds = Math.floor((Date.now() - submittedAt) / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ─── Store ───────────────────────────────────────────────────

export const useMvsepStore = create<MvsepState & MvsepActions>((set, get) => ({
  activeJobs: new Map(),
  dailyUsage: { count: 0, date: getTodayString() },

  addJob: (hash, trackId, fileName, keySource) => {
    set((state) => {
      const newJobs = new Map(state.activeJobs);
      newJobs.set(hash, {
        hash,
        trackId,
        fileName,
        status: 'uploading',
        keySource,
        submittedAt: Date.now(),
        lastPolledAt: Date.now(),
        downloadProgress: { downloaded: 0, total: 0 },
      });
      return { activeJobs: newJobs };
    });
  },

  updateJobStatus: (hash, status, error) => {
    set((state) => {
      const newJobs = new Map(state.activeJobs);
      const job = newJobs.get(hash);
      if (job) {
        newJobs.set(hash, {
          ...job,
          status,
          error,
          lastPolledAt: Date.now(),
        });
      }
      return { activeJobs: newJobs };
    });
  },

  updateDownloadProgress: (hash, downloaded, total) => {
    set((state) => {
      const newJobs = new Map(state.activeJobs);
      const job = newJobs.get(hash);
      if (job) {
        newJobs.set(hash, {
          ...job,
          downloadProgress: { downloaded, total },
        });
      }
      return { activeJobs: newJobs };
    });
  },

  removeJob: (hash) => {
    set((state) => {
      const newJobs = new Map(state.activeJobs);
      newJobs.delete(hash);
      return { activeJobs: newJobs };
    });
  },

  setDailyUsage: (usage) => {
    set({ dailyUsage: usage });
  },

  resetDailyUsageIfNewDay: () => {
    const today = getTodayString();
    const { dailyUsage } = get();
    if (dailyUsage.date !== today) {
      set({ dailyUsage: { count: 0, date: today } });
    }
  },
}));
