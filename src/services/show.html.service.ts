import { saveStepHtml, getStepHtml, deleteStepHtml } from './idb.service';

// ── Object URL Lifecycle ──

const _htmlObjectUrls = new Set<string>();

/** Создать objectURL и зарегистрировать в lifecycle */
export function createHtmlObjectUrl(blob: Blob): string {
  // ❄️ INV-HTML-02: Always set MIME with charset — IDB strips charset from Blob.type
  // Without this, browser defaults to non-UTF8 → кракозябры
  const htmlBlob = new Blob([blob], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(htmlBlob);
  _htmlObjectUrls.add(url);
  return url;
}

/** Отозвать все HTML objectURL и очистить Set */
export function revokeAllHtmlUrls(): void {
  _htmlObjectUrls.forEach(url => URL.revokeObjectURL(url));
  _htmlObjectUrls.clear();
}

/** Отозвать конкретный HTML objectURL */
export function revokeHtmlUrl(url: string): void {
  URL.revokeObjectURL(url);
  _htmlObjectUrls.delete(url);
}

// ── HTML Pipeline ──

/**
 * Загрузить .html файл → сохранить оригинальный blob в IDB → вернуть objectURL.
 * 
 * ⚠️ НЕ используем file.text() — сохраняем File как есть,
 *    чтобы сохранить оригинальную кодировку (UTF-8, Windows-1251, etc.)
 */
export async function processAndSaveHtml(file: File, htmlId: string): Promise<string> {
  await saveStepHtml(htmlId, file);
  return createHtmlObjectUrl(file);
}

/** Загрузить HTML из IDB → вернуть objectURL */
export async function loadStepHtmlUrl(htmlId: string): Promise<string | null> {
  const blob = await getStepHtml(htmlId);
  if (!blob) return null;
  return createHtmlObjectUrl(blob);
}

/** Удалить HTML из IDB */
export async function removeStepHtml(htmlId: string): Promise<void> {
  await deleteStepHtml(htmlId);
}
