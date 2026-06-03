import { useEffect, useRef, useCallback } from 'react';

/**
 * Auto-resize textarea to fit content.
 * 
 * Callback ref → sync height on mount (no 1-frame glitch).
 * useEffect → resize on value change.
 * 
 * Usage: const ref = useAutoResize([value]);
 *        <textarea ref={ref} rows={1} />
 */
export function useAutoResize(deps: unknown[]) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const callbackRef = useCallback((el: HTMLTextAreaElement | null) => {
    ref.current = el;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, deps);

  return callbackRef;
}
