import { describe, it, expect, vi } from 'vitest';
import { aiHub, ASSISTANT_RESPONSE_COMPLETED } from '../../js/ai/registry';
import { startLayer2Emitter } from '../layer2-report-emitter';

// NB: не используем initRegistry (_reset/runAll) — _reset() чистит реестр целиком,
// а модульные registerInit срабатывают однократно на импорте. Подписка — напрямую.
//
// NB2: src/test/setup.ts глушит глобальный dispatchEvent (vi.stubGlobal → vi.fn()),
// поэтому ассертим НЕ реальные события окна, а ЖУРНАЛ ВЫЗОВОВ этого стоба —
// это env-независимо и проверяет ровно контракт writer'а.

function dispatchedReportArrived(): Array<{ type: string; detail?: unknown }> {
  const stub = window.dispatchEvent as unknown as { mock?: { calls: unknown[][] } };
  const calls = stub.mock?.calls ?? [];
  return calls
    .map((args) => args[0] as CustomEvent)
    .filter((ev): ev is CustomEvent => !!ev && typeof ev === 'object' && (ev as CustomEvent).type !== undefined)
    .map((ev) => ({ type: ev.type, detail: ev.detail }));
}

describe('G3 layer2-report-emitter', () => {
  it('startLayer2Emitter: ASSISTANT_RESPONSE_COMPLETED → ровно один team-m.report-arrived (source=mac-chat)', () => {
    const stop = startLayer2Emitter();
    try {
      (window.dispatchEvent as ReturnType<typeof vi.fn>).mockClear();

      aiHub.dispatchEvent(new CustomEvent(ASSISTANT_RESPONSE_COMPLETED, { detail: { fullText: 'x' } }));

      const hits = dispatchedReportArrived().filter((e) => e.type === 'team-m.report-arrived');
      expect(hits).toHaveLength(1);
      const detail = hits[0].detail as { source: string; text?: string; reportId?: string };
      expect(detail.source).toBe('mac-chat');
      expect(detail.text).toBe('x');
      expect(typeof detail.reportId).toBe('string');
      expect((detail.reportId as string).length).toBeGreaterThan(0);
    } finally {
      stop();
    }
  });

  it('emitReportArrived G1-safe: даже если dispatch бросает — наружу не летит', () => {
    const spy = vi.spyOn(window, 'dispatchEvent').mockImplementation(() => {
      throw new Error('boom');
    });
    try {
      expect(() => emitReportArrivedDirect({ source: 'inbox-sync', ts: Date.now() })).not.toThrow();
    } finally {
      spy.mockRestore();
    }
  });
});

// Прямой импорт ниже — чтобы G1-safe тест не зависел от журнала стаба.
import { emitReportArrived as emitReportArrivedDirect } from '../notify-emit';
