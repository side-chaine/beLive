import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openPostUploadFlow, resolvePostUploadFlow, type PostUploadFlowInput } from './postUploadFlow';
import { saveLyricsBlocks } from '../../services/track.actions';

function baseInput(overrides: Partial<PostUploadFlowInput> = {}): PostUploadFlowInput {
  return {
    trackId: 1,
    hasLyrics: true,
    hasBlocks: true,
    hasMarkers: true,
    origin: 'lrc',
    ...overrides,
  };
}

function setCatalog(tracks: any[], currentTrackIndex = 0) {
  (window as any).trackCatalog = { tracks, currentTrackIndex };
}

beforeEach(() => {
  (window as any).trackCatalog = undefined;
  (window as any).idbService = undefined;
  (window as any).showAppNotification = undefined;
});

describe('resolvePostUploadFlow (pure)', () => {
  it('R1: no track → none/no-track', () => {
    const r = resolvePostUploadFlow(baseInput({ trackId: null }));
    expect(r).toEqual({ action: 'none', reason: 'no-track' });
  });

  it('R2: empty lyrics → none/no-lyrics', () => {
    const r = resolvePostUploadFlow(baseInput({ hasLyrics: false }));
    expect(r.action).toBe('none');
    expect(r.reason).toBe('no-lyrics');
  });

  it('R3: feed/showActive/featureActive → none/blocked', () => {
    expect(resolvePostUploadFlow(baseInput({ feed: true })).action).toBe('none');
    expect(resolvePostUploadFlow(baseInput({ showActive: true })).action).toBe('none');
    expect(resolvePostUploadFlow(baseInput({ featureActive: true })).action).toBe('none');
  });

  it('R4: editor already open → none/editor-open', () => {
    const r = resolvePostUploadFlow(baseInput({ editorOpen: true }));
    expect(r).toEqual({ action: 'none', reason: 'editor-open' });
  });

  it('R5: no blocks + no markers → open-blocks', () => {
    expect(resolvePostUploadFlow(baseInput({ hasBlocks: false, hasMarkers: false })).action)
      .toBe('open-blocks');
  });

  it('R6: LRC origin, markers exist, no blocks → open-blocks', () => {
    const r = resolvePostUploadFlow(baseInput({
      origin: 'lrc', dataVersion: 2, hasBlocks: false, hasMarkers: true,
    }));
    expect(r.action).toBe('open-blocks');
  });

  it('R7: JSON origin + blocks + markers → none', () => {
    const r = resolvePostUploadFlow(baseInput({ origin: 'json' }));
    expect(r.action).toBe('none');
  });

  it('R8/R12: confidence 0.6 and undefined → open-blocks (?? 0), JSON stays high', () => {
    expect(resolvePostUploadFlow(baseInput({ confidence: 0.6 })).action).toBe('open-blocks');
    expect(resolvePostUploadFlow(baseInput({ confidence: undefined })).action).toBe('open-blocks');
    expect(resolvePostUploadFlow(baseInput({ origin: 'json', confidence: undefined })).action)
      .toBe('none');
  });

  it('R9: confidence 0.8 → none', () => {
    expect(resolvePostUploadFlow(baseInput({ confidence: 0.8 })).action).toBe('none');
  });

  it('R10: blocks without markers → open-sync', () => {
    expect(resolvePostUploadFlow(baseInput({ hasBlocks: true, hasMarkers: false })).action)
      .toBe('open-sync');
  });

  it('R11: markers without blocks → open-blocks', () => {
    expect(resolvePostUploadFlow(baseInput({ hasBlocks: false, hasMarkers: true })).action)
      .toBe('open-blocks');
  });
});

describe('openPostUploadFlow (orchestrator)', () => {
  it('O1: open-blocks — index from tc.tracks, loadTrack awaited (autoplay:false), then editor', async () => {
    setCatalog([{ id: 1 }, { id: 2 }], 0);
    const calls: string[] = [];
    const loadTrack = vi.fn(async (index: number) => {
      calls.push('load');
      (window as any).trackCatalog.currentTrackIndex = index;
    });
    const openBlockEditor = vi.fn(() => {
      calls.push('editor');
      return true;
    });

    const result = await openPostUploadFlow(
      baseInput({ trackId: 2, hasBlocks: false, hasMarkers: false }),
      { loadTrack, openBlockEditor },
    );

    expect(result).toBe('opened');
    expect(loadTrack).toHaveBeenCalledWith(1, { autoplay: false });
    expect(calls).toEqual(['load', 'editor']);
  });

  it('O2: current id → no reload', async () => {
    setCatalog([{ id: 1 }, { id: 2 }], 1);
    const loadTrack = vi.fn(async () => {});
    const openBlockEditor = vi.fn(() => true);

    const result = await openPostUploadFlow(
      baseInput({ trackId: 2, hasBlocks: false, hasMarkers: false }),
      { loadTrack, openBlockEditor },
    );

    expect(result).toBe('opened');
    expect(loadTrack).not.toHaveBeenCalled();
    expect(openBlockEditor).toHaveBeenCalledTimes(1);
  });

  it('O3: id changed after await → blocked/stale-track, editor not called', async () => {
    setCatalog([{ id: 1 }, { id: 2 }], 0);
    const loadTrack = vi.fn(async (index: number) => {
      const tc = (window as any).trackCatalog;
      tc.currentTrackIndex = index;
      tc.tracks[index] = { id: 99 };
    });
    const openBlockEditor = vi.fn(() => true);

    const result = await openPostUploadFlow(
      baseInput({ trackId: 2, hasBlocks: false, hasMarkers: false }),
      { loadTrack, openBlockEditor },
    );

    expect(result).toBe('blocked');
    expect(openBlockEditor).not.toHaveBeenCalled();
  });

  it('O4: parallel call → busy, finally releases', async () => {
    setCatalog([{ id: 1 }, { id: 2 }], 0);
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const loadTrack = vi.fn(async (index: number) => {
      (window as any).trackCatalog.currentTrackIndex = index;
      await gate;
    });
    const openBlockEditor = vi.fn(() => true);
    const input = baseInput({ trackId: 2, hasBlocks: false, hasMarkers: false });

    const first = openPostUploadFlow(input, { loadTrack, openBlockEditor });
    const second = await openPostUploadFlow(input, { loadTrack, openBlockEditor });
    expect(second).toBe('busy');

    release();
    expect(await first).toBe('opened');

    const third = await openPostUploadFlow(input, { loadTrack, openBlockEditor });
    expect(third).toBe('opened');
  });

  it('O5: editor returned false → blocked', async () => {
    setCatalog([{ id: 1 }], 0);
    const result = await openPostUploadFlow(
      baseInput({ trackId: 1, hasBlocks: false, hasMarkers: false }),
      { loadTrack: vi.fn(async () => {}), openBlockEditor: vi.fn(() => false) },
    );
    expect(result).toBe('blocked');
  });

  it('O6: cancel → onSaved not called, no re-open', async () => {
    setCatalog([{ id: 1 }], 0);
    const onSaved = vi.fn();
    const onCancel = vi.fn();
    const openBlockEditor = vi.fn((opts: any) => {
      opts?.onCancel?.();
      return true;
    });

    const result = await openPostUploadFlow(
      baseInput({ trackId: 1, hasBlocks: false, hasMarkers: false }),
      { loadTrack: vi.fn(async () => {}), openBlockEditor, onSaved, onCancel },
    );

    expect(result).toBe('opened');
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSaved).not.toHaveBeenCalled();
    expect(openBlockEditor).toHaveBeenCalledTimes(1);
  });
});

