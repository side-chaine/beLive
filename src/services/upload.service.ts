/**
 * Upload Service — stateless upload helpers
 * F58-TC-002: Exact port from catalog-v2.js handleFileSelect + utilities
 * F59: Module-level uploadSession = source of truth
 */

// Upload session types
export interface UploadSession {
  instrumental: File | null;
  vocal: File | null;
  lyrics: File | null;
  json: File | null;
  zip: File | null;
  parsedLyricsContent: string | null;
  jsonMarkers: unknown[] | null;
  jsonTextBlocks: unknown[] | null;
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
export async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
    reader.onerror = (e) => reject(e);
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
      uploadSession.json = file;
      try {
        const text = await readFileAsText(file);
        const data = JSON.parse(text);
        if (Array.isArray(data)) {
          uploadSession.jsonMarkers = data;
          uploadSession.jsonTextBlocks = [];
        } else if (data && Array.isArray(data.markers)) {
          uploadSession.jsonMarkers = data.markers;
          if (data.textBlocks && Array.isArray(data.textBlocks)) {
            uploadSession.jsonTextBlocks = data.textBlocks;
          } else {
            uploadSession.jsonTextBlocks = [];
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

async function loadTrackIntoApp(track: any): Promise<number> {
  const w = window as any;
  const tc = w.trackCatalog;
  if (!tc) throw new Error('TrackCatalog недоступен');

  const idb = w.idbService;
  const freshTracks = idb?.getAllTracks
    ? await idb.getAllTracks()
    : [];

  tc.tracks.length = 0;
  tc.tracks.push(...freshTracks);

  const trackIndex = tc.tracks.findIndex((t: any) => t.id === track.id);
  if (trackIndex === -1) {
    throw new Error('Трек не найден в основном каталоге после перезагрузки');
  }

  const orchestrator = (window as any).trackOrchestrator;
  if (!orchestrator) {
    throw new Error('trackOrchestrator недоступен');
  }
  await orchestrator(trackIndex, {});
  return trackIndex;
}

async function openBlockEditorForTrack(track: any): Promise<void> {
  const w = window as any;
  try {
    await loadTrackIntoApp(track);

    const startTs = performance.now();
    const maxWaitMs = 5000;

    const waitReady = () => {
      const we = w.waveformEditor;
      const ready = we
        && typeof we._openNewBlockEditor === 'function'
        && we.currentTrackId === track.id;
      if (ready) {
        we._openNewBlockEditor();
        return;
      }
      if (performance.now() - startTs > maxWaitMs) {
        console.warn('Block editor timeout');
        w.showAppNotification?.('⚠️ Редактор блоков недоступен: таймаут ожидания', 'info');
        return;
      }
      setTimeout(waitReady, 150);
    };

    waitReady();
  } catch (error) {
    console.error('❌ Ошибка при открытии редактора блоков:', error);
    w.showAppNotification?.('❌ Ошибка открытия редактора блоков', 'error');
  }
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
    const trackTitle = getFileNameWithoutExtension(session.instrumental!.name);

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

    // Save to IDB
    const savedTrack = await w.idbService.saveTrack(trackData);

    // Sync to trackCatalog.tracks
    if (w.trackCatalog?.tracks) {
      w.trackCatalog.tracks.push(savedTrack);
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
        document.dispatchEvent(new Event('tracks-changed'));
      } catch (e) {
        console.warn('Ошибка при применении JSON маркеров:', e);
      }
      return;
    }

    // Non-JSON branch — delegate to legacy block editor tail
    showNotification('success', `✅ Трек "${savedTrack.title}" успешно сохранён`);
    setTimeout(() => openBlockEditorForTrack(savedTrack), 500);

  } catch (err: any) {
    console.error('💾 saveTrack error:', err);
    showNotification('error', `❌ Ошибка сохранения: ${err.message}`);
  }
}

/**
 * Handle ZIP file selection — exact port without legacy DOM dependencies
 * F58-TC-007: Calls TS handleFileSelect + saveTrack
 */
export async function handleZipFileSelect(file: File): Promise<void> {
  try {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(await readFileAsArrayBuffer(file));

    let instrumentalFile: File | null = null;
    let vocalFile: File | null = null;
    let lyricsFile: File | null = null;
    let jsonFile: File | null = null;

    const entries: Array<{ name: string; zipEntry: any }> = [];

    zip.forEach((relativePath: string, zipEntry: any) => {
      if (zipEntry.dir) return;
      if (relativePath.includes('__MACOSX/')) return;
      if (relativePath.split('/').pop()?.startsWith('._')) return;
      entries.push({ name: relativePath, zipEntry });
    });

    for (const { name, zipEntry } of entries) {
      const lower = name.toLowerCase();
      const ext = getFileExtension(name);
      const baseName = getBaseNameFromPath(name).toLowerCase();

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

        const isVocal = baseName.includes('_vocals_') || baseName.includes('_vocal');
        if (isVocal && !vocalFile) {
          vocalFile = audioFile;
        } else if (!isVocal && !instrumentalFile) {
          instrumentalFile = audioFile;
        } else if (!instrumentalFile) {
          instrumentalFile = audioFile;
        }
      }

      if (isLyrics && !lyricsFile) {
        const text = await zipEntry.async('string');
        lyricsFile = new File([text], getBaseNameFromPath(name), { type: 'text/plain' });
      }

      if (isJson && !jsonFile) {
        const text = await zipEntry.async('string');
        jsonFile = new File([text], getBaseNameFromPath(name), { type: 'application/json' });
      }
    }

    if (!instrumentalFile) {
      showNotification('error', '❌ В ZIP архиве не найдена инструментальная дорожка');
      return;
    }

    // Populate session via TS handleFileSelect
    uploadSession = createFreshSession();

    await handleFileSelect(instrumentalFile.name.split('.').pop() === 'json'
      ? 'json' : 'instrumental', instrumentalFile);

    if (vocalFile) await handleFileSelect('vocal', vocalFile);
    if (lyricsFile) await handleFileSelect('lyrics', lyricsFile);
    if (jsonFile) await handleFileSelect('json', jsonFile);

    // Save track
    await saveTrack();

    showNotification('success', '✅ ZIP архив успешно распакован и файлы распределены!');

  } catch (err: any) {
    console.error('handleZipFileSelect error:', err);
    showNotification('error', `❌ Ошибка обработки ZIP: ${err.message}`);
  }
}
