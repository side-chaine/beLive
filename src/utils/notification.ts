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
    if (div.parentNode) {div.parentNode.removeChild(div);}
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

/* ────────────────────────────────────────────────────────────────────────────
 * Уведомление о результате разделения.
 * Только два факта: готово / не получилось. Очередь и промежуточные статусы
 * сюда не попадают — их видно в Порте, а лишние уведомления раздражают.
 * Выезд снизу справа, как в Windows; наведение останавливает таймер.
 * ──────────────────────────────────────────────────────────────────────────── */

export interface TrackNotice {
  kind: 'ready' | 'failed';
  title: string;
  text: string;
}

const NOTICE_LIFETIME_MS = 6000;
const NOTICE_CSS_ID = 'bl-ntc-style';

function _ensureNoticeCss(): void {
  if (document.getElementById(NOTICE_CSS_ID)) {return;}
  const style = document.createElement('style');
  style.id = NOTICE_CSS_ID;
  style.textContent = `
.bl-ntc{pointer-events:auto;position:relative;display:flex;gap:11px;align-items:flex-start;
  width:372px;max-width:min(372px,calc(100vw - 40px));padding:12px 13px 13px;
  border-radius:14px;overflow:hidden;cursor:pointer;color:#e8e8ec;
  font:13px/1.45 system-ui,sans-serif;background:rgba(20,20,25,.94);
  border:1px solid rgba(255,255,255,.1);
  box-shadow:0 18px 46px -14px rgba(0,0,0,.85);
  -webkit-backdrop-filter:blur(22px) saturate(170%);backdrop-filter:blur(22px) saturate(170%);
  animation:bl-ntc-in .3s cubic-bezier(.16,1,.3,1) both}
.bl-ntc::before{content:'';position:absolute;left:0;top:0;bottom:0;width:2px;background:#4ade80}
.bl-ntc--err::before{background:#f87171}
.bl-ntc.is-out{animation:bl-ntc-out .18s ease-in forwards}
.bl-ntc__ico{width:34px;height:34px;border-radius:9px;flex:0 0 auto;position:relative;
  display:flex;align-items:flex-end;justify-content:center;gap:2px;padding:7px 6px;
  background:rgba(74,222,128,.1);border:1px solid rgba(74,222,128,.32)}
.bl-ntc--err .bl-ntc__ico{background:rgba(248,113,113,.1);border-color:rgba(248,113,113,.35)}
.bl-ntc__ico b{display:block;width:2px;border-radius:1px;background:#4ade80;opacity:1}
.bl-ntc--err .bl-ntc__ico b{display:none}
.bl-ntc__ico b:nth-child(1){height:8px}.bl-ntc__ico b:nth-child(2){height:14px}
.bl-ntc__ico b:nth-child(3){height:10px}.bl-ntc__ico b:nth-child(4){height:16px}
.bl-ntc__ico b:nth-child(5){height:9px}.bl-ntc__ico b:nth-child(6){height:13px}
.bl-ntc__ico b:nth-child(7){height:7px}
.bl-ntc__glyph{position:absolute;inset:0;display:none;align-items:center;justify-content:center;font-size:15px}
.bl-ntc--err .bl-ntc__glyph{display:flex}
.bl-ntc__body{flex:1;min-width:0;padding-top:1px}
.bl-ntc__title{font-size:12.5px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bl-ntc__text{font-size:11px;color:rgba(255,255,255,.42);margin-top:2px;line-height:1.45}
.bl-ntc__close{position:absolute;top:8px;right:8px;width:18px;height:18px;border-radius:5px;
  display:flex;align-items:center;justify-content:center;font-size:12px;line-height:1;
  color:rgba(255,255,255,.35);background:rgba(255,255,255,.05);border:none;cursor:pointer;
  opacity:0;transition:opacity .15s}
.bl-ntc:hover .bl-ntc__close{opacity:1}
.bl-ntc__close:hover{color:#e8e8ec;background:rgba(255,255,255,.12)}
.bl-ntc__drain{position:absolute;left:0;right:0;bottom:0;height:2px;background:rgba(255,255,255,.06)}
.bl-ntc__drain i{display:block;height:100%;width:100%;background:rgba(255,255,255,.3);
  transform-origin:left;animation:bl-ntc-drain ${NOTICE_LIFETIME_MS}ms linear forwards}
.bl-ntc:hover .bl-ntc__drain i{animation-play-state:paused}
@keyframes bl-ntc-in{0%{opacity:0;transform:translateY(22px) scale(.97)}100%{opacity:1;transform:none}}
@keyframes bl-ntc-out{0%{opacity:1;transform:none}100%{opacity:0;transform:translateY(14px) scale(.98)}}
@keyframes bl-ntc-drain{0%{transform:scaleX(1)}100%{transform:scaleX(0)}}
@media (prefers-reduced-motion: reduce){
  .bl-ntc{animation:bl-ntc-fade .18s ease-out both}
  .bl-ntc.is-out{animation:none;opacity:0}
  .bl-ntc__drain i{animation:none;transform:none}
  @keyframes bl-ntc-fade{from{opacity:0}to{opacity:1}}
}`;
  document.head.appendChild(style);
}

function _dismissNotice(el: HTMLDivElement): void {
  if (el.classList.contains('is-out')) {return;}
  el.classList.add('is-out');
  setTimeout(() => el.remove(), 200);
}

/**
 * Показать уведомление о результате разделения.
 * Срабатывает только на терминальном статусе — один раз на джоб.
 */
export function showTrackNotice(notice: TrackNotice): HTMLDivElement | null {
  if (typeof document === 'undefined') {return null;}
  _ensureNoticeCss();

  const el = document.createElement('div');
  el.className = `bl-ntc${notice.kind === 'failed' ? ' bl-ntc--err' : ''}`;
  el.setAttribute('role', 'status');

  const ico = document.createElement('div');
  ico.className = 'bl-ntc__ico';
  for (let i = 0; i < 7; i++) {ico.appendChild(document.createElement('b'));}
  const glyph = document.createElement('span');
  glyph.className = 'bl-ntc__glyph';
  glyph.textContent = '⚠';
  ico.appendChild(glyph);

  const body = document.createElement('div');
  body.className = 'bl-ntc__body';
  const title = document.createElement('div');
  title.className = 'bl-ntc__title';
  title.textContent = notice.title;
  const text = document.createElement('div');
  text.className = 'bl-ntc__text';
  text.textContent = notice.text;
  body.append(title, text);

  const close = document.createElement('button');
  close.className = 'bl-ntc__close';
  close.type = 'button';
  close.setAttribute('aria-label', 'Закрыть');
  close.textContent = '✕';

  const drain = document.createElement('div');
  drain.className = 'bl-ntc__drain';
  drain.appendChild(document.createElement('i'));

  el.append(ico, body, close, drain);

  let timer = setTimeout(() => _dismissNotice(el), NOTICE_LIFETIME_MS);
  el.addEventListener('mouseenter', () => clearTimeout(timer));
  el.addEventListener('mouseleave', () => { timer = setTimeout(() => _dismissNotice(el), 2400); });
  el.addEventListener('click', () => _dismissNotice(el));

  _getToastStack().appendChild(el);
  return el;
}
