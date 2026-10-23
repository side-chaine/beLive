/**
 * App notification utility.
 * Extracted from app.js (F7 migration).
 * 3-level fallback: LyricsDisplay → LiveMode → DOM toast.
 */

export type NotificationType = 'info' | 'success' | 'error';

/**
 * Plain DOM toast — always visible, independent of LyricsDisplay.
 * Pinned to the TOP center (away from the bottom player deck) with max z-index.
 */
export function showToast(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
  const div = document.createElement('div');
  div.textContent = message;
  div.setAttribute('role', 'alert');
  div.style.cssText =
    'position:fixed;top:16px;left:50%;transform:translateX(-50%);' +
    'max-width:min(720px,90vw);' +
    'padding:10px 20px;border-radius:5px;color:#fff;' +
    'font:14px/1.4 system-ui,sans-serif;' +
    'z-index:2147483647;pointer-events:none;' +
    'box-shadow:0 6px 24px rgba(0,0,0,.35);' +
    'background:' +
    (type === 'error'
      ? 'rgba(220,53,69,0.9)'
      : type === 'success'
      ? 'rgba(40,167,69,0.9)'
      : 'rgba(0,123,255,0.9)');
  document.body.appendChild(div);
  const duration = type === 'error' ? 8000 : 5000;
  setTimeout(() => {
    if (div.parentNode) div.parentNode.removeChild(div);
  }, duration);
}

export function showAppNotification(message: string, type: string = 'info'): void {
  // Priority 1: LyricsDisplay statusDisplay
  try {
    const w = window as any;
    const ld = w.lyricsDisplay;
    if (ld && ld.statusDisplay && typeof ld.statusDisplay.updateStatus === 'function') {
      ld.statusDisplay.updateStatus(message, type);
      return;
    }
  } catch (_) {}

  // Priority 2: DOM toast
  showToast(message, type as 'info' | 'success' | 'error');
}
