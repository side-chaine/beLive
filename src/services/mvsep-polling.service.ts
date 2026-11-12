/**
 * MVSEP Polling Service — Adaptive polling for stem separation jobs
 * TC-MVSEP-005: Singleton service for MVSEP job lifecycle management
 *
 * Правила (дизайн-док first-path, R2–R5):
 *  - R2: транспорт/авторизация НИКОГДА не убивают джобу. Ошибка → `paused` +
 *    бэкофф; пробуждение по `online` / возврату во вкладку. «failed» — только
 *    когда MVSEP сам сказал failed/not_found (3 раза подряд) или импорт сломан
 *    не по сети.
 *  - R3: неизвестный статус MVSEP = processing (см. mapMvsepStatus).
 *  - R4: resume на старте берёт processing и timeout (в окне давности).
 *  - R5: keySource/код ошибки/попытки лежат в IDB, а не только в сторе.
 *  - R6 (FP-N7): окно ожидания считается от последнего ЧЕСТНОГО ответа MVSEP,
 *    а не от старта сессии. Пока приходит queue/processing — поллер живёт;
 *    сдаётся только после MAX_POLL_TIME тишины подряд.
 *
 * `paused` — in-memory фаза поллера. В IDB трек остаётся `processing`, поэтому
 * перезагрузка во время паузы подхватывается resume.
 */

import {
  pollStatusDetailed,
  downloadStems,
  getPollMaxTime,
  isMvsepAuthError,
  MvsepError,
} from './mvsep.service';
import type { MvsepJobStatus, MvsepQueueInfo } from './mvsep.service';
import { recordQueueSample } from './mvsep-queue-log';
import { useMvsepStore, getElapsedString } from '../stores/mvsep.store';
import { useMvsepKeyStore } from '../stores/mvsep-key.store';
import { showTrackNotice } from '../utils/notification';
import { completeMvsepTrack } from './upload.service';
import {
  getMvsepResumableTracks,
  updateTrackField,
} from './idb.service';

// ─── Types ───────────────────────────────────────────────────

interface PollingJob {
  hash: string;
  trackId: number;
  timer: ReturnType<typeof setTimeout> | null;
  startTime: number;
  /** Момент последнего честного ответа MVSEP. От него считается окно тишины. */
  lastProgressAt: number;
  pollCount: number;
  /** Подряд идущие not_found (MVSEP мог ещё не проиндексировать свежий hash). */
  notFoundCount: number;
  /** Подряд идущие сбои транспорта/авторизации — для бэкоффа. */
  pausedCount: number;
  paused: boolean;
  /** Сколько раз пытались скачать+импортировать результат. */
  importAttempts: number;
}

export interface StartPollingOptions {
  /** От какого момента считать окно ожидания (по умолчанию — сейчас). */
  startTime?: number;
  /** Задержка до первого опроса (по умолчанию 10 с). */
  firstDelayMs?: number;
}

// ─── Constants ───────────────────────────────────────────────

const MAX_POLL_TIME = getPollMaxTime(); // 3 h тишины подряд — предохранитель, не окно ожидания
/**
 * Потолок одной сессии — от старта, ответы его не продлевают.
 * Без него джоба, которую MVSEP потерял, но продолжает отдавать `waiting`,
 * опрашивалась бы вечно: тишины нет, значит 3-часовой предохранитель не сработает.
 * 6 ч — 4× худшего живого замера (87 минут при очереди 374).
 */
const ABSOLUTE_MAX_POLL_TIME = 6 * 60 * 60 * 1000;
const NOT_FOUND_TOLERANCE = 3;
const MAX_IMPORT_ATTEMPTS = 5;

/**
 * Окно, в котором resume ещё пробует подобрать `processing`/`timeout` трек.
 * ⚠ 87 минут проверены живым прогоном 11.11 (трек подхватился после
 * перезагрузки). Что MVSEP держит результат сутки — **предположение**: снять
 * его может только прогон на 24 ч. Если MVSEP удалит результат раньше —
 * `not_found` ×3 → `failed`, дёшево и честно.
 */
const RESUME_WINDOW_MS = 24 * 60 * 60 * 1000;

// Adaptive intervals based on poll count
function getAdaptiveDelay(pollCount: number): number {
  if (pollCount < 3) {return 10_000;}   // 0-2: 10s
  if (pollCount < 6) {return 15_000;}   // 3-5: 15s
  if (pollCount < 11) {return 30_000;}  // 6-10: 30s
  return 60_000;                       // 11+: 60s
}

