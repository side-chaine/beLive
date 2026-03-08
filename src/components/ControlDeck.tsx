import { Suspense, useEffect, useRef } from 'react';
import { useDeckStore } from '../stores/deck.store';
import { useModeStore } from '../stores/mode.store';
import { usePianoStore } from '../stores/piano.store';
import { getModulesForMode, getLazyComponent } from '../deck/registry';
import '../deck/modules';
import { TransportBar } from './TransportBar';
import styles from './ControlDeck.module.css';

export function ControlDeck() {
  const expanded = useDeckStore(s => s.expanded);
  const activeTabId = useDeckStore(s => s.activeTabId);
  const toggle = useDeckStore(s => s.toggle);
  const setTab = useDeckStore(s => s.setTab);
  const mode = useModeStore(s => s.mode);
  const rootRef = useRef<HTMLDivElement>(null);
  const pianoOpen = usePianoStore(s => s.open);

  const visibleTabs = getModulesForMode(mode);
  const ActiveModule = getLazyComponent(activeTabId);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      document.documentElement.style.setProperty(
        '--bl-deck-height', `${entry.contentRect.height}px`
      );
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty('--bl-deck-height');
    };
  }, []);

  if (pianoOpen) return null;

  return (
    <div ref={rootRef} className={styles.root} data-reactive="true">
      <div className={styles.handle} onClick={toggle}>
        {expanded ? '▲' : '▼'} Controls
      </div>

      <div className={styles.tabs}>
        {visibleTabs.map(t => (
          <button
            key={t.id}
            className={styles.tab}
            data-active={String(t.id === activeTabId)}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {expanded && (
        <div className={styles.panel}>
          {ActiveModule && (
            <Suspense fallback={null}>
              <ActiveModule />
            </Suspense>
          )}
        </div>
      )}

      <TransportBar />
    </div>
  );
}
