/**
 * Block Scene Service (Wave 2)
 * Manages per-block background images stored in beLive_scenes IDB
 * 
 * Priority: Block Scene > Global Custom BG > Cover Art > Pexels
 * 
 * Lifecycle:
 *   - User uploads → resizeImage → extractThemeFromBlob → IDB save
 *   - Track load → event-driven preload → Map<blockIndex, ObjectURL>
 *   - Block change → lookup map → crossfade on scene div
 *   - Track switch → revoke URLs → reload
 */

import {
  getScenesForTrack,
  getSceneBlob,
  saveScene as idbSaveScene,
  deleteScene as idbDeleteScene,
  clearScenesForTrack as idbClearScenes,
  getScenesCountForTrack,
} from './idb.service';
import type { BlockScene, BlockSceneMeta, SceneMap, SceneEntry } from './idb.service';
import { resizeImage } from '../utils/image-resize';
import { extractThemeFromBlob } from './cover-art.service';
import { checkBgStorageQuota, isWithinBgLimit, MAX_BG_PER_TRACK } from '../utils/storage-quota';
import { useTrackStore } from '../stores/track.store';
import type { CoverArtTheme } from '../types/cover-theme.types';

// ── Object URL lifecycle ──────────────────────────────────

const _sceneObjectUrls = new Set<string>();

function revokeAllSceneUrls(): void {
  _sceneObjectUrls.forEach(url => {
    try { URL.revokeObjectURL(url); } catch (_) {}
  });
  _sceneObjectUrls.clear();
}

// ── Scene CRUD ────────────────────────────────────────────

/**
 * Get metadata for all scenes of a track (no blobs)
 */
export async function getBlockScenes(trackId: number): Promise<BlockSceneMeta[]> {
  return getScenesForTrack(trackId);
}

/**
 * Get blob for a specific scene (lazy load)
 */
export async function getBlockSceneBlob(sceneId: string): Promise<Blob | null> {
  return getSceneBlob(sceneId);
}

/**
 * Upload and save a scene for a specific block
 * Returns the saved scene metadata, or null if quota exceeded
 */
export async function uploadBlockScene(
  trackId: number,
  blockIndex: number,
  file: File | Blob,
  blockId?: string,
  lineIndex?: number | null,
): Promise<BlockSceneMeta | null> {
  // 1. Check storage quota
  const quota = await checkBgStorageQuota();
  if (!quota.allowed) {
    console.warn('[BlockScene] Storage quota exceeded:', quota.reason);
    return null;
  }

  // 2. Check per-track limit
  const currentCount = await getScenesCountForTrack(trackId);
  if (!isWithinBgLimit(currentCount)) {
    console.warn(`[BlockScene] Max ${MAX_BG_PER_TRACK} backgrounds per track reached`);
    return null;
  }

  // 3. Resize image
  const resized = await resizeImage(file);

  // 4. Extract color theme
  let theme: CoverArtTheme | null = null;
  try {
    theme = await extractThemeFromBlob(resized);
  } catch (e) {
    console.warn('[BlockScene] Theme extraction failed:', e);
  }

  // 5. Save to IDB
  const id = lineIndex != null
    ? `${trackId}_${blockIndex}_${lineIndex}`
    : `${trackId}_${blockIndex}`;
  const scene: BlockScene = {
    id,
    trackId,
    blockIndex,
    lineIndex: lineIndex ?? null,
    blockId,
    blob: resized,
    theme: theme || {
      coverUrl: '',
      primary: '#6366f1',
      secondary: '#3b82f6',
      accent: '#f59e0b',
      isDark: true,
      text: '#ffffff',
    },
    addedAt: new Date().toISOString(),
  };

  await idbSaveScene(scene);

  console.log(`[BlockScene] Saved: trackId=${trackId} block=${blockIndex} id=${id}`);

  // Return metadata (without blob)
  const { blob: _, ...meta } = scene;
  return meta as BlockSceneMeta;
}

/**
 * Upload a line-level scene for a specific line within a block
 */
export async function uploadLineScene(
  trackId: number,
  blockIndex: number,
  lineIndex: number,
  file: File | Blob,
  blockId?: string,
): Promise<BlockSceneMeta | null> {
  return uploadBlockScene(trackId, blockIndex, file, blockId, lineIndex);
}

/**
 * Get line-level scenes for a specific block
 * Returns only scenes where lineIndex is not null
 */
