/* eslint-disable @typescript-eslint/no-explicit-any */

import { migratePersistedBlock } from '../utils/block-migration';

export class LyricsService {
  lyricsContainer: HTMLElement | null;
  containerElement: HTMLElement | null;
  currentLine: number;
  lyrics: string[];
  currentLyricElement: HTMLElement | null;
  fullText: string;
  duration: number;
  autoScrollEnabled: boolean;
  lastScrollTime: number;
  _usingLinkinParkMap: boolean;
  _lastEditModeState: boolean;
  karaokeLineElements: HTMLElement[];
  activeKaraokeEl: HTMLElement | null;
  nextKaraokeEl: HTMLElement | null;
  currentStyle: any;
  styleClasses: Record<string, string>;
  appliedStyleClasses: string[];
  currentlyFocusedBlockId: string | null;
  textBlocks: any[]; // ParsedBlock[] from parsing.service
  currentBlockCreation: number[];
  isInBlockMode: boolean;
  usingMarkerManager: boolean;
  options: any;
  isRehearsalModeActive: boolean;
  currentActiveBlock: any;
  scrollTimeout: any;
  rehearsalScrollTimeout: any;
  lyricsLines: any[];
  activeLineIndex: number;
  _originalLineTexts: any;
  _hasWrappedLetters: boolean;
  updateDefinedBlocksDisplay: ((blocks: any[]) => void) | null;

  constructor() {
    this.lyricsContainer = document.getElementById('lyrics-display');
    this.containerElement = document.getElementById('lyrics-container');
    this.currentLine = 0;
    this.lyrics = [];
    this.currentLyricElement = null;
    this.fullText = '';
    this.duration = 0;
    this.autoScrollEnabled = true;
    this.lastScrollTime = 0;
    this._usingLinkinParkMap = false;
    this._lastEditModeState = false;
    this.karaokeLineElements = [];
    this.activeKaraokeEl = null;
    this.nextKaraokeEl = null;
    this.currentStyle = null;
    this.styleClasses = {};
    this.appliedStyleClasses = [];
    this.currentlyFocusedBlockId = null;
    this.textBlocks = [];
    this.currentBlockCreation = [];
    this.isInBlockMode = false;
    this.usingMarkerManager = false;
    this.options = {
      autoScroll: true,
      showControls: true,
      highlightActive: true,
      scrollBehavior: 'smooth',
    };
    this.isRehearsalModeActive = false;
    this.currentActiveBlock = null;
    this.scrollTimeout = null;
    this.rehearsalScrollTimeout = null;
    this.lyricsLines = [];
    this.activeLineIndex = -1;
    this._originalLineTexts = null;
    this._hasWrappedLetters = false;
    this.updateDefinedBlocksDisplay = null;
  }

  loadLyrics(text: string, duration: number, shouldRender = true): void {
    if (text && text.length > 0) {
      // RTF detection handled by parsingService
    }
    this.currentLine = 0;
    this.lyrics = [];
    this.fullText = text;
    this.duration = duration;
    this.autoScrollEnabled = true;
    this._usingLinkinParkMap = false;
    this.currentlyFocusedBlockId = null;
    if (this.lyricsContainer) this.lyricsContainer.innerHTML = '';
    if (this.containerElement) this.containerElement.scrollTop = 0;
    if (!text || !this.lyricsContainer) {
      if (shouldRender) {
        this.lyricsContainer!.innerHTML =
          '<div class="no-lyrics">No lyrics text provided</div>';
      }
      return;
    }
    const w = window as any;
    text = w.parsingService ? w.parsingService.sanitizeLyricsText(text) : text;
    this._processLyrics(text);
    if (shouldRender) this._renderLyrics();
  }

  reloadLyrics(text: string, duration: number, shouldRender = true): void {
    this.reset();
    this.loadLyrics(text, duration, shouldRender);
    this.setStyle({ id: 'default', name: 'По умолчанию' });
  }

