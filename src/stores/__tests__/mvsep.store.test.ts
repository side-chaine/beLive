/**
 * MVSEP store — очередь как отдельное поле джобы.
 *
 * Живой прогон 10.11.2026 показал, что MVSEP отдаёт позицию в очереди, и её
 * надо показывать в Пульте. Здесь проверяется только жизненный цикл поля:
 * появилось из поллинга, живёт в queued, исчезает при выходе из него.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useMvsepStore } from '../mvsep.store';

beforeEach(() => {
  useMvsepStore.setState({ activeJobs: new Map() });
});

const job = () => useMvsepStore.getState().activeJobs.get('h1');

describe('очередь в MvsepJobState', () => {
  it('новая джоба без очереди — undefined, а не нули', () => {
    useMvsepStore.getState().addJob('h1', 7, 'track.mp3', 'beLive');
    expect(job()?.queue).toBeUndefined();
  });

  it('updateJobQueue пишет позицию и размер', () => {
    useMvsepStore.getState().addJob('h1', 7, 'track.mp3', 'beLive');
    useMvsepStore.getState().updateJobQueue('h1', { pos: 18, total: 446 });
    expect(job()?.queue).toEqual({ pos: 18, total: 446 });
  });

  it('в queued очередь сохраняется', () => {
    useMvsepStore.getState().addJob('h1', 7, 'track.mp3', 'beLive');
    useMvsepStore.getState().updateJobQueue('h1', { pos: 3, total: 436 });
    useMvsepStore.getState().updateJobStatus('h1', 'queued');
    expect(job()?.queue).toEqual({ pos: 3, total: 436 });
  });

  it('выход из queued очищает очередь — не висит в processing', () => {
    useMvsepStore.getState().addJob('h1', 7, 'track.mp3', 'beLive');
    useMvsepStore.getState().updateJobQueue('h1', { pos: 3, total: 436 });
    useMvsepStore.getState().updateJobStatus('h1', 'processing');
    expect(job()?.queue).toBeUndefined();
  });

  it('updateJobQueue по неизвестному hash ничего не ломает', () => {
    useMvsepStore.getState().updateJobQueue('nope', { pos: 1, total: 2 });
    expect(useMvsepStore.getState().activeJobs.size).toBe(0);
  });
});