const PAUSE_BACKOFF_MS = [15_000, 30_000, 60_000, 120_000, 300_000];
function getPauseDelay(pausedCount: number): number {
  return PAUSE_BACKOFF_MS[Math.min(Math.max(pausedCount - 1, 0), PAUSE_BACKOFF_MS.length - 1)];
}

/**
 * Ошибка скачивания/опроса, которую имеет смысл повторить позже.
 * Не-MvsepError (TypeError «Failed to fetch», SyntaxError от HTML-страницы
 * вместо JSON) — транспорт. Из MvsepError транзиентны сбои статуса/скачивания
 * по 5xx/429/408 и «ещё не готово».
 */
function isTransientError(err: unknown): boolean {
  if (!(err instanceof MvsepError)) {return true;}
  const c = err.code;
  return (
    c === 'MVSEP_NOT_READY' ||
    (c.startsWith('MVSEP_STATUS_HTTP_') && isTransientHttp(c)) ||
    (c.startsWith('MVSEP_STATUS_FETCH_ERROR_') && isTransientHttp(c)) ||
    (c.startsWith('DOWNLOAD_ERROR_') && isTransientHttp(c))
  );
}

function isTransientHttp(code: string): boolean {
  const n = Number(code.slice(code.lastIndexOf('_') + 1));
  return n >= 500 || n === 429 || n === 408;
}

// ─── Singleton Service ───────────────────────────────────────

class MvsepPollingService {
  private active: Map<string, PollingJob> = new Map();
  private wakeListenersInstalled = false;

  /**
   * Start polling a MVSEP job.
   * No-op if already polling this hash.
   */
  startPolling(hash: string, trackId: number, opts: StartPollingOptions = {}): void {
    if (this.active.has(hash)) {return;} // already polling

    // Окно тишины отсчитывается от старта сессии: resume передаёт startTime
    // только в тестах, прод — никогда, поэтому после F5 окно начинается заново.
    const startedAt = opts.startTime ?? Date.now();

    const job: PollingJob = {
      hash,
      trackId,
      timer: null,
      startTime: startedAt,
      lastProgressAt: startedAt,
      pollCount: 0,
      notFoundCount: 0,
      pausedCount: 0,
      paused: false,
      importAttempts: 0,
    };

    this.active.set(hash, job);
    this.installWakeListeners();

    job.timer = setTimeout(() => this.tick(hash), opts.firstDelayMs ?? 10_000);
  }

  /**
   * Stop polling a MVSEP job.
   * Cleans up timer and removes from active map.
   */
  stopPolling(hash: string): void {
    const job = this.active.get(hash);
    if (job) {
      if (job.timer) {clearTimeout(job.timer);}
      this.active.delete(hash);
    }

    // Also remove from store
    useMvsepStore.getState().removeJob(hash);
  }

  /** Поллер сейчас в паузе (сеть/сессия)? Для UI в A2. */
  isPaused(hash: string): boolean {
    return this.active.get(hash)?.paused ?? false;
  }

  /**
   * «Проверить сейчас» (FP-N7): ручной опрос вне расписания.
   * Снимает текущий таймер и спрашивает MVSEP сразу. Дальше всё как обычно:
   * ответ — планируется следующий опрос, ошибка — бэкофф паузы.
   */
  pollNow(hash: string): boolean {
    const job = this.active.get(hash);
    if (!job) {return false;}
    if (job.timer) {clearTimeout(job.timer);}
    job.timer = setTimeout(() => this.tick(hash), 0);
    return true;
  }

  /**
   * FP-N7: сырьё для разбора очереди. Пишем каждый честный ответ — по этим
   * точкам видно, в какие часы MVSEP разбирает быстрее (журнал в localStorage).
   */
  private journal(
    job: PollingJob,
    status: MvsepJobStatus,
    silenceSec: number,
    queue?: MvsepQueueInfo,
  ): void {
    const sample = {
      at: Date.now(),
      hash: job.hash,
      status,
      pos: queue?.pos,
      total: queue?.total,
      poll: job.pollCount,
      elapsedSec: Math.round((Date.now() - job.startTime) / 1000),
      silenceSec,
    };
    recordQueueSample(sample);
    console.info('[MvsepPoll]', sample);
  }

