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
const KEY_TOGGLE = 'Slash';       // `/` key
const KEY_ATTACK = 'KeyX';        // `X` key
const KEY_JUMP = 'Space';         // space key
const KEY_ESCAPE = 'Escape';
const DOUBLE_JUMP_WINDOW = 400;   // ms between space presses

// ── Closure state (НЕ singleton, НЕ store) ──
let _lastSpaceAt = 0;

// ── Guard: не перехватывать в input/textarea/select ──
function shouldIntercept(e: KeyboardEvent): boolean {
  const tag = (e.target as HTMLElement)?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return false;
  if ((e.target as HTMLElement)?.isContentEditable) return false;
  return true;
}

// ── Callbacks type ──
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

      // ── `/` — Toggle Focus Mode ──
      if (e.code === KEY_TOGGLE) {
        e.preventDefault();
        const wasActive = isBillyControlActive();
        const nowActive = toggleBillyControl();
        if (nowActive !== wasActive) {
          callbacksRef.current.onFocusChange?.(nowActive);
        }
        return;
      }

      // ── Escape — Deactivate Focus Mode ──
      if (e.code === KEY_ESCAPE && isBillyControlActive()) {
        e.preventDefault();
        setBillyControlActive(false);
        callbacksRef.current.onFocusChange?.(false);
        return;
      }

      // ── Below: only in Focus Mode ──
      if (!isBillyControlActive()) return;

      // ── `X` — Mic Grab (attack) ──
      if (e.code === KEY_ATTACK && !e.shiftKey) {
        e.preventDefault();
        callbacksRef.current.onAttack?.();
        return;
      }

      // ── `space` — Jump / Double Jump ──
      if (e.code === KEY_JUMP) {
        e.preventDefault();
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

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Auto-deactivate on overlay open ──
  useEffect(() => {
    const unsub = useTrackInfoStore.subscribe((state) => {
      if (state.isOpen && isBillyControlActive()) {
        setBillyControlActive(false);
        callbacksRef.current.onFocusChange?.(false);
      }
    });
    return unsub;
  }, []);

  // ── Auto-deactivate on track change ──
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
