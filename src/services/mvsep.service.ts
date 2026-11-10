/**
 * MVSEP Service — Stem Separation API Integration
 * TC-MVSEP-001: Core service for MVSEP API communication
 *
 * Разделение идёт ТОЛЬКО через CF Worker proxy (JWT auth). Прямого вызова MVSEP с
 * ключом из бандла нет: MVSEP_API_KEY живёт только в воркере (`wrangler secret`).
 */

import { useUserProfileStore } from '../stores/user-profile.store';
import { useMvsepKeyStore } from '../stores/mvsep-key.store';
import { useMvsepStore } from '../stores/mvsep.store';
import { authService } from './auth.service';
import {
  classifyStemFromFilename,
  getFileNameWithoutExtension,
} from './upload.service';

// ─── Constants ───────────────────────────────────────────────

// Phase 1.5: CF Worker proxy (primary). Прямого fallback с ключом из бандла нет.
const MVSEP_WORKER_URL = import.meta.env.VITE_MVSEP_WORKER_URL || 'https://belive-mvsep.nikitosss007.workers.dev';

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

/**
 * Типизированная ошибка слоя MVSEP. `message` начинается с `code`, поэтому
 * старый код, сравнивающий строки, не ломается; новый смотрит на `.code`.
 *
 * Коды: AUTH_REQUIRED (сессия beLive), MVSEP_KEY_INVALID (ключ MVSEP отвергнут),
 * FILE_TOO_LARGE, CONCURRENT_LIMIT, MVSEP_LIMIT_REACHED, MVSEP_SUBMIT_ERROR_<n>,
 * MVSEP_API_ERROR, MVSEP_NO_HASH, MVSEP_STATUS_HTTP_<n>, MVSEP_STATUS_FETCH_ERROR_<n>,
 * MVSEP_NOT_READY, MVSEP_NO_FILES, MVSEP_NO_INSTRUMENTAL, DOWNLOAD_ERROR_<n>.
 */
export class MvsepError extends Error {
  readonly code: string;
  constructor(code: string, detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'MvsepError';
    this.code = code;
  }
}

/** Ошибка «нужно войти / обновить сессию beLive» (не путать с невалидным ключом MVSEP). */
export function isMvsepAuthError(err: unknown): boolean {
  return err instanceof MvsepError && err.code === 'AUTH_REQUIRED';
}

// ─── Key Resolution ──────────────────────────────────────────

