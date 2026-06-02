import { useEffect, useRef, useState } from 'react';

/**
 * Возвращает true если мышь не двигалась delayMs миллисекунд.
 * Публикует data-mouse-idle на <html> для CSS.
 * Убирает cursor когда idle.
 */
export function useMouseIdle(delayMs = 2500): boolean {
  const [idle, setIdle] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const reset = () => {
    setIdle(false);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setIdle(true), delayMs);
  };

  useEffect(() => {
    reset();

    window.addEventListener('mousemove', reset);
    window.addEventListener('mousedown', reset);
    window.addEventListener('keydown', reset);

    return () => {
      window.removeEventListener('mousemove', reset);
      window.removeEventListener('mousedown', reset);
      window.removeEventListener('keydown', reset);
      clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delayMs]);

  // DOM публикация для CSS
  useEffect(() => {
    document.documentElement.setAttribute('data-mouse-idle', idle ? 'true' : 'false');
    document.body.style.cursor = idle ? 'none' : '';
    return () => {
      document.documentElement.removeAttribute('data-mouse-idle');
      document.body.style.cursor = '';
    };
  }, [idle]);

  return idle;
}
