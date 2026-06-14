/**
 * Upload Service — stateless upload helpers
 * F58-TC-002: Exact port from catalog-v2.js handleFileSelect + utilities
 * F59: Module-level uploadSession = source of truth
 */

import { buildLineMap } from '../sync/word-sync/line-map.builder';
import type { PersistedTextBlock, PersistedSyncMarker } from '../types/persistence.types';
import { isPersistedSyncMarkerArray, isPersistedTextBlockArray } from '../types/persistence.types';
import type { AlignmentResult } from '../sync/word-sync/types';
import type { StemDataEntry } from './idb.service';
import { fetchCoverArtAndUpdate } from './cover-art.service';
import { parseLrcString, lrcToMarkers } from './auto-lyrics.service';
import { useTrackStore } from '../stores/track.store';
import { loadTrack } from './track.actions';

// W6.2: Stem classification keywords (filename substring → stem slot)
// Instrumental is NEVER matched here — it's the file with NO stem keyword
// (because instrumentals are named after the track, not after a stem type)
const STEM_CLASSIFICATION_KEYWORDS: Readonly<Record<string, string[]>> = {
  vocals:  ['_vocals_', '_vocal', 'vocals', 'vocal', '_vox_', ' vox', 'lead_vox', 'lead_vocal'],
  drums:   ['drums', 'drum', 'drm'],
  bass:    ['bass', 'bass_'],
  keys:    ['keys', 'key_', '_key', 'piano', 'kys', 'synth'],
  guitar:  ['guitar', 'gtr', 'guit'],
  backing: ['back_voc', 'bgvoc', 'bvoc', 'backing_vocal', '_bv', 'bv_', 'back_vox', 'backing'],
  other:   ['_other_', '_other.', 'other_[mvsep', 'other'],  // W9-UX-005: Include bare 'other' for re-import
};

// Backing vocal patterns — if matched, it's NOT lead vocal even if 'vocal' substring present
const BACKING_VOCAL_PATTERNS = ['back_voc', 'bgvoc', 'bvoc', 'backing_vocal', '_bv', 'bv_', 'back_vox'];

/** Classify a filename into a stem slot using keyword matching. Returns null = instrumental */
export function classifyStemFromFilename(baseName: string): string | null {
  const lower = baseName.toLowerCase();

  // Check backing vocal FIRST — if matched, it's backing stem, not lead vocal
  const isBackingVocal = BACKING_VOCAL_PATTERNS.some(p => lower.includes(p));
  if (isBackingVocal) return 'backing';

  // Check all stem slots (including 'vocals')
  for (const [stemId, keywords] of Object.entries(STEM_CLASSIFICATION_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return stemId;
    }
  }
  return null; // No keyword match = instrumental
}

// Upload session types
export interface UploadSession {
  instrumental: File | null;
  vocal: File | null;
  lyrics: File | null;
  json: File | null;
  zip: File | null;
  parsedLyricsContent: string | null;
  jsonMarkers: PersistedSyncMarker[] | null;
  jsonTextBlocks: PersistedTextBlock[] | null;
  alignmentArtifact?: { name: string; data: AlignmentResult } | null;
  lyricsHash?: string | null;
  /** TC-COVER-01: Cover art URL restored from ZIP export */
  coverArtUrl?: string | null;
  /** TC-COVER-06: Cover art blob from ZIP for offline use */
  coverArtBlob?: Blob | null;
  /** TC-CBG-08: Custom background blob from ZIP */
  customBgBlob?: Blob;
  /** TC-COVER-01: Cover theme restored from ZIP export */
  coverTheme?: import('../types/cover-theme.types').CoverArtTheme | null;
  /** TC-LRC-05: Original lyrics with structural tags for LRC Picker */
  lyricsOriginalContent?: string | null;
  /** W6: Additional stems from ZIP (drums, bass, keys, etc.) */
  additionalStems?: Record<string, File> | null;
  /** W7: Override track title from ZIP filename (mvsep bundles) */
  overrideTitle?: string | null;
  /** TC-29-09: Block scenes metadata from ZIP export.json */
  jsonScenes?: Array<{
    blockIndex: number;
    lineIndex: number | null;
    blockId?: string;
    file: string;
    theme: import('../types/cover-theme.types').CoverArtTheme;
  }> | null;
}

function createFreshSession(): UploadSession {
  return {
    instrumental: null,
    vocal: null,
    lyrics: null,
    json: null,
    zip: null,
    parsedLyricsContent: null,
    jsonMarkers: null,
    jsonTextBlocks: null,
    additionalStems: null,  // W6: Initialize additional stems
    overrideTitle: null,  // W7: Initialize override title
  };
}

let uploadSession: UploadSession = createFreshSession();

function detachUploadSession(): UploadSession {
  const old = uploadSession;
  uploadSession = createFreshSession();
  return old;
}

// Upload file types
export type UploadFileType = 'instrumental' | 'vocal' | 'lyrics' | 'json' | 'zip';

/**
 * Read file as text
 */
export async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
}

/**
 * Read file as ArrayBuffer
 */
export async function readFileAsArrayBuffer(file: File, onProgress?: (pct: number) => void): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
    reader.onerror = (e) => reject(e);
    reader.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Get base name from path
 */
export function getBaseNameFromPath(fullPath: string): string {
  if (!fullPath) return '';
  const lastSlashIndex = fullPath.lastIndexOf('/');
  return lastSlashIndex !== -1 ? fullPath.substring(lastSlashIndex + 1) : fullPath;
}

/**
 * Get file name without extension
 */
export function getFileNameWithoutExtension(fileName: string): string {
  if (!fileName) return '';
  const baseName = getBaseNameFromPath(fileName);
  const lastDotIndex = baseName.lastIndexOf('.');
  return lastDotIndex !== -1 ? baseName.substring(0, lastDotIndex) : baseName;
}

