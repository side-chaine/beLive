import { useLyricsStore } from '../stores/lyrics.store';
import { useModeStore } from '../stores/mode.store';
import styles from './LiveSubtitle.module.css';
import { WordHighlightLine } from '../triggers/WordHighlightLine';

export function LiveSubtitle() {
  const mode = useModeStore(s => s.mode);
  const lines = useLyricsStore(s => s.lines);
  const activeLineIndex = useLyricsStore(s => s.activeLineIndex);
  
  if (mode !== 'live') return null;
  
  const text = activeLineIndex >= 0 && activeLineIndex < lines.length
    ? lines[activeLineIndex]
    : '';
  
  return (
    <div className={styles.container}>
      <div className={`${styles.line} ${!text ? styles.empty : ''}`}>
        {text ? <WordHighlightLine lineIndex={activeLineIndex} text={text} /> : '\u00A0'}
      </div>
    </div>
  );
}
