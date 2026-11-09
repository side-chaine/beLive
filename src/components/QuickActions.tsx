import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useModeStore } from '../stores/mode.store';
import { useUIStore } from '../stores/ui.store';
import { useAppStore } from '../stores/app.store';
import { useUserProfileStore } from '../stores/user-profile.store';
import { HintToggle } from '../hints/HintToggle';
import { QuickToggles } from './usermenu/QuickToggles';

const MODE_COLORS: Record<string, string> = {
  concert: '#3498db',
  karaoke: '#9b59b6',
  rehearsal: '#FF8C00',
  live: '#e74c3c',
};

/**
 * Меню аватара.
 *
 * С 09.11 здесь только два смысла: **вход в комнату** (шапка «User») и быстрые
 * тумблеры студии (Подсказки, Show Cover, Background, Stems). Настройки ИИ и
 * качество графики переехали в комнату — дублировать их в меню больше не нужно.
 */
export function QuickActions() {
  const mode = useModeStore((s) => s.mode);
  const color = MODE_COLORS[mode] || '#fff';
  const setCatalogOpen = useUIStore((s) => s.setCatalogOpen);
  const setSurface = useAppStore((s) => s.setSurface);
  const avatarUrl = useUserProfileStore((s) => s.currentUser?.avatarUrl);
  const userAvatar = useUserProfileStore((s) => s.userAvatar);
  const userName = useUserProfileStore((s) => s.userName);

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

  /** Единственный вход в комнату — из шапки меню. */
  const openRoom = useCallback(() => {
    setCatalogOpen(false);
    setSurface('profile');
    closeMenu();
  }, [setCatalogOpen, setSurface, closeMenu]);

  // Close menu on click outside
  useEffect(() => {
    if (!menuOpen) {return;}

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
    if (!menuOpen) {return;}

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

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', position: 'relative' }}>
      {/* Anchor for the guided-tour layer. HintLayer measures this node; never
          replace it with hard-coded coordinates. */}
      <button data-bl-hint-target="catalog" onClick={openCatalog} style={btnStyle()}>Catalog</button>
      <button
        ref={avatarBtnRef}
        onClick={toggleMenu}
        title={userName || 'User Menu'}
        aria-expanded={menuOpen}
        aria-haspopup="true"
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          border: `2px solid ${menuOpen ? color : '#555'}`,
          background: 'rgba(255,255,255,0.08)',
          cursor: 'pointer',
          padding: 0,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = color;
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = menuOpen ? color : '#555';
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={userName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontSize: '1rem', lineHeight: 1 }}>{userAvatar || '🎤'}</span>
        )}
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
          {/* Вход в комнату — вся шапка кликабельна */}
          <button
            type="button"
            onClick={openRoom}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: 2,
              width: '100%',
              padding: '8px 16px',
              marginBottom: 4,
              border: 0,
              borderBottom: '1px solid #333',
              background: 'transparent',
              color: 'inherit',
              font: 'inherit',
              textAlign: 'left',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>User</span>
            <span style={{ fontSize: 11, color: '#888' }}>Комната · статистика и настройки →</span>
          </button>

          {/* Guided-tour master switch — ONE line. */}
          <div
            style={{ padding: '8px 12px', borderBottom: '1px solid #333', marginBottom: 4 }}
            onClick={(e) => e.stopPropagation()}
          >
            <HintToggle />
          </div>

          <QuickToggles accentColor={color} onClose={closeMenu} />
        </div>
      )}
    </div>
  );
}
