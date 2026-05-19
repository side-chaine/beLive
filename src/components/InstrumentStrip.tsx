import React from 'react';
import { useStemStore } from '../stem/stem.store';
import { BUILTIN_STEMS, VISUAL_MIXER_DISPLAY_ORDER } from '../stem/stemTypes';
import { InstrumentCard } from './InstrumentCard';
import styles from './InstrumentStrip.module.css';

export function InstrumentStrip() {
  const loadedStems = useStemStore(s => s.loadedStems);
  
  // Filter: hide instrumental, hide undefined stems
  // Sort: by VISUAL_MIXER_DISPLAY_ORDER (vocals center, rhythm left, melodic right)
  const visibleStems = loadedStems
    .filter(id => id !== 'instrumental')
    .filter(id => BUILTIN_STEMS[id] !== undefined)
    .sort((a, b) => {
      const orderA = VISUAL_MIXER_DISPLAY_ORDER[a] ?? 99;
      const orderB = VISUAL_MIXER_DISPLAY_ORDER[b] ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      return a.localeCompare(b);
    });
  
  const handleMuteToggle = (stemId: string) => {
    const st = useStemStore.getState();
    const ae = (window as any).audioEngine;
    const newMute = !st.stemMutes[stemId];
    st.setStemMute(stemId, newMute);
    ae?.setStemMute?.(stemId, newMute);
  };
  
  const handleSoloToggle = (stemId: string) => {
    const st = useStemStore.getState();
    const ae = (window as any).audioEngine;
    const newSolo = !st.stemSolos[stemId];
    st.setStemSolo(stemId, newSolo);
    ae?.setStemSolo?.(stemId, newSolo);
  };
  
  const handleVolumeChange = (stemId: string, volume: number) => {
    const st = useStemStore.getState();
    const ae = (window as any).audioEngine;
    st.setStemVolume(stemId, volume);
    ae?.setStemVolume?.(stemId, volume);
  };
  
  if (visibleStems.length === 0) return null;
  
  return (
    <div className={styles.strip}>
      {visibleStems.map((stemId, index) => (
        <div 
          key={stemId}
          className={styles.cardWrapper}
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <InstrumentCard
            stemId={stemId}
            onMuteToggle={handleMuteToggle}
            onSoloToggle={handleSoloToggle}
            onVolumeChange={handleVolumeChange}
          />
        </div>
      ))}
    </div>
  );
}
