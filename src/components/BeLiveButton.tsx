import { useEffect, useRef, type AnimationEvent, type KeyboardEvent } from 'react';
import { useUIStore } from '../stores/ui.store';
import { useRoundelPulse } from '../hooks/useRoundelPulse';
import styles from './BeLiveButton.module.css';

export function BeLiveButton() {
  const appMode = useUIStore(s => s.appMode);
  const setAppMode = useUIStore(s => s.setAppMode);
  const borderRef = useRef<HTMLDivElement>(null);
  const isOpen = appMode === 'feed';
  const { pulseKey, pulseActive, fire, endPulse } = useRoundelPulse('bl');

  useEffect(() => {
    const el = borderRef.current;
    if (!el) return;
    el.classList.remove(styles['bl-spin-open'], styles['bl-spin-close']);
    void el.offsetWidth;
    el.classList.add(isOpen ? styles['bl-spin-open'] : styles['bl-spin-close']);
  }, [isOpen]);

  const activate = () => {
    fire();                                   // echoes on the deck roundel
    setAppMode(isOpen ? 'studio' : 'feed');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' && e.code !== 'Space') return;
    e.preventDefault();                       // global Space shortcut is guarded
    if (!e.repeat) activate();
  };

  return (
    <div
      className={`${styles['bl-wrap']} ${isOpen ? styles['open'] : ''}`}
      data-bl-roundel="bl"
      role="button"
      tabIndex={0}
      aria-label={isOpen ? 'beLive — back to studio' : 'beLive — open feed'}
      aria-pressed={isOpen}
      onClick={activate}
      onKeyDown={onKeyDown}
    >
      <div className={styles['bl-border']} ref={borderRef} />
      {pulseActive && (
        <span
          key={pulseKey}
          className={styles['bl-pulse']}
          data-bl-pulse={pulseKey}
          aria-hidden="true"
          onAnimationEnd={(e: AnimationEvent<HTMLSpanElement>) => {
            // ignore the nested sweep's own animationend
            if (e.target === e.currentTarget) endPulse();
          }}
        >
          <span className={styles['bl-pulse-lit']} />
          <span className={styles['bl-pulse-sweep']} />
        </span>
      )}
      <div className={styles['bl-inner']}>
        <span className={`${styles['letter']} ${styles['letter-b']}`}>b</span>
        <span className={`${styles['letter']} ${styles['letter-e']}`}>e</span>
        <span className={`${styles['letter']} ${styles['letter-L']}`}>L</span>
        <span className={`${styles['letter']} ${styles['letter-ive']}`}>ive</span>
      </div>
    </div>
  );
}
