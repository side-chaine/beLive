import { describe, it, expect, beforeEach } from 'vitest';
import { useTakesStore } from './takes.store';

/**
 * pin-semantics.test.ts — страховка S1/S2:
 * pinnedBlockId атомарен с isRecording при startRecording,
 * finishRecording/cancelRecording НЕ трогают pinnedBlockId,
 * setActiveBlock({fromUser:true}) снимает пин,
 * cleanup() сбрасывает всё (включая pinnedBlockId).
 */
describe('pin-semantics (S1/S2)', () => {
  beforeEach(() => {
    // Полный сброс через cleanup
    useTakesStore.getState().cleanup();
  });

  it('startRecording ставит pinnedBlockId атомарно с isRecording (один set)', () => {
    const s = useTakesStore.getState();
    s.startRecording('block-A', 0);

    const next = useTakesStore.getState();
    expect(next.isRecording).toBe(true);
    expect(next.recordingSlot).toBe(0);
    expect(next.activeBlockId).toBe('block-A');
    expect(next.pinnedBlockId).toBe('block-A');
  });

  it('finishRecording НЕ меняет activeBlockId и pinnedBlockId', () => {
    const s = useTakesStore.getState();
    s.startRecording('block-A', 1);

    useTakesStore.getState().finishRecording({
      id: 'take-block-A-1',
      blockId: 'block-A',
      slot: 1,
      mimeType: 'audio/webm',
      duration: 4.2,
      recordedAt: Date.now(),
      status: 'ready',
      peaksReady: false,
      trimStartSec: 0,
    });

    const after = useTakesStore.getState();
    expect(after.isRecording).toBe(false);
    expect(after.activeBlockId).toBe('block-A');
    expect(after.pinnedBlockId).toBe('block-A');
  });

  it('cancelRecording НЕ меняет activeBlockId и pinnedBlockId', () => {
    useTakesStore.getState().startRecording('block-B', 2);
    useTakesStore.getState().cancelRecording();

    const after = useTakesStore.getState();
    expect(after.isRecording).toBe(false);
    expect(after.activeBlockId).toBe('block-B');
    expect(after.pinnedBlockId).toBe('block-B');
  });

  it('setActiveBlock({fromUser:true}) снимает pinnedBlockId', () => {
    useTakesStore.getState().startRecording('block-A', 0);
    expect(useTakesStore.getState().pinnedBlockId).toBe('block-A');

    // Пользователь кликнул чип другого блока
    useTakesStore.getState().setActiveBlock('block-C', { fromUser: true });

    const after = useTakesStore.getState();
    expect(after.activeBlockId).toBe('block-C');
    expect(after.pinnedBlockId).toBeNull();
  });

  it('setActiveBlock без fromUser НЕ снимает pinnedBlockId (программный переход)', () => {
    useTakesStore.getState().startRecording('block-A', 0);
    expect(useTakesStore.getState().pinnedBlockId).toBe('block-A');

    // Программный переход (авто-follow и т.п.)
    useTakesStore.getState().setActiveBlock('block-D');

    const after = useTakesStore.getState();
    expect(after.activeBlockId).toBe('block-D');
    expect(after.pinnedBlockId).toBe('block-A'); // пин сохраняется
  });

  it('cleanup() сбрасывает pinnedBlockId и activeBlockId', () => {
    useTakesStore.getState().startRecording('block-A', 0);
    expect(useTakesStore.getState().pinnedBlockId).toBe('block-A');

    useTakesStore.getState().cleanup();

    const after = useTakesStore.getState();
    expect(after.activeBlockId).toBeNull();
    expect(after.pinnedBlockId).toBeNull();
    expect(after.isRecording).toBe(false);
  });
});
