/**
 * MVSEP Service — Stem Separation API Integration
 * TC-MVSEP-001: Core service for MVSEP API communication
 * 
 * Phase 1: Direct MVSEP API (VITE_MVSEP_API_KEY)
 * Phase 2: CF Worker proxy (JWT auth) — only this file changes
 */

import { useUserProfileStore } from '../stores/user-profile.store';
import { useMvsepStore } from '../stores/mvsep.store';
import {
  classifyStemFromFilename,
  getFileNameWithoutExtension,
} from './upload.service';

// ─── Constants ───────────────────────────────────────────────

const MVSEP_API_URL = 'https://mvsep.com/api/separation';
// Phase 2: const MVSEP_API_URL = import.meta.env.VITE_MVSEP_WORKER_URL || '';
const MVSEP_API_TOKEN = import.meta.env.VITE_MVSEP_API_KEY || '';

const MVSEP_RENDER_ID = 63;         // BS Roformer SW (6 stems)
const MVSEP_OUTPUT_FORMAT = 0;      // mp3 320kbps
const MVSEP_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const MVSEP_MAX_POLL_TIME = 20 * 60 * 1000;   // 20 min

const MVSEP_DAILY_LIMIT_LOGGED = 10; // beLive quota for shared key
const MVSEP_DAILY_LIMIT_GUEST = 0;   // Guest = fallback only

const DOWNLOAD_RETRIES = 3;
const DOWNLOAD_RETRY_DELAYS = [5000, 15000, 30000];

// ─── Types ───────────────────────────────────────────────────

export type MvsepJobStatus =
  | 'waiting'
  | 'processing'
  | 'done'
  | 'failed'
  | 'not_found'
  | 'error';

export type MvsepKeySource = 'user' | 'beLive' | 'none';

export interface MvsepFileResult {
  url: string;
  download: string;
}

export interface MvsepSubmitResult {
  hash: string;
  keySource: MvsepKeySource;
}

// ─── Key Resolution ──────────────────────────────────────────

export function resolveApiKey(): { key: string; source: MvsepKeySource } {
  const userKey = useUserProfileStore.getState().currentUser?.mvsepApiKey;
  if (userKey?.trim()) {
    return { key: userKey.trim(), source: 'user' };
  }

  const sharedKey = MVSEP_API_TOKEN;
  if (sharedKey) {
    return { key: sharedKey, source: 'beLive' };
  }

  return { key: '', source: 'none' };
}

export function canAutoSeparate(): { allowed: boolean; reason?: string } {
  const { source } = resolveApiKey();
  const isGuest = useUserProfileStore.getState().isGuest;

  if (source === 'user') {
    return { allowed: true };
  }

  if (source === 'beLive') {
    if (isGuest) {
      return { allowed: false, reason: 'auth_required' };
    }
    if (!isWithinDailyLimit()) {
      return { allowed: false, reason: 'limit_reached' };
    }
    const activeJobs = useMvsepStore.getState().activeJobs;
    const sharedKeyJobs = [...activeJobs.values()].filter(
      (j) => j.keySource === 'beLive' && j.status !== 'done' && j.status !== 'failed' && j.status !== 'timeout'
    );
    if (sharedKeyJobs.length > 0) {
      return { allowed: false, reason: 'concurrent' };
    }
    return { allowed: true };
  }

  return { allowed: false, reason: 'no_key' };
}

// ─── Daily Usage ─────────────────────────────────────────────

const USAGE_STORAGE_KEY = 'belive:mvsep-usage';

interface MvsepDailyUsage {
  count: number;
  date: string;
}

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function getDailyUsage(): MvsepDailyUsage {
  try {
    const raw = localStorage.getItem(USAGE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.date === getTodayString()) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return { count: 0, date: getTodayString() };
}

function saveDailyUsage(usage: MvsepDailyUsage): void {
  try {
    localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(usage));
  } catch {
    // ignore
  }
}

export function isWithinDailyLimit(): boolean {
  const usage = getDailyUsage();
  return usage.count < MVSEP_DAILY_LIMIT_LOGGED;
}

export function incrementDailyUsage(): void {
  const usage = getDailyUsage();
  usage.count += 1;
  saveDailyUsage(usage);
}

export function getDailyUsageInfo(): { used: number; limit: number; date: string } {
  const usage = getDailyUsage();
  return {
    used: usage.count,
    limit: MVSEP_DAILY_LIMIT_LOGGED,
    date: usage.date,
  };
}

