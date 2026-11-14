import type { SubBlock } from '../utils/block-utils';
import type { TextBlock } from '../stores/blocks.store';
import styles from './WagonTrain.module.css';

interface SubSegmentRowProps {
  block: TextBlock;
  /** 708 / 22.1x: готовый массив из WagonTrain — один расчёт на вагон. */
  subBlocks: SubBlock[];
  /** BL-050-ui: римские метки I–IV (без глифов/цветов — решение владельца). */
  roman?: string[];
  /** BL-050-ui (У13): вес ширины ∝ времени; null → fallback на число строк. */
  weights?: (number | null)[];
  isActive: boolean;
  activeSubIdx: number;
  /** Блок целиком в петле — тогда у суб-блоков доступны кнопки +/−. */
  inLoopBlock: boolean;
  loopSubBlockKeys: string[];
  /** Края непрерывного пробега петли по суб-блокам — только они съёмные. */
  firstSubKey: string | null;
  lastSubKey: string | null;
  /** Суб-блоки сразу за пробегом — на них показываем «+» (расширить). */
  adjacentSubKeys: Set<string>;
  onSubClick: (block: TextBlock, subFirstLineIndex: number) => void;
  onToggleSub: (block: TextBlock, subIndex: number) => void;
}

/**
 * Ряд суб-блоков — отдельный компонент (Центр_2, 07.11).
 *
 * 708 / 23:5x · канон Никиты: «убираем квадраты». Заливки карточек больше НЕТ.
 * Раньше в регион попадала карточка целиком и превращалась в ровный янтарный
 * прямоугольник поверх тёмного блока — читалось как наклейка, а не как «блок
 * горит». Теперь регион показывает ОДИН слой — свечение вагона, обрезанное по
 * отсечке (см. .loopEdge в WagonTrain.module.css). Ряд суб-блоков остаётся
 * нейтральным: он про сегментацию и плейхед, а не про петлю.
 */
export function SubSegmentRow({
  block,
  subBlocks,
  roman,
  weights,
  isActive,
  activeSubIdx,
  inLoopBlock,
  loopSubBlockKeys,
  firstSubKey,
  lastSubKey,
  adjacentSubKeys,
  onSubClick,
  onToggleSub,
}: SubSegmentRowProps) {
  if (subBlocks.length <= 1) return null;

  // Ширина ∝ времени — только если ВСЕ веса известны (иначе смешаем единицы).
  const byTime = !!weights && weights.length === subBlocks.length &&
    weights.every((w) => w != null && w > 0);

  return (
    <div className={styles.subSegments}>
      {subBlocks.map((sub, si) => {
        const key = `${block.id}:${si}`;
        const active = isActive && si === activeSubIdx;
        const inSubLoop = loopSubBlockKeys.includes(key);
        // Только крайние суб-блоки пробега петли съёмные (как и у вагонов):
        // середина не удаляется — стор сам откажет. «+» — только на соседях.
        const showMinus = inSubLoop && (key === firstSubKey || key === lastSubKey);
        const showPlus = !inSubLoop && adjacentSubKeys.has(key);
        const flex = byTime ? weights![si]! : sub.lineIndices.length;
        return (
          <div
            key={sub.id}
            className={styles.subSegmentWrapper}
            style={{ flex }}
          >
            <div
              className={styles.subSegment}
              data-sub-active={active || undefined}
              /* 708 / 07.11 · шаг 3: data-in-loop носят ТОЛЬКО вагоны.
                 Иначе useLoopContourGeometry собирал подблоки в геометрию =>
                 4 контура вместо одного и разрыв пробега по nextElementSibling. */
              data-sub-in-loop={inSubLoop || undefined}
              onClick={(e) => {
                e.stopPropagation();
                onSubClick(block, sub.lineIndices[0]);
              }}
            >
              {roman?.[si] && (
                <span className={styles.subSegmentRoman} aria-hidden="true">
                  {roman[si]}
                </span>
              )}
            </div>
            {inLoopBlock && (showMinus || showPlus) && (
              <span
                role="button"
                tabIndex={0}
                className={styles.subLoopToggle}
                data-active={showMinus || undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSub(block, si);
                }}
                title={showMinus ? 'Remove from loop' : 'Add to loop'}
              >
                {showMinus ? '−' : '+'}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
