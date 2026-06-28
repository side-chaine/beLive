/**
 * ZIP Export Service — generate track ZIP archive
 * Extracted from SyncEditorPanel.handleExportZip
 */
import JSZip from 'jszip';
import { getTrack } from '../../services/idb.service';
import { useTrackStore } from '../../stores/track.store';
import { computeLyricsHash } from '../../sync/word-sync/hash';
import { calcPreFlight, assertZipSize, wouldFitZip } from '../../utils/zip-preflight';
import { runTranscodePipeline } from '../../utils/zip-transcode-pipeline';
import { terminateWorker, transcodeStem } from '../../utils/mp3-transcoder';
import { closeZipAudioContext, hasZipAudioContext } from '../../utils/audio-context-manager';
import { logZipEvent } from '../../utils/zip-logger';
import { STEM_TRANSCODE_CONFIG } from '../../config/stem-transcode.config';

function mimeToExt(mimeType?: string | null): string {
  if (!mimeType) return 'mp3';
  const map: Record<string, string> = {
    'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/mp4': 'm4a',
    'audio/x-m4a': 'm4a', 'audio/aac': 'aac', 'audio/ogg': 'ogg',
    'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/wave': 'wav',
    'audio/flac': 'flac', 'audio/x-flac': 'flac',
  };
  return map[mimeType.toLowerCase()] || 'mp3';
}

export interface ZipExportCallbacks {
  onProgress?: (percent: number) => void;
}

export interface ZipExportInput {
  trackId: number;
  liveMarkers?: any[];
  liveTextBlocks?: any[];
}