/**
 * Get file extension
 */
export function getFileExtension(fileName: string): string {
  if (!fileName) return '';
  const baseName = getBaseNameFromPath(fileName);
  const lastDotIndex = baseName.lastIndexOf('.');
  return lastDotIndex !== -1 ? baseName.substring(lastDotIndex + 1) : '';
}

/**
 * Check if file is an alignment artifact
 * Matches: alignment.json, *-alignment.json
 */
function isAlignmentFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  const baseName = getBaseNameFromPath(lower);
  return baseName === 'alignment.json' || baseName.endsWith('-alignment.json');
}

/**
 * Validate alignment artifact shape
 * Expected: { lines: Array, source: string, version: number }
 */
function isValidAlignmentArtifact(data: any): data is AlignmentResult {
  if (!data || typeof data !== 'object') return false;
  const hasLines = Array.isArray(data.lines);
  const hasSource = typeof data.source === 'string';
  const hasVersion = typeof data.version === 'number';
  return hasLines && hasSource && hasVersion;
}

/**
 * Show notification via window.showAppNotification
 */
export function showNotification(type: 'info' | 'success' | 'error', message: string): void {
  const w = window as any;
  if (w.showAppNotification) {
    w.showAppNotification(message, type);
  }
}

/**
 * Handle file selection — stateless, stores in uploadSession
 */
export async function handleFileSelect(
  type: UploadFileType,
  file: File,
  _fromZip = false
): Promise<void> {
  switch (type) {
    case 'instrumental':
      uploadSession.instrumental = file;
      showNotification('info', `Инструментал ${file.name} загружен.`);
      break;

    case 'vocal':
      uploadSession.vocal = file;
      showNotification('info', `Вокал ${file.name} загружен.`);
      break;

    case 'lyrics':
      uploadSession.lyrics = file;
      const isRtf = file.name.toLowerCase().endsWith('.rtf') || file.type === 'application/rtf';
      try {
        const rawText = await readFileAsText(file);
        let processedText = rawText;
        if (isRtf) {
          try {
            const rtfService = (window as any).rtfService;
            if (rtfService?.parseRtf) {
              processedText = await rtfService.parseRtf(rawText);
              if (!processedText) {
                console.warn('UploadService: RTF parser returned empty content. Using raw text as fallback.');
                processedText = rawText;
              }
            }
          } catch (e) {
            console.error('UploadService: RTF parsing error, using raw text. Error:', e);
            processedText = rawText;
          }
        }
        uploadSession.parsedLyricsContent = processedText;
      } catch (e) {
        console.error('UploadService: Error reading lyrics file:', e);
        showNotification('error', '❌ Ошибка чтения файла лирики');
        uploadSession.lyrics = null;
        uploadSession.parsedLyricsContent = null;
      }
      break;

    case 'json':
      // Guard: skip alignment files - they are handled separately in ZIP processing
      if (isAlignmentFile(file.name)) {
        console.log('UploadService: Skipping alignment file in handleFileSelect:', file.name);
        break;
      }
      uploadSession.json = file;
      try {
        const text = await readFileAsText(file);
        const data = JSON.parse(text);
        if (Array.isArray(data)) {
          // Validate markers array shape
          if (isPersistedSyncMarkerArray(data)) {
            uploadSession.jsonMarkers = data;
            uploadSession.jsonTextBlocks = [];
          } else {
            showNotification('error', '❌ JSON массив содержит некорректные маркеры');
            uploadSession.jsonMarkers = null;
            uploadSession.jsonTextBlocks = null;
          }
        } else if (data && Array.isArray(data.markers)) {
          // Validate markers array shape
          if (!isPersistedSyncMarkerArray(data.markers)) {
            showNotification('error', '❌ JSON поле markers содержит некорректные маркеры');
            uploadSession.jsonMarkers = null;
            uploadSession.jsonTextBlocks = null;
            break;
          }
          uploadSession.jsonMarkers = data.markers;
          
          // Validate textBlocks array shape if present
          if (data.textBlocks && Array.isArray(data.textBlocks)) {
            if (!isPersistedTextBlockArray(data.textBlocks)) {
              showNotification('error', '❌ JSON поле textBlocks содержит некорректные блоки');
              uploadSession.jsonTextBlocks = null;
              break;
            }
            uploadSession.jsonTextBlocks = data.textBlocks;
          } else {
            uploadSession.jsonTextBlocks = [];
          }
          // Extract lyricsHash for roundtrip word-sync compatibility
          if (data.lyricsHash && typeof data.lyricsHash === 'string') {
            uploadSession.lyricsHash = data.lyricsHash;
            if (import.meta.env.DEV) console.log('[Upload] lyricsHash extracted from export.json:', data.lyricsHash.slice(0, 16) + '...');
          }
          // TC-COVER-01: Extract cover art from ZIP metadata
          if (data.coverArtUrl && typeof data.coverArtUrl === 'string') {
            uploadSession.coverArtUrl = data.coverArtUrl;
          }
          if (data.coverTheme && typeof data.coverTheme === 'object') {
            uploadSession.coverTheme = data.coverTheme;
          }
          // TC-LRC-05: Restore original lyrics content with structural tags
          if (data.lyricsOriginalContent && typeof data.lyricsOriginalContent === 'string') {
            uploadSession.lyricsOriginalContent = data.lyricsOriginalContent;
          }
          // TC-29-09: Block scenes metadata
          if (data.scenes && Array.isArray(data.scenes)) {
            uploadSession.jsonScenes = data.scenes;
          }
        } else {
          showNotification('error', '❌ JSON должен содержать массив markers');
          uploadSession.jsonMarkers = null;
          uploadSession.jsonTextBlocks = null;
        }
      } catch (e) {
        console.error('UploadService: JSON parse error:', e);
        showNotification('error', '❌ Некорректный JSON файл');
        uploadSession.jsonMarkers = null;
        uploadSession.jsonTextBlocks = null;
      }
      break;

    case 'zip':
      uploadSession.zip = file;
      showNotification('info', `ZIP архив ${file.name} загружен.`);
      break;
  }
}

