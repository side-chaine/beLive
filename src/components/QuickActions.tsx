import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useModeStore } from '../stores/mode.store';
import { useUIStore } from '../stores/ui.store';
import { usePerformanceTier, usePerformanceStore } from '../performance/performance.hooks';
import { usePlateStore } from '../stores/plate.store';
import { useStemStore } from '../stem/stem.store';
import { useAiSettingsStore } from '../stores/ai-settings.store';
import { useAppStore } from '../stores/app.store';
import type { PerformanceTier } from '../performance/performance.types';
import { useTrackStore } from '../stores/track.store';
import { useBlockSceneStore } from '../stores/blockScene.store';

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
  customBgUrl: string | null;
}

function GraphicsTierControls({
  menuItemStyle,
  tierLabelStyle,
  checkmarkStyle,
  accentColor,
  onClose,
  customBgUrl,
}: GraphicsTierControlsProps) {
  const { tier, autoDetect, detectedTier } = usePerformanceTier();
  const { setTier, setAutoDetect } = usePerformanceStore();
  const useAutoBg = usePlateStore(s => s.useAutoBg);
  const setUseAutoBg = usePlateStore(s => s.setUseAutoBg);
  const hasBlockScenes = useTrackStore(s => s.hasBlockScenes);
  const setBlockSceneOpen = useBlockSceneStore(s => s.setOpen);

  const tiers: PerformanceTier[] = ['lite', 'balanced', 'max', 'ultra'];

  const handleTierSelect = (selectedTier: PerformanceTier) => {
    setTier(selectedTier);
    onClose();
  };

  const handleUseAuto = () => {
    setUseAutoBg(!useAutoBg);
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

      {/* Show Cover option */}
      <div
        style={{
          ...menuItemStyle,
          paddingLeft: 20,
          background: useAutoBg ? `${accentColor}15` : undefined,
          borderLeft: useAutoBg ? `2px solid ${accentColor}` : '2px solid transparent',
        }}
        onClick={handleUseAuto}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = `${accentColor}22`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = useAutoBg ? `${accentColor}15` : 'transparent';
        }}
      >
        <span style={{ fontWeight: useAutoBg ? 500 : 400, color: useAutoBg ? '#fff' : '#ccc' }}>
          Show Cover
        </span>
        {useAutoBg && <span style={checkmarkStyle}>✓</span>}
      </div>

              {/* Background — unified entry point */}
              <div
                style={{
                  ...menuItemStyle,
                  paddingLeft: 20,
                  background: (customBgUrl || hasBlockScenes) ? `${accentColor}15` : '',
                  borderLeft: (customBgUrl || hasBlockScenes) ? `2px solid ${accentColor}` : '2px solid transparent',
                }}
                onClick={() => setBlockSceneOpen(true)}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = (customBgUrl || hasBlockScenes) ? `${accentColor}25` : `${accentColor}10`; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = (customBgUrl || hasBlockScenes) ? `${accentColor}15` : ''; }}
              >
                <span style={{ fontWeight: (customBgUrl || hasBlockScenes) ? 500 : 400, color: (customBgUrl || hasBlockScenes) ? '#fff' : '#ccc' }}>
                  Background
                </span>
                {(customBgUrl || hasBlockScenes) && <span style={checkmarkStyle}>✓</span>}
              </div>
    </div>
  );
}

// ── Stems Toggle ──
interface StemsToggleProps {
  menuItemStyle: React.CSSProperties;
  accentColor: string;
  onClose: () => void;
}