// ─── API: Submit Track ───────────────────────────────────────

export async function submitTrack(
  fileData: ArrayBuffer,
  fileName: string,
  apiKey?: string
): Promise<MvsepSubmitResult> {
  const { key, source } = apiKey ? { key: apiKey, source: 'user' as MvsepKeySource } : resolveApiKey();

  if (!key) {
    throw new Error('NO_API_KEY');
  }

  if (fileData.byteLength > MVSEP_MAX_FILE_SIZE) {
    throw new Error('FILE_TOO_LARGE');
  }

  const formData = new FormData();
  formData.append('audiofile', new Blob([fileData]), fileName);
  formData.append('sep_type', String(MVSEP_RENDER_ID));
  formData.append('output_format', String(MVSEP_OUTPUT_FORMAT));

  if (source === 'beLive') {
    formData.append('api_token', key);
  } else {
    formData.append('api_token', key);
  }

  const headers: Record<string, string> = {};

  const response = await fetch(`${MVSEP_API_URL}/create`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (response.status === 403) {
    throw new Error('MVSEP_LIMIT_REACHED');
  }

  if (!response.ok) {
    throw new Error(`MVSEP_SUBMIT_ERROR_${response.status}`);
  }

  const json = await response.json();

  if (json.status === 'error') {
    const errors = json.errors?.join(', ') || 'Unknown MVSEP error';
    if (errors.includes('limit') || errors.includes('Limit')) {
      throw new Error('MVSEP_LIMIT_REACHED');
    }
    throw new Error(`MVSEP_API_ERROR: ${errors}`);
  }

  const hash = json.data?.hash;
  if (!hash) {
    throw new Error('MVSEP_NO_HASH');
  }

  return { hash, keySource: source };
}

// ─── API: Poll Status ────────────────────────────────────────

export async function pollStatus(hash: string): Promise<MvsepJobStatus> {
  const { key } = resolveApiKey();

  const url = `${MVSEP_API_URL}/get?hash=${hash}${key ? `&api_token=${key}` : ''}`;
  const response = await fetch(url);

  if (!response.ok) {
    return 'error';
  }

  const json = await response.json();

  if (json.status === 'done') return 'done';
  if (json.status === 'failed') return 'failed';
  if (json.status === 'not_found') return 'not_found';
  if (json.status === 'processing') return 'processing';
  if (json.status === 'waiting') return 'waiting';

  return 'error';
}

// ─── API: Download Stems ─────────────────────────────────────

export async function downloadStems(hash: string): Promise<Map<string, Blob>> {
  const { key } = resolveApiKey();

  const url = `${MVSEP_API_URL}/get?hash=${hash}${key ? `&api_token=${key}` : ''}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`MVSEP_STATUS_FETCH_ERROR_${response.status}`);
  }

  const json = await response.json();

  if (json.status !== 'done' || !json.data?.files) {
    throw new Error(`MVSEP_NOT_READY: status=${json.status}`);
  }

  const files: MvsepFileResult[] = json.data.files;

  if (files.length === 0) {
    throw new Error('MVSEP_NO_FILES');
  }

  const stemMap = new Map<string, Blob>();

  for (const file of files) {
    const baseName = getFileNameWithoutExtension(file.download);
    const stemId = classifyStemFromFilename(baseName);
    const key = stemId || 'instrumental';

    if (stemMap.has(key)) continue;

    const blob = await downloadWithRetry(file.url);
    stemMap.set(key, blob);
  }

  if (!stemMap.has('instrumental')) {
    throw new Error('MVSEP_NO_INSTRUMENTAL');
  }

  return stemMap;
}

async function downloadWithRetry(url: string): Promise<Blob> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < DOWNLOAD_RETRIES; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP_${response.status}`);
      }
      return await response.blob();
    } catch (err: any) {
      lastError = err;
      if (attempt < DOWNLOAD_RETRIES - 1) {
        await sleep(DOWNLOAD_RETRY_DELAYS[attempt]);
      }
    }
  }

  throw lastError || new Error('DOWNLOAD_FAILED');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Utility ─────────────────────────────────────────────────

export function getMaxFileSize(): number {
  return MVSEP_MAX_FILE_SIZE;
}

export function getPollMaxTime(): number {
  return MVSEP_MAX_POLL_TIME;
}

export function isAudioFile(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', 'wma'].includes(ext);
}

export function isZipFile(fileName: string): boolean {
  return fileName.toLowerCase().endsWith('.zip');
}
