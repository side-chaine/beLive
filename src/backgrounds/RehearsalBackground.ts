export class RehearsalBackgroundManager {
  private imagePaths: string[];
  private interval: number;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private body: HTMLElement;
  private lastImageIndex: number = -1;
  private isActive: boolean = false;
  private _currentBlockIndex: number | null = null;
  private _boundHandler: ((e: Event) => void) | null = null;
  private _currentBlockId: string | null = null;
  private _cache: Map<string, HTMLImageElement>;
  private _decoded: Map<string, boolean>;

  constructor(imagePaths: string[], interval: number = 0) {
    this.imagePaths = imagePaths;
    this.interval = interval;
    this.body = document.body;
    this._cache = new Map();
    this._decoded = new Map();
  }

  private _preloadAll(): void {
    if (!Array.isArray(this.imagePaths)) return;
    this.imagePaths.forEach(src => {
      if (this._cache.has(src)) return;
      const img = new Image();
      img.decoding = 'async';
      img.loading = 'eager';
      img.src = src;
      this._cache.set(src, img);
      if (typeof img.decode === 'function') {
        img.decode()
          .then(() => { this._decoded.set(src, true); })
          .catch(() => {});
      }
    });
  }

  start(): void {
    if (!this.imagePaths || this.imagePaths.length === 0) return;
    this.body.classList.add('rehearsal-active');
    this.isActive = true;
    this._preloadAll();
    this._setBackground();
    if (this.interval && this.interval > 0 && this.imagePaths.length > 1) {
      this.timerId = setInterval(
        this._setBackground.bind(this), 
        this.interval
      );
    }
  }

  stop(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.isActive = false;
    this.body.classList.remove('rehearsal-active');
    if (this._boundHandler) {
      document.removeEventListener('active-line-changed', this._boundHandler);
      this._boundHandler = null;
    }
  }

  private _setBackground(forcedIndex: number | null = null): void {
    if (!this.isActive) return;
    let nextIndex = forcedIndex;
    if (typeof nextIndex !== 'number' || nextIndex < 0) {
      do {
        nextIndex = Math.floor(Math.random() * this.imagePaths.length);
      } while (
        this.imagePaths.length > 1 && 
        nextIndex === this.lastImageIndex
      );
    }
    this.lastImageIndex = nextIndex;
    const imagePath = this.imagePaths[nextIndex];
    let img = this._cache.get(imagePath);
    if (!img) {
      img = new Image();
      img.decoding = 'async';
      img.loading = 'eager';
      img.src = imagePath;
      this._cache.set(imagePath, img);
    }
    const apply = (): void => {
      if (!this.isActive) return;
      this.body.style.setProperty('background-image', `url('${imagePath}')`);
    };
    if (img.complete && img.naturalWidth > 0) {
      apply();
    } else {
      let applied = false;
      const tryApply = () => {
        if (!applied) {
          applied = true;
          apply();
        }
      };
      if (typeof img.decode === 'function') {
        img.decode().then(tryApply).catch(() => {});
      }
      img.onload = tryApply;
      img.onerror = () => {
        console.error(`❌ Rehearsal Background: failed to load ${imagePath}`);
      };
      setTimeout(tryApply, 300);
    }
  }

  bindToBlockChanges(
    lyricsDisplay: any,
    blockLoopControl: any,
    _audioEngine: any
  ): void {
    if (this._boundHandler) return;
    this._boundHandler = (e: Event) => {
      try {
        if (!this.isActive) return;
        if (!lyricsDisplay || 
            !Array.isArray(lyricsDisplay.textBlocks) || 
            lyricsDisplay.textBlocks.length === 0) {
          return;
        }
        if (blockLoopControl && 
            (blockLoopControl.isLooping || blockLoopControl.isSeekingInProgress)) {
          return;
        }
        const lineIndex = (e as CustomEvent).detail?.lineIndex;
        if (typeof lineIndex !== 'number') return;
        const processedBlocks = (typeof lyricsDisplay._splitLargeBlocks === 'function')
          ? lyricsDisplay._splitLargeBlocks(lyricsDisplay.textBlocks || [])
          : (lyricsDisplay.textBlocks || []);
        const newBlockIndex = this._getBlockIndexByLine(processedBlocks, lineIndex);
        if (newBlockIndex === null) return;
        const newBlockId = processedBlocks[newBlockIndex]?.id || `idx-${newBlockIndex}`;
        if (this._currentBlockIndex === null) {
          this._currentBlockIndex = newBlockIndex;
          this._currentBlockId = newBlockId;
          return;
        }
        if (newBlockIndex !== this._currentBlockIndex || newBlockId !== this._currentBlockId) {
          this._currentBlockIndex = newBlockIndex;
          this._currentBlockId = newBlockId;
          const imgIndex = newBlockIndex % this.imagePaths.length;
          this._setBackground(imgIndex);
        }
      } catch (_) {}
    };
    document.addEventListener('active-line-changed', this._boundHandler);
    try {
      if (lyricsDisplay && 
          Array.isArray(lyricsDisplay.textBlocks) && 
          lyricsDisplay.textBlocks.length > 0) {
        const currentLine = typeof lyricsDisplay.currentLine === 'number' 
          ? lyricsDisplay.currentLine 
          : 0;
        const processedBlocks = (typeof lyricsDisplay._splitLargeBlocks === 'function')
          ? lyricsDisplay._splitLargeBlocks(lyricsDisplay.textBlocks || [])
          : (lyricsDisplay.textBlocks || []);
        this._currentBlockIndex = this._getBlockIndexByLine(processedBlocks, currentLine);
        this._currentBlockId = this._currentBlockIndex !== null 
          ? processedBlocks?.[this._currentBlockIndex]?.id || null 
          : null;
      }
    } catch (_) {}
  }

  private _getBlockIndexByLine(blocks: any[], lineIndex: number): number | null {
    for (let i = 0; i < blocks.length; i++) {
      const blk = blocks[i];
      if (!blk || !Array.isArray(blk.lineIndices)) continue;
      const min = Math.min(...blk.lineIndices);
      const max = Math.max(...blk.lineIndices);
      if (lineIndex >= min && lineIndex <= max) return i;
    }
    return null;
  }
}
