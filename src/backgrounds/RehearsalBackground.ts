import type { SceneMap, SceneEntry } from '../services/idb.service';

export class RehearsalBackgroundManager {
  private imagePaths: string[];
  private interval: number;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private body: HTMLElement;
  private lastImageIndex: number = -1;
  private isActive: boolean = false;
  private _currentBlockIndex: number | null = null;
  private _boundHandler: ((e: Event) => void) | null = null;
  private _cache: Map<string, HTMLImageElement>;
  private _decoded: Map<string, boolean>;
  private _coverArtActive: boolean = false;  // TC-COVER-04
  private _coverIsDark: boolean = false;     // TC-COVER-04
  private _customBgActive: boolean = false;
  private _customBgUrl: string | null = null;
  private _sceneLayerA: HTMLDivElement;
  private _sceneLayerB: HTMLDivElement;
  private _activeSceneLayer: 'A' | 'B' = 'A';
  private _sceneMap: SceneMap = { blockScenes: new Map(), lineScenes: new Map() };
  private _lastSceneSwitch: number = 0;
  private readonly BLOCK_SWITCH_COOLDOWN = 300;
  private readonly LINE_SWITCH_COOLDOWN = 150;
  private _crossfadeTimer: ReturnType<typeof setTimeout> | null = null;
  private _lastSceneFingerprint: string = '';
  private _lastAppliedSceneUrl: string | null = null;

