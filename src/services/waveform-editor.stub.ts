/* eslint-disable @typescript-eslint/no-explicit-any */
import { saveLyricsBlocks } from './track.actions';
declare const ModalBlockEditor: any;

export class WaveformEditorStub {
  currentTrackId: number | null = null;
  lastLoadedFile: string | null = null;
  currentTrackTitle = '';
  isVisible = false;
  modalBlockEditor: any = null;

  audioEngine: any;
  lyricsDisplay: any;
  markerManager: any;

  constructor(audioEngine?: any) {
    this.audioEngine = audioEngine;
    this.lyricsDisplay = (window as any).lyricsDisplay;
    this.markerManager = (window as any).markerManager;
  }

  show(): void {}
  hide(): void {}
  async loadDualWaveforms(): Promise<void> {}
  async loadAudioForSync(): Promise<void> {}

  _showNotification(message: string, type: string): void {
    const w = window as any;
    if (w.showAppNotification) {
      w.showAppNotification(message, type);
    }
  }

  async _openNewBlockEditor(): Promise<void> {
    const w = window as any;

    if (!this.currentTrackId) {
      this._showNotification('Ошибка: Трек не выбран', 'error');
      return;
    }

    if (!w.trackCatalog) {
      this._showNotification('Ошибка: Каталог треков недоступен', 'error');
      return;
    }

    const track = w.trackCatalog.tracks.find(
      (t: any) => t.id === this.currentTrackId
    );
    if (!track) {
      this._showNotification('Ошибка: Трек не найден', 'error');
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

    if (!this.modalBlockEditor) {
      this.modalBlockEditor = new ModalBlockEditor();
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

    this.modalBlockEditor.init(
      currentLyrics,
      track,
      async (editedBlocks: any, newLyricsText: string) => {
        if (w.trackCatalog && this.currentTrackId) {
          try {
            saveLyricsBlocks(this.currentTrackId, editedBlocks, newLyricsText);
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

    this.modalBlockEditor.show();
  }
}

export function registerWaveformEditorStub(): void {
  const w = window as any;
  if (!w.waveformEditor) {
    w.waveformEditor = new WaveformEditorStub(w.audioEngine);
  }
}
