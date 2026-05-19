import React from 'react';
import { useDeckStore } from '../stores/deck.store';
import { useStemStore } from '../stem/stem.store';
import { InstrumentStrip } from './InstrumentStrip';
import styles from './InstrumentOverlay.module.css';

// Глобальный CSS для tier gating + recording clamp
import '../triggers/instrument-card.css';

export function InstrumentOverlay() {
  const visualMode = useDeckStore(s => s.visualMode);
  const deckExpanded = useDeckStore(s => s.expanded);
  const stemsMode = useStemStore(s => s.stemsMode);
  const loadedStems = useStemStore(s => s.loadedStems);
  
  // Visible: visual mode + stems mode + deck collapsed + has stems beyond instrumental
  // Mode check deferred — overlay only rendered in rehearsal mode (TC-VM-011 controls this)
  const hasStems = loadedStems.filter(id => id !== 'instrumental').length > 0;
  const visible = visualMode && stemsMode && !deckExpanded && hasStems;
  
  return (
    <div 
      className={`${styles.overlay} ${visible ? styles.visible : styles.hidden}`}
      data-vm-overlay=""
    >
      <div className={styles.toolbar}>
        <button 
          className={styles.modeBtn}
          onClick={() => useDeckStore.getState().exitVisualMode()}
          title="Switch to DAW mode"
        >
          DAW
        </button>
      </div>
      <InstrumentStrip />
    </div>
  );
}