  private _createSceneDiv(id: string): HTMLDivElement {
    const div = document.createElement('div');
    div.id = id;
    Object.assign(div.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '-1',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      opacity: '0',
      transition: 'opacity 0.3s ease',
      pointerEvents: 'none',
    });
    return div;
  }

  constructor(imagePaths: string[], interval: number = 0) {
    this.imagePaths = imagePaths;
    this.interval = interval;
    this.body = document.body;
    this._cache = new Map();
    this._decoded = new Map();
    this._sceneLayerA = this._createSceneDiv('bg-scene-a');
    this._sceneLayerB = this._createSceneDiv('bg-scene-b');
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
    document.body.appendChild(this._sceneLayerA);
    document.body.appendChild(this._sceneLayerB);
    this.isActive = true;
    this._preloadAll();
    if (this._customBgUrl) {
      this.body.style.setProperty('background-image', `url('${this._customBgUrl}')`);
      this.body.style.setProperty('background-size', 'cover');
      this.body.style.setProperty('background-position', 'center');
      this.body.style.setProperty('background-repeat', 'no-repeat');
    } else {
      this._setBackground();
      if (this.interval && this.interval > 0 && this.imagePaths.length > 1) {
        this.timerId = setInterval(
          this._setBackground.bind(this), 
          this.interval
        );
      }
    }
  }

  stop(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.isActive = false;
    // Clear backgroundImage before revoke to prevent ERR_FILE_NOT_FOUND
    this._sceneLayerA.style.backgroundImage = '';
    this._sceneLayerB.style.backgroundImage = '';
    this._sceneLayerA.remove();
    this._sceneLayerB.remove();
    this._sceneMap = { blockScenes: new Map(), lineScenes: new Map() };
    this._currentBlockIndex = null;
    this._lastSceneFingerprint = '';
    this._lastAppliedSceneUrl = null;
    if (this._crossfadeTimer) {
      clearTimeout(this._crossfadeTimer);
      this._crossfadeTimer = null;
    }
    this.body.style.removeProperty('background-image');
    this.body.style.removeProperty('background');
    this.body.style.removeProperty('background-size');
    this.body.style.removeProperty('background-position');
    this.body.style.removeProperty('background-repeat');
    this.body.classList.remove('rehearsal-active');
    if (this._boundHandler) {
      document.removeEventListener('active-line-changed', this._boundHandler);
      this._boundHandler = null;
    }
  }

  private _setBackground(forcedIndex: number | null = null): void {
    if (!this.isActive) return;
    if (this._customBgUrl) return;
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
      if (this._coverArtActive) {
        const dimAlpha = this._customBgActive
          ? 0.80                              // stronger dim under custom bg
          : (this._coverIsDark ? 0.45 : 0.70); // original cover art dimming
        this.body.style.setProperty('background-image',
          `linear-gradient(rgba(0,0,0,${dimAlpha}), rgba(0,0,0,${dimAlpha})), url('${imagePath}')`);
      } else {
        this.body.style.setProperty('background-image', `url('${imagePath}')`);
      }
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

  setCustomBg(url: string | null): void {
    this._customBgUrl = url;
    if (url) {
      if (this.timerId) {
        clearInterval(this.timerId);
        this.timerId = null;
      }
      this.body.style.setProperty('background-image', `url('${url}')`);
      this.body.style.setProperty('background-size', 'cover');
      this.body.style.setProperty('background-position', 'center');
      this.body.style.setProperty('background-repeat', 'no-repeat');
    } else {
      this.body.style.removeProperty('background-size');
      this.body.style.removeProperty('background-position');
      this.body.style.removeProperty('background-repeat');
      this.lastImageIndex = -1;
      this._setBackground();
      if (this.interval && this.interval > 0 && this.imagePaths.length > 1) {
        this.timerId = setInterval(
          this._setBackground.bind(this),
          this.interval
        );
      }
    }
  }

  /**
   * Set mapping: blockIndex/lineIndex → scene Object URL
   * Called from useBackgroundManagers when scenes are loaded
   */
  setBlockSceneMap(sceneMap: SceneMap): void {
    const fingerprint = this._computeSceneFingerprint(sceneMap);
    const unchanged = fingerprint === this._lastSceneFingerprint;

    // Всегда обновляем _sceneMap (новые URLs для будущих _resolveSceneUrl)
    this._sceneMap = sceneMap;

    if (unchanged) {
      // Данные не изменились — обновляем URL активного слоя без crossfade
      if (this.isActive && this._currentBlockIndex !== null) {
        let lineIdxInBlock = 0;
        try {
          const ld = (window as any).lyricsDisplay;
          if (ld && typeof ld.currentLine === 'number') {
            const processedBlocks = (typeof ld._splitLargeBlocks === 'function')
              ? ld._splitLargeBlocks(ld.textBlocks)
              : ld.textBlocks;
            lineIdxInBlock = this._getLineIndexInBlock(processedBlocks, this._currentBlockIndex, ld.currentLine);
          }
        } catch (_) {}
        const entry = this._resolveSceneUrl(this._currentBlockIndex, lineIdxInBlock);
        if (entry?.url) {
          const activeLayer = this._activeSceneLayer === 'A' ? this._sceneLayerA : this._sceneLayerB;
          // Preload before applying — prevents broken image during decode
          const img = new Image();
          img.src = entry.url;
          const apply = () => {
            activeLayer.style.backgroundImage = `url('${entry.url}')`;
            this._lastAppliedSceneUrl = entry.url;
          };
          if (img.complete && img.naturalWidth > 0) {
            apply();
          } else {
            img.onload = apply;
            img.onerror = apply; // Apply anyway — better than stuck blank
          }
        }
      }
      return;
    }

    this._lastSceneFingerprint = fingerprint;

    // ── PROACTIVE APPLY ──
    let blockIndex: number | null = this._currentBlockIndex;
    let lineIdxInBlock: number = 0;

    if (blockIndex === null) {
      // Source: lyricsDisplay boundary shell
      try {
        const ld = (window as any).lyricsDisplay;
        if (ld && Array.isArray(ld.textBlocks) && ld.textBlocks.length > 0) {
          const currentLine = typeof ld.currentLine === 'number' ? ld.currentLine : 0;
          const processedBlocks = (typeof ld._splitLargeBlocks === 'function')
            ? ld._splitLargeBlocks(ld.textBlocks)
            : ld.textBlocks;
          blockIndex = this._getBlockIndexByLine(processedBlocks, currentLine);
          if (blockIndex !== null) {
            lineIdxInBlock = this._getLineIndexInBlock(processedBlocks, blockIndex, currentLine);
          }
        }
      } catch (_) {}

      // Fallback: block 0 (начало трека)
      if (blockIndex === null) {
        blockIndex = 0;
        lineIdxInBlock = 0;
      }
    } else {
      // Уже есть blockIndex — резолвим lineIdxInBlock
      try {
        const ld = (window as any).lyricsDisplay;
        if (ld && typeof ld.currentLine === 'number') {
          const processedBlocks = (typeof ld._splitLargeBlocks === 'function')
            ? ld._splitLargeBlocks(ld.textBlocks)
            : ld.textBlocks;
          lineIdxInBlock = this._getLineIndexInBlock(processedBlocks, blockIndex, ld.currentLine);
        }
      } catch (_) {}
    }

    // Сохраняем для будущих active-line-changed
    this._currentBlockIndex = blockIndex;

    // Применяем сцену (dedup guard внутри setBlockScene)
    const entry = this._resolveSceneUrl(blockIndex, lineIdxInBlock);
    this.setBlockScene(entry?.url || null);
  }

  clearAllScenes(): void {
    this._sceneMap = { blockScenes: new Map(), lineScenes: new Map() };
    this._sceneLayerA.style.opacity = '0';
    this._sceneLayerB.style.opacity = '0';
    this._sceneLayerA.style.backgroundImage = '';
    this._sceneLayerB.style.backgroundImage = '';
    this._lastSceneFingerprint = '';
    this._lastAppliedSceneUrl = null;
    this._currentBlockIndex = null;
  }

  /**
   * Crossfade to a block scene URL (or null = hide scene layer)
   */
  setBlockScene(url: string | null): void {
    if (!this.isActive) return;

    // Dedup guard — skip если уже показываем этот URL
    if (url === this._lastAppliedSceneUrl) return;

    if (url === null) {
      // Cleanup pending crossfade timer
      if (this._crossfadeTimer) {
        clearTimeout(this._crossfadeTimer);
        this._crossfadeTimer = null;
      }
      this._lastAppliedSceneUrl = null;
      this._sceneLayerA.style.opacity = '0';
      this._sceneLayerB.style.opacity = '0';
      return;
    }

    this._lastAppliedSceneUrl = url;

    const img = new Image();
    img.src = url;

    const doCrossfade = () => {
      const nextLayer = this._activeSceneLayer === 'A' ? this._sceneLayerB : this._sceneLayerA;
      const currentLayer = this._activeSceneLayer === 'A' ? this._sceneLayerA : this._sceneLayerB;

      nextLayer.style.backgroundImage = `url('${url}')`;
      nextLayer.style.opacity = '1';
      currentLayer.style.opacity = '0';

      if (this._crossfadeTimer) clearTimeout(this._crossfadeTimer);
      this._crossfadeTimer = setTimeout(() => this._swapLayers(), 700);

      nextLayer.addEventListener('transitionend', () => {
        if (this._crossfadeTimer) {
          clearTimeout(this._crossfadeTimer);
          this._crossfadeTimer = null;
        }
        this._swapLayers();
      }, { once: true });

      this._activeSceneLayer = this._activeSceneLayer === 'A' ? 'B' : 'A';
    };

    if (img.complete && img.naturalWidth > 0) {
      doCrossfade();
    } else {
      img.onload = () => doCrossfade();
      img.onerror = () => {
        console.warn('[RehearsalBg] Scene image failed to load:', url);
        doCrossfade();
      };
      setTimeout(() => doCrossfade(), 500);
    }
  }

  private _swapLayers(): void {
    this._crossfadeTimer = null;
    const prevLayer = this._activeSceneLayer === 'A' ? this._sceneLayerB : this._sceneLayerA;
    prevLayer.style.opacity = '0';
    prevLayer.style.backgroundImage = '';
  }

  private _computeSceneFingerprint(sceneMap: SceneMap): string {
    const blocks = [...sceneMap.blockScenes.entries()]
      .sort(([a], [b]) => a - b)
      .map(([k, v]) => `${k}:${v.theme?.primary ?? 'x'}:${v.theme?.accent ?? 'x'}`)
      .join(',');
    const lines = [...sceneMap.lineScenes.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v.theme?.primary ?? 'x'}:${v.theme?.accent ?? 'x'}`)
      .join(',');
    return `${blocks}|${lines}`;
  }

  // TC-COVER-04: Update dimming when cover art state changes
  setCoverArtState(active: boolean, isDark?: boolean, hasCustomBg?: boolean): void {
    const wasActive = this._coverArtActive;
    const prevCustomBg = this._customBgActive;
    if (this._coverArtActive === active && this._coverIsDark === !!isDark && this._customBgActive === !!hasCustomBg) return;
    this._coverArtActive = active;
    this._coverIsDark = !!isDark;
    this._customBgActive = !!hasCustomBg;
    if ((active && !wasActive) || (!!hasCustomBg && !prevCustomBg)) {
      this.lastImageIndex = -1;
    }
    this._setBackground();
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
        const ld = (window as any).lyricsDisplay || lyricsDisplay;
        if (!ld || !Array.isArray(ld.textBlocks) || ld.textBlocks.length === 0) {
          return;
        }
        if (blockLoopControl && 
            (blockLoopControl.isLooping || blockLoopControl.isSeekingInProgress)) {
          return;
        }
        const lineIndex = (e as CustomEvent).detail?.lineIndex;
        if (typeof lineIndex !== 'number') return;
        const processedBlocks = (typeof ld._splitLargeBlocks === 'function')
          ? ld._splitLargeBlocks(ld.textBlocks || [])
          : (ld.textBlocks || []);
        const newBlockIndex = this._getBlockIndexByLine(processedBlocks, lineIndex);
        if (newBlockIndex === null) return;
        if (this._currentBlockIndex === null) {
          this._currentBlockIndex = newBlockIndex;
          return;
        }
        // Compute line index within block for scene lookup
        const lineIdxInBlock = this._getLineIndexInBlock(processedBlocks, newBlockIndex, lineIndex);
        const sceneEntry = this._resolveSceneUrl(newBlockIndex, lineIdxInBlock);

        // Determine cooldown based on transition type
        const blockChanged = newBlockIndex !== this._currentBlockIndex;
        const now = Date.now();
        const cooldown = blockChanged ? this.BLOCK_SWITCH_COOLDOWN : this.LINE_SWITCH_COOLDOWN;
        if (sceneEntry && now - this._lastSceneSwitch < cooldown) {
          // Cooldown — still update block tracking but skip scene switch
          this._currentBlockIndex = newBlockIndex;
          return;
        }
        this._lastSceneSwitch = now;

        this._currentBlockIndex = newBlockIndex;

        // Pexels slideshow (block-based cycling)
        if (blockChanged) {
          const imgIndex = newBlockIndex % this.imagePaths.length;
          this._setBackground(imgIndex);
        }

        // Scene transition
        this.setBlockScene(sceneEntry?.url || null);

        // Lookahead: prefetch next line
        this._prefetchNextLine(newBlockIndex, lineIdxInBlock, processedBlocks);
      } catch (_) {}
    };
    document.addEventListener('active-line-changed', this._boundHandler);
    try {
      const ldInit = (window as any).lyricsDisplay || lyricsDisplay;
      if (ldInit && 
          Array.isArray(ldInit.textBlocks) && 
          ldInit.textBlocks.length > 0) {
        const currentLine = typeof ldInit.currentLine === 'number' 
          ? ldInit.currentLine 
          : 0;
        const processedBlocks = (typeof ldInit._splitLargeBlocks === 'function')
          ? ldInit._splitLargeBlocks(ldInit.textBlocks || [])
          : (ldInit.textBlocks || []);
        this._currentBlockIndex = this._getBlockIndexByLine(processedBlocks, currentLine);
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

  private _getLineIndexInBlock(blocks: any[], blockIndex: number, globalLineIndex: number): number {
    const block = blocks[blockIndex];
    if (!block?.lineIndices) return -1;
    return block.lineIndices.indexOf(globalLineIndex);
  }

  private _resolveSceneUrl(blockIndex: number, lineIdxInBlock: number): SceneEntry | null {
    // 1. Line-level (priority)
    if (lineIdxInBlock >= 0) {
      const lineKey = `${blockIndex}_${lineIdxInBlock}`;
      const lineEntry = this._sceneMap.lineScenes.get(lineKey);
      if (lineEntry) return lineEntry;
    }
    // 2. Block-level (fallback)
    return this._sceneMap.blockScenes.get(blockIndex) || null;
  }

  private _prefetchNextLine(blockIndex: number, currentLineIdx: number, blocks: any[]): void {
    const block = blocks[blockIndex];
    if (!block?.lineIndices) return;
    const nextIdx = currentLineIdx + 1;
    if (nextIdx >= block.lineIndices.length) return;
    const entry = this._resolveSceneUrl(blockIndex, nextIdx);
    if (entry) {
      const img = new Image();
      img.src = entry.url;
    }
  }
}
