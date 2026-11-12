/**
 * First Path — «кинул трек → получил стемы».
 *
 * Единственное место, где UI связывается с MVSEP. Три шага держим вместе, чтобы
 * ни один экран не мог забыть половину:
 *   submit (воркер) → placeholder в каталоге → поллинг.
 *
 * Плейсхолдер создаётся ПОСЛЕ submit: без hash его нечем восстанавливать
 * (resume ищет треки по mvsepHash), а «мёртвый» трек в каталоге хуже, чем
 * честная ошибка.
 */

import {
  submitTrack,
  canAutoSeparate,
  getMaxFileSize,
  isAudioFile,
} from './mvsep.service';
import { createMvsepPlaceholder } from './upload.service';
import { mvsepPollingService } from './mvsep-polling.service';
import { useMvsepStore } from '../stores/mvsep.store';

/** Почему Порт отказал до отправки. Коды совпадают с reason у canAutoSeparate. */
export type FirstPathReject =
  | 'not_audio'
  | 'too_large'
  | 'auth_required'
  | 'limit_reached'
  | 'concurrent'
  | 'no_key';

export type FirstPathResult =
  | { ok: true; hash: string; trackId: number }
  | { ok: false; reason: FirstPathReject };

/**
 * Проверка до отправки: отказ должен приходить на этапе перетаскивания, а не
 * после пяти минут ожидания.
 */
export function checkFirstPathFile(file: File): FirstPathReject | null {
  if (!isAudioFile(file.name)) {return 'not_audio';}
  if (file.size > getMaxFileSize()) {return 'too_large';}

  const gate = canAutoSeparate();
  if (!gate.allowed) {return (gate.reason as FirstPathReject) ?? 'no_key';}

  return null;
}

/**
 * Запустить путь. Возвращает причину отказа вместо исключения: Порт — это
 * элемент интерфейса, ему нужна строка статуса, а не stack trace.
 */
export async function startFirstPath(
  file: File,
  /** Уже прочитанный буфер: тот же файл нужен локальному анализу темпа. */
  preloaded?: ArrayBuffer,
): Promise<FirstPathResult> {
  const reject = checkFirstPathFile(file);
  if (reject) {return { ok: false, reason: reject };}

  // Ошибки транспорта/авторизации летят исключением: это не «нельзя», а «не сейчас».
  const buffer = preloaded ?? await file.arrayBuffer();
  const { hash, keySource } = await submitTrack(buffer, file.name);

  const trackId = await createMvsepPlaceholder(file.name, hash, keySource);

  useMvsepStore.getState().addJob(hash, trackId, file.name, keySource);
  mvsepPollingService.startPolling(hash, trackId, { firstDelayMs: 5000 });

  return { ok: true, hash, trackId };
}

/** Человеческий текст отказа для строки статуса Пульта. */
export const FIRST_PATH_REJECT_TEXT: Readonly<Record<FirstPathReject, string>> = {
  not_audio: 'нужен аудиофайл — mp3, wav, flac, ogg, m4a',
  too_large: 'файл больше 50 МБ',
  auth_required: 'войди — без входа разделение недоступно',
  limit_reached: 'лимит 10 треков в день исчерпан',
  concurrent: 'идёт другой трек — дождись его',
  no_key: 'нет ключа MVSEP',
};