describe('saveLyricsBlocks (IDB seam)', () => {
  function setupTrack(overrides: any = {}) {
    const track: any = {
      id: 1,
      title: 'Song',
      lyrics: 'old lyrics',
      blocksData: [{ id: 'old' }],
      syncMarkers: [],
      lastModified: 'old-date',
      ...overrides,
    };
    setCatalog([track], 0);
    const idb = { saveTrack: vi.fn(async (t: any) => ({ ...t })) };
    (window as any).idbService = idb;
    (window as any).showAppNotification = vi.fn();
    return { track, idb };
  }

  it('S1: success → true, blocksData/lyrics/lastModified updated', async () => {
    const { track, idb } = setupTrack();
    const blocks = [{ id: 'b1', lineIndices: [0, 1] }];

    const ok = await saveLyricsBlocks(1, blocks, 'new lyrics');

    expect(ok).toBe(true);
    expect(track.blocksData).toEqual(blocks);
    expect(track.lyrics).toBe('new lyrics');
    expect(track.lastModified).not.toBe('old-date');
    expect(idb.saveTrack).toHaveBeenCalledTimes(1);
  });

  it('S2: IDB missing/reject → false, no partial mutations', async () => {
    const { track, idb } = setupTrack();
    idb.saveTrack.mockRejectedValueOnce(new Error('idb down'));

    const ok = await saveLyricsBlocks(1, [{ id: 'b1' }], 'new lyrics');

    expect(ok).toBe(false);
    expect(track.blocksData).toEqual([{ id: 'old' }]);
    expect(track.lyrics).toBe('old lyrics');
    expect(track.lastModified).toBe('old-date');
    expect((window as any).showAppNotification).toHaveBeenCalledWith(
      expect.stringContaining('idb down'), 'error',
    );
  });

  it('S3: cross-track — correct id saved, foreign track untouched', async () => {
    const first: any = { id: 1, title: 'A', lyrics: 'a', blocksData: [], syncMarkers: [], lastModified: 'a' };
    const second: any = { id: 2, title: 'B', lyrics: 'b', blocksData: [], syncMarkers: [], lastModified: 'b' };
    setCatalog([first, second], 0);
    const idb = { saveTrack: vi.fn(async (t: any) => ({ ...t })) };
    (window as any).idbService = idb;
    (window as any).showAppNotification = vi.fn();

    const ok = await saveLyricsBlocks(2, [{ id: 'b2' }], 'B new');

    expect(ok).toBe(true);
    expect(second.blocksData).toEqual([{ id: 'b2' }]);
    expect(second.lyrics).toBe('B new');
    expect(first.blocksData).toEqual([]);
    expect(first.lyrics).toBe('a');
    expect(first.lastModified).toBe('a');
  });

  it('S4: empty/whitespace newLyricsText → old track.lyrics kept', async () => {
    const { track } = setupTrack();

    const ok = await saveLyricsBlocks(1, [{ id: 'b1' }], '   \n\t ');

    expect(ok).toBe(true);
    expect(track.lyrics).toBe('old lyrics');
  });

  it('S5: idMap rewrites M2.afterBlockId before write', async () => {
    const { track, idb } = setupTrack({
      syncMarkers: [
        { id: 'm2', markerType: 'M2', time: 10, lineIndex: 1, text: '', afterBlockId: 'old-1' },
        { id: 'm1', markerType: 'M1', time: 1, lineIndex: 0, text: 'x' },
      ],
    });

    const ok = await saveLyricsBlocks(1, [{ id: 'new-1' }], 'lyrics', { 'old-1': 'new-1' });

    expect(ok).toBe(true);
    const written = idb.saveTrack.mock.calls[0][0];
    expect(written.syncMarkers[0].afterBlockId).toBe('new-1');
    expect(written.syncMarkers[1].afterBlockId).toBeUndefined();
    expect(track.syncMarkers[0].afterBlockId).toBe('new-1');
  });
});
