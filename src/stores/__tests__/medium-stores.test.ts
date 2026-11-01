import { describe, it, expect } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// Правило для этого файла: НЕ вызывать setState в beforeEach.
//
// Прошлая версия делала `setState({ loopStart: null })`, а затем проверяла
// `loopStart === null`. Такого ключа в сторе нет вообще: setState его создаёт,
// тест читает только что созданное. Тест не мог упасть ни при какой поломке
// стора — он проверял setState, а не стор.
//
// Теперь проверяется то, что стор объявляет сам. Поменяется дефолт в сторе —
// тест покраснеет. Это и есть требование: тест должен уметь падать.
// ─────────────────────────────────────────────────────────────────────────────

// ─── loop.store ───
import { useLoopStore } from '../loop.store';
describe('loop.store', () => {
  it('начальное состояние — луп не задан', () => {
    const s = useLoopStore.getState();
    expect(s.isLooping).toBe(false);
    expect(s.loopStartTime).toBeNull();
    expect(s.loopEndTime).toBeNull();
    expect(s.loopStartLine).toBeNull();
    expect(s.loopEndLine).toBeNull();
    expect(s.loopOrigin).toBeNull();
    expect(s.loopBlockIds).toEqual([]);
    expect(s.loopSubBlockKeys).toEqual([]);
  });
});

// ─── pitch.store ───
import { usePitchStore } from '../pitch.store';
describe('pitch.store', () => {
  it('начальное состояние — питч простаивает, нот нет', () => {
    const s = usePitchStore.getState();
    expect(s.status).toBe('idle');
    expect(s.isSinging).toBe(false);
    expect(s.frequency).toBeNull();
    expect(s.note).toBeNull();
    expect(s.midi).toBeNull();
    expect(s.cents).toBe(0);
    expect(s.confidence).toBe(0);
    expect(s.error).toBeNull();
  });
});

// ─── textStyle.store ───
import { useTextStyleStore } from '../textStyle.store';
describe('textStyle.store', () => {
  it('начальное состояние — стиль concert по умолчанию', () => {
    const s = useTextStyleStore.getState();
    // Стор персистится в localStorage; в тестовом окружении он пуст,
    // поэтому применяются дефолты из loadPersisted().
    expect(s.styleId).toBe('concert');
    expect(s.fontFamily).toBe("'Oswald', sans-serif");
    expect(s.transitionId).toBe('explosion');
  });
});

// ─── markers.store ───
import { useMarkersStore } from '../markers.store';
describe('markers.store', () => {
  it('начальное состояние — маркеров и секций нет', () => {
    const s = useMarkersStore.getState();
    expect(s.markers).toEqual([]);
    expect(s.sections).toEqual([]);
    expect(s.trackDuration).toBe(0);
    expect(s.syncMode).toBe('line');
  });
});

// ─── lyrics.store ───
import { useLyricsStore } from '../lyrics.store';
describe('lyrics.store', () => {
  it('начальное состояние — строк нет, гейт закрыт', () => {
    const s = useLyricsStore.getState();
    expect(s.lines).toEqual([]);
    expect(s.activeLineIndex).toBe(-1);
    expect(s.activeBlockId).toBeNull();
    expect(s.lyricsReady).toBe(false);
    expect(s.structurePending).toBe(false);
  });
});

// ─── monitor.store ───
import { useMonitorStore } from '../monitor.store';
describe('monitor.store', () => {
  it('начальное состояние — монитор выключен', () => {
    const s = useMonitorStore.getState();
    expect(s.enabled).toBe(false);
    expect(s.open).toBe(false);
    expect(s.isEnabling).toBe(false);
  });
});

// ─── wordSync.store ───
import { useWordSyncStore } from '../wordSync.store';
describe('wordSync.store', () => {
  it('начальное состояние — выравнивания нет', () => {
    const s = useWordSyncStore.getState();
    expect(s.lineMap).toEqual([]);
    expect(s.alignmentData).toBeNull();
    expect(s.lyricsHash).toBeNull();
    expect(s.audioSource).toBeNull();
    expect(s.status).toBe('idle');
    expect(s.degraded).toBe(false);
    expect(s.error).toBeNull();
  });
});
