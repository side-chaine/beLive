import React from 'react';
import { useWordSyncStore } from '../stores/wordSync.store';
import { useTextStyleStore } from '../stores/textStyle.store';
import { useTriggerStore } from './trigger.store';
import { useResolvedTrailDepth } from '../performance/performance.hooks';
import './word-effects.css';

interface WordHighlightLineProps {
  lineIndex: number;
  text: string;
  fx?: 'progress' | 'neon' | 'underline' | 'bounce';
  focus?: 'off' | 'soft' | 'strong';
  blockType?: string;
}

export const WordHighlightLine: React.FC<WordHighlightLineProps> = ({
  lineIndex,
  text,
  fx,
  focus,
  blockType,
}) => {
  const activeWordId = useTriggerStore(s => s.activeWordId);
  const triggerLineIndex = useTriggerStore(s => s.triggerLineIndex);
  const wsStatus = useWordSyncStore(s => s.status);
  const wordTrailDepth = useResolvedTrailDepth();

  // No word-sync data at all → plain text
  if (wsStatus !== 'ready') {
    return <>{text}</>;
  }

  const ws = useWordSyncStore.getState();
  if (!ws.hasUsableWordSyncForLine(lineIndex)) {
    return <>{text}</>;
  }

  const words = ws.getWordsForLine(lineIndex);
  if (!words || words.length === 0) {
    return <>{text}</>;
  }

  const isActiveLine = lineIndex === triggerLineIndex;

  // Past line detection for trail depth
  // 'scene' → settled on active + past visible lines
  // 'line' → settled only on active line
  // 'off' → no settled words
  const isPastLine =
    wordTrailDepth === 'scene' &&
    triggerLineIndex >= 0 &&
    lineIndex < triggerLineIndex;

  // Determine line role for wrapper attribute
  let lineRole: string | undefined;
  if (isActiveLine) {
    lineRole = 'active';
  } else if (isPastLine) {
    lineRole = 'past';
  } else {
    lineRole = 'idle';
  }

  // Calculate active word index for completed word logic (active line only)
  const activeWordIndex = isActiveLine ? words.findIndex(w => w.id === activeWordId) : -1;

  // Determine if FX/focus should be applied to this line
  // Active line: always apply
  // Past lines in Full mode: apply for consistent family styling
  const shouldApplyFx = isActiveLine || isPastLine;

  // ALWAYS render word spans — even for inactive lines.
  // Active line: one word gets --active class.
  // Inactive line: all words dim (no --active).
  // Past lines in Full mode: all words get completed state.
  // data-word-focus controls intensity of the effect (off/soft/strong)
  return (
    <span
      className="bl-word-line"
      data-line-role={lineRole}
      data-word-fx={shouldApplyFx ? (fx || undefined) : undefined}
      data-word-focus={shouldApplyFx ? (focus || undefined) : undefined}
      data-block-type={blockType || undefined}
    >
      {words.map((word, i) => {
        const isActiveWord = isActiveLine && word.id === activeWordId;

        // Settled word detection:
        // - Past lines in 'scene' mode: all words are settled
        // - Active line in 'line' or 'scene' mode: words before active word are settled
        const isSettledWord =
          isPastLine ||
          (isActiveLine &&
            wordTrailDepth !== 'off' &&
            activeWordIndex >= 0 &&
            i < activeWordIndex);

        let wordState: string | undefined;
        if (isActiveWord) {
          wordState = 'active';
        } else if (isSettledWord) {
          wordState = 'settled';
        }

        return (
          <React.Fragment key={word.id || `w-${lineIndex}-${i}`}>
            <span
              className={`bl-word${isActiveWord ? ' bl-word--active' : ''}`}
              data-word-state={wordState}
            >
              {word.text}
            </span>
            {i < words.length - 1 ? ' ' : ''}
          </React.Fragment>
        );
      })}
    </span>
  );
};
