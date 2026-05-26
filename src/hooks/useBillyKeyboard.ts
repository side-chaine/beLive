// ═══ Billy Keyboard Handler ═══
// INV-BILLY-CTRL: Control = модификатор, не режим
// `/` = Focus Mode toggle (e.code, НЕ e.key — русская раскладка)
// `X` = Mic Grab (в Focus Mode)
// `space` = Jump / Double Jump (в Focus Mode)
// `Escape` = Focus Mode off

import { useEffect, useRef } from 'react';
import {
  isBillyControlActive,
  setBillyControlActive,
  toggleBillyControl,
} from './useBillyControl';
import { useTrackInfoStore } from '../stores/trackInfo.store';

// ── Constants ──
const KEY_TOGGLE = 'Slash';
const KEY_ATTACK = 'KeyX';
const KEY_JUMP = 'Space';
const KEY_ESCAPE = 'Escape';
const DOUBLE_JUMP_WINDOW = 400;

// ── Closure state ──
let _lastSpaceAt = 0;

function shouldIntercept(e: KeyboardEvent): boolean {
  const tag = (e.target as HTMLElement)?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return false;
  if ((e.target as HTMLElement)?.isContentEditable) return false;
  return true;
}

interface KeyboardCallbacks {
  onAttack?: () => void;
  onJump?: (type: 'single' | 'double') => void;
  onFocusChange?: (active: boolean) => void;
}

export function useBillyKeyboard(callbacks: KeyboardCallbacks = {}) {
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!shouldIntercept(e)) return;

      if (e.code === KEY_TOGGLE) {
        e.preventDefault();
        const wasActive = isBillyControlActive();
        const nowActive = toggleBillyControl();
        if (nowActive !== wasActive) {
          callbacksRef.current.onFocusChange?.(nowActive);
        }
        return;
      }

      if (e.code === KEY_ESCAPE && isBillyControlActive()) {
        e.preventDefault();
        setBillyControlActive(false);
        callbacksRef.current.onFocusChange?.(false);
        return;
      }

      // ── Arrow keys: перехват в Focus Mode ──
      if (isBillyControlActive() && !e.shiftKey &&
          (e.code === 'ArrowLeft' || e.code === 'ArrowRight' ||
           e.code === 'ArrowUp' || e.code === 'ArrowDown')) {
        e.preventDefault();
        e.stopPropagation();
        // W10: movement direction from arrows
        return;
      }

      if (!isBillyControlActive()) return;

      if (e.code === KEY_ATTACK && !e.shiftKey) {
        e.preventDefault();
        callbacksRef.current.onAttack?.();
        return;
      }

      if (e.code === KEY_JUMP) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const now = performance.now();
        const timeSinceLastSpace = now - _lastSpaceAt;
        if (timeSinceLastSpace < DOUBLE_JUMP_WINDOW) {
          _lastSpaceAt = 0;
          callbacksRef.current.onJump?.('double');
        } else {
          _lastSpaceAt = now;
          callbacksRef.current.onJump?.('single');
        }
        return;
      }
    };

    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, []);

  useEffect(() => {
    const unsub = useTrackInfoStore.subscribe((state) => {
      if (state.isOpen && isBillyControlActive()) {
        setBillyControlActive(false);
        callbacksRef.current.onFocusChange?.(false);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    const handler = () => {
      if (isBillyControlActive()) {
        setBillyControlActive(false);
        callbacksRef.current.onFocusChange?.(false);
      }
    };
    document.addEventListener('before-track-change', handler);
    return () => document.removeEventListener('before-track-change', handler);
  }, []);
}
