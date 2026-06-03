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
import { useShowStore } from '../stores/show.store';

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
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!shouldIntercept(e)) return;

      // ── Show scenario guard ──
      const showState = useShowStore.getState();
      if (showState.activeMode === 'scenario' && !showState.featureActive) {
        // ❄️ INV-SHOW-KEY-01: During presentation, PresenterDock owns keyboard.
        // Billy must NOT intercept Space (jump) or any other key.
        // Arrows still work via useKeyboardShortcuts (separate handler).
        if (showState.isPresenting) {
          return;
        }
        return;
      }

      if (e.code === KEY_TOGGLE) {
        e.preventDefault();
        const wasActive = isBillyControlActive();
        const nowActive = toggleBillyControl();
        if (nowActive !== wasActive) {
          callbacksRef.current.onFocusChange?.(nowActive);
          // Сброс direction при выходе из Focus Mode
          if (!nowActive) {
            document.documentElement.removeAttribute('data-billy-direction');
          }
        }
        return;
      }

      if (e.code === KEY_ESCAPE && isBillyControlActive()) {
        e.preventDefault();
        setBillyControlActive(false);
        document.documentElement.removeAttribute('data-billy-direction');
        callbacksRef.current.onFocusChange?.(false);
        return;
      }

      // ── Arrow keys: пишем direction в DOM ──
      if (isBillyControlActive() && !e.shiftKey &&
          (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) {
        e.preventDefault();
        e.stopPropagation();
        const dir = e.code === 'ArrowLeft' ? 'left' : 'right';
        document.documentElement.setAttribute('data-billy-direction', dir);
        return;
      }

      // ArrowUp/ArrowDown — перехватываем без действия (W4: vertical)
      if (isBillyControlActive() && !e.shiftKey &&
          (e.code === 'ArrowUp' || e.code === 'ArrowDown')) {
        e.preventDefault();
        e.stopPropagation();
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

    const handleKeyUp = (e: KeyboardEvent) => {
      // Сброс direction при отпускании стрелки
      if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        const current = document.documentElement.getAttribute('data-billy-direction');
        // Сброс только если текущее направление совпадает с отпущенной клавишей
        if (e.code === 'ArrowLeft' && current === 'left') {
          document.documentElement.removeAttribute('data-billy-direction');
        }
        if (e.code === 'ArrowRight' && current === 'right') {
          document.documentElement.removeAttribute('data-billy-direction');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('keyup', handleKeyUp);
      document.documentElement.removeAttribute('data-billy-direction');
    };
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
