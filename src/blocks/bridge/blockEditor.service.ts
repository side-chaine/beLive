// beLive — Block Editor Service
// W5 (MICRO-PACK-WAVE5, ПРАВКА-3): прямой терминальный вход в BlockEditorModal.
// вызов — напрямую useBlockEditorStore.getState().open(...), без Proxy.

import { useBlockEditorStore } from '../store/blockEditor.store';
import { saveLyricsBlocks } from '../../services/track.actions';

/**
 * openBlockEditor — единственный вход в живой BlockEditorModal.
 * Логика перенесена 1:1 из удалённого WaveformEditor stub:
 * guard'ы (нет трека/каталога → error-нотификация), RTF-парс,
 * авто-нарезка блоков (boundary припев|проигрыш + аккумулятор 2 строк),
 * save-колбэк (saveLyricsBlocks + loadImportedBlocks + updateMarkerColors
 * + success/error-нотификации).
 */
export function openBlockEditor(): void {
  const w = window as any;

  const tc = w.trackCatalog;
  if (!tc) {
    w.showAppNotification?.('Ошибка: Каталог треков недоступен', 'error');
    return;
  }

  const idx = tc.currentTrackIndex;
  const track = (idx >= 0 && idx < tc.tracks.length) ? tc.tracks[idx] : null;
  const currentTrackId = track?.id ?? null;   // нативный тип из каталога, НЕ String()

  if (!currentTrackId) {
    w.showAppNotification?.('Ошибка: Трек не выбран', 'error');
    return;
  }

  let currentLyrics = '';

  if (track.lyricsOriginalContent) {
    if (track.lyricsOriginalContent.trim().startsWith('{\\rtf')) {
      try {
        const raw = String(track.lyricsOriginalContent);
        const svc = w.parsingService;
        let txt = svc?.rtfToText ? svc.rtfToText(raw) : raw;
        txt = txt
          .replace(/\r\n|\r/g, '\n')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
        currentLyrics = txt;
      } catch {
        currentLyrics = track.lyricsOriginalContent;
      }
    } else {
      currentLyrics = track.lyricsOriginalContent;
    }
  } else if (track.lyrics) {
    currentLyrics = track.lyrics;
  } else if (w.lyricsDisplay?.fullText) {
    currentLyrics = w.lyricsDisplay.fullText;
  }

  try {
    const hasDoubleNewlines = /\n\s*\n/.test(currentLyrics || '');
    if (
      !hasDoubleNewlines &&
      w.lyricsDisplay &&
      Array.isArray(w.lyricsDisplay.lyrics) &&
      w.lyricsDisplay.lyrics.length > 0
    ) {
      const lines = w.lyricsDisplay.lyrics
        .map((l: any) => String(l || '').trim())
        .filter(Boolean);
      const blocks: string[] = [];
      const boundary = /(\[?\s*(припев|проигрыш)\s*\]?)/i;
      let acc: string[] = [];
      for (const line of lines) {
        if (boundary.test(line)) {
          if (acc.length) {
            blocks.push(acc.join('\n'));
            acc = [];
          }
          blocks.push(line);
          continue;
        }
        acc.push(line);
        if (acc.length >= 2) {
          blocks.push(acc.join('\n'));
          acc = [];
        }
      }
      if (acc.length) blocks.push(acc.join('\n'));
      if (blocks.length > 0) currentLyrics = blocks.join('\n\n');
    }
  } catch (e) {
    console.warn('WaveformEditor: LyricsDisplay fallback failed', e);
  }

  useBlockEditorStore.getState().open(
    currentLyrics,
    track,
    async (editedBlocks: any, newLyricsText: string) => {
      if (w.trackCatalog && currentTrackId) {
        try {
          saveLyricsBlocks(currentTrackId, editedBlocks, newLyricsText);
          if (w.lyricsDisplay?.loadImportedBlocks) {
            w.lyricsDisplay.loadImportedBlocks(
              editedBlocks,
              newLyricsText,
              true
            );
          }
          if (w.markerManager?.updateMarkerColors) {
            w.markerManager.updateMarkerColors();
          }
          w.showAppNotification?.('Текст и блоки сохранены успешно!', 'success');
        } catch (error: any) {
          w.showAppNotification?.(
            `Ошибка сохранения: ${error?.message || error}`,
            'error'
          );
        }
      }
    },
    () => {
      w.showAppNotification?.('Редактирование блоков отменено.', 'info');
    }
  );
}