  /**
   * Boot recovery: resume orphaned MVSEP jobs (R4, R5).
   * Берёт `processing` и `timeout` в окне RESUME_WINDOW_MS. Заводит джобу в
   * сторе (он не персистится), keySource — из IDB.
   */
  async resumeOrphanedJobs(): Promise<void> {
    try {
      const tracks = await getMvsepResumableTracks();

      for (const track of tracks) {
        if (!track.mvsepHash) {
          // Без hash восстановить нечего
          await updateTrackField(track.id, {
            mvsepStatus: 'failed',
            mvsepErrorCode: 'NO_HASH',
          });
          continue;
        }

        const submittedAt = track.mvsepSubmittedAt
          ? new Date(track.mvsepSubmittedAt).getTime()
          : 0;

        if (Date.now() - submittedAt > RESUME_WINDOW_MS) {
          if (track.mvsepStatus !== 'timeout') {
            await updateTrackField(track.id, { mvsepStatus: 'timeout' });
          }
          continue;
        }

        if (this.active.has(track.mvsepHash)) {continue;}

        // timeout → снова processing: «перестали ждать» ≠ «MVSEP отказал»
        if (track.mvsepStatus === 'timeout') {
          await updateTrackField(track.id, { mvsepStatus: 'processing' });
        }

        const keySource =
          track.mvsepKeySource ??
          (useMvsepKeyStore.getState().apiKey ? 'user' : 'beLive');

        const store = useMvsepStore.getState();
        store.addJob(track.mvsepHash, track.id, track.title || '', keySource, submittedAt || undefined);
        store.updateJobStatus(track.mvsepHash, 'processing');

        this.startPolling(track.mvsepHash, track.id, { firstDelayMs: 3_000 });
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
    if (!job) {return;}
    job.timer = null;

    // Порядок важен: потолок сессии — ДО обновления lastProgressAt, иначе он
    // сдвигается на один опрос и тест зеленеет по неверной причине.
    // 1) потолок: 6 ч от старта, ответы не продлевают;
    // 2) тишина: 3 ч без единого честного ответа.
    const now = Date.now();
    if (now - job.startTime > ABSOLUTE_MAX_POLL_TIME) {
      await this.handleTimeout(hash, job.trackId);
      return;
    }
    if (now - job.lastProgressAt > MAX_POLL_TIME) {
      await this.handleTimeout(hash, job.trackId);
      return;
    }

    try {
      const { status, queue } = await pollStatusDetailed(hash);
      if (!this.active.has(hash)) {return;} // остановили, пока ждали ответ
      const answeredAt = Date.now();
      const silenceSec = Math.round((answeredAt - job.lastProgressAt) / 1000);
      job.lastProgressAt = answeredAt;
      job.pollCount++;
      this.markResumed(job);

      if (status === 'not_found') {
        job.notFoundCount++;
        if (job.notFoundCount >= NOT_FOUND_TOLERANCE) {
          await this.handleFailed(hash, job.trackId, 'MVSEP_NOT_FOUND', 'MVSEP: not_found');
          return;
        }
      } else {
        job.notFoundCount = 0;
      }

      if (status === 'done') {
        await this.handleDone(hash, job.trackId);
      } else if (status === 'failed') {
        await this.handleFailed(hash, job.trackId, 'MVSEP_FAILED', 'MVSEP: failed');
      } else {
        // waiting / processing / not_found (в пределах допуска) — следующий опрос
        useMvsepStore
          .getState()
          .updateJobStatus(hash, status === 'waiting' ? 'queued' : 'processing');
        // Очередь пишем только когда MVSEP её реально отдал (см. readQueue).
        if (queue) {useMvsepStore.getState().updateJobQueue(hash, queue);}
        this.journal(job, status, silenceSec, queue);
        job.timer = setTimeout(() => this.tick(hash), getAdaptiveDelay(job.pollCount));
      }
    } catch (err) {
      this.pause(hash, err);
    }
  }

  /**
   * R2: сбой транспорта/сессии = пауза с бэкоффом, джоба жива.
   * Ограничивает только общее окно MAX_POLL_TIME (→ timeout, который resume
   * потом подберёт).
   */
  private pause(hash: string, err: unknown): void {
    const job = this.active.get(hash);
    if (!job) {return;}

    job.paused = true;
    job.pausedCount++;
    const delay = getPauseDelay(job.pausedCount);

    if (isMvsepAuthError(err)) {
      useMvsepStore.getState().updateJobStatus(hash, 'auth_required');
    }
    console.warn(
      `[MvsepPolling] paused (${job.pausedCount}), retry in ${Math.round(delay / 1000)}s:`,
      err instanceof Error ? err.message : err,
    );

    if (job.timer) {clearTimeout(job.timer);}
    job.timer = setTimeout(() => this.tick(hash), delay);
  }

  /** Успешный ответ после паузы — снимаем паузу, возвращаем статус в «processing». */
  private markResumed(job: PollingJob): void {
    if (!job.paused) {return;}
    job.paused = false;
    job.pausedCount = 0;
    useMvsepStore.getState().updateJobStatus(job.hash, 'processing');
  }

  /** `online` / возврат во вкладку → не ждём конца бэкоффа. */
  private wakePaused = (): void => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {return;}
    for (const job of this.active.values()) {
      if (!job.paused) {continue;}
      if (job.timer) {clearTimeout(job.timer);}
      job.timer = setTimeout(() => this.tick(job.hash), 0);
    }
  };

  private installWakeListeners(): void {
    if (this.wakeListenersInstalled || typeof window === 'undefined') {return;}
    this.wakeListenersInstalled = true;
    window.addEventListener('online', this.wakePaused);
    document.addEventListener('visibilitychange', this.wakePaused);
  }

  /**
   * Handle successful MVSEP job — download stems and complete track.
   */
  private async handleDone(hash: string, trackId: number): Promise<void> {
    const job = this.active.get(hash);
    useMvsepStore.getState().updateJobStatus(hash, 'downloading');

    let stemsMap: Map<string, Blob>;
    try {
      stemsMap = await downloadStems(hash);
    } catch (err: any) {
      if (!this.active.has(hash)) {return;}
      if (isMvsepAuthError(err)) {
        // сессия — не вина джобы; не считаем в попытки
        this.pause(hash, err);
        return;
      }
      if (job && isTransientError(err)) {
        job.importAttempts++;
        await this.persistAttempts(trackId, job.importAttempts);
        if (job.importAttempts < MAX_IMPORT_ATTEMPTS) {
          this.pause(hash, err);
          return;
        }
      }
      console.error('[MvsepPolling] download error:', err);
      await this.handleFailed(
        hash,
        trackId,
        err instanceof MvsepError ? err.code : 'DOWNLOAD_FAILED',
        `Download failed: ${err?.message ?? err}`,
      );
      return;
    }

    try {
      const total = stemsMap.size;
      useMvsepStore.getState().updateDownloadProgress(hash, 0, total);

      let downloaded = 0;
      // downloadStems already downloaded all — just report progress
      // eslint-disable-next-line no-empty-pattern -- [FROZEN-REQUEST N1b | Центр_5 2026-11-08 | ok: 707 (и.о. Gate R) | ревью: Соннет постфактум]
      for (const [] of stemsMap) {
        downloaded++;
        useMvsepStore.getState().updateDownloadProgress(hash, downloaded, total);
      }

      useMvsepStore.getState().updateJobStatus(hash, 'importing');

      await completeMvsepTrack(trackId, stemsMap);

      useMvsepStore.getState().updateJobStatus(hash, 'done');
      this.notifyReady(hash);

      // Clean up
      this.stopPolling(hash);
    } catch (err: any) {
      console.error('[MvsepPolling] handleDone error:', err);
      await this.handleFailed(hash, trackId, 'IMPORT_FAILED', `Import failed: ${err.message}`);
    }
  }

  private async persistAttempts(trackId: number, attempts: number): Promise<void> {
    try {
      await updateTrackField(trackId, { mvsepAttempts: attempts });
    } catch (err) {
      console.error('[MvsepPolling] persistAttempts IDB error:', err);
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
  private async handleFailed(
    hash: string,
    trackId: number,
    code: string,
    message: string,
  ): Promise<void> {
    useMvsepStore.getState().updateJobStatus(hash, 'failed', message);
    this.notifyFailed(hash);

    try {
      await updateTrackField(trackId, { mvsepStatus: 'failed', mvsepErrorCode: code });
    } catch (err) {
      console.error('[MvsepPolling] handleFailed IDB error:', err);
    }

    this.stopPolling(hash);
  }

  /**
   * Уведомление «готово». Только факт, без промежуточных статусов:
   * очередь и разделение человек видит в Порте, если ему надо.
   */
  private notifyReady(hash: string): void {
    const job = useMvsepStore.getState().activeJobs.get(hash);
    if (!job) {return;}
    const elapsed = job.submittedAt ? ` · заняло ${getElapsedString(job.submittedAt)}` : '';
    showTrackNotice({
      kind: 'ready',
      title: `${job.fileName || 'трек'} — готово`,
      text: `7 стемов${elapsed}`,
    });
  }

  private notifyFailed(hash: string): void {
    const job = useMvsepStore.getState().activeJobs.get(hash);
    if (!job) {return;}
    showTrackNotice({
      kind: 'failed',
      title: `${job.fileName || 'трек'} — не получилось`,
      text: 'MVSEP не смог обработать файл. Повтор — новая отправка.',
    });
  }
}

// ─── Export singleton ────────────────────────────────────────

export const mvsepPollingService = new MvsepPollingService();
