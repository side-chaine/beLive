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

// Phase 1.5: CF Worker proxy (primary) + direct fallback (user key)
const MVSEP_WORKER_URL = import.meta.env.VITE_MVSEP_WORKER_URL || 'https://belive-mvsep.nikitosss007.workers.dev';
const MVSEP_API_TOKEN = import.meta.env.VITE_MVSEP_API_KEY || '';  // direct fallback only

const MVSEP_RENDER_ID = 63;         // BS Roformer SW (6 stems)
const MVSEP_OUTPUT_FORMAT = 0;      // mp3 320kbps
const MVSEP_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const MVSEP_MAX_POLL_TIME = 20 * 60 * 1000;   // 20 min

const MVSEP_DAILY_LIMIT_LOGGED = 10; // beLive quota for shared key

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

  // Phase 1.5: Worker has the shared key — client doesn't need it
  if (MVSEP_WORKER_URL) {
    return { key: '', source: 'beLive' };
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
  if (fileData.byteLength > MVSEP_MAX_FILE_SIZE) {
    throw new Error('FILE_TOO_LARGE');
  }

  // Path 1: CF Worker proxy (Phase 1.5)
  if (MVSEP_WORKER_URL) {
    const authToken = useUserProfileStore.getState().currentUser?.authToken;
    if (!authToken) throw new Error('AUTH_REQUIRED');

    const formData = new FormData();
    formData.append('audiofile', new Blob([fileData]), fileName);
    formData.append('sep_type', String(MVSEP_RENDER_ID));
    formData.append('output_format', String(MVSEP_OUTPUT_FORMAT));

    const headers: Record<string, string> = {
      Authorization: `Bearer ${authToken}`,
    };
    const userKey = useUserProfileStore.getState().currentUser?.mvsepApiKey;
    if (userKey?.trim()) {
      headers['X-Mvsep-User-Key'] = userKey.trim();
    }

    const resp = await fetch(`${MVSEP_WORKER_URL}/submit`, {
      method: 'POST', headers, body: formData,
    });

    if (resp.status === 401) throw new Error('AUTH_REQUIRED');
    if (resp.status === 429) {
      const json = await resp.json();
      if (json.code === 'CONCURRENT_LIMIT') throw new Error('CONCURRENT_LIMIT');
      throw new Error('MVSEP_LIMIT_REACHED');
    }
    if (!resp.ok) throw new Error(`MVSEP_SUBMIT_ERROR_${resp.status}`);

    const json = await resp.json();
    if (json.status === 'error') {
      throw new Error(`MVSEP_API_ERROR: ${json.errors?.join(', ') || 'Unknown'}`);
    }
    if (!json.data?.hash) throw new Error('MVSEP_NO_HASH');

    const keySource: MvsepKeySource = json.quota?.keySource || 'beLive';
    return { hash: json.data.hash, keySource };
  }

  // Path 2: Direct MVSEP API (fallback — user key only)
  const { key, source } = apiKey ? { key: apiKey, source: 'user' as MvsepKeySource } : resolveApiKey();
  if (!key) throw new Error('NO_API_KEY');

  const formData = new FormData();
  formData.append('audiofile', new Blob([fileData]), fileName);
  formData.append('sep_type', String(MVSEP_RENDER_ID));
  formData.append('output_format', String(MVSEP_OUTPUT_FORMAT));
  formData.append('api_token', key);

  const resp = await fetch('https://mvsep.com/api/separation/create', {
    method: 'POST', body: formData,
  });

  if (resp.status === 403) throw new Error('MVSEP_LIMIT_REACHED');
  if (!resp.ok) throw new Error(`MVSEP_SUBMIT_ERROR_${resp.status}`);

  const json = await resp.json();
  if (json.status === 'error') {
    const errors = json.errors?.join(', ') || 'Unknown MVSEP error';
    if (errors.includes('limit') || errors.includes('Limit')) throw new Error('MVSEP_LIMIT_REACHED');
    throw new Error(`MVSEP_API_ERROR: ${errors}`);
  }
  if (!json.data?.hash) throw new Error('MVSEP_NO_HASH');

  return { hash: json.data.hash, keySource: source };
}

// ─── API: Poll Status ────────────────────────────────────────

export async function pollStatus(hash: string): Promise<MvsepJobStatus> {
  if (MVSEP_WORKER_URL) {
    const resp = await fetch(`${MVSEP_WORKER_URL}/status?hash=${encodeURIComponent(hash)}`);
    if (!resp.ok) return 'error';
    const json = await resp.json();
    return mapMvsepStatus(json.status);
  }

  // Direct fallback
  const { key } = resolveApiKey();
  const url = `https://mvsep.com/api/separation/get?hash=${hash}${key ? `&api_token=${key}` : ''}`;
  const resp = await fetch(url);
  if (!resp.ok) return 'error';
  const json = await resp.json();
  return mapMvsepStatus(json.status);
}

function mapMvsepStatus(status: string): MvsepJobStatus {
  if (status === 'done') return 'done';
  if (status === 'failed') return 'failed';
  if (status === 'not_found') return 'not_found';
  if (status === 'processing') return 'processing';
  if (status === 'waiting') return 'waiting';
  return 'error';
}

// ─── API: Download Stems ─────────────────────────────────────

export async function downloadStems(hash: string): Promise<Map<string, Blob>> {
  // Get files list first (need to know what to download)
  let files: MvsepFileResult[];

  if (MVSEP_WORKER_URL) {
    const resp = await fetch(`${MVSEP_WORKER_URL}/status?hash=${encodeURIComponent(hash)}`);
    if (!resp.ok) throw new Error(`MVSEP_STATUS_FETCH_ERROR_${resp.status}`);
    const json = await resp.json();
    if (json.status !== 'done' || !json.data?.files) {
      throw new Error(`MVSEP_NOT_READY: status=${json.status}`);
    }
    files = json.data.files;
  } else {
    const { key } = resolveApiKey();
    const url = `https://mvsep.com/api/separation/get?hash=${hash}${key ? `&api_token=${key}` : ''}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`MVSEP_STATUS_FETCH_ERROR_${resp.status}`);
    const json = await resp.json();
    if (json.status !== 'done' || !json.data?.files) {
      throw new Error(`MVSEP_NOT_READY: status=${json.status}`);
    }
    files = json.data.files;
  }

  if (files.length === 0) throw new Error('MVSEP_NO_FILES');

  const stemMap = new Map<string, Blob>();
  const keySource = useMvsepStore.getState().activeJobs.get(hash)?.keySource;

  for (const file of files) {
    const baseName = getFileNameWithoutExtension(file.download);
    const stemId = classifyStemFromFilename(baseName);
    const key = stemId || 'instrumental';
    if (stemMap.has(key)) continue;

    // User key → direct download (CORS may work for signed URLs)
    // Shared key → through Worker proxy
    let blob: Blob;
    if (MVSEP_WORKER_URL && keySource === 'beLive') {
      const resp = await fetch(`${MVSEP_WORKER_URL}/download?url=${encodeURIComponent(file.url)}`);
      if (!resp.ok) throw new Error(`DOWNLOAD_ERROR_${resp.status}`);
      blob = await resp.blob();
    } else {
      blob = await downloadWithRetry(file.url);
    }
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
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP_${resp.status}`);
      return await resp.blob();
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
