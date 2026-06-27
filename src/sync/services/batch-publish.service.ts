/**
 * Batch Publish Service — publish multiple tracks to Telegram sequentially
 */
import { generateTrackZip } from './zip-export.service';
import { uploadBlobToTelegram } from '../../services/tg-upload.service';

export interface BatchTrackProgress {
  trackId: number;
  index: number;
  total: number;
  title: string;
  artist: string;
  phase: 'pending' | 'generating' | 'uploading' | 'done' | 'error';
  percent: number;
  error?: string;
}

export interface BatchPublishCallbacks {
  onTrackStart?: (progress: BatchTrackProgress) => void;
  onTrackProgress?: (progress: BatchTrackProgress) => void;
  onTrackDone?: (progress: BatchTrackProgress) => void;
  onTrackError?: (progress: BatchTrackProgress) => void;
  onOverallProgress?: (doneCount: number, total: number, errorCount: number) => void;
}

export interface TrackPublishMeta {
  trackId: number;
  title: string;
  artist: string;
  skip?: boolean;
}

export interface BatchPublishHandle {
  abort: () => void;
  isRunning: () => boolean;
}

export function batchPublishTracks(
  tracks: TrackPublishMeta[],
  callbacks?: BatchPublishCallbacks,
): BatchPublishHandle {
  let aborted = false;
  let running = true;
  let doneCount = 0;
  let errorCount = 0;

  const total = tracks.length;
  const filtered = tracks.filter(t => !t.skip);

  (async () => {
    for (let i = 0; i < filtered.length; i++) {
      if (aborted) break;

      const track = filtered[i];
      const progress: BatchTrackProgress = {
        trackId: track.trackId, index: i, total,
        title: track.title, artist: track.artist,
        phase: 'pending', percent: 0,
      };

      progress.phase = 'generating';
      callbacks?.onTrackStart?.(progress);
      callbacks?.onTrackProgress?.(progress);

      try {
        const blob = await generateTrackZip(
          { trackId: track.trackId },
          { onProgress: (pct) => {
            progress.percent = pct;
            callbacks?.onTrackProgress?.(progress);
          }},
        );

        if (aborted) break;

        progress.phase = 'uploading';
        progress.percent = 0;
        callbacks?.onTrackProgress?.(progress);

        await uploadBlobToTelegram(blob, track.artist, track.title, {
          onProgress: (pct) => {
            progress.percent = pct;
            callbacks?.onTrackProgress?.(progress);
          },
        });

        if (aborted) break;

        doneCount++;
        progress.phase = 'done';
        progress.percent = 100;
        callbacks?.onTrackDone?.(progress);
        callbacks?.onOverallProgress?.(doneCount, total, errorCount);

        document.dispatchEvent(new CustomEvent('tg-upload-complete', {
          detail: { title: track.title, artist: track.artist }
        }));

        await new Promise(r => setTimeout(r, 300));

      } catch (err) {
        errorCount++;
        progress.phase = 'error';
        progress.error = err instanceof Error ? err.message : String(err);
        callbacks?.onTrackError?.(progress);
        callbacks?.onOverallProgress?.(doneCount, total, errorCount);
      }
    }

    running = false;
    callbacks?.onOverallProgress?.(doneCount, total, errorCount);
  })();

  return {
    abort: () => { aborted = true; },
    isRunning: () => running,
  };
}
