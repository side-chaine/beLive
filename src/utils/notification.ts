/**
 * App notification utility.
 * Extracted from app.js (F7 migration).
 * 3-level fallback: LyricsDisplay → LiveMode → DOM toast.
 */

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

  // Priority 2: LiveMode error message
  try {
    const w = window as any;
    if (w.liveMode && typeof w.liveMode._showErrorMessage === 'function') {
      w.liveMode._showErrorMessage(message, type);
      return;
    }
  } catch (_) {}

  // Priority 3: DOM toast
  const div = document.createElement('div');
  div.textContent = message;
  div.style.cssText =
    'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);' +
    'padding:10px 20px;border-radius:5px;color:#fff;z-index:9999;' +
    'background:' +
    (type === 'error'
      ? 'rgba(220,53,69,0.9)'
      : type === 'success'
      ? 'rgba(40,167,69,0.9)'
      : 'rgba(0,123,255,0.9)');
  document.body.appendChild(div);
  setTimeout(() => {
    if (div.parentNode) div.parentNode.removeChild(div);
  }, 5000);
}
