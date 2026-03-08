import { useState, useEffect } from 'react';
import { useModeStore } from '../stores/mode.store';
import { VolumeControls } from './VolumeControls';
import { ControlPanel } from './ControlPanel';
import styles from './BottomBar.module.css';

const LS_KEY = 'react:bottomBarCollapsed';

export function BottomBar() {
  const mode = useModeStore(s => s.mode);
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem(LS_KEY) === '1';
  });

  useEffect(() => {
    localStorage.setItem(LS_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  if (mode === 'live') return null;

  return (
    <div className={styles.container}>
      <div className={styles.handle} onClick={() => setCollapsed(!collapsed)}>
        <span className={`${styles.arrow} ${!collapsed ? styles.arrowUp : ''}`}>
          ▲
        </span>
        Controls
      </div>
      {!collapsed && (
        <div className={styles.panel}>
           <div className={styles.rowRight}>
             <VolumeControls />
           </div>
           <div className={styles.rowCenter}>
             <ControlPanel />
           </div>
        </div>
      )}
    </div>
  );
}


