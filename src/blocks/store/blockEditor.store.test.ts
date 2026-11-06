import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useBlockEditorStore } from './blockEditor.store';

const getState = () => useBlockEditorStore.getState();

function reset() {
  useBlockEditorStore.setState(useBlockEditorStore.getInitialState(), true);
}

beforeEach(reset);

describe('blockEditor.store — A: parse/seed/overlay/save', () => {
  it('A1: untagged 2 paragraphs with an empty line → continuous [[0,1],[2,3]]', () => {
    getState().open('line1\nline2\n\nline3\nline4', null, null);

    expect(getState().blocks.map(b => b.lineIndices)).toEqual([[0, 1], [2, 3]]);
    expect(getState().lyricsLines).toEqual(['line1', 'line2', 'line3', 'line4']);
  });

  it('A2: leading/trailing whitespace + CRLF → indices stay continuous', () => {
    getState().open('\n\n line1 \r\n line2\r\n\r\nline3 \r\n\r\n', null, null);

    expect(getState().lyricsLines).toEqual(['line1', 'line2', 'line3']);
    expect(getState().blocks.map(b => b.lineIndices)).toEqual([[0, 1], [2]]);
  });

  it('A3: empty/whitespace text → [] blocks and [] lines', () => {
    getState().open('', null, null);
    expect(getState().blocks).toEqual([]);
    expect(getState().lyricsLines).toEqual([]);

    reset();
    getState().open('   \n\t\n  ', null, null);
    expect(getState().blocks).toEqual([]);
    expect(getState().lyricsLines).toEqual([]);
  });

  it('A4: seed preserves id/type/lineIndices, text comes from line-space', () => {
    getState().open('one\ntwo\nthree\nfour', null, null, null, {
      seedBlocks: [{ id: 'b1', name: 'Chorus', type: 'chorus', lineIndices: [2, 3] }],
    });

    const [block] = getState().blocks;
    expect(block.id).toBe('b1');
    expect(block.type).toBe('chorus');
    expect(block.lineIndices).toEqual([2, 3]);
    expect(block.text).toBe('three\nfour');
  });

  it('A5: seed with OOB index drops the index, block survives without throwing', () => {
    getState().open('one\ntwo', null, null, null, {
      seedBlocks: [{ id: 'b2', name: 'Verse', type: 'verse', lineIndices: [0, 99] }],
    });

    expect(getState().blocks).toHaveLength(1);
    expect(getState().blocks[0].id).toBe('b2');
    expect(getState().blocks[0].lineIndices).toEqual([0]);
    expect(getState().blocks[0].text).toBe('one');
  });

  it('A6: tag overlay without seed → types/indices in line-space, no tags in lines', () => {
    getState().open('a\nb\nc\nd', null, null, null, {
      tagText: '[Verse]\na\nb\n[Chorus]\nc\nd',
    });

    expect(getState().blocks.map(b => b.type)).toEqual(['verse', 'chorus']);
    expect(getState().blocks.map(b => b.lineIndices)).toEqual([[0, 1], [2, 3]]);
    expect(getState().lyricsLines).toEqual(['a', 'b', 'c', 'd']);
    expect(getState().blocks.map(b => b.text).join('\n')).not.toContain('[');
  });

  it('A7: single tag block + whitespace separators → block stays alive', () => {
    getState().open('a\n\n\nb', null, null, null, {
      tagText: '[Verse]\na\nb',
    });

    expect(getState().blocks).toHaveLength(1);
    expect(getState().blocks[0].type).toBe('verse');
    expect(getState().blocks[0].lineIndices).toEqual([0, 1]);
  });

  it('A7b: preamble + [Verse] → preamble stays in lyricsLines and in Save', async () => {
    const onSave = vi.fn(async (_blocks: any, _lyrics: string) => undefined);
    getState().open('preamble\nline1\nline2', null, onSave, null, {
      tagText: 'preamble\n[Verse]\nline1\nline2',
    });

    expect(getState().lyricsLines).toEqual(['preamble', 'line1', 'line2']);
    expect(getState().blocks[0].lineIndices).toEqual([1, 2]);

    await getState().save();

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][1]).toBe('preamble\nline1\nline2');
  });

  it('A8: Save awaits onSave → EMPTY → onSaved exactly once', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const onSave = vi.fn(async (_blocks: any, _lyrics: string) => { await gate; });
    const onSaved = vi.fn();

    getState().open('a\nb', null, onSave, null, { onSaved });
    const saving = getState().save();

    expect(getState().isSaving).toBe(true);
    expect(onSaved).not.toHaveBeenCalled();

    release();
    await saving;

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(getState().isOpen).toBe(false);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('A9: reject or false → modal open, isSaving=false, onSaved not called', async () => {
    const onSaved = vi.fn();

    getState().open('a\nb', null, vi.fn(async () => { throw new Error('idb'); }), null, { onSaved });
    await getState().save();

    expect(getState().isOpen).toBe(true);
    expect(getState().isSaving).toBe(false);
    expect(onSaved).not.toHaveBeenCalled();

    getState().open('a\nb', null, vi.fn(async () => false), null, { onSaved });
    await getState().save();

    expect(getState().isOpen).toBe(true);
    expect(getState().isSaving).toBe(false);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('A10: cancel throws → still EMPTY; empty editor → no onSave/onSaved', async () => {
    getState().open('a\nb', null, null, () => { throw new Error('cancel'); });
    expect(() => getState().cancel()).toThrow('cancel');
    expect(getState().isOpen).toBe(false);
    expect(getState().blocks).toEqual([]);

    const onSave = vi.fn(async () => undefined);
    const onSaved = vi.fn();
    getState().open('', null, onSave, null, { onSaved });
    await getState().save();

    expect(onSave).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });
});