/**
 * Clear specific file type from upload session
 */
export function clearFile(type: UploadFileType): void {
  uploadSession[type] = null;
  if (type === 'lyrics') {
    uploadSession.parsedLyricsContent = null;
  }
  if (type === 'json') {
    uploadSession.jsonMarkers = null;
    uploadSession.jsonTextBlocks = null;
  }
}

/**
 * Reset entire upload session
 */
export function resetUploadSession(): void {
  uploadSession = createFreshSession();
}

/**
 * Check if instrumental is present (minimum requirement for save)
 */
export function canSave(): boolean {
  return uploadSession.instrumental !== null;
}

/**
 * Get track title from instrumental file name
 */
export function getTrackTitle(): string | null {
  const instrumental = uploadSession.instrumental;
  if (!instrumental) return null;
  return getFileNameWithoutExtension(instrumental.name);
}

/**
 * Save track to database — strict exact port from legacy
 * F58-TC-005v2: All 5 corrections from 007 included
 */
export async function saveTrack(): Promise<void> {
  const w = window as any;

  if (!uploadSession.instrumental) {
    console.error('💾 CatalogV2: Отмена сохранения - инструментал отсутствует.');
    showNotification('error', '❌ Выберите инструментальную дорожку');
    return;
  }

  const session = detachUploadSession();

  // cancelUpload before branch split — exact legacy order


  try {
    // Read instrumental
    const instrumentalData = await readFileAsArrayBuffer(session.instrumental!);
    const instrumentalType = session.instrumental!.type;
    // W7: Use overrideTitle from ZIP filename if available (mvsep bundles)
    const trackTitle = session.overrideTitle?.trim()
      || getFileNameWithoutExtension(session.instrumental!.name);

    // Read vocals
    let vocalsData: ArrayBuffer | null = null;
    let vocalsType: string | null = null;
    if (session.vocal) {
      vocalsData = await readFileAsArrayBuffer(session.vocal);
      vocalsType = session.vocal.type;
    }

    // Read lyrics — exact null defaults
    let lyricsOriginalContent: string | null = null;
    let lyricsFileName: string | null = null;
    if (session.lyrics) {
      lyricsFileName = session.lyrics.name;
      lyricsOriginalContent = session.parsedLyricsContent
        || await readFileAsText(session.lyrics);
    }

    // Read json — exact contract parity (vars kept unused as in legacy)
    let jsonFileName: string | null = null;
    let jsonContent: string | null = null;
    if (session.json) {
      jsonContent = await readFileAsText(session.json);
      jsonFileName = session.json.name;
    }

    // Build trackData — EXACT LEGACY SCHEMA
    const trackData: any = {
      id: Date.now(),
      title: trackTitle,
      instrumentalData,
      instrumentalType,
      vocalsData,
      vocalsType,
      lyricsFileName,
      dateAdded: new Date().toISOString(),
      lyricsOriginalContent: session.parsedLyricsContent || lyricsOriginalContent,
      blocksData: Array.isArray(session.jsonTextBlocks) ? session.jsonTextBlocks : [],
      lyrics: session.parsedLyricsContent || lyricsOriginalContent,
      lastModified: new Date().toISOString(),
      syncMarkers: Array.isArray(session.jsonMarkers) ? session.jsonMarkers : [],
    };

    // ─── LRC Auto-Sync: parse LRC locally, save clean lyrics + valid markers ───
    // If parsedLyricsContent is LRC format AND no JSON markers from export.json,
    // parse it locally to produce clean display text and timestamped markers.
    // This prevents the INDEX MISMATCH bug where _processLyrics strips empty lines
    // but markers still reference pre-strip line numbers.
    const isLrcContent = session.parsedLyricsContent && /\d{2}:\d{2}[.:]\d{2,3}/.test(session.parsedLyricsContent);

    if (isLrcContent) {
      try {
        const lrcResult = parseLrcString(session.parsedLyricsContent!);
        const { markers: lrcMarkers, lyricsLines } = lrcToMarkers(lrcResult);

        // Overwrite lyrics with clean display text (no timestamps, no empty lines)
        trackData.lyrics = lyricsLines.join('\n');
        // Keep original LRC for future migration needs
        // trackData.lyricsOriginalContent already set to raw LRC above
        // Only overwrite markers if no JSON markers from export.json
        // (JSON markers are usually user-verified and higher quality)
        if (!Array.isArray(session.jsonMarkers) || session.jsonMarkers.length === 0) {
          trackData.syncMarkers = lrcMarkers;
          trackData.blocksData = []; // No blocks without Genius text
          console.log(
            `[AutoLyrics] LRC parsed locally: ${lyricsLines.length} clean lines, ${lrcMarkers.length} markers`
          );
        } else {
          console.log(
            `[AutoLyrics] LRC detected but JSON markers present (${session.jsonMarkers.length}). Keeping JSON markers.`
          );
        }
        // Mark as processed — prevents double-parsing in loadTrack()
        trackData.dataVersion = 2;
      } catch (e) {
        console.warn('[AutoLyrics] LRC parse failed, saving raw:', e);
      }
    }

    // TC-COVER-01: Save cover art to IDB if present in ZIP
    if (session.coverArtUrl) {
      trackData.coverArtUrl = session.coverArtUrl;
    }
    // TC-COVER-06: Save cover art blob to IDB for offline use
    if (session.coverArtBlob) {
      trackData.coverArtBlob = session.coverArtBlob;
    }
    // TC-CBG-08: Custom background + theme extraction
    if (session.customBgBlob) {
      trackData.customBgBlob = session.customBgBlob;
      try {
        const { extractThemeFromBlob } = await import('../services/cover-art.service');
        const theme = await extractThemeFromBlob(session.customBgBlob);
        if (theme) trackData.customBgTheme = theme;
      } catch (e) {
        console.warn('[Upload] Custom bg theme extraction failed:', e);
      }
    }
    if (session.coverTheme) {
      trackData.coverTheme = session.coverTheme;
    }
    // TC-LRC-05: Save original lyrics content for LRC Picker
    if (session.lyricsOriginalContent) {
      trackData.lyricsOriginalContent = session.lyricsOriginalContent;
    }

    // Add alignment data if present
    if (session.alignmentArtifact) {
      trackData.alignmentData = session.alignmentArtifact.data;
      // Build and persist lineMap for cache verdict compatibility
      const lyrics = session.parsedLyricsContent || '';
      if (lyrics) {
        const { lineMap } = buildLineMap(lyrics);
        trackData.lineMap = lineMap;
      }
      // Persist lyricsHash from export.json for roundtrip compatibility
      if (session.lyricsHash) {
        trackData.lyricsHash = session.lyricsHash;
      }
    }

    // Save to IDB
    const savedTrack = await w.idbService.saveTrack(trackData);

    // W6: Save additional stems to IDB stemsData (separate update to avoid bloating trackData)
    if (session.additionalStems && Object.keys(session.additionalStems).length > 0) {
      const stemsData: Record<string, StemDataEntry> = {};
      for (const [stemId, file] of Object.entries(session.additionalStems)) {
        const fileBuffer = await readFileAsArrayBuffer(file);
        stemsData[stemId] = { data: fileBuffer, type: file.type };
      }
      await w.idbService.updateTrackField(savedTrack.id, { stemsData, stemsMode: true });
      // Patch the in-memory savedTrack so trackCatalog gets stemsData too
      savedTrack.stemsData = stemsData;
      savedTrack.stemsMode = true;
      if (import.meta.env.DEV) console.log(`[Upload] W6: saved ${Object.keys(stemsData).length} additional stems to IDB`);
    }

    // Sync to trackCatalog.tracks
    if (w.trackCatalog?.tracks) {
      w.trackCatalog.tracks.push(savedTrack);
    }

    // TC-COVER-01: Skip API if cover art restored from ZIP
    if (session.coverArtBlob || session.coverArtUrl) {
      if (import.meta.env.DEV) console.log('[CoverArt] Restored from ZIP (skip API)');
      // Apply theme synchronously
      if (session.coverTheme) {
        useTrackStore.getState().setCurrentCoverTheme?.(session.coverTheme);
      }
    } else {
      fetchCoverArtAndUpdate(savedTrack.id, trackTitle).catch(err => {
        console.warn('[CoverArt] fetch failed:', err);
      });
    }

    // Load lyrics — EXACT: 3 args with trackDuration
    if (w.lyricsDisplay && savedTrack.lyrics) {
      const trackDuration = savedTrack.duration || (w.audioEngine?.duration || 0);
      w.lyricsDisplay.loadLyrics(savedTrack.lyrics, trackDuration, false);
    }

    // Set markers — exact try/catch from legacy
    try {
      if (savedTrack.syncMarkers?.length > 0 && w.markerManager) {
        w.markerManager.setMarkers(savedTrack.syncMarkers);
      }
    } catch (e) {
      console.warn('Не удалось применить маркеры из JSON сразу:', e);
    }

    // JSON branch — exact try/catch + exact order
    const hasJsonMarkers = Array.isArray(savedTrack?.syncMarkers)
      && savedTrack.syncMarkers.length > 0;

    if (hasJsonMarkers) {
      try {
        if (w.markerManager?.updateMarkerColors) {
          w.markerManager.updateMarkerColors();
        }
        if (
          w.lyricsDisplay &&
          Array.isArray(w.lyricsDisplay.textBlocks) &&
          w.lyricsDisplay.textBlocks.length > 0
        ) {
          if (typeof w.lyricsDisplay.activateRehearsalDisplay === 'function') {
            w.lyricsDisplay.activateRehearsalDisplay();
          }
        }
        showNotification('success', `✅ Трек "${savedTrack.title}" успешно сохранён`);
        document.dispatchEvent(new CustomEvent('tracks-changed', { detail: { source: 'track-import' } }));
      } catch (e) {
        console.warn('Ошибка при применении JSON маркеров:', e);
      }
      return;
    }

    // Non-JSON branch — delegate to legacy block editor tail
    showNotification('success', `✅ Трек "${savedTrack.title}" успешно сохранён`);
    
    const hasLyrics = !!(session.lyrics || session.parsedLyricsContent);
    document.dispatchEvent(new CustomEvent('track-saved', {
      detail: {
        trackId: savedTrack.id,
        title: savedTrack.title,
        hasLyrics,
      }
    }));
    
    // ═══ TC-FLOW-01: lrclib-зависимая логика без автооткрытия редакторов ═══
    if (hasLyrics && savedTrack.id) {
      import('./auto-lyrics.service').then(async ({ shouldSkipEditorsForTrack, waitForCache }) => {
        // Если auto-sync уже применился — ничего не делаем
        if (shouldSkipEditorsForTrack(savedTrack.id)) {
          if (import.meta.env.DEV) {
            console.log('[AutoLyrics] Block Editor skipped in saveTrack — auto-sync applied for track', savedTrack.id);
          }
          return;
        }

        // Ждём lrclib максимум 5 секунд
        const title = savedTrack.title || '';
        const lrcResult = title ? await waitForCache(title, 5000) : null;

        if (lrcResult) {
          // lrclib нашёл данные — трек уже получит auto-sync через UploadPanel
          if (import.meta.env.DEV) {
            console.log('[TC-FLOW] lrclib data cached for', title, '— no editor needed');
          }
          return;
        }

        // lrclib не нашёл — открываем sync editor
        if (import.meta.env.DEV) {
          console.log('[TC-FLOW] lrclib NOT found for', title, '— opening sync editor');
        }
        const trackIndex = useTrackStore.getState().tracksMeta
          .findIndex(t => String(t.id) === String(savedTrack.id));
        if (trackIndex >= 0) {
          loadTrack(trackIndex, { autoplay: false, openSyncEditor: true });
        }
      }).catch(() => {
        // fallback — ничего не открываем, трек в каталоге
      });
    }

  } catch (err: any) {
    console.error('💾 saveTrack error:', err);
    showNotification('error', `❌ Ошибка сохранения: ${err.message}`);
  }
}

