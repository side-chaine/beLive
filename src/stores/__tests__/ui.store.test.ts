import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '../ui.store';

describe('ui.store', () => {
  beforeEach(() => {
    useUIStore.setState({ catalogOpen: false, karaokeLinesCount: 2, karaokeLyricsScale: 120 });
  });

  it('начальное состояние', () => {
    const s = useUIStore.getState();
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
