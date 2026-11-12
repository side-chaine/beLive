import { describe, it, expect, beforeEach } from 'vitest';
import { recordQueueSample, readQueueLog, clearQueueLog } from '../mvsep-queue-log';
import type { QueueSample } from '../mvsep-queue-log';

const sample = (at: number): QueueSample => ({
  at,
  hash: 'h',
  status: 'waiting',
  pos: 10,
  total: 100,
  poll: 1,
  elapsedSec: 0,
  silenceSec: 0,
});

beforeEach(() => {clearQueueLog();});

describe('журнал очереди MVSEP', () => {
  it('пишет и читает точки по порядку', () => {
    recordQueueSample(sample(1));
    recordQueueSample({ ...sample(2), pos: 9 });

    const log = readQueueLog();
    expect(log.map((s) => s.at)).toEqual([1, 2]);
    expect(log[1].pos).toBe(9);
  });

  it('держится кольца на 500 записей — старые вытесняются', () => {
    for (let i = 0; i < 505; i++) {recordQueueSample(sample(i));}

    const log = readQueueLog();
    expect(log).toHaveLength(500);
    expect(log[0].at).toBe(5);
    expect(log[499].at).toBe(504);
  });

  it('битый JSON в хранилище не роняет чтение и не мешает записи', () => {
    localStorage.setItem('belive.mvsep.queue.log.v1', '{не json');
    expect(readQueueLog()).toEqual([]);

    recordQueueSample(sample(7));
    expect(readQueueLog().map((s) => s.at)).toEqual([7]);
  });

  it('clearQueueLog опустошает журнал', () => {
    recordQueueSample(sample(1));
    clearQueueLog();
    expect(readQueueLog()).toEqual([]);
  });
});
