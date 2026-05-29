import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useBlockSceneStore } from '../stores/blockScene.store';
import { useTrackStore } from '../stores/track.store';
import { useBlocksStore } from '../stores/blocks.store';
import { useLyricsStore } from '../stores/lyrics.store';
import {
  getBlockScenes,
  getBlockSceneBlob,
  uploadBlockScene,
  uploadLineScene,
  deleteBlockScene,
} from '../services/block-scene.service';
import type { BlockSceneMeta } from '../services/idb.service';
import { resizeImage } from '../utils/image-resize';
import { extractThemeFromBlob } from '../services/cover-art.service';
import { updateTrackField } from '../services/idb.service';
import type { CoverArtTheme } from '../types/cover-theme.types';
import { createSubBlocks } from '../utils/block-utils';
import { MAX_SUB_BLOCK_LINES } from '../slot-matrix/slot-matrix.utils';
import styles from './BlockScenesModal.module.css';

type Tab = 'scenes' | 'custom';

export function BlockScenesModal() {
  const isOpen = useBlockSceneStore((s) => s.isOpen);
  const setOpen = useBlockSceneStore((s) => s.setOpen);
  const selectedBlockIndex = useBlockSceneStore((s) => s.selectedBlockIndex);
  const setSelectedBlockIndex = useBlockSceneStore((s) => s.setSelectedBlockIndex);
  const selectedLineIndex = useBlockSceneStore((s) => s.selectedLineIndex);
  const setSelectedLineIndex = useBlockSceneStore((s) => s.setSelectedLineIndex);

  const currentTrack = useTrackStore((s) => s.currentTrack);
  const customBgUrl = useTrackStore((s) => s.currentTrack?.customBgUrl) || null;
  const textBlocks = useBlocksStore((s) => s.blocks);
  const lyricsLines = useLyricsStore((s) => s.lines);
  const activeLineIndex = useLyricsStore((s) => s.activeLineIndex);

  const [tab, setTab] = useState<Tab>('scenes');
  const [scenes, setScenes] = useState<BlockSceneMeta[]>([]);
  const [previewUrls, setPreviewUrls] = useState<Map<string, string>>(new Map());
  const [customPreview, setCustomPreview] = useState<string | null>(customBgUrl);

  const sceneInputRef = useRef<HTMLInputElement>(null);
  const lineInputRef = useRef<HTMLInputElement>(null);
  const customInputRef = useRef<HTMLInputElement>(null);

  const trackId = currentTrack?.id ? Number(currentTrack.id) : null;

  const blocks = (textBlocks || []).map((b: any, i: number) => ({
    index: i,
    id: b.id || `block-${i}`,
    type: b.type || 'verse',
    label: b.type || `Block ${i + 1}`,
    lineIndices: b.lineIndices || [],
    lineCount: (b.lineIndices || []).length,
  }));

  // ── Derived maps from scenes ──
  const lineSceneMap = useMemo(() => {
    const map = new Map<string, BlockSceneMeta>();
    scenes.forEach(s => {
      if (s.lineIndex != null) map.set(`${s.blockIndex}_${s.lineIndex}`, s);
    });
    return map;
  }, [scenes]);

  const blockSceneMap = useMemo(() => {
    const map = new Map<number, BlockSceneMeta>();
    scenes.forEach(s => {
      if (s.lineIndex == null) map.set(s.blockIndex, s);
    });
    return map;
  }, [scenes]);

  // ── Preview URL lifecycle ──
  const previewUrlsRef = useRef<Map<string, string>>(new Map());

  const revokeOldUrls = useCallback(() => {
    previewUrlsRef.current.forEach((url) => { try { URL.revokeObjectURL(url); } catch (_) {} });
    previewUrlsRef.current = new Map();
  }, []);

  const loadScenes = useCallback(async () => {
    if (!trackId) return;
    try {
      const sceneList = await getBlockScenes(trackId);
      setScenes(sceneList);
      revokeOldUrls();
      const urls = new Map<string, string>();
      for (const scene of sceneList) {
        const blob = await getBlockSceneBlob(scene.id);
        if (blob) {
          const url = URL.createObjectURL(blob);
          previewUrlsRef.current.set(scene.id, url);
          urls.set(scene.id, url);
        }
      }
      setPreviewUrls(urls);
    } catch (e) {
      console.warn('[BackgroundModal] Load failed:', e);
    }
  }, [trackId, revokeOldUrls]);

  useEffect(() => {
    if (isOpen) {
      loadScenes();
      setCustomPreview(customBgUrl);
      setTab('scenes');
      setSelectedBlockIndex(null);
      setSelectedLineIndex(null);
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => { try { URL.revokeObjectURL(url); } catch (_) {} });
    };
  }, []);

  if (!isOpen) return null;

  const getBlockColor = (type: string): string => {
    const colors: Record<string, string> = {
      verse: '#4CAF50',
      chorus: '#F44336',
      bridge: '#9C27B0',
      intro: '#2196F3',
      outro: '#00BCD4',
      prechorus: '#FFEB3B',
      'pre-chorus': '#FFEB3B',
    };
    return colors[type] || '#6b7280';
  };

  const handleBlockHeaderClick = (blockIndex: number) => {
    setSelectedBlockIndex(blockIndex);
    setSelectedLineIndex(null);
    if (!blockSceneMap.has(blockIndex)) {
      sceneInputRef.current?.click();
    }
  };

  const handleLineClick = (blockIndex: number, localLineIndex: number) => {
    setSelectedBlockIndex(blockIndex);
    setSelectedLineIndex(localLineIndex);
    const lineKey = `${blockIndex}_${localLineIndex}`;
    if (!lineSceneMap.has(lineKey)) {
      lineInputRef.current?.click();
    }
  };

  const handleSceneUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !trackId || selectedBlockIndex === null) return;
    e.target.value = '';
    try {
      const block = blocks[selectedBlockIndex];
      await uploadBlockScene(trackId, selectedBlockIndex, file, block?.id);
      await loadScenes();
      document.dispatchEvent(new CustomEvent('tracks-changed'));
    } catch (err) {
      console.error('[BackgroundModal] Upload failed:', err);
    }
  };

  // === LINE-LEVEL UPLOAD ===
  const handleLineUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !trackId || selectedBlockIndex === null || selectedLineIndex === null) return;
    e.target.value = '';
    try {
      const block = blocks[selectedBlockIndex];
      await uploadLineScene(trackId, selectedBlockIndex, selectedLineIndex, file, block?.id);
      await loadScenes();
      document.dispatchEvent(new CustomEvent('tracks-changed'));
    } catch (err) {
      console.error('[BackgroundModal] Line upload failed:', err);
    }
  };

  const handleRemoveBlockScenes = async (blockIndex: number) => {
    if (!trackId) return;
    try {
      const blockScenesToRemove = scenes.filter(s => s.blockIndex === blockIndex);
      for (const scene of blockScenesToRemove) {
        await deleteBlockScene(scene.id);
      }
      await loadScenes();
      if (selectedBlockIndex === blockIndex) {
        setSelectedLineIndex(null);
      }
      document.dispatchEvent(new CustomEvent('tracks-changed'));
    } catch (err) {
      console.error('[BackgroundModal] Block scenes remove failed:', err);
    }
  };

  const handleInlineLineRemove = async (blockIndex: number, localLineIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!trackId) return;
    const lineKey = `${blockIndex}_${localLineIndex}`;
    const scene = lineSceneMap.get(lineKey);
    if (!scene) return;
    try {
      await deleteBlockScene(scene.id);
      await loadScenes();
      if (selectedBlockIndex === blockIndex && selectedLineIndex === localLineIndex) {
        setSelectedLineIndex(null);
      }
      document.dispatchEvent(new CustomEvent('tracks-changed'));
    } catch (err) {
      console.error('[BackgroundModal] Inline line remove failed:', err);
    }
  };

  const handleCustomUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !trackId) return;
    e.target.value = '';
    try {
      const resized = await resizeImage(file);
      let theme: CoverArtTheme | null = null;
      try { theme = await extractThemeFromBlob(resized); } catch (_) {}
      await updateTrackField(trackId, { customBgBlob: resized, customBgTheme: theme });
      setCustomPreview(URL.createObjectURL(resized));
      document.dispatchEvent(new CustomEvent('tracks-changed'));
    } catch (err) {
      console.error('[BackgroundModal] Custom upload failed:', err);
    }
  };

  const handleCustomRemove = async () => {
    if (!trackId) return;
    try {
      await updateTrackField(trackId, { customBgBlob: null, customBgTheme: null });
      setCustomPreview(null);
      document.dispatchEvent(new CustomEvent('tracks-changed'));
    } catch (err) {
      console.error('[BackgroundModal] Custom remove failed:', err);
    }
  };

  return (
    <div className={styles.overlay} onClick={() => setOpen(false)}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Minimal top bar: tabs + close */}
        <div className={styles.topBar}>
          <div className={styles.tabs}>
            <button className={tab === 'scenes' ? styles.tabActive : styles.tab} onClick={() => setTab('scenes')}>
              Scenes
            </button>
            <button className={tab === 'custom' ? styles.tabActive : styles.tab} onClick={() => setTab('custom')}>
              Custom
            </button>
          </div>
          <button className={styles.closeBtn} onClick={() => setOpen(false)}>Done</button>
        </div>

        {tab === 'scenes' && (
          <>
            {blocks.length === 0 ? (
              <div className={styles.emptyState}>No blocks found. Add blocks in the Block Editor first.</div>
            ) : (
              <div className={styles.trackMap}>
                {blocks.map((block) => {
                  const blockScene = blockSceneMap.get(block.index);
                  const blockPreview = blockScene ? previewUrls.get(blockScene.id) : null;
                  const isBlockSelected = selectedBlockIndex === block.index && selectedLineIndex === null;
                  const isActiveBlock = activeLineIndex >= 0 && block.lineIndices.includes(activeLineIndex);
                  const blockHasScenes = !!blockScene || scenes.some(s => s.blockIndex === block.index && s.lineIndex != null);
                  const blockColor = getBlockColor(block.type);

                  // Sub-blocks like TrackMap
                  const subBlocks = createSubBlocks(block.lineIndices, MAX_SUB_BLOCK_LINES, lyricsLines);

                  return (
                    <div
                      key={block.index}
                      className={`${styles.blockColumn} ${isBlockSelected ? styles.blockColumnSelected : ''} ${isActiveBlock ? styles.blockColumnActive : ''}`}
                      style={{ '--block-color': blockColor } as React.CSSProperties}
                    >
                      <div
                        className={`${styles.columnHeader} ${blockPreview ? styles.columnHeaderFilled : ''}`}
                        style={blockPreview ? { backgroundImage: `url(${blockPreview})` } : {}}
                        onClick={() => handleBlockHeaderClick(block.index)}
                      >
                        <span className={styles.columnName}>{block.label}<span className={styles.headerCount}> · {block.lineCount}</span></span>
                        {!blockPreview && <span className={styles.headerPlus}>+</span>}
                        {blockHasScenes && (
                          <button
                            className={styles.headerTrash}
                            onClick={(e) => { e.stopPropagation(); handleRemoveBlockScenes(block.index); }}
                            title="Remove all scenes from this block"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      <div className={styles.subBlocksRow}>
                        {subBlocks.map((sub, subIdx) => {
                          // Compute localLineIndex offset for this sub-block
                          const subOffset = subBlocks.slice(0, subIdx).reduce((acc, s) => acc + s.lineIndices.length, 0);

                          return (
                            <div key={sub.id} className={`${styles.subBlock}${subIdx > 0 ? ' ' + styles.subBlockDivided : ''}`} style={{ '--sub-lines': sub.lineIndices.length } as React.CSSProperties}>
                                {sub.lineIndices.map((_: number, i: number) => {
                                  const localIdx = subOffset + i;
                                  const lineKey = `${block.index}_${localIdx}`;
                                  const lineScene = lineSceneMap.get(lineKey);
                                  const linePreview = lineScene ? previewUrls.get(lineScene.id) : null;
                                  const isLineSelected = selectedLineIndex === localIdx && selectedBlockIndex === block.index;

                                  return (
                                    <div
                                      key={localIdx}
                                      className={`${styles.cell} ${isLineSelected ? styles.cellSelected : ''} ${linePreview ? styles.cellFilled : ''}`}
                                      style={linePreview ? { backgroundImage: `url(${linePreview})` } : {}}
                                      onClick={() => handleLineClick(block.index, localIdx)}
                                      data-lyric={lyricsLines[block.lineIndices[localIdx]] || undefined}
                                    >
                                      <span className={styles.cellNum}>{localIdx + 1}</span>
                                      {linePreview && (
                                        <button
                                          className={styles.cellRemove}
                                          onClick={(e) => handleInlineLineRemove(block.index, localIdx, e)}
                                          title="Remove scene"
                                        >
                                          ×
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </>
        )}

        {tab === 'custom' && (
          <div className={styles.customSection}>
            <div
              className={styles.customPreview}
              style={customPreview ? { backgroundImage: `url(${customPreview})` } : {}}
              onClick={() => customInputRef.current?.click()}
            >
              {!customPreview && <span className={styles.customPlus}>+</span>}
            </div>
            <div className={styles.customActions}>
              <button className={styles.actionBtn} onClick={() => customInputRef.current?.click()}>
                {customPreview ? 'Replace' : 'Upload'}
              </button>
              {customPreview && (
                <button className={styles.actionBtnDanger} onClick={handleCustomRemove}>Remove</button>
              )}
            </div>
          </div>
        )}

        <input ref={sceneInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleSceneUpload} />
        <input ref={lineInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLineUpload} />
        <input ref={customInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleCustomUpload} />
      </div>
    </div>
  );
}
