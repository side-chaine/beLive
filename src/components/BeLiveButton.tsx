import { useEffect, useRef } from 'react';
import { useUIStore } from '../stores/ui.store';
import styles from './BeLiveButton.module.css';

export function BeLiveButton() {
  const appMode = useUIStore(s => s.appMode);
  const setAppMode = useUIStore(s => s.setAppMode);
  const borderRef = useRef<HTMLDivElement>(null);
  const isOpen = appMode === 'feed';

  useEffect(() => {
    const el = borderRef.current;
    if (!el) return;
    el.classList.remove(styles['bl-spin-open'], styles['bl-spin-close']);
    void el.offsetWidth;
    el.classList.add(isOpen ? styles['bl-spin-open'] : styles['bl-spin-close']);
  }, [isOpen]);

  return (
    <div
      className={`${styles['bl-wrap']} ${isOpen ? styles['open'] : ''}`}
      onClick={() => setAppMode(isOpen ? 'studio' : 'feed')}
    >
      <div className={styles['bl-border']} ref={borderRef} />
      <div className={styles['bl-glow']} />
      <div className={styles['bl-inner']}>
        <span className={`${styles['letter']} ${styles['letter-b']}`}>b</span>
        <span className={`${styles['letter']} ${styles['letter-e']}`}>e</span>
        <span className={`${styles['letter']} ${styles['letter-L']}`}>L</span>
        <span className={`${styles['letter']} ${styles['letter-ive']}`}>ive</span>
      </div>
      <div className={styles['bl-reflection']} />
    </div>
  );
}