export async function generateTrackZip(
  input: ZipExportInput,
  callbacks?: ZipExportCallbacks,
): Promise<Blob> {
  const { trackId, liveMarkers, liveTextBlocks } = input;
  const meta = useTrackStore.getState().tracksMeta.find(t => Number(t.id) === trackId)
    || useTrackStore.getState().currentTrack;

  const fullTrack = await getTrack(trackId);
  if (!fullTrack) throw new Error(`Track ${trackId} not found in IDB`);

  const zip = new JSZip();
  const trackName = meta?.title || 'track';
  const safeName = trackName.replace(/[<>:"/\\|?*]/g, '_');

  if (fullTrack.instrumentalData) {
    zip.file(`${safeName}.${mimeToExt(fullTrack.instrumentalType)}`, fullTrack.instrumentalData, { compression: 'STORE' });
  }
  if (fullTrack.vocalsData) {
    zip.file(`${safeName}_vocals.${mimeToExt(fullTrack.vocalsType)}`, fullTrack.vocalsData, { compression: 'STORE' });
  }

  if (fullTrack.stemsData && Object.keys(fullTrack.stemsData).length > 0) {
    let scenesBytes = 0;
    try {
      const { getBlockScenes, getBlockSceneBlob } = await import('../../services/block-scene.service');
      const sceneMetas = await getBlockScenes(trackId);
      for (const scene of sceneMetas) {
        const blob = await getBlockSceneBlob(scene.id);
        if (blob) scenesBytes += blob.size;
      }
    } catch { /* scenes optional */ }

    const preFlight = calcPreFlight(
      {
        stemsData: fullTrack.stemsData,
        instrumentalByteLength: fullTrack.instrumentalData?.byteLength,
        vocalsByteLength: fullTrack.vocalsData?.byteLength,
        coverByteLength: fullTrack.coverArtBlob?.size,
        bgByteLength: fullTrack.customBgBlob?.size,
        scenesByteLength: scenesBytes || undefined,
      },
      STEM_TRANSCODE_CONFIG.compressibleTypes,
    );

    if (preFlight.needsTranscode) {
      callbacks?.onProgress?.(6);
      const rawStemsData: Record<string, { data: ArrayBuffer; type: string }> = {};
      for (const [stemId, entry] of Object.entries(fullTrack.stemsData)) {
        if (entry?.data) rawStemsData[stemId] = { data: entry.data.slice(0), type: entry.type };
      }

      const result = await runTranscodePipeline({
        stemsData: fullTrack.stemsData,
        stemsToTranscode: preFlight.stemsToTranscode,
        predictedTotal: preFlight.predictedTotal,
        onProgress: (stemId, percent) => logZipEvent('stem-encode-progress', { stemId, progress: percent }),
      });

      let finalBytes = (fullTrack.instrumentalData?.byteLength ?? 0)
        + (fullTrack.vocalsData?.byteLength ?? 0)
        + (fullTrack.coverArtBlob?.size ?? 0)
        + (fullTrack.customBgBlob?.size ?? 0)
        + scenesBytes;

      for (const [stemId, entry] of Object.entries(fullTrack.stemsData)) {
        if (!entry?.data) continue;
        const comp = result.compressed[stemId];
        if (comp) finalBytes += comp.byteLength;
        else if (!result.skipped.includes(stemId)) finalBytes += entry.data.byteLength;
      }

      if (!wouldFitZip(finalBytes)) {
        let largestStem = '', largestSize = 0;
        for (const [stemId, data] of Object.entries(result.compressed)) {
          if (data.byteLength > largestSize) { largestSize = data.byteLength; largestStem = stemId; }
        }
        if (largestStem && rawStemsData[largestStem]) {
          terminateWorker();
          try {
            const tightened = await transcodeStem(largestStem, rawStemsData[largestStem].data, STEM_TRANSCODE_CONFIG.fallbackBitrate);
            result.compressed[largestStem] = tightened.data;
          } catch { /* tightening failed */ }
          terminateWorker();
        }
        if (!wouldFitZip(finalBytes)) {
          throw new Error('Экспорт невозможен: размер трека превышает 50MB даже после сжатия.');
        }
      }

      for (const [stemId, entry] of Object.entries(fullTrack.stemsData)) {
        if (!entry?.data) continue;
        const comp = result.compressed[stemId];
        if (comp) zip.file(`stems/${stemId}.mp3`, comp, { compression: 'STORE' });
        else if (!result.skipped.includes(stemId)) zip.file(`stems/${stemId}.${mimeToExt(entry.type)}`, entry.data, { compression: 'STORE' });
      }
      terminateWorker();
      if (hasZipAudioContext()) closeZipAudioContext();
    } else {
      for (const [stemId, entry] of Object.entries(fullTrack.stemsData)) {
        if (entry?.data) zip.file(`stems/${stemId}.${mimeToExt(entry.type)}`, entry.data, { compression: 'STORE' });
      }
    }
  }

  callbacks?.onProgress?.(8);
  const lyrics = fullTrack.lyrics || fullTrack.lyricsOriginalContent || '';
  if (lyrics) zip.file('lyrics.txt', lyrics);

  if (fullTrack.coverArtBlob) {
    const ext = fullTrack.coverArtBlob.type?.includes('png') ? 'png' : 'jpg';
    zip.file(`cover.${ext}`, fullTrack.coverArtBlob, { compression: 'STORE' });
  } else if (fullTrack.coverArtUrl?.startsWith('http')) {
    try {
      const resp = await fetch(fullTrack.coverArtUrl);
      if (resp.ok) {
        const coverBlob = await resp.blob();
        const ext = coverBlob.type?.includes('png') ? 'png' : 'jpg';
        zip.file(`cover.${ext}`, coverBlob, { compression: 'STORE' });
      }
    } catch { /* cover optional */ }
  }

  if (fullTrack.customBgBlob) {
    const bgExt = fullTrack.customBgBlob.type?.includes('png') ? 'png' : 'jpg';
    zip.file(`backgrounds/bg_01.${bgExt}`, fullTrack.customBgBlob, { compression: 'STORE' });
  }

  const markers = liveMarkers || fullTrack.syncMarkers || [];
  const textBlocks = liveTextBlocks || fullTrack.blocksData || [];
  const exportData: Record<string, any> = {
    id: trackId,
    title: meta?.title || 'Untitled',
    savedAt: new Date().toISOString(),
    markers, lyrics, textBlocks,
    lyricsHash: lyrics ? computeLyricsHash(lyrics) : undefined,
    coverArtUrl: fullTrack.coverArtUrl || undefined,
    coverTheme: fullTrack.coverTheme || undefined,
    lyricsOriginalContent: fullTrack.lyricsOriginalContent || undefined,
  };
  if (fullTrack.customBgBlob) {
    exportData.backgrounds = [{ file: `backgrounds/bg_01.${fullTrack.customBgBlob.type?.includes('png') ? 'png' : 'jpg'}`, trackId }];
  }

  zip.file('export.json', JSON.stringify(exportData, null, 2));
  if (fullTrack.alignmentData) zip.file('alignment.json', JSON.stringify(fullTrack.alignmentData, null, 2));

  callbacks?.onProgress?.(10);

  const blob = await new Promise<Blob>((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    zip.generateInternalStream({ type: 'uint8array', streamFiles: true })
      .on('data', (data: Uint8Array) => { chunks.push(data); })
      .on('end', () => resolve(new Blob(chunks as BlobPart[], { type: 'application/zip' })))
      .on('error', (err: Error) => reject(err))
      .resume();
  });

  assertZipSize(blob);
  return blob;
}
