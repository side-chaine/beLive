import { useTextStyleStore } from '../stores/textStyle.store';
import '../data/textStylePresets'; // F21: sets window.__TEXT_STYLE_PRESETS

let unsub: (() => void) | null = null;
let retryTimer: ReturnType<typeof setInterval> | null = null;

let activeObs: MutationObserver | null = null;
let lastActiveEl: Element | null = null;
let lastTimeout: ReturnType<typeof setTimeout> | null = null;

function scaleFontSize(fontSize: string, scale: number) {
  const match = fontSize.match(/([0-9\.]+)(.*)/);
  if (!match || match.length < 3) return fontSize;
  const value = parseFloat(match[1]);
  const unit = match[2] || '';
  const scaled = value * scale;
  return `${scaled.toFixed(2)}${unit}`;
}

/** Build a style object that lyricsDisplay.setStyle() expects */
function buildStyleObject(fontFamily: string, fontScale: number) {
  const baseFontSize = '1.6em';
  return {
    id: 'concert',
    name: 'Концертный',
    description: 'Крупный, контрастный текст для выступлений',
    category: 'hidden',
    cssClass: 'style-concert',
    containerClass: 'container-concert',
    transition: 'zoom',
    options: {
      textAlign: 'center',
      fontSize: scaleFontSize(baseFontSize, fontScale),
      lineSpacing: '1.6',
      fontFamily: fontFamily,
      textColor: '#ffffff',
      backgroundColor: 'transparent',
      fontWeight: 'bold',
    },
  };
}

function getLyricsDisplay(): any {
  return (window as any).lyricsDisplay ?? null;
}

function forceInlineFontFamily(fontFamily: string) {
  const ld = getLyricsDisplay();
  const root: HTMLElement | null =
    ld?.lyricsContainer ??
    document.getElementById('lyrics-display');

  if (!root) return;

  // Force on container
  try {
    root.style.setProperty('font-family', fontFamily, 'important');
  } catch {}

  // Force on every line (CSS might override lines directly)
  const lines = root.querySelectorAll('.lyric-line');
  lines.forEach(el => {
    try {
      (el as HTMLElement).style.setProperty('font-family', fontFamily, 'important');
    } catch {}
  });
}

function ensureBecomingActiveDriver() {
  if (activeObs) return;

  const ld = getLyricsDisplay();
  const root: HTMLElement | null =
    ld?.lyricsContainer ??
    document.getElementById('lyrics-display');

  if (!root) return;

  const trigger = () => {
    const el = root.querySelector('.lyric-line.active');
    if (!el || el === lastActiveEl) return;

    lastActiveEl = el;

    // Re-apply font in case legacy re-render recreated nodes / re-applied CSS
    const { fontFamily } = useTextStyleStore.getState();
    forceInlineFontFamily(fontFamily);

    try {
      el.classList.add('becoming-active');
    } catch {}

    if (lastTimeout) clearTimeout(lastTimeout);
    lastTimeout = setTimeout(() => {
      try {
        el.classList.remove('becoming-active');
      } catch {}
    }, 900);
  };

  const syncFont = () => {
    const { fontFamily } = useTextStyleStore.getState();
    forceInlineFontFamily(fontFamily);
  };

  activeObs = new MutationObserver(() => {
    // Any DOM update in lyrics can recreate lines → re-apply inline font.
    syncFont();
    trigger();
  });

  activeObs.observe(root, {
    subtree: true,
    attributes: true,
    attributeFilter: ['class'],
    childList: true,
  });

  /* initial */
  syncFont();
  trigger();
}

function applyFont(fontFamily: string, fontScale: number): boolean {
  const ld = getLyricsDisplay();
  if (!ld?.setStyle) return false;
  const style = buildStyleObject(fontFamily, fontScale);
  ld.setStyle(style);

  // Hard guarantee: enforce on actual rendered lines
  forceInlineFontFamily(fontFamily);

  // Some legacy renders may happen async; do a second pass
  requestAnimationFrame(() => forceInlineFontFamily(fontFamily));
  setTimeout(() => forceInlineFontFamily(fontFamily), 50);

  /* F21: dead TSM backfill removed — presets now in React store */
  return true;
}

function applyTransition(transitionId: string): boolean {
  const ld = getLyricsDisplay();
  if (!ld?.setTransition) return false;
  ld.setTransition(transitionId);

  /* F21: dead TSM backfill removed — transition managed by React store */
  return true;
}

function applyAll() {
  const { fontFamily, transitionId, fontScale } = useTextStyleStore.getState();
  const fontOk = applyFont(fontFamily, fontScale);
  const transOk = applyTransition(transitionId);
  return fontOk && transOk;
}

/** F34: Re-apply style + rehearsal restore after track load */
function onTrackLoaded(): void {
  applyAll();
  if (document.body.classList.contains('mode-rehearsal')) {
    const ld = getLyricsDisplay();
    if (ld?.activateRehearsalDisplay) ld.activateRehearsalDisplay();
  }
}

export function initTextStyleBridge() {
  if (unsub) return;

  const store = useTextStyleStore;

  /* Try to apply now; if lyricsDisplay not ready, retry every 500ms */
  if (!applyAll()) {
    retryTimer = setInterval(() => {
      if (applyAll()) {
        ensureBecomingActiveDriver();
        if (retryTimer) {
          clearInterval(retryTimer);
          retryTimer = null;
        }
      }
    }, 500);
  } else {
    ensureBecomingActiveDriver();
  }

  /* Subscribe to store changes */
  unsub = store.subscribe((state, prev) => {
    if (state.fontFamily !== prev.fontFamily || state.fontScale !== prev.fontScale) {
      applyFont(state.fontFamily, state.fontScale);
    }
    if (state.transitionId !== prev.transitionId) {
      applyTransition(state.transitionId);
    }
    /* F21: redundant tsm.setStyle removed — bridge calls ld.setStyle directly */
  });

  /* F34: Re-apply style when track loads */
  document.addEventListener('track-loaded', onTrackLoaded);
}

export function destroyTextStyleBridge() {
  unsub?.();
  unsub = null;
  if (retryTimer) {
    clearInterval(retryTimer);
    retryTimer = null;
  }
  if (activeObs) {
    activeObs.disconnect();
    activeObs = null;
  }
  lastActiveEl = null;
  if (lastTimeout) {
    clearTimeout(lastTimeout);
    lastTimeout = null;
  }
  document.removeEventListener('track-loaded', onTrackLoaded);
}
