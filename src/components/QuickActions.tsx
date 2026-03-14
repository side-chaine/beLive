import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useModeStore } from '../stores/mode.store';
import { useUIStore } from '../stores/ui.store';
import { usePerformanceTier, usePerformanceStore } from '../performance/performance.hooks';
import type { PerformanceTier } from '../performance/performance.types';

const MODE_COLORS: Record<string, string> = {
  concert: '#3498db',
  karaoke: '#9b59b6',
  rehearsal: '#FF8C00',
  live: '#e74c3c',
};

interface GraphicsTierControlsProps {
  menuItemStyle: React.CSSProperties;
  tierLabelStyle: (isActive: boolean) => React.CSSProperties;
  checkmarkStyle: React.CSSProperties;
  accentColor: string;
  onClose: () => void;
}

function GraphicsTierControls({
  menuItemStyle,
  tierLabelStyle,
  checkmarkStyle,
  accentColor,
  onClose,
}: GraphicsTierControlsProps) {
  const { tier, autoDetect, detectedTier } = usePerformanceTier();
  const { setTier, setAutoDetect } = usePerformanceStore();

  const tiers: PerformanceTier[] = ['lite', 'balanced', 'max', 'ultra'];

  const handleTierSelect = (selectedTier: PerformanceTier) => {
    setTier(selectedTier);
    onClose();
  };

  const handleUseAuto = () => {
    setAutoDetect(true);
    onClose();
  };

  // Determine effective display state
  const effectiveTier = autoDetect ? detectedTier : tier;

  return (
    <div style={{ padding: '4px 0' }}>
      {/* Section header with current mode indicator */}
      <div
        style={{
          ...menuItemStyle,
          cursor: 'default',
          opacity: 0.8,
        }}
      >
        <span style={{ fontWeight: 600 }}>Graphics</span>
        <span style={tierLabelStyle(autoDetect)}>
          {autoDetect ? `Auto: ${effectiveTier}` : `Manual: ${effectiveTier}`}
        </span>
      </div>

      {/* Status feedback line */}
      <div
        style={{
          padding: '4px 12px 8px 20px',
          fontSize: 11,
          color: autoDetect ? '#888' : accentColor,
          fontStyle: autoDetect ? 'italic' : 'normal',
        }}
      >
        {autoDetect ? `Detected: ${detectedTier}` : 'User selected'}
      </div>

      {/* Tier options */}
      {tiers.map((t) => {
        const isActive = effectiveTier === t;
        const isManualActive = !autoDetect && tier === t;

        return (
          <div
            key={t}
            style={{
              ...menuItemStyle,
              paddingLeft: 20,
              background: isActive ? `${accentColor}15` : undefined,
              borderLeft: isManualActive ? `2px solid ${accentColor}` : '2px solid transparent',
            }}
            onClick={() => handleTierSelect(t)}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = `${accentColor}22`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isActive ? `${accentColor}15` : 'transparent';
            }}
          >
            <span
              style={{
                textTransform: 'capitalize',
                fontWeight: isActive ? 500 : 400,
                color: isActive ? '#fff' : '#ccc',
              }}
            >
              {t}
            </span>
            {isManualActive && <span style={checkmarkStyle}>✓</span>}
            {autoDetect && isActive && (
              <span style={{ fontSize: 10, color: '#666', fontStyle: 'italic' }}>auto</span>
            )}
          </div>
        );
      })}

      {/* Divider */}
      <div style={{ borderTop: '1px solid #333', margin: '4px 0' }} />

      {/* Use Auto option */}
      <div
        style={{
          ...menuItemStyle,
          paddingLeft: 20,
          background: autoDetect ? `${accentColor}15` : undefined,
          borderLeft: autoDetect ? `2px solid ${accentColor}` : '2px solid transparent',
        }}
        onClick={handleUseAuto}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = `${accentColor}22`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = autoDetect ? `${accentColor}15` : 'transparent';
        }}
      >
        <span style={{ fontWeight: autoDetect ? 500 : 400, color: autoDetect ? '#fff' : '#ccc' }}>
          Use Auto
        </span>
        {autoDetect && <span style={checkmarkStyle}>✓</span>}
      </div>
    </div>
  );
}

export function QuickActions() {
  const mode = useModeStore((s) => s.mode);
  const color = MODE_COLORS[mode] || '#fff';
  const setCatalogOpen = useUIStore((s) => s.setCatalogOpen);

  const openCatalog = useCallback(() => {
    setCatalogOpen(true);
  }, [setCatalogOpen]);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const avatarBtnRef = useRef<HTMLButtonElement>(null);

  const toggleMenu = useCallback(() => {
    setMenuOpen((prev) => !prev);
  }, []);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);

  // Close menu on click outside
  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        avatarBtnRef.current &&
        !avatarBtnRef.current.contains(target)
      ) {
        closeMenu();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen, closeMenu]);

  // Close menu on Escape key
  useEffect(() => {
    if (!menuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen, closeMenu]);

  const btnStyle = (active = false): React.CSSProperties => ({
    background: active ? `${color}22` : 'transparent',
    border: `1px solid ${active ? color : '#444'}`,
    color: active ? color : '#aaa',
    borderRadius: 6,
    padding: '6px 10px',
    cursor: 'pointer',
    fontSize: 12,
    fontFamily: 'system-ui, sans-serif',
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap',
  });

  const menuItemStyle: React.CSSProperties = {
    padding: '8px 12px',
    cursor: 'pointer',
    borderRadius: 4,
    transition: 'background 0.15s ease',
    fontSize: 13,
    color: '#eee',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  };

  const tierLabelStyle = (isActive: boolean): React.CSSProperties => ({
    fontSize: 11,
    color: isActive ? color : '#888',
    fontWeight: isActive ? 600 : 400,
    textTransform: 'capitalize',
  });

  const checkmarkStyle: React.CSSProperties = {
    fontSize: 12,
    color: color,
    marginLeft: 4,
  };

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', position: 'relative' }}>
      <button onClick={openCatalog} style={btnStyle()}>Catalog</button>
      <button
        ref={avatarBtnRef}
        onClick={toggleMenu}
        style={btnStyle(menuOpen)}
        title="User Menu"
        aria-expanded={menuOpen}
        aria-haspopup="true"
      >
        👤
      </button>

      {menuOpen && (
        <div
          ref={menuRef}
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            minWidth: 200,
            background: 'rgba(20, 20, 25, 0.98)',
            border: '1px solid #444',
            borderRadius: 8,
            padding: '8px 0',
            zIndex: 999999,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            backdropFilter: 'blur(12px)',
          }}
        >
          {/* User section */}
          <div style={{ padding: '8px 16px', borderBottom: '1px solid #333', marginBottom: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>User</div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>Settings & Preferences</div>
          </div>

          {/* Graphics section - performance tier controls */}
          <GraphicsTierControls
            menuItemStyle={menuItemStyle}
            tierLabelStyle={tierLabelStyle}
            checkmarkStyle={checkmarkStyle}
            accentColor={color}
            onClose={closeMenu}
          />
        </div>
      )}
    </div>
  );
}
