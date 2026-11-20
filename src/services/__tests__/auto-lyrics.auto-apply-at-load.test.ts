/**
 * HOTFIX 2026-11-20 — lrclib auto-apply при загрузке трека (I Disappear).
 *
 * Симптом: трек играет, но TrackMap/лирика пустые. Корень (вердикт 806):
 * prefetch только греет кэш, а apply к lyricsDisplay шёл только через ручную
 * вставку текста. Тест проверяет контракт нового хелпера: при треке БЕЗ своего
 * текста/блоков он берёт LRC из кэша и зовёт reloadLyrics(rawSynced), а при
 * наличии IDB-данных — путь загрузки НЕ трогает (защита от маскировки 3b).
 */

import { describe, it, expect, vi } from 'vitest';
import { autoApplyLrcAtLoad } from '../auto-lyrics.service';
import type { LrcResult, AutoApplyLrcTarget } from '../auto-lyrics.service';

const RAW = '[00:39.89] Hey, hey, hey\n[00:42.55] Here I go now';

const cached: LrcResult = {
  lines: [
    { time: 39.89, text: 'Hey, hey, hey' },
    { time: 42.55, text: 'Here I go now' },
  ],
  rawSynced: RAW,
  fetchedAt: 0,
};

function makeTarget() {
  const reloadLyrics = vi.fn();
  const target: AutoApplyLrcTarget = { reloadLyrics };
  return { target, reloadLyrics };
}

describe('autoApplyLrcAtLoad — lrclib при пустом треке', () => {
  it('пустой трек + live-cache → reloadLyrics(rawSynced, duration, false)', async () => {
    const { target, reloadLyrics } = makeTarget();
    const lookup = vi.fn().mockResolvedValue(cached);

    const applied = await autoApplyLrcAtLoad(
      target, 'Metallica-I Disappear', 266, false, false, 3000, lookup,
    );

    expect(applied).toBe(true);
    expect(lookup).toHaveBeenCalledWith('Metallica-I Disappear', 3000);
    expect(reloadLyrics).toHaveBeenCalledTimes(1);
    expect(reloadLyrics).toHaveBeenCalledWith(RAW, 266, false);
  });

  it('свой текст в IDB → кэш не дёргаем, reloadLyrics не зовём', async () => {
    const { target, reloadLyrics } = makeTarget();
    const lookup = vi.fn().mockResolvedValue(cached);

    const applied = await autoApplyLrcAtLoad(
      target, 'Metallica-I Disappear', 266, true, false, 3000, lookup,
    );

    expect(applied).toBe(false);
    expect(lookup).not.toHaveBeenCalled();
    expect(reloadLyrics).not.toHaveBeenCalled();
  });

  it('свои блоки в IDB → путь loadImportedBlocks не меняется (3b не маскируем)', async () => {
    const { target, reloadLyrics } = makeTarget();
    const lookup = vi.fn().mockResolvedValue(cached);

    const applied = await autoApplyLrcAtLoad(
      target, 'Metallica-I Disappear', 266, false, true, 3000, lookup,
    );

    expect(applied).toBe(false);
    expect(lookup).not.toHaveBeenCalled();
    expect(reloadLyrics).not.toHaveBeenCalled();
  });

  it('кэш пуст / нет title / нет ld → ничего не применяем', async () => {
    const emptyLookup = vi.fn().mockResolvedValue(null);
    const a = makeTarget();
    expect(await autoApplyLrcAtLoad(a.target, 'X', 1, false, false, 3000, emptyLookup)).toBe(false);
    expect(a.reloadLyrics).not.toHaveBeenCalled();

    const b = makeTarget();
    const hit = vi.fn().mockResolvedValue(cached);
    expect(await autoApplyLrcAtLoad(b.target, '', 1, false, false, 3000, hit)).toBe(false);
    expect(hit).not.toHaveBeenCalled();

    expect(await autoApplyLrcAtLoad(null, 'X', 1, false, false, 3000, hit)).toBe(false);
  });
});