export function resolveApiKey(): { key: string; source: MvsepKeySource } {
  const userKey = useMvsepKeyStore.getState().apiKey;
  if (userKey?.trim()) {
    return { key: userKey.trim(), source: 'user' };
  }

  // Worker держит общий ключ — клиенту он не нужен.
  // Ниже была ветка «прямой вызов с ключом из VITE-переменной», но она
  // недостижима: MVSEP_WORKER_URL выше имеет жёсткий дефолт и всегда truthy.
  // Ветку убрали: читать секретоподобную VITE-переменную в клиенте нельзя
  // в принципе (Vite инлайнит её в бандл), даже если код мёртв.
  if (MVSEP_WORKER_URL) {
    return { key: '', source: 'beLive' };
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

// ─── Worker transport (JWT + silent refresh) ─────────────────

function getAuthToken(): string {
  return useUserProfileStore.getState().currentUser?.authToken || '';
}

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Обновить JWT через cookie-сессию. Параллельные вызовы делят один запрос
 * (несколько стемов качаются одновременно и могут словить 401 разом).
 */
function refreshAuthToken(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const session = await authService.refreshSession();
        if (!session) {return false;}
        await authService.applySession(session);
        return !!getAuthToken();
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

/**
 * 401 именно от воркера beLive (наш JWT), а не от MVSEP. Воркер пробрасывает
 * статус MVSEP как есть (belive-mvsep/index.js:157), поэтому по одному коду их
 * не различить; свои 401 воркер помечает `errors: ['AUTH_REQUIRED'|'INVALID_TOKEN']`
 * (index.js:249-257). Нечитаемое тело трактуем как «наш» 401 — лишний refresh безвреден.
 */
async function isWorkerAuthRejection(resp: Response): Promise<boolean> {
  try {
    const body = await resp.clone().json();
    const errors: unknown = body?.errors;
    return (
      Array.isArray(errors) &&
      errors.some((e) => e === 'AUTH_REQUIRED' || e === 'INVALID_TOKEN')
    );
  } catch {
    return true;
  }
}

/**
 * fetch к воркеру с JWT. Нет токена или воркер ответил «наш» 401 → один refresh
 * и один повтор; если не помогло — `AUTH_REQUIRED`. 401 от MVSEP (неверный ключ)
 * возвращается вызывающему как есть.
 */
async function workerFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const send = (): Promise<Response> =>
    fetch(`${MVSEP_WORKER_URL}${path}`, {
      ...init,
      headers: {
        ...((init.headers as Record<string, string> | undefined) ?? {}),
        Authorization: `Bearer ${getAuthToken()}`,
      },
    });

  if (!getAuthToken() && !(await refreshAuthToken())) {
    throw new MvsepError('AUTH_REQUIRED');
  }

  let resp = await send();
  if (resp.status === 401 && (await isWorkerAuthRejection(resp))) {
    if (!(await refreshAuthToken())) {throw new MvsepError('AUTH_REQUIRED');}
    resp = await send();
    if (resp.status === 401 && (await isWorkerAuthRejection(resp))) {
      throw new MvsepError('AUTH_REQUIRED');
    }
  }
  return resp;
}

/**
 * Живой ответ MVSEP на неверный ключ (зонд 707, 07.11.2026):
 * HTTP 401 `{"success":false,"errors":["invalid token"],"data":{"message":"invalid token. …"}}`.
 * Регэксп — запас на другие формулировки (сброс ключа, `api_key`, `unauthorized`).
 */
const KEY_INVALID_RE = /token|api.?key|unauthor/i;

/** Текст ошибки из любой известной формы ответа: `errors[]`, `data.message`, `message`, `error`. */
function extractMvsepMessage(body: any): string {
  if (!body || typeof body !== 'object') {return '';}
  const candidates = [
    Array.isArray(body.errors) ? body.errors.join(', ') : body.errors,
    body.data?.message,
    body.message,
    body.error,
  ];
  const hit = candidates.find((c) => typeof c === 'string' && c.trim());
  return hit ? String(hit) : '';
}

// ─── API: Submit Track ───────────────────────────────────────

export async function submitTrack(
  fileData: ArrayBuffer,
  fileName: string,
): Promise<MvsepSubmitResult> {
  if (fileData.byteLength > MVSEP_MAX_FILE_SIZE) {
    throw new MvsepError('FILE_TOO_LARGE');
  }

  const formData = new FormData();
  formData.append('audiofile', new Blob([fileData]), fileName);
  formData.append('sep_type', String(MVSEP_RENDER_ID));
  formData.append('output_format', String(MVSEP_OUTPUT_FORMAT));

  const headers: Record<string, string> = {};
  const userKey = useMvsepKeyStore.getState().apiKey?.trim();
  if (userKey) {headers['X-Mvsep-User-Key'] = userKey;}

  const resp = await workerFetch('/submit', { method: 'POST', headers, body: formData });

  // Сюда 401 доходит только если он НЕ от нашего воркера (см. workerFetch) —
  // т.е. от MVSEP. С пользовательским ключом это «ключ невалиден» (D8).
  if (resp.status === 401) {
    throw userKey
      ? new MvsepError('MVSEP_KEY_INVALID')
      : new MvsepError('MVSEP_SUBMIT_ERROR_401');
  }
  if (resp.status === 429) {
    const body = await resp.json().catch(() => ({}));
    if (body?.code === 'CONCURRENT_LIMIT') {throw new MvsepError('CONCURRENT_LIMIT');}
    throw new MvsepError('MVSEP_LIMIT_REACHED');
  }
  if (!resp.ok) {
    const text = extractMvsepMessage(await resp.json().catch(() => null));
    if (KEY_INVALID_RE.test(text)) {throw new MvsepError('MVSEP_KEY_INVALID');}
    throw new MvsepError(`MVSEP_SUBMIT_ERROR_${resp.status}`, text || undefined);
  }

  const json = await resp.json();
  // Живой ответ MVSEP на успех: `{success:true, data:{link, hash}}` — поля `status` НЕТ
  // (старый код ждал `status==='ok'`). Ошибку признаём по любому из двух признаков.
  if (json.status === 'error' || json.success === false) {
    const errors = extractMvsepMessage(json) || 'Unknown';
    if (KEY_INVALID_RE.test(errors)) {throw new MvsepError('MVSEP_KEY_INVALID');}
    if (/limit/i.test(errors)) {throw new MvsepError('MVSEP_LIMIT_REACHED');}
    throw new MvsepError('MVSEP_API_ERROR', errors);
  }
  if (!json.data?.hash) {throw new MvsepError('MVSEP_NO_HASH');}

  const keySource: MvsepKeySource = json.quota?.keySource || (userKey ? 'user' : 'beLive');
  return { hash: json.data.hash, keySource };
}

// ─── API: Poll Status ────────────────────────────────────────

/**
 * Статус джобы MVSEP.
 *
 * Контракт (R2/R3): функция НЕ возвращает 'error'. Транспорт, 401 после refresh
 * и не-2xx ответы — это БРОСОК (вызывающий решает: пауза/повтор, а не «failed»).
 * Неизвестный статус MVSEP = 'processing'.
 */
export async function pollStatus(hash: string): Promise<MvsepJobStatus> {
  return (await pollStatusDetailed(hash)).status;
}

/** Позиция в очереди MVSEP. `pos` — сколько джоб впереди нас, `total` — размер очереди. */
export interface MvsepQueueInfo {
  pos: number;
  total: number;
}

/**
 * Полный ответ /status: статус + очередь, если MVSEP её отдал.
 *
 * `eta_seconds` намеренно не читаем. Живой прогон 10.11.2026: eta_seconds 63 → 45 → 11,
 * пока current_order шёл 26 → 18 → 3, то есть ETA не убывает и врёт. Позиция же
 * монотонна и проверяема — её и показываем. Нет полей — нет очереди, никаких нулей.
 */
export async function pollStatusDetailed(
  hash: string,
): Promise<{ status: MvsepJobStatus; queue?: MvsepQueueInfo }> {
  const resp = await workerFetch(`/status?hash=${encodeURIComponent(hash)}`);
  if (!resp.ok) {throw new MvsepError(`MVSEP_STATUS_HTTP_${resp.status}`);}
  const json = await resp.json();
  return { status: mapMvsepStatus(json?.status), queue: readQueue(json?.data) };
}

/** Достаёт очередь из data MVSEP. Мусор, NaN и нули → undefined (не рисуем строку). */
export function readQueue(data: unknown): MvsepQueueInfo | undefined {
  if (!data || typeof data !== 'object') {return undefined;}
  const d = data as Record<string, unknown>;
  const pos = d.current_order;
  const total = d.queue_count;
  if (typeof pos !== 'number' || typeof total !== 'number') {return undefined;}
  if (!Number.isFinite(pos) || !Number.isFinite(total)) {return undefined;}
  if (pos <= 0 || total <= 0) {return undefined;}
  return { pos, total };
}

const warnedStatuses = new Set<string>();

/**
 * Док MVSEP 🌐: not_found, waiting, processing, distributing, merging, done, failed.
 * distributing/merging — штатные промежуточные стадии (D2): раньше они падали в
 * 'error' и убивали джобу. Всё неизвестное — тоже 'processing' (+ один warn).
 */
export function mapMvsepStatus(status: unknown): MvsepJobStatus {
  switch (status) {
    case 'done': return 'done';
    case 'failed': return 'failed';
    case 'not_found': return 'not_found';
    case 'waiting': return 'waiting';
    case 'processing':
    case 'distributing':
    case 'merging':
      return 'processing';
    default: {
      const label = String(status);
      if (!warnedStatuses.has(label)) {
        warnedStatuses.add(label);
        console.warn(`[MVSEP] unknown status "${label}" — treating as processing`);
      }
      return 'processing';
    }
  }
}

// ─── Stem classification (MVSEP download path) ───────────────

/** Токен имени файла → id слота (те же id, что у `classifyStemFromFilename`: пианино = `keys`). */
const STEM_TOKEN_TO_SLOT: Readonly<Record<string, string>> = {
  vocals: 'vocals', vocal: 'vocals', vox: 'vocals',
  drums: 'drums', drum: 'drums',
  bass: 'bass',
  piano: 'keys', keys: 'keys', synth: 'keys',
  guitar: 'guitar', gtr: 'guitar',
  other: 'other',
  instrum: 'instrumental', instrumental: 'instrumental', instrumentals: 'instrumental',
  karaoke: 'instrumental', accompaniment: 'instrumental',
};

function tokenizeName(name: string): string[] {
  return name.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/**
 * Классификация ВСЕХ файлов одной джобы разом → массив id слотов (по порядку).
 *
 * Почему не `classifyStemFromFilename` по одному файлу: он ищет подстроки по
 * всему имени, а в имени есть НАЗВАНИЕ ТРЕКА («Guitar Hero», «The Other Side»
 * дадут guitar/other для каждого файла), а неопознанный файл он по ZIP-семантике
 * считает инструменталом (молчаливая подмена). Здесь название, модель и формат
 * одинаковы у всех файлов джобы → токены, общие для всех файлов, выбрасываются,
 * и остаётся только метка стема. Формат имён MVSEP не нужно знать заранее.
 * Что не опознано — `unknown_<i>` (+ warn), а не инструментал.
 * Сам `classifyStemFromFilename` не меняем (ZIP-путь).
 */
export function classifyMvsepFiles(baseNames: string[]): string[] {
  const tokenLists = baseNames.map(tokenizeName);

  // Сколько раз токен встречается в КАЖДОМ файле (минимум по файлам) — «общая часть»
  // (название, модель, формат). Метка стема добавляет токену ещё одно вхождение, поэтому
  // даже название трека со словом «Vocals» не прячет метку «Vocals».
  const counts = tokenLists.map((list) => {
    const m = new Map<string, number>();
    for (const t of list) {m.set(t, (m.get(t) ?? 0) + 1);}
    return m;
  });
  const commonCount = new Map<string, number>();
  if (counts.length >= 2) {
    for (const [tok, n] of counts[0]) {
      commonCount.set(tok, Math.min(n, ...counts.slice(1).map((c) => c.get(tok) ?? 0)));
    }
  }
  const isCommon = (i: number, tok: string): boolean =>
    (counts[i].get(tok) ?? 0) <= (commonCount.get(tok) ?? 0);

  return baseNames.map((name, i) => {
    const all = tokenLists[i];
    const diff = all.filter((t) => !isCommon(i, t));
    // Метка стема, общая для всех файлов (бывает у наборов из 2 файлов), не должна
    // «исчезнуть»: если после выбрасывания общего ничего не осталось — смотрим всё имя.
    const toks = diff.length > 0 ? diff : all;

    // «No Vocals» / «without vocals» — инструментал, а не вокал. Отрицание берём
    // только из различающейся части, чтобы «No Vocals Here» в НАЗВАНИИ трека не сработало.
    for (let k = 0; k < all.length; k++) {
      const next = all[k + 1] ?? '';
      const distinct = !isCommon(i, all[k]);
      if (
        (distinct && (all[k] === 'novocals' || all[k] === 'novocal')) ||
        (distinct && (all[k] === 'no' || all[k] === 'without') && /^vocals?$/.test(next))
      ) {
        return 'instrumental';
      }
    }
    for (const tok of toks) {
      const slot = STEM_TOKEN_TO_SLOT[tok];
      if (slot) {return slot;}
    }
    // Метка могла быть склеена с другим словом — старый классификатор, но только по «хвосту»
    if (toks.length > 0) {
      const legacy = classifyStemFromFilename(`_${toks.join('_')}_`);
      if (legacy) {return legacy;}
    }
    console.warn(`[MVSEP] unclassified stem file "${name}" → unknown_${i}`);
    return `unknown_${i}`;
  });
}

// ─── API: Download Stems ─────────────────────────────────────

export async function downloadStems(hash: string): Promise<Map<string, Blob>> {
  const statusResp = await workerFetch(`/status?hash=${encodeURIComponent(hash)}`);
  if (!statusResp.ok) {throw new MvsepError(`MVSEP_STATUS_FETCH_ERROR_${statusResp.status}`);}
  const json = await statusResp.json();
  if (json.status !== 'done' || !json.data?.files) {
    throw new MvsepError('MVSEP_NOT_READY', `status=${json.status}`);
  }
  const files: MvsepFileResult[] = json.data.files;
  if (files.length === 0) {throw new MvsepError('MVSEP_NO_FILES');}

  // R6: ВСЕ скачивания идут через /download воркера, независимо от keySource.
  // Раньше прокси включался только при keySource==='beLive', а keySource жил в
  // не-персистентном сторе → после перезагрузки BYOK-стемы шли напрямую (D6).
  const baseNames = files.map((f) => getFileNameWithoutExtension(f.download));
  const keys = classifyMvsepFiles(baseNames);
  const results = await Promise.all(
    files.map(async (file, i) => {
      const blob = await downloadViaWorker(file.url);
      return { key: keys[i], blob, baseName: baseNames[i] };
    }),
  );

  const stemMap = new Map<string, Blob>();
  for (const { key, blob } of results) {
    if (!stemMap.has(key)) {stemMap.set(key, blob);}
  }

  if (!stemMap.has('instrumental')) {
    // Политика «нет инструментала» (D1/Q5) решается после замера H3 — здесь
    // поведение прежнее, но в ошибке теперь имена файлов для диагностики.
    throw new MvsepError(
      'MVSEP_NO_INSTRUMENTAL',
      results.map((r) => r.baseName).join(' | '),
    );
  }

  return stemMap;
}

/** Ретраи на сетевые сбои и 5xx/429/408; 401 уже обработан в workerFetch, прочие 4xx — сразу. */
async function downloadViaWorker(url: string): Promise<Blob> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < DOWNLOAD_RETRIES; attempt++) {
    let retryable = true;
    try {
      const resp = await workerFetch(`/download?url=${encodeURIComponent(url)}`);
      if (resp.ok) {return await resp.blob();}
      retryable = resp.status >= 500 || resp.status === 429 || resp.status === 408;
      lastError = new MvsepError(`DOWNLOAD_ERROR_${resp.status}`);
    } catch (err) {
      if (isMvsepAuthError(err)) {throw err;}
      lastError = err; // сеть / обрыв чтения тела — ретраим
    }
    if (!retryable) {throw lastError;}
    if (attempt < DOWNLOAD_RETRIES - 1) {
      await sleep(DOWNLOAD_RETRY_DELAYS[attempt]);
    }
  }
  throw lastError || new MvsepError('DOWNLOAD_FAILED');
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