const StemsToggle: React.FC<StemsToggleProps> = ({ menuItemStyle, accentColor, onClose }) => {
  const stemsMode = useStemStore(s => s.stemsMode); // TC-10.8: tumbler state

  const tc = (window as any).trackCatalog;
  const currentTrack = tc?.tracks?.[tc?.currentTrackIndex];
  const hasStemsData = !!(currentTrack?.stemsData && Object.keys(currentTrack.stemsData).length > 0);

  const handleToggle = async () => {
    const st = useStemStore.getState();
    const newMode = !st.stemsMode;
    const ae = (window as any).audioEngine;
    const trackId = currentTrack?.id;

    if (newMode) {
      // ═══ ТУМБЛЕР ON — загрузить стемы, показать фейдеры ═══

      st.setStemsMode(true);

      // Persist stemsMode
      if (trackId) {
        const idb = (window as any).idbService;
        idb?.updateTrackField?.(trackId, { stemsMode: true });
      }

      // Проверяем: стемы уже загружены?
      const loadedStemIds = ae?.stems ? [...ae.stems.keys()] : [];
      const musicStemsLoaded = loadedStemIds.some(
        (id: string) => id !== 'instrumental' && id !== 'vocals'
      );

      if (!musicStemsLoaded) {
        // Загрузить стемы on-demand
        useStemStore.getState().setStemsLoading(true);
        try {
          const { loadStemsOnDemand } = await import('../services/track.orchestrator');
          await loadStemsOnDemand();
        } catch (e) {
          console.warn('[QuickActions] On-demand load failed:', e);
        } finally {
          useStemStore.getState().setStemsLoading(false);
        }
      }

      // ВАЖНО: НЕ ставить stemsEnabled=true!
      // Кнопка Stems в MixerPanel будет НЕ гореть.
      // Пользователь сам нажмёт кнопку чтобы включить воспроизведение стемов.
      // Стемы загружены но на volume=0 (muted) — не влияют на звук.

    } else {
      // ═══ ТУМБЛЕР OFF — скрыть фейдеры, выключить стемы ═══

      st.setStemsMode(false);

      // Если стемы играли — выключить воспроизведение
      if (st.stemsEnabled) {
        st.setStemsEnabled(false);
        ae?.setStemsEnabled?.(false);
        ae?.setStemVolume?.('instrumental', 1);
        st.setStemVolume('instrumental', 1);

        // Mute music stems
        if (ae?.stems) {
          ae.stems.forEach((_: any, id: string) => {
            if (id !== 'instrumental' && id !== 'vocals') {
              ae.setStemVolume?.(id, 0);
            }
          });
        }

        const musicStems = st.loadedStems.filter(
          (id: string) => id !== 'instrumental' && id !== 'vocals'
        );
        for (const id of musicStems) {
          st.setStemVolume(id, 0);
        }
      }

      // Persist stemsMode
      if (trackId) {
        const idb = (window as any).idbService;
        idb?.updateTrackField?.(trackId, { stemsMode: false });
      }
    }

    onClose();
  };

  return (
    <div style={{ borderTop: '1px solid #333', marginTop: 8, paddingTop: 8 }}>
      <div
        style={{
          ...menuItemStyle,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: hasStemsData ? 'pointer' : 'not-allowed',
          opacity: hasStemsData ? 1 : 0.4,
        }}
        onClick={hasStemsData ? handleToggle : undefined}
      >
        <span style={{ fontWeight: 600, fontSize: 12, color: '#ddd' }}>Stems</span>
        
        {!hasStemsData ? (
          <span style={{ fontSize: 10, color: '#666' }}>N/A</span>
        ) : (
          /* Toggle Switch */
          <div style={{
            width: 36,
            height: 20,
            borderRadius: 10,
            background: stemsMode ? accentColor : '#444',
            position: 'relative',
            transition: 'background 0.2s ease',
            flexShrink: 0,
          }}>
            <div style={{
              width: 16,
              height: 16,
              borderRadius: 8,
              background: '#fff',
              position: 'absolute',
              top: 2,
              left: stemsMode ? 18 : 2,
              transition: 'left 0.2s ease',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }} />
          </div>
        )}
      </div>
    </div>
  );
};

export function QuickActions() {
  const mode = useModeStore((s) => s.mode);
  const color = MODE_COLORS[mode] || '#fff';
  const setCatalogOpen = useUIStore((s) => s.setCatalogOpen);
  const customBgUrl = useTrackStore(s => s.currentTrack?.customBgUrl) || null;
  const setSurface = useAppStore(s => s.setSurface);


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

          {/* Room / Profile */}
          <div style={{
            padding: '8px 16px', cursor: 'pointer',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}
            onClick={() => { setSurface('profile'); closeMenu(); }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <span style={{ fontWeight: 500, color: '#eee' }}>🏠 Комната</span>
            <span style={{ fontSize: 10, color: '#666' }}>Profile</span>
          </div>

          {/* AI Settings */}
          <div
            style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            onClick={() => { useAiSettingsStore.getState().setShowSettings(true); closeMenu(); }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <span style={{ fontWeight: 500, color: '#eee' }}>AI Settings</span>
            <span style={{ fontSize: 10, color: '#666' }}>Configure</span>
          </div>

          {/* Graphics section - performance tier controls */}
          <GraphicsTierControls
            menuItemStyle={menuItemStyle}
            tierLabelStyle={tierLabelStyle}
            checkmarkStyle={checkmarkStyle}
            accentColor={color}
            onClose={closeMenu}
            customBgUrl={customBgUrl}
          />
          <StemsToggle
            menuItemStyle={menuItemStyle}
            accentColor={color}
            onClose={closeMenu}
          />
        </div>
      )}
    </div>
  );
}
