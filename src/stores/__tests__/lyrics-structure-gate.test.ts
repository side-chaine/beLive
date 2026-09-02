import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useLyricsStore } from '../lyrics.store';
import { useBlocksStore } from '../blocks.store';

// D-CASE 7 (FOUC gate): structurePending — арм на before-track-change по свежим tc-данным,
// релиз по blocks>0 / flush-сиблингу / watchdog 1200мс.
// jsdom-дефолт по vitest.config (pragma не нужна); fake timers ВСЕХ кейсах;
// диспатч ТОЛЬКО document.dispatchEvent (setup.ts:125 глушит window-диспатч).

const makeBlock = (id = 'b1', type = 'verse') => ({
  id,
  name: '',
  type,
  lineIndices: [0],
});

describe('lyrics-structure-gate', () => {
  beforeEach(() => {
    useLyricsStore.setState({
      lines: [],
      activeLineIndex: -1,
      activeBlockId: null,
      lyricsReady: false,
      structurePending: false,
    });
    useBlocksStore.setState({ blocks: [], blockCount: 0 });
    (globalThis as any).trackCatalog = undefined;
    (globalThis as any).lyricsDisplay = undefined;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('К1: арм+релиз — tc blocksData>0 → true; setBlocks>0 → false', () => {
    (globalThis as any).trackCatalog = { tracks: [{ id: 't1', blocksData: [1] }] };
    document.dispatchEvent(new CustomEvent('before-track-change', { detail: { toTrackId: 't1' } }));
    expect(useLyricsStore.getState().structurePending).toBe(true);

    useBlocksStore.setState({ blocks: [makeBlock()] });
    expect(useLyricsStore.getState().structurePending).toBe(false);
  });

  it('К2: без структуры — мгновенно false, таймер не армится', () => {
    (globalThis as any).trackCatalog = { tracks: [{ id: 't2' }] };
    document.dispatchEvent(new CustomEvent('before-track-change', { detail: { toTrackId: 't2' } }));
    expect(useLyricsStore.getState().structurePending).toBe(false);

    // watchdog не взводился при hasStructure=false — 2с ничего не меняют
    vi.advanceTimersByTime(2000);
    expect(useLyricsStore.getState().structurePending).toBe(false);
  });

  it('К3: watchdog 1200мс → false (raw-деградация)', () => {
    (globalThis as any).trackCatalog = { tracks: [{ id: 't1', blocksData: [1] }] };
    document.dispatchEvent(new CustomEvent('before-track-change', { detail: { toTrackId: 't1' } }));
    expect(useLyricsStore.getState().structurePending).toBe(true);

    vi.advanceTimersByTime(1200);
    expect(useLyricsStore.getState().structurePending).toBe(false);
  });

  it('(а): изоляция флагов — watchdog снимает только structurePending, lyricsReady не тронут', () => {
    (globalThis as any).trackCatalog = { tracks: [{ id: 't1', blocksData: [1] }] };
    document.dispatchEvent(new CustomEvent('before-track-change', { detail: { toTrackId: 't1' } }));
    expect(useLyricsStore.getState().structurePending).toBe(true);
    expect(useLyricsStore.getState().lyricsReady).toBe(false);

    vi.advanceTimersByTime(1200);
    expect(useLyricsStore.getState().structurePending).toBe(false);
    // наш 1200мс-watchdog — НЕ BAC-001 _watchdog: lyricsReady не поднимает
    expect(useLyricsStore.getState().lyricsReady).toBe(false);
  });

  it('(б): watchdog→raw — при lines>0 после релиза сырьё опубликовано (не null-навсегда)', () => {
    (globalThis as any).trackCatalog = { tracks: [{ id: 't1', blocksData: [1] }] };
    document.dispatchEvent(new CustomEvent('before-track-change', { detail: { toTrackId: 't1' } }));
    useLyricsStore.getState().setLyricsReady(true);
    useLyricsStore.getState().setLines(['a', 'b', 'c']);
    expect(useLyricsStore.getState().structurePending).toBe(true);
    expect(useLyricsStore.getState().lines.length).toBe(3);

    vi.advanceTimersByTime(1200);
    expect(useLyricsStore.getState().structurePending).toBe(false);
    expect(useLyricsStore.getState().lines.length).toBe(3);
  });

  it('(в): двойной свитч A→B→A — ре-арм таймера честный (1199 true, +1мс false)', () => {
    (globalThis as any).trackCatalog = {
      tracks: [
        { id: 't1', blocksData: [1] },
        { id: 't2' },
      ],
    };
    // A: структура → true + арм
    document.dispatchEvent(new CustomEvent('before-track-change', { detail: { toTrackId: 't1' } }));
    expect(useLyricsStore.getState().structurePending).toBe(true);
    // B: пустой → false (старый таймер снят clearStructWatchdog)
    document.dispatchEvent(new CustomEvent('before-track-change', { detail: { toTrackId: 't2' } }));
    expect(useLyricsStore.getState().structurePending).toBe(false);
    // A снова → ре-арм
    document.dispatchEvent(new CustomEvent('before-track-change', { detail: { toTrackId: 't1' } }));
    expect(useLyricsStore.getState().structurePending).toBe(true);

    vi.advanceTimersByTime(1199);
    expect(useLyricsStore.getState().structurePending).toBe(true);
    vi.advanceTimersByTime(1);
    expect(useLyricsStore.getState().structurePending).toBe(false);
  });

  it('(г): гонка-инверсия У-1 — арм при пустом lyricsDisplay; bare Event → false (арма нет)', () => {
    // гейт зависит от tc-данных, НЕ от window.lyricsDisplay
    (globalThis as any).lyricsDisplay = {};
    (globalThis as any).trackCatalog = { tracks: [{ id: 't1', blocksData: [1] }] };

    // bare Event (без detail — delete/clearAll) → арма нет
    document.dispatchEvent(new Event('before-track-change'));
    expect(useLyricsStore.getState().structurePending).toBe(false);
  });

  it('(д): ранние blocks — setBlocks до track-loaded → false сразу, flush без ре-холда', () => {
    (globalThis as any).trackCatalog = { tracks: [{ id: 't1', blocksData: [1] }] };
    document.dispatchEvent(new CustomEvent('before-track-change', { detail: { toTrackId: 't1' } }));
    expect(useLyricsStore.getState().structurePending).toBe(true);

    // blocks приходят до track-loaded → релиз той же подпиской
    useBlocksStore.setState({ blocks: [makeBlock()] });
    expect(useLyricsStore.getState().structurePending).toBe(false);

    // track-loaded: флаш BAC-001 открывает гейт без ре-холда structurePending
    document.dispatchEvent(new Event('track-loaded'));
    expect(useLyricsStore.getState().structurePending).toBe(false);
    expect(useLyricsStore.getState().lyricsReady).toBe(true);
  });
});
