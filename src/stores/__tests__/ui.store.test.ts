import { describe, it, expect, vi } from 'vitest';
import { useUIStore } from '../ui.store';

// Тавтология снята: beforeEach писал catalogOpen=false / karaokeLinesCount=2 /
// karaokeLyricsScale=120, а тест «начальное состояние» их же и проверял.
describe('ui.store', () => {
  it('начальное состояние (реальный инициализатор)', async () => {
    // resetModules + динамический импорт: стор создаётся заново настоящим
    // инициализатором, а не значением, которое тест сам же и записал выше.
    vi.resetModules();
    const store = (await import('../ui.store')).useUIStore;
    const s = store.getState();
    expect(s.catalogOpen).toBe(false);
    expect(s.karaokeLinesCount).toBe(2);
    expect(s.karaokeLyricsScale).toBe(120);
  });

  it('setCatalogOpen(true) открывает каталог', () => {
    useUIStore.getState().setCatalogOpen(true);
    expect(useUIStore.getState().catalogOpen).toBe(true);
  });

  it('setKaraokeLinesCount(4) меняет количество строк', () => {
    useUIStore.getState().setKaraokeLinesCount(4);
    expect(useUIStore.getState().karaokeLinesCount).toBe(4);
  });

  it('setKaraokeLyricsScale(150) меняет масштаб', () => {
    useUIStore.getState().setKaraokeLyricsScale(150);
    expect(useUIStore.getState().karaokeLyricsScale).toBe(150);
  });
});
