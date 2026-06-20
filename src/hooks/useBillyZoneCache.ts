import { useEffect } from 'react';
import { useBillyRuntimeStore } from '../billy/billy-runtime.store';
import { BILLY_MARGIN_X, CORNER_POS } from '../billy/billy.constants';
import { useDeckStore } from '../stores/deck.store';

/**
 * Вычисляет ZoneBounds из реальной геометрии layout-компонентов.
 * Читает CSS vars, опубликованные ResizeObserver в Header/WagonTrain/ControlDeck.
 *
 * INV-BILLY-COORD: Все значения нормализованы 0..1
 * INV-BILLY-SURFACE: cornerY = groundBottom — Билли стоит НА деке
 */
export function useBillyZoneCache() {
  useEffect(() => {
    const compute = () => {
      const root = document.documentElement;
      const cs = getComputedStyle(root);
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (vh === 0 || vw === 0) return;

      // ── Layout heights из CSS vars ──
      const headerH = parseFloat(cs.getPropertyValue('--react-header-height')) || 64;
      const wagonH = parseFloat(cs.getPropertyValue('--wagon-train-height')) || 40;
      const deckH = parseFloat(cs.getPropertyValue('--bl-deck-height')) || 80;

      // ── Ground: от низа WagonTrain до верха ControlDeck ──
      const groundTop = (headerH + wagonH) / vh;
      const groundBottom = (vh - deckH) / vh;

      // ── Safe margins: Billy не вылезает за viewport ──
      const groundLeft = BILLY_MARGIN_X / vw;
      const groundRight = 1 - BILLY_MARGIN_X / vw;

      // ── Corner: правый край, стоит НА поверхности дока ──
      const cornerX = Math.min(groundRight - 0.06, CORNER_POS.x);
      const cornerY = groundBottom; // НЕ CORNER_POS.y! Ноги = поверхность

      useBillyRuntimeStore.getState().updateZoneCache({
        ground: {
          top: groundTop,
          bottom: groundBottom,
          left: groundLeft,
          right: groundRight,
        },
        corner: { x: cornerX, y: cornerY },
      });
    };

    // Первичное вычисление
    compute();

    // Пересчёт при resize
    const ro = new ResizeObserver(compute);
    ro.observe(document.documentElement);

    // Пересчёт при изменении состояния дока (сворачивание/разворачивание)
    // ControlDeck — fixed элемент, viewport ResizeObserver не ловит его
    const unsubDeck = useDeckStore.subscribe(() => {
      compute();
      setTimeout(compute, 50);   // CSS transition в процессе
      setTimeout(compute, 300);  // transition завершён
      setTimeout(compute, 600);  // финальная стабилизация
    });

    // Post-layout settle
    const settle1 = setTimeout(compute, 300);
    const settle2 = setTimeout(compute, 1000);

    return () => {
      ro.disconnect();
      clearTimeout(settle1);
      clearTimeout(settle2);
      unsubDeck();
    };
  }, []);
}