/**
 * Handle ZIP file selection — exact port without legacy DOM dependencies
 * F58-TC-007: Calls TS handleFileSelect + saveTrack
 */
export async function handleZipFileSelect(file: File, onProgress?: (pct: number) => void): Promise<void> {
  try {
    // ⚡ TC-BUG-02: Очищаем стемы перед каждым ZIP — предотвращает "stem slot already taken"
    // при повторной загрузке до вызова saveTrack()
    uploadSession.additionalStems = null;
    // W7: Capture ZIP filename for overrideTitle (mvsep bundles)
    const zipFileName = file.name;
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(
      await readFileAsArrayBuffer(file, (pct) => onProgress?.(Math.round(pct * 0.30)))
    );
    onProgress?.(33);

    let instrumentalFile: File | null = null;
    let vocalFile: File | null = null;
    let lyricsFile: File | null = null;
    let jsonFile: File | null = null;
    let alignmentArtifact: { name: string; data: any } | null = null;

    const entries: Array<{ name: string; zipEntry: any }> = [];

    zip.forEach((relativePath: string, zipEntry: any) => {
      if (zipEntry.dir) return;
      if (relativePath.includes('__MACOSX/')) return;
      if (relativePath.split('/').pop()?.startsWith('._')) return;
      entries.push({ name: relativePath, zipEntry });
    });

    // W6.1: Two-pass audio classification — collect first, then classify with priorities
    const audioFiles: Array<{ file: File; baseNameNoExt: string }> = [];
    let processedEntries = 0;
    const totalEntries = entries.length || 1;

    for (const { name, zipEntry } of entries) {
      const ext = getFileExtension(name);
      const isAudio = ['mp3','wav','ogg','flac','aac','m4a'].includes(ext);
      const isLyrics = ['txt','lrc','rtf'].includes(ext);
      const isJson = ext === 'json';

      if (isAudio) {
        const buffer = await zipEntry.async('arraybuffer');
        const mimeMap: Record<string, string> = {
          mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg',
          flac: 'audio/flac', aac: 'audio/aac', m4a: 'audio/mp4',
        };
        const mime = mimeMap[ext] || 'audio/mpeg';
        const audioFile = new File([buffer], getBaseNameFromPath(name), { type: mime });
        const baseNameNoExt = getFileNameWithoutExtension(getBaseNameFromPath(name));
        audioFiles.push({ file: audioFile, baseNameNoExt });
      }

      if (isLyrics && !lyricsFile) {
        const text = await zipEntry.async('string');
        lyricsFile = new File([text], getBaseNameFromPath(name), { type: 'text/plain' });
      }

      if (isJson) {
        // Check alignment first — independent of jsonFile guard
        if (isAlignmentFile(name)) {
          try {
            const text = await zipEntry.async('string');
            const parsed = JSON.parse(text);
            if (isValidAlignmentArtifact(parsed)) {
              alignmentArtifact = { name: getBaseNameFromPath(name), data: parsed };
              if (import.meta.env.DEV) console.log('[Upload] alignment artifact found:', name);
            } else {
              console.warn('[Upload] alignment file invalid shape:', name);
            }
          } catch (e) {
            console.warn('[Upload] alignment file parse error:', name);
          }
        } else if (!jsonFile) {
          // Only take first non-alignment JSON as markers file
          const text = await zipEntry.async('string');
          jsonFile = new File([text], getBaseNameFromPath(name), { type: 'application/json' });
        }
      }

      processedEntries++;
      onProgress?.(33 + Math.round((processedEntries / totalEntries) * 37));
    }

    // W6.2: Residual classification — file with NO stem keyword = instrumental
    // Logic: instrumentals are named after the track (e.g., "Linkin Park - In the End"),
    //        they never have stem keywords like "drums", "vocals", "bass" etc.
    //        So the unmatched file is naturally the instrumental.
    for (const { file, baseNameNoExt } of audioFiles) {
      const stemSlot = classifyStemFromFilename(baseNameNoExt);

      if (stemSlot === 'vocals') {
        // Lead vocal — primary slot
        if (!vocalFile) {
          vocalFile = file;
          if (import.meta.env.DEV) console.log(`[Upload] W6.2: classified as vocal ← ${file.name}`);
        } else {
          if (!uploadSession.additionalStems) uploadSession.additionalStems = {};
          if (!uploadSession.additionalStems['backing']) {
            uploadSession.additionalStems['backing'] = file;
            if (import.meta.env.DEV) console.log(`[Upload] W6.2: vocal slot taken → backing ← ${file.name}`);
          } else {
            console.warn(`[Upload] W6.2: vocal+backing taken, skipping: ${file.name}`);
          }
        }
      } else if (stemSlot) {
        // Stem slot (drums, bass, keys, guitar, backing)
        if (!uploadSession.additionalStems) uploadSession.additionalStems = {};
          if (!uploadSession.additionalStems[stemSlot]) {
            uploadSession.additionalStems[stemSlot] = file;
            if (import.meta.env.DEV) console.log(`[Upload] W6.2: classified stem: ${stemSlot} ← ${file.name}`);
        } else {
          console.warn(`[Upload] W6.2: stem slot '${stemSlot}' already taken, skipping: ${file.name}`);
        }
      } else {
        // No keyword match = residual block
        // W7.2: Explicit instrum detection for mvsep bundles
        if (baseNameNoExt.toLowerCase().includes('instrum')) {
          if (!instrumentalFile) {
            instrumentalFile = file;
            uploadSession.overrideTitle = zipFileName
              .replace(/\.zip$/i, '')
              .replace(/\.(flac|mp3|wav|aac|m4a|ogg)$/i, '')
              .trim();
            if (import.meta.env.DEV) console.log(`[Upload] W7.2: mvsep instrum detected, title="${uploadSession.overrideTitle}" ← ${file.name}`);
            // W11: fire-and-forget lrclib prefetch (параллельно с загрузкой аудио)
            // Захватываем title синхронно ДО async импорта — сессия может сброситься раньше
            const _prefetchTitle = uploadSession.overrideTitle;
            const _prefetchFile = file; // instrumental File для чтения duration
            if (_prefetchTitle) {
              import('./auto-lyrics.service').then(async ({ prefetch, prefetchWithDuration }) => {
                if (import.meta.env.DEV) {
                  console.log('[W11] prefetch called, title:', _prefetchTitle);
                }
                // Попытка получить duration из instrumental файла через Audio element
                try {
                  const audio = new Audio();
                  audio.src = URL.createObjectURL(_prefetchFile);
                  await new Promise<void>((resolve) => {
                    audio.onloadedmetadata = () => resolve();
                    audio.onerror = () => resolve();
                    setTimeout(() => resolve(), 3000); // safety timeout
                  });
                  const dur = audio.duration;
                  URL.revokeObjectURL(audio.src);
                  if (dur && dur > 0 && isFinite(dur)) {
                    if (import.meta.env.DEV) {
                      console.log(`[W11] prefetchWithDuration: ${_prefetchTitle}, duration=${Math.round(dur)}s`);
                    }
                    prefetchWithDuration(_prefetchTitle, dur);
                  } else {
                    prefetch(_prefetchTitle);
                  }
                } catch {
                  prefetch(_prefetchTitle);
                }
              }).catch(() => {});
            }
          }
        } else if (!instrumentalFile) {
          // True instrumental (no stem keyword, no 'instrum' in name)
          instrumentalFile = file;
          if (import.meta.env.DEV) console.log(`[Upload] W6.2: classified as instrumental (no stem keyword) ← ${file.name}`);
          // TC-ZIP-05: fire-and-forget lrclib prefetch for 2-stem ZIP (no 'instrum' in name)
          const _pfTitle = getFileNameWithoutExtension(file.name);
          if (_pfTitle) {
            import('./auto-lyrics.service').then(async ({ prefetch, prefetchWithDuration }) => {
              if (import.meta.env.DEV) console.log('[W11] prefetch called (2-stem), title:', _pfTitle);
              try {
                const audio = new Audio();
                audio.src = URL.createObjectURL(file);
                await new Promise<void>((resolve) => {
                  audio.onloadedmetadata = () => resolve();
                  audio.onerror = () => resolve();
                  setTimeout(() => resolve(), 3000);
                });
                const dur = audio.duration;
                URL.revokeObjectURL(audio.src);
                if (dur && dur > 0 && isFinite(dur)) {
                  if (import.meta.env.DEV) console.log(`[W11] prefetchWithDuration (2-stem): ${_pfTitle}, duration=${Math.round(dur)}s`);
                  prefetchWithDuration(_pfTitle, dur);
                } else {
                  prefetch(_pfTitle);
                }
              } catch {
                prefetch(_pfTitle);
              }
            }).catch(() => {});
          }
        } else {
          // Second unclassified file → other stem
          if (!uploadSession.additionalStems) uploadSession.additionalStems = {};
          if (!uploadSession.additionalStems['other']) {
            uploadSession.additionalStems['other'] = file;
            if (import.meta.env.DEV) console.log(`[Upload] W6.2: unclassified → other ← ${file.name}`);
          } else {
            console.warn(`[Upload] W6.2: 'other' slot already taken, skipping: ${file.name}`);
          }
        }
      }
    }

    if (!instrumentalFile) {
      showNotification('error', '❌ В ZIP архиве не найдена инструментальная дорожка');
      return;
    }

    // Populate session via TS handleFileSelect
    // W6.2 fix: preserve additionalStems across session reset
    // W7: Also preserve overrideTitle
    const preservedStems = uploadSession.additionalStems;
    const preservedTitle = uploadSession.overrideTitle;
    uploadSession = createFreshSession();
    uploadSession.additionalStems = preservedStems;
    uploadSession.overrideTitle = preservedTitle;

    await handleFileSelect(instrumentalFile.name.split('.').pop() === 'json'
      ? 'json' : 'instrumental', instrumentalFile);

    if (vocalFile) await handleFileSelect('vocal', vocalFile);
    if (lyricsFile) await handleFileSelect('lyrics', lyricsFile);
    if (jsonFile) await handleFileSelect('json', jsonFile);

    // Attach alignment artifact if found
    if (alignmentArtifact) {
      uploadSession.alignmentArtifact = alignmentArtifact;
    }

    // TC-COVER-06-FIX: Extract cover art file from ZIP (offline-ready)
    // Must be here — zip object is only available in handleZipFileSelect scope
    const coverZipFile = zip.file('cover.jpg') || zip.file('cover.png');
    if (coverZipFile) {
      try {
        const ab = await coverZipFile.async('arraybuffer');
        const isPng = coverZipFile.name.toLowerCase().endsWith('.png');
        const coverBlob = new Blob([ab], { type: isPng ? 'image/png' : 'image/jpeg' });
        uploadSession.coverArtBlob = coverBlob;
        if (import.meta.env.DEV) console.log('[CoverArt] Extracted from ZIP:', coverBlob.type, Math.round(coverBlob.size / 1024) + 'KB');
      } catch (e) {
        console.warn('[Upload] Failed to extract cover art from ZIP:', e);
      }
    }

      // TC-CBG-08: Extract custom background from ZIP
      const bgFolder = zip.folder('backgrounds');
      if (bgFolder) {
        const bgEntries: Array<{ path: string; file: any }> = [];
        bgFolder.forEach((path: string, file: any) => {
          if (!file.dir) bgEntries.push({ path, file });
        });
        if (bgEntries.length > 0) {
          try {
            const first = bgEntries[0];
            const ab = await first.file.async('arraybuffer');
            const isPng = first.path.toLowerCase().endsWith('.png');
            uploadSession.customBgBlob = new Blob([ab], {
              type: isPng ? 'image/png' : 'image/jpeg',
            });
            console.log('[CustomBg] Extracted from ZIP:', Math.round(ab.byteLength / 1024) + 'KB');
          } catch (e) {
            console.warn('[Upload] Failed to extract custom bg:', e);
          }
        }
      }

    // TC-29-09: Capture scenes before detachUploadSession() inside saveTrack()
    const sessionScenes = uploadSession.jsonScenes;

    onProgress?.(75);
    await saveTrack();
    onProgress?.(85);

    // ── TC-29-09: Import block scenes from ZIP ──
    let importedCount = 0;
    if (sessionScenes && sessionScenes.length > 0) {
      try {
        const { saveScene } = await import('./idb.service');
        const { resizeImage } = await import('../utils/image-resize');
        const savedTrack = (window as any).trackCatalog?.tracks?.[
          (window as any).trackCatalog?.tracks?.length - 1
        ];
        const newTrackId = savedTrack?.id;

        if (newTrackId) {
          let importedScenes = 0;
          const totalScenes = sessionScenes.length || 1;
          for (const sceneMeta of sessionScenes) {
            try {
              const sceneZipEntry = zip.file(sceneMeta.file);
              if (!sceneZipEntry) {
                console.warn(`[SceneImport] File not found in ZIP: ${sceneMeta.file}`);
                continue;
              }
              const ab = await sceneZipEntry.async('arraybuffer');
              const isPng = sceneMeta.file.toLowerCase().endsWith('.png');
              const rawBlob = new Blob([ab], { type: isPng ? 'image/png' : 'image/jpeg' });

              // Resize — same as manual upload (max 1920px)
              const resized = await resizeImage(rawBlob);

              const sceneId = sceneMeta.lineIndex != null
                ? `${newTrackId}_${sceneMeta.blockIndex}_${sceneMeta.lineIndex}`
                : `${newTrackId}_${sceneMeta.blockIndex}`;

              await saveScene({
                id: sceneId,
                trackId: newTrackId,
                blockIndex: sceneMeta.blockIndex,
                lineIndex: sceneMeta.lineIndex ?? null,
                blockId: sceneMeta.blockId,
                blob: resized,
                theme: sceneMeta.theme,
                addedAt: new Date().toISOString(),
              });
              importedCount++;
              importedScenes++;
            } catch (sceneErr) {
              console.warn(`[SceneImport] Failed: block=${sceneMeta.blockIndex} line=${sceneMeta.lineIndex}`, sceneErr);
            }
            onProgress?.(85 + Math.round((importedScenes / totalScenes) * 14));
          }
          console.log(`[SceneImport] Imported ${importedCount}/${sessionScenes.length} scenes for trackId=${newTrackId}`);

          // Trigger scene reload — preload ran before import completed
          if (importedCount > 0) {
            document.dispatchEvent(new CustomEvent('tracks-changed', { detail: { source: 'scene-crud' } }));
          }
        }
      } catch (sceneImportErr) {
        console.warn('[SceneImport] Scene import failed:', sceneImportErr);
        // Non-critical — track is already saved
      }
    }

    const sceneNote = importedCount > 0 ? ` (+${importedCount} сцен)` : '';
    showNotification('success', `✅ ZIP архив успешно распакован и файлы распределены!${sceneNote}`);

  } catch (err: any) {
    console.error('handleZipFileSelect error:', err);
    showNotification('error', `❌ Ошибка обработки ZIP: ${err.message}`);
  }
}