export async function getLineScenesForBlock(
  trackId: number,
  blockIndex: number,
): Promise<BlockSceneMeta[]> {
  const all = await getScenesForTrack(trackId);
  return all.filter(s => s.blockIndex === blockIndex && s.lineIndex != null);
}

/**
 * Delete a specific scene
 */
export async function deleteBlockScene(sceneId: string): Promise<void> {
  await idbDeleteScene(sceneId);
  console.log(`[BlockScene] Deleted: ${sceneId}`);
}

/**
 * Clear all scenes for a track
 */
export async function clearAllBlockScenes(trackId: number): Promise<void> {
  await idbClearScenes(trackId);
  revokeAllSceneUrls();
  console.log(`[BlockScene] Cleared all for trackId=${trackId}`);
}

// ── Preload & Object URLs ────────────────────────────────

/**
 * Preload all scenes for a track → returns Map<blockIndex, ObjectURL>
 * Called on track-loaded event (NOT from orchestrator)
 */
export async function preloadScenesForTrack(trackId: number): Promise<SceneMap> {
  // Revoke previous URLs
  revokeAllSceneUrls();

  const scenes = await getScenesForTrack(trackId);
  if (scenes.length === 0) return { blockScenes: new Map(), lineScenes: new Map() };

  const blockScenes = new Map<number, SceneEntry>();
  const lineScenes = new Map<string, SceneEntry>();

  for (const scene of scenes) {
    const blob = await getSceneBlob(scene.id);
    if (!blob) continue;

    const url = URL.createObjectURL(blob);
    _sceneObjectUrls.add(url);

    const entry: SceneEntry = { url, theme: scene.theme };

    if (scene.lineIndex != null) {
      const key = `${scene.blockIndex}_${scene.lineIndex}`;
      lineScenes.set(key, entry);
    } else {
      blockScenes.set(scene.blockIndex, entry);
    }
  }

  console.log(`[BlockScene] Preloaded ${blockScenes.size} block + ${lineScenes.size} line scenes for trackId=${trackId}`);
  return { blockScenes, lineScenes };
}

/**
 * Revoke all scene Object URLs (e.g. on track change)
 */
export function revokeAllScenes(): void {
  revokeAllSceneUrls();
}

// ── Event-driven preload ─────────────────────────────────

/**
 * Initialize block scene preload on track-loaded events
 * Returns cleanup function
 */
export function initBlockScenePreload(): () => void {
  let _lastPreloadedTrackId: number | null = null;
  let _preloadInProgress = false;

  const doPreload = async () => {
    const trackId = useTrackStore.getState().currentTrack?.id;
    if (!trackId) return;
    const numId = Number(trackId);
    if (_lastPreloadedTrackId === numId || _preloadInProgress) return;
    _preloadInProgress = true;
    try {
      const sceneMap = await preloadScenesForTrack(numId);
      _lastPreloadedTrackId = numId;
      const sceneCount = sceneMap.blockScenes.size + sceneMap.lineScenes.size;
      console.log(`[BlockScene] Preloaded ${sceneMap.blockScenes.size} block + ${sceneMap.lineScenes.size} line scenes for trackId=${numId}`);
      document.dispatchEvent(new CustomEvent('block-scenes-loaded', {
        detail: { trackId: numId, sceneCount, sceneMap },
      }));
    } catch (e) {
      console.warn('[BlockScene] Preload failed:', e);
    } finally {
      _preloadInProgress = false;
    }
  };

  const onTrackLoaded = () => { _lastPreloadedTrackId = null; doPreload(); };
  const onBeforeTrackChange = () => { _lastPreloadedTrackId = null; revokeAllScenes(); };

  document.addEventListener('track-loaded', onTrackLoaded);
  document.addEventListener('before-track-change', onBeforeTrackChange);

  // Eager preload if track already loaded
  doPreload();

  return () => {
    document.removeEventListener('track-loaded', onTrackLoaded);
    document.removeEventListener('before-track-change', onBeforeTrackChange);
    revokeAllScenes();
  };
}

// ── Has scenes check ─────────────────────────────────────

/**
 * Check if a track has any block scenes (lightweight — metadata only)
 */
export async function hasBlockScenes(trackId: number): Promise<boolean> {
  const scenes = await getScenesForTrack(trackId);
  return scenes.length > 0;
}
