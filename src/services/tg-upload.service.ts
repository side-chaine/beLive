/**
 * TG Upload Service — upload ZIP blob to Telegram via belive-feed-bot Worker
 */
const TG_UPLOAD_URL = 'https://belive-feed-bot.nikitosss007.workers.dev/upload';

export interface TgUploadCallbacks {
  onProgress?: (percent: number) => void;
  onDone?: () => void;
  onError?: (status: number, statusText: string) => void;
}

export interface TgUploadResult {
  success: boolean;
}

/**
 * Upload a blob to Telegram catalog via belive-feed-bot Worker
 * Returns promise that resolves when upload completes
 */
export function uploadBlobToTelegram(
  blob: Blob,
  artist: string,
  title: string,
  callbacks?: TgUploadCallbacks,
  contentHash?: string,
  stemType?: string,
): Promise<TgUploadResult> {
  return new Promise((resolve) => {
    const formData = new FormData();
    formData.append('file', blob, `${artist} - ${title}.zip`);
    formData.append('artist', artist);
    formData.append('title', title);
    formData.append('type', stemType || 'full');
    if (contentHash) formData.append('contentHash', contentHash);
    if (stemType) formData.append('stemType', stemType);

    const xhr = new XMLHttpRequest();

    let lastProgressUpdate = 0;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && callbacks?.onProgress) {
        const now = Date.now();
        if (now - lastProgressUpdate < 100) return; // throttle: max 10 updates/sec
        lastProgressUpdate = now;
        callbacks.onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        callbacks?.onDone?.();
        resolve({ success: true });
      } else {
        callbacks?.onError?.(xhr.status, xhr.statusText);
        resolve({ success: false });
      }
    };

    xhr.onerror = () => {
      callbacks?.onError?.(0, 'Network error');
      resolve({ success: false });
    };

    xhr.onabort = () => {
      callbacks?.onError?.(0, 'Aborted');
      resolve({ success: false });
    };

    xhr.open('POST', TG_UPLOAD_URL);
    xhr.setRequestHeader('X-API-Key', 'belive2026');
    xhr.send(formData);
  });
}
