// beLive Theme System — Theme Selector Component
// Sprint 7 | Phase 2
// Dropdown UI for switching between themes

import { useState, useRef, useEffect } from 'react';
import { useThemeStore } from '../theme/store/theme-store';
import { themeRegistry, getThemeById } from '../theme/themes/index';
import { applyTheme, applyMode } from '../theme/engine/css-injector';
import styles from './ThemeSelector.module.css';

export function ThemeSelector() {
  const [open, setOpen] = useState(false);
  const activeThemeId = useThemeStore(s => s.activeThemeId);
  const activeMode = useThemeStore(s => s.activeMode);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSelect = (id: string) => {
    const theme = getThemeById(id);
    useThemeStore.setState({ activeThemeId: id });
    applyTheme(theme);
    applyMode(theme, activeMode);
    setOpen(false);
  };

  const themes = Object.values(themeRegistry);
  const current = getThemeById(activeThemeId);

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        className={styles.trigger}
        onClick={() => setOpen(!open)}
        title="Theme"
      >
        {current.name}
      </button>

      {open && (
        <div className={styles.dropdown}>
          {themes.map(t => (
            <button
              key={t.id}
              className={styles.option}
              data-active={t.id === activeThemeId}
              onClick={() => handleSelect(t.id)}
            >
              <span
                className={styles.swatch}
                style={{ background: t.semantic.accentPrimary }}
              />
              {t.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