// ─── MVSEP Track Lifecycle ──────────────────────────────────

/**
 * Create a placeholder track in IDB for MVSEP processing.
 * Track appears in catalog with "Processing..." badge.
 * NOT playable until completeMvsepTrack() is called.
 */
export async function createMvsepPlaceholder(
  fileName: string,
  hash: string
): Promise<number> {
  const w = window as any;
  const idb = w.idbService;
  if (!idb) throw new Error('idbService not available');

  const trackTitle = getFileNameWithoutExtension(fileName);

  // TODO(Phase 2): Replace with crypto.randomUUID()
  const trackId = Date.now();

  const trackData: any = {
    id: trackId,
    title: trackTitle,
    instrumentalData: new ArrayBuffer(0), // placeholder — not playable
    instrumentalType: 'audio/mpeg',
    dateAdded: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    mvsepStatus: 'processing' as const,
    mvsepHash: hash,
    mvsepSubmittedAt: new Date().toISOString(),
    lyrics: '',
    blocksData: [],
    syncMarkers: [],
  };

  const saved = await idb.saveTrack(trackData);

  document.dispatchEvent(
    new CustomEvent('tracks-changed', {
      detail: { source: 'mvsep-placeholder' },
    })
  );

  return saved.id;
}

/**
 * Complete MVSEP track with downloaded stems.
 * Updates the placeholder with real audio data.
 * StemsMap keys: 'instrumental', 'vocals', 'drums', 'bass', 'keys', 'guitar', 'other'
 */