  setStyle(style: any): void {
    if (!style || !style.id) return;
    if (this.currentStyle?.id === 'rehearsal' && style.id !== 'rehearsal') {
      this.deactivateRehearsalDisplay();
    }
    this.currentStyle = style;
    if (style.id === 'rehearsal') {
      this.activateRehearsalDisplay();
      return;
    }
    this._renderLyrics();
    localStorage.setItem('selectedTextStyle', style.id);
  }

  _renderLyrics(): void {
    try {
      document.dispatchEvent(new CustomEvent('lyrics-rendered'));
    } catch (_) { /* ignore */ }
  }

  setActiveLine(index: number, force = false): void {
    if (this.currentLine === index && !force) return;
    this.currentLine = index;
    try {
      document.dispatchEvent(
        new CustomEvent('active-line-changed', {
          detail: { lineIndex: index },
        })
      );
    } catch (_) { /* ignore */ }
  }

  reset(): void {
    this.currentLine = 0;
    this.autoScrollEnabled = true;
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
      this.scrollTimeout = null;
    }
    if (this.rehearsalScrollTimeout) {
      clearTimeout(this.rehearsalScrollTimeout);
      this.rehearsalScrollTimeout = null;
    }
    if (this.currentLyricElement) {
      this.currentLyricElement.classList.remove('active');
      this.currentLyricElement = null;
    }
    if (this.lyrics.length > 0) {
      const w = window as any;
      if (w.markerService && w.markerService.hasMarkers()) {
        this.setActiveLine(0);
      }
    }
  }

  clearAllTextBlocks(): void {
    this.textBlocks = [];
    this.currentBlockCreation = [];
  }

  _sanitizeBlocks(blocks: unknown[]): any[] {
    const ps = (window as any).parsingService;
    if (ps && typeof ps.sanitizeBlocks === 'function') {
      return ps.sanitizeBlocks(blocks, Array.isArray(this.lyrics) ? this.lyrics.length : 0);
    }
    return blocks as any[];
  }

  activateRehearsalDisplay(): void {
    this._renderLyrics();
  }

  deactivateRehearsalDisplay(): void {
    if (this.currentStyle && this.currentStyle.id !== 'rehearsal') {
      this._renderLyrics();
    }
  }

  fullReset(): void {
    const container = document.getElementById('lyrics-container-main');
    if (container) container.innerHTML = '';
    this.lyricsLines = [];
    this.activeLineIndex = -1;
    this._originalLineTexts = null;
    this._hasWrappedLetters = false;
    const w = window as any;
    this.currentStyle =
      w.__TEXT_STYLE_PRESETS?.['default'] ??
      { id: 'default', name: 'По умолчанию' };
  }

  /* eslint-disable no-useless-escape */
  async _processLyrics(text: string): Promise<string[] | void> {
    if (!text) {
      this.lyrics = [];
      return [];
    }
    const rtfSignatures = ['\\rtf', '{\\rtf', '\\par', '\\pard', '\\f0', '\\ansicpg', '\\cocoartf'];
    const isRtf = rtfSignatures.some((sig) => text.includes(sig));
    const isLrc = text.includes('[') && text.includes(']') && /\[\d+:\d+/i.test(text);
    const hasUnicode = text.includes('\\u') || text.includes("\\'");
    let processedText = '';
    const w = window as any;
    const ps = w.parsingService;
    if (isRtf) {
      try {
        processedText = ps ? await ps.parseRtfUniversal(text) : text;
      } catch (rtfError) {
        console.error('Ошибка при обработке RTF текста:', rtfError);
        processedText =
          (ps ? ps.extractStructuredContentFromRtf(text) : '') ||
          (ps ? ps.extractUnicodeFromRtf(text) : '') ||
          (ps ? ps.basicTextCleanup(text) : text);
      }
      if (!processedText || processedText.split('\n').length < 5) {
        processedText = ps ? ps.extractStructuredContentFromRtf(text) : '';
        if (!processedText || processedText.split('\n').length < 5) {
          processedText = ps ? ps.extractUnicodeFromRtf(text) : '';
        }
      }
    } else if (isLrc) {
      processedText = ps ? ps.parseLrcFile(text) : '';
    } else if (hasUnicode) {
      processedText = ps ? ps.convertUnicodeCodesToChars(text) : text;
    } else {
      processedText = ps ? ps.cleanText(text) : text;
    }
    if (!processedText || processedText.trim().length === 0) {
      console.warn('Не удалось обработать текст, применяем базовую очистку');
      processedText = ps ? ps.basicTextCleanup(text) : text;
    }
    this.fullText = processedText;
    const textLanguage = ps ? ps.detectLanguage(processedText) : 'unknown';
    void textLanguage; // detected but not used currently
    if (this.fullText.includes('\\')) {
      this.fullText = this.fullText.replace(/\\/g, '\n');
    }
    let lines = this.fullText.split(/\r?\n/);
    if (lines.length < 3 && processedText.length > 100) {
      const hasTags = /\[(verse|chorus|bridge|interlude|intro|outro)/i.test(processedText);
      if (hasTags) {
        console.debug('Tagged lyrics detected, fewer lines after tag filtering — applying intelligent split');
      } else {
        console.warn('Недостаточно строк после обработки, применяем интеллектуальное разделение');
      }
      lines = ps ? ps.intelligentLineSplitting(processedText) : [];
    }
    lines = lines
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0)
      .filter((line: string) => !/^[;:,.\\/\/#!$%\^&\*;:{}=\-_`~()]+$/.test(line));
    this.lyrics = lines;
  }

  async loadImportedBlocks(
    blocksData: any[],
    lyricsContent?: string,
    shouldRender = true
  ): Promise<void> {
    return new Promise((resolve) => {
      if (!blocksData || !Array.isArray(blocksData)) {
        console.warn('LyricsDisplay: Invalid or empty blocksData provided to loadImportedBlocks.');
        this.textBlocks = [];
        if (shouldRender) this._renderLyrics();
        if (typeof this.updateDefinedBlocksDisplay === 'function') {
          this.updateDefinedBlocksDisplay([]);
        }
        resolve();
        return;
      }
      this.textBlocks = blocksData.map((block: any) => {
        const migrated = migratePersistedBlock(block);
        return {
          ...migrated,
          originalLineIndices: block.lineIndices ? [...block.lineIndices] : [],
        };
      });
      if (lyricsContent && typeof lyricsContent === 'string') {
        this.lyrics = lyricsContent.split('\n').map((line: string) => line.trim()).filter((line: string) => line.length > 0);
      } else {
        this.lyrics = [];
      }
      try {
        this.textBlocks = this._sanitizeBlocks(this.textBlocks);
      } catch (e) {
        console.warn('LyricsDisplay: Error during block sanitization:', e);
      }
      if (shouldRender) this._renderLyrics();
      if (typeof this.updateDefinedBlocksDisplay === 'function') {
        this.updateDefinedBlocksDisplay(this.textBlocks);
      }
      resolve();
    });
  }
}

export function registerLyricsService(): void {
  const w = window as any;
  w.lyricsDisplay = new LyricsService();
}

export function patchLyricsDisplaySlimMethods(): void {
  const ld = (window as any).lyricsDisplay;
  if (!ld) return;
  const proto = LyricsService.prototype as any;
  ld.setStyle = proto.setStyle;
  ld.clearAllTextBlocks = proto.clearAllTextBlocks;
  ld.activateRehearsalDisplay = proto.activateRehearsalDisplay;
  ld.deactivateRehearsalDisplay = proto.deactivateRehearsalDisplay;
  ld.fullReset = proto.fullReset;
  ld._renderLyrics = proto._renderLyrics;
  ld.setActiveLine = proto.setActiveLine;
  ld.reset = proto.reset;
  ld.reloadLyrics = proto.reloadLyrics;
  ld.loadImportedBlocks = proto.loadImportedBlocks;
  ld.loadLyrics = proto.loadLyrics;
  ld._processLyrics = proto._processLyrics;
  ld._sanitizeBlocks = proto._sanitizeBlocks;
}
