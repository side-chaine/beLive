import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aiHub, ASSISTANT_RESPONSE_COMPLETED } from '../../js/ai/registry';
import { emitReportArrived } from '../notify-emit';
import { startLayer2Emitter } from '../layer2-report-emitter';
import { runAll, _reset } from '../../foundation/registry/initRegistry';

describe('G3 layer2-report-emitter', () => {
  let cleanup: () => void;

  beforeEach(() => {
    _reset();
    cleanup = runAll();
  });

  afterEach(() => {
    cleanup();
  });

  it('эмитит ровно один team-m.report-arrived на ASSISTANT_RESPONSE_COMPLETED', () => {
    const events: CustomEvent[] = [];
    const listener = (e: Event) => events.push(e as CustomEvent);
    window.addEventListener('team-m.report-arrived', listener);
    aiHub.dispatchEvent(new CustomEvent(ASSISTANT_RESPONSE_COMPLETED, { detail: { fullText: 'x' } }));
    expect(events).toHaveLength(1);
    const detail = events[0].detail as { source: string };
    expect(detail.source).toBe('mac-chat');
    window.removeEventListener('team-m.report-arrived', listener);
  });

  it('emitReportArrived не бросает наружу при ошибке dispatch (G1-safe)', () => {
    const spy = vi.spyOn(window, 'dispatchEvent').mockImplementation(() => {
      throw new Error('boom');
    });
    expect(() => emitReportArrived({ source: 'inbox-sync', ts: Date.now() })).not.toThrow();
    spy.mockRestore();
  });
});
