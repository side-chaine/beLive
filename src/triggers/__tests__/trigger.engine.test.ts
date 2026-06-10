import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockEmit, mockClear } = vi.hoisted(() => ({
  mockEmit: vi.fn(),
  mockClear: vi.fn(),
}));

vi.mock('../trigger.bus', () => ({
  triggerBus: {
    emit: mockEmit,
    clear: mockClear,
  },
}));

import { TriggerEngine } from '../trigger.engine';

describe('TriggerEngine', () => {
  let engine: TriggerEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new TriggerEngine();
  });

  it('новый engine не содержит детекторов', () => {
    const events = engine.tick(0);
    expect(events).toEqual([]);
  });

  it('addDetector добавляет детектор', () => {
    const detector = { id: 'test', tick: vi.fn(() => []), reset: vi.fn() };
    engine.addDetector(detector);
    engine.tick(100);
    expect(detector.tick).toHaveBeenCalledWith(100);
  });

  it('tick возвращает события от детектора', () => {
    const mockEvent = { id: 'word-1', type: 'rising', source: 'word-line', value: 1, time: 50, metadata: {} };
    const detector = { id: 'test', tick: vi.fn(() => [mockEvent]), reset: vi.fn() };
    engine.addDetector(detector);

    const events = engine.tick(50);
    expect(events).toEqual([mockEvent]);
    expect(mockEmit).toHaveBeenCalledWith(mockEvent);
  });

  it('removeDetector удаляет по id', () => {
    const d1 = { id: 'a', tick: vi.fn(() => []), reset: vi.fn() };
    const d2 = { id: 'b', tick: vi.fn(() => []), reset: vi.fn() };
    engine.addDetector(d1);
    engine.addDetector(d2);
    engine.removeDetector('a');

    engine.tick(0);
    expect(d1.tick).not.toHaveBeenCalled();
    expect(d2.tick).toHaveBeenCalled();
  });

  it('resetAll сбрасывает все детекторы и эмитит reset', () => {
    const d1 = { id: 'a', tick: vi.fn(() => []), reset: vi.fn() };
    engine.addDetector(d1);
    engine.resetAll();

    expect(d1.reset).toHaveBeenCalled();
    expect(mockEmit).toHaveBeenCalledWith(expect.objectContaining({ id: 'trigger-reset' }));
  });

  it('dispose очищает детекторы и triggerBus', () => {
    engine.addDetector({ id: 'a', tick: vi.fn(() => []), reset: vi.fn() });
    engine.dispose();

    expect(mockClear).toHaveBeenCalled();
    // После dispose, tick не должен вызывать детекторы
    const events = engine.tick(0);
    expect(events).toEqual([]);
  });
});
