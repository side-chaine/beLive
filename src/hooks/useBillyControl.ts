// ═══ Billy Control — Focus Mode Flag ═══
// INV-BILLY-FLAG: Control flag = DOM data-attr
// HMR-safe: DOM переживает module reload
// CSS-accessible: [data-billy-control="true"] правила уже в CSS

import { useState, useEffect } from 'react';
import { useTrackStore } from '../stores/track.store';

// ── Data-attr key ──
const CONTROL_ATTR = 'data-billy-control';

// ── Imperative API (для keyboard handler, bridge, tests) ──

export function isBillyControlActive(): boolean {
  return document.documentElement.getAttribute(CONTROL_ATTR) === 'true';
}

export function setBillyControlActive(v: boolean): void {
  if (v) {
    document.documentElement.setAttribute(CONTROL_ATTR, 'true');
  } else {
    document.documentElement.removeAttribute(CONTROL_ATTR);
  }
}

/**
 * Toggle Focus Mode. Returns new state.
 * Guard: НЕ включается без трека.
 */
export function toggleBillyControl(): boolean {
  const hasTrack = !!useTrackStore.getState().currentTrack;
  if (!hasTrack) return false;

  const next = !isBillyControlActive();
  setBillyControlActive(next);
  return next;
}

// ── React Hook (реактивное наблюдение за data-attr) ──

export function useBillyControl(): boolean {
  const [active, setActive] = useState(isBillyControlActive);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setActive(isBillyControlActive());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [CONTROL_ATTR],
    });
    return () => observer.disconnect();
  }, []);

  return active;
}
