// beLive — Block Editor Service
// W5 (MICRO-PACK-WAVE5, ПРАВКА-3): прямой терминальный вход в BlockEditorModal.
// вызов — напрямую useBlockEditorStore.getState().open(...), без Proxy.

import { useBlockEditorStore } from '../store/blockEditor.store';
import { saveLyricsBlocks } from '../../services/track.actions';
import { parseTaggedLyrics } from '../parser/tagged-lyrics.parser';
import { buildParagraphEditorText } from '../parser/paragraph-blocks';

export interface OpenBlockEditorOptions {
  trackId?: number | string | null;
  trackIndex?: number | null;
  /** Explicit line-space text override (tests / callers with ready display lines) */
  text?: string | null;
  /** Persisted blocksData — ids/indices survive the round-trip */
  seedBlocks?: any[] | null;
  /** Original text with structural tags — overlay for types only */
  tagText?: string | null;
  onSaved?: () => void;
  onCancel?: () => void;
}

function nonEmptyLines(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(l => String(l ?? '').trim()).filter(l => l.length > 0);
}

/**
 * openBlockEditor — единственный вход в живой BlockEditorModal.
 * Guard'ы (нет трека/каталога → error-нотификация), line-space из lyricsDisplay,
 * seed из track.blocksData, tag-overlay только когда нужен,
 * await persist + runtime apply только если трек всё ещё текущий.
 */
export function openBlockEditor(opts: OpenBlockEditorOptions = {}): boolean {
  const w = window as any;

  const tc = w.trackCatalog;
  if (!tc) {
    w.showAppNotification?.('Ошибка: Каталог треков недоступен', 'error');
    return false;
  }

  const tracks: any[] = Array.isArray(tc.tracks) ? tc.tracks : [];
  let track: any = null;
  let idx: number = -1;

  if (opts.trackId !== undefined && opts.trackId !== null) {
    idx = tracks.findIndex((t: any) => String(t.id) === String(opts.trackId));
    if (idx >= 0) track = tracks[idx];
  }
  if (!track) {
    idx = typeof opts.trackIndex === 'number' ? opts.trackIndex : tc.currentTrackIndex;
    track = (idx >= 0 && idx < tracks.length) ? tracks[idx] : null;
  }

  const currentTrackId = track?.id ?? null;   // нативный тип из каталога, НЕ String()
  if (currentTrackId === null || currentTrackId === undefined) {
    w.showAppNotification?.('Ошибка: Трек не выбран', 'error');
    return false;
  }

  const original = typeof track.lyricsOriginalContent === 'string'
    ? track.lyricsOriginalContent
    : '';

  // Line-space = lyricsDisplay.lyrics (markers live in this index space).
  let lines = nonEmptyLines(w.lyricsDisplay?.lyrics);

  if (opts.text !== null && opts.text !== undefined) {
    lines = String(opts.text).replace(/\r\n|\r/g, '\n').split('\n').map(l => l.trim()).filter(Boolean);
  }

  if (lines.length === 0) {
    let fallbackText = '';
    if (original.trim().startsWith('{\\rtf')) {
      try {
        const svc = w.parsingService;
        const txt = svc?.rtfToText ? svc.rtfToText(original) : original;
        fallbackText = txt.replace(/\r\n|\r/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
      } catch {
        fallbackText = original;
      }
    } else if (track.lyrics) {
      fallbackText = String(track.lyrics);
    } else if (original) {
      fallbackText = original;
    } else if (w.lyricsDisplay?.fullText) {
      fallbackText = String(w.lyricsDisplay.fullText);
    }

    lines = fallbackText.split(/\r\n|\r|\n/).map(l => l.trim()).filter(Boolean);
  }

  const seedBlocks = Array.isArray(opts.seedBlocks)
    ? opts.seedBlocks
    : (Array.isArray(track.blocksData) ? track.blocksData : []);

  const hasSeed = seedBlocks.length > 0;
  // 009 strike: no automatic tagText overlay — seed/2-line chunker closes the structure.
  const tagText = !hasSeed && opts.tagText ? opts.tagText : null;

  let editorText: string;
  if (hasSeed || tagText) {
    editorText = lines.join('\n');
  } else {
    // D2: теги → original (store сам раздаст блоки+типы); иначе — абзацы Genius, один блок.
    const tagged = parseTaggedLyrics(original);
    if (tagged.hasStructure && tagged.blocks.length >= 2) {
      editorText = original;
    } else {
      const fromSource = buildParagraphEditorText(original) ?? buildParagraphEditorText(track.lyrics);
      editorText = fromSource ?? lines.join('\n');
    }
  }

  useBlockEditorStore.getState().open(
    editorText,
    track,
    async (editedBlocks: any, newLyricsText: string) => {
      const saved = await saveLyricsBlocks(currentTrackId, editedBlocks, newLyricsText);
      if (!saved) {
        // У-2: false = failure — store keeps the modal open, no onSaved.
        throw new Error('saveLyricsBlocks returned false');
      }

      // Runtime apply only if the edited track is still the current one.
      const current = tc.tracks?.[tc.currentTrackIndex];
      const sameTrack = !!current && String(current.id) === String(currentTrackId);
      if (sameTrack) {
        if (w.lyricsDisplay?.loadImportedBlocks) {
          w.lyricsDisplay.loadImportedBlocks(editedBlocks, newLyricsText, true);
        }
        if (w.markerManager?.updateMarkerColors) {
          w.markerManager.updateMarkerColors();
        }
      }

      w.showAppNotification?.('Текст и блоки сохранены успешно!', 'success');
    },
    () => {
      opts.onCancel?.();
      w.showAppNotification?.('Редактирование блоков отменено.', 'info');
    },
    {
      seedBlocks,
      tagText,
      onSaved: opts.onSaved ?? null,
    },
  );

  return true;
}
