import { useUIStore } from '../stores/ui.store';
import styles from './BeLiveButton.module.css';

export function BeLiveButton() {
  const appMode = useUIStore(s => s.appMode);
  const setAppMode = useUIStore(s => s.setAppMode);
  const isOpen = appMode === 'feed';

  return (
    <div
      className={`${styles['bl-wrap']} ${isOpen ? styles['open'] : ''}`}
      onClick={() => setAppMode(isOpen ? 'studio' : 'feed')}
    >
      <div className={styles['bl-border']} />
      <div className={styles['bl-inner']}>
        <span className={`${styles['letter']} ${styles['letter-b']}`}>b</span>
        <span className={`${styles['letter']} ${styles['letter-e']}`}>e</span>
        <span className={`${styles['letter']} ${styles['letter-L']}`}>L</span>
        <span className={`${styles['letter']} ${styles['letter-ive']}`}>ive</span>
      </div>
    </div>
  );
}
