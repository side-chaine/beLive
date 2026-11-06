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

    // ═══ ФИКС (Билли-левитация): пересчёт на следующем кадре ═══
    // На маунте ControlDeck публикует реальный --bl-deck-height асинхронно
    // (свой effect + ResizeObserver). Первый compute() гоняет его и читает
    // заглушку 80 → Билли левитирует на загрузке. rAF ловит значение уже
    // после публикации ControlDeck, до первого видимого тика Surface Snap.
    const rafId = requestAnimationFrame(compute);

    // Пересчёт при resize viewport
    const ro = new ResizeObserver(compute);
    ro.observe(document.documentElement);

    // ═══ ФИКС (Билли-поверхность): ловим ЛЮБУЮ публикацию --bl-deck-height ═══
    // ControlDeck пишет эту CSS-var при: первичной публикации, ленивом маунте
    // панели дока, появлении прогресс-бара трека, переходе высоты дока.
    // useBillyZoneCache не смотрит на сам док, поэтому подписываемся на
    // CSS-var через MutationObserver на <html>. Билли теперь ВСЕГДА стоит на
    // живой поверхности дока и едет вместе с ней (раскрытие/скрытие/трек).
    let lastDeckH = document.documentElement.style.getPropertyValue('--bl-deck-height');
    const mo = new MutationObserver(() => {
      const v = document.documentElement.style.getPropertyValue('--bl-deck-height');
      if (v === lastDeckH) return; // только при реальном изменении высоты дока
      lastDeckH = v;
      compute();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });

    // Пересчёт при изменении состояния дока (сворачивание/разворачивание)
    // ControlDeck — fixed элемент, viewport ResizeObserver не ловит его
    const unsubDeck = useDeckStore.subscribe(() => {
      compute();
      setTimeout(compute, 50);   // CSS transition в процессе
      setTimeout(compute, 300);  // transition завершён
      setTimeout(compute, 600);  // финальная стабилизация
    });

    // Post-layout settle (belt-and-suspenders)
    const settle1 = setTimeout(compute, 300);
    const settle2 = setTimeout(compute, 1000);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      mo.disconnect();
      clearTimeout(settle1);
      clearTimeout(settle2);
      unsubDeck();
    };
  }, []);
}
