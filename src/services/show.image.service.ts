import { resizeImage } from '../utils/image-resize';
import { saveStepImage, getStepImage, deleteStepImage } from './idb.service';

// ── Object URL Lifecycle ──

const _stepObjectUrls = new Set<string>();

/** Создать objectURL и зарегистрировать в lifecycle */
export function createStepObjectUrl(blob: Blob): string {
  const url = URL.createObjectURL(blob);
  _stepObjectUrls.add(url);
  return url;
}

/** Отозвать все objectURL и очистить Set */
export function revokeAllStepUrls(): void {
  _stepObjectUrls.forEach(url => URL.revokeObjectURL(url));
  _stepObjectUrls.clear();
}

/** Отозвать конкретный objectURL */
export function revokeStepUrl(url: string): void {
  URL.revokeObjectURL(url);
  _stepObjectUrls.delete(url);
}

/** Double-buffer: отложить отзыв старых URL */
export function deferredRevokeStepUrls(urls: string[], delayMs = 800): void {
  setTimeout(() => {
    urls.forEach(url => {
      URL.revokeObjectURL(url);
      _stepObjectUrls.delete(url);
    });
  }, delayMs);
}

// ── Image Pipeline ──

/** Загрузить файл → сжать → сохранить в IDB → вернуть objectURL */
export async function processAndSaveImage(
  file: File,
  imageId: string,
): Promise<string> {
  // 1. Resize
  const resized = await resizeImage(file);
  
  // 2. Save to IDB
  await saveStepImage(imageId, resized);
  
  // 3. Create objectURL
  return createStepObjectUrl(resized);
}

/** Загрузить изображение из IDB → вернуть objectURL */
export async function loadStepImageUrl(imageId: string): Promise<string | null> {
  const blob = await getStepImage(imageId);
  if (!blob) return null;
  return createStepObjectUrl(blob);
}

/** Удалить изображение из IDB + отозвать objectURL */
export async function removeStepImage(imageId: string): Promise<void> {
  await deleteStepImage(imageId);
}
