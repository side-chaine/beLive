/**
 * App notification utility.
 * Extracted from app.js (F7 migration).
 * 3-level fallback: LyricsDisplay → LiveMode → DOM toast.
 */

export type NotificationType = 'info' | 'success' | 'error';

/**
 * Plain DOM toast — always visible, independent of LyricsDisplay.
 * Стиль beLive: тёмная плашка + бренд-бордер. Справа снизу (над Billy),
 * стек вертикальный — не перекрывает хедер и транспорт.
 */
let _toastStack: HTMLDivElement | null = null;
function _getToastStack(): HTMLDivElement {
  if (!_toastStack) {
    _toastStack = document.createElement('div');
    _toastStack.style.cssText =
      'position:fixed;top:16px;left:50%;transform:translateX(-50%);' +
      'display:flex;flex-direction:column;gap:8px;align-items:flex-end;' +
      'z-index:2147483647;pointer-events:none;';
    _toastStack.style.top = 'auto';
    _toastStack.style.left = 'auto';
    _toastStack.style.transform = 'none';
    _toastStack.style.bottom = '88px'; // над доком Billy/транспорта
    _toastStack.style.right = '20px';
    document.body.appendChild(_toastStack);
  }
  return _toastStack;
}

export function showToast(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
  const ACCENT: Record<string, string> = {
    error: 'rgba(239,68,68,0.85)',
    success: 'rgba(245,158,11,0.85)', // амбер
    info: 'rgba(196,77,255,0.85)',    // сирень
  };
  const div = document.createElement('div');
  div.textContent = message;
  div.setAttribute('role', 'alert');
  div.style.cssText =
    'max-width:min(460px,90vw);' +
    'padding:10px 14px;border-radius:8px;color:#F5F2FF;' +
    'font:13px/1.45 system-ui,sans-serif;' +
    'pointer-events:none;' +
    'background:rgba(18,15,26,0.92);' +
    `border:1px solid ${ACCENT[type]};` +
    'border-left-width:3px;' +
    'box-shadow:0 6px 24px rgba(0,0,0,.45);';
  _getToastStack().appendChild(div);
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