export async function completeMvsepTrack(
  trackId: number,
  stemsMap: Map<string, Blob>
): Promise<void> {
  const w = window as any;
  const idb = w.idbService;
  if (!idb) throw new Error('idbService not available');

  // Read blobs as ArrayBuffers
  const instrumentalBlob = stemsMap.get('instrumental');
  if (!instrumentalBlob) {
    throw new Error('No instrumental stem from MVSEP');
  }

  const instrumentalData = await instrumentalBlob.arrayBuffer();
  const vocalsBlob = stemsMap.get('vocals');
  const vocalsData = vocalsBlob ? await vocalsBlob.arrayBuffer() : null;

  // Build stemsData for additional stems
  const stemsData: Record<string, import('./idb.service').StemDataEntry> = {};
  const stemOrder = ['drums', 'bass', 'keys', 'guitar', 'other'] as const;
  const stemDisplayOrder: Array<{ stemId: string; label: string }> = [];

  for (const stemId of stemOrder) {
    const blob = stemsMap.get(stemId);
    if (blob) {
      stemsData[stemId] = {
        data: await blob.arrayBuffer(),
        type: blob.type || 'audio/mpeg',
      };
      const labels: Record<string, string> = {
        drums: '🥁 Drums',
        bass: '🎸 Bass',
        keys: '🎹 Keys',
        guitar: '🎸 Guitar',
        other: '🎵 Other',
      };
      stemDisplayOrder.push({ stemId, label: labels[stemId] || stemId });
    }
  }

  // Count received stems for notification
  const totalExpected = 7;
  const totalReceived = 1 + (vocalsData ? 1 : 0) + Object.keys(stemsData).length;

  // Update track in IDB
  const updates: any = {
    instrumentalData,
    instrumentalType: 'audio/mpeg',
    vocalsData,
    vocalsType: vocalsData ? 'audio/mpeg' : null,
    mvsepStatus: 'done' as const,
    lastModified: new Date().toISOString(),
  };

  if (Object.keys(stemsData).length > 0) {
    updates.stemsData = stemsData;
    updates.stemDisplayOrder = stemDisplayOrder;
    updates.stemsMode = true;
  }

  await idb.updateTrackField(trackId, updates);

  document.dispatchEvent(
    new CustomEvent('tracks-changed', {
      detail: { source: 'mvsep-complete' },
    })
  );

  // ─── ZIP Pipeline Parity ────────────────────────────────────

  // Block 1: Sync in-memory trackCatalog with IDB
  try {
    if (w.trackCatalog && idb?.getAllTracks) {
      const freshTracks = await idb.getAllTracks();
      w.trackCatalog.tracks.length = 0;
      w.trackCatalog.tracks.push(...freshTracks);
    }
  } catch {
    // non-critical
  }

  // Block 2: Dispatch track-saved to trigger lyrics modal (🔥 KEY)
  const trackForLyrics = await idb.getTrack(trackId);
  const trackTitle = trackForLyrics?.title || '';
  const hasLyrics = !!(trackForLyrics?.lyrics && trackForLyrics.lyrics.trim().length > 0);
  document.dispatchEvent(new CustomEvent('track-saved', {
    detail: { trackId, title: trackTitle, hasLyrics }
  }));

  // Block 3: Stem count notification
  const totalStems = stemsMap.size;
  if (totalStems < 7) {
    showNotification('info', `✅ ${totalStems} из 7 стемов получено`);
  } else {
    showNotification('success', '✅ Все 7 стемов загружены!');
  }

  // Notification
  if (totalReceived < totalExpected) {
    const { showNotification } = await import('./upload.service');
    showNotification(
      'success',
      `✅ ${totalReceived} из ${totalExpected} стемов получено`
    );
  } else {
    const { showNotification } = await import('./upload.service');
    showNotification('success', '✅ Все стемы получены!');
  }

  // Fire-and-forget enrichment
  try {
    const track = await idb.getTrack(trackId);
    if (track?.title) {
      const { fetchCoverArtAndUpdate } = await import('./cover-art.service');
      fetchCoverArtAndUpdate(trackId, track.title).catch(() => {});
      // Prefetch lrclib so waitForCache finds it when user pastes lyrics
      const { prefetch } = await import('./auto-lyrics.service');
      prefetch(track.title);
    }
  } catch {
    // enrichment is optional
  }
}

/**
 * Cancel and delete a MVSEP placeholder track.
 * Used when user cancels processing or deletes failed placeholder.
 */
export async function cancelMvsepPlaceholder(trackId: number): Promise<void> {
  const w = window as any;
  const idb = w.idbService;
  if (!idb) return;

  await idb.deleteTrack(trackId);

  document.dispatchEvent(
    new CustomEvent('tracks-changed', {
      detail: { source: 'mvsep-cancel' },
    })
  );
}
