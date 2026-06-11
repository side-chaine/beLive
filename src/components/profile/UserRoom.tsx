import { useEffect, useState, useRef } from 'react';
import { useAppStore } from '../../stores/app.store';
import { useUserProfileStore } from '../../stores/user-profile.store';
import { authService } from '../../services/auth.service';
import { useThemeStore } from '../../theme/store/theme-store';
import { themeRegistry, getThemeById } from '../../theme/themes/index';
import { applyTheme, applyMode } from '../../theme/engine/css-injector';
import './UserRoom.css';

export function UserRoom() {
  const setSurface = useAppStore(s => s.setSurface);
  const currentUser = useUserProfileStore(s => s.currentUser);
  const logout = useUserProfileStore(s => s.logout);
  const userName = useUserProfileStore(s => s.userName);
  const userAvatar = useUserProfileStore(s => s.userAvatar);
  const isGuest = useUserProfileStore(s => s.isGuest);
  const [mvsepKeyInput, setMvsepKeyInput] = useState('');
  const [showMvsepKey, setShowMvsepKey] = useState(false);
  const mvsepKeyValue = useUserProfileStore(s => s.currentUser?.mvsepApiKey) || '';

  // Theme selector state
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);
  const activeThemeId = useThemeStore(s => s.activeThemeId);
  const activeMode = useThemeStore(s => s.activeMode);
  const themeDropdownRef = useRef<HTMLDivElement>(null);

  // Close theme dropdown on outside click
  useEffect(() => {
    if (!themeDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (themeDropdownRef.current && !themeDropdownRef.current.contains(e.target as Node)) {
        setThemeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [themeDropdownOpen]);

  // Escape closes
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSurface('app');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setSurface]);

  const handleLogout = () => {
    logout();
    setSurface('welcome');
  };

  const avatarContent = currentUser?.avatarUrl
    ? <img src={currentUser.avatarUrl} alt="" className="bl-userroom__avatar-img" />
    : <span className="bl-userroom__avatar-emoji">{userAvatar || '🎤'}</span>;

  return (
    <div className="bl-userroom-overlay" onClick={() => setSurface('app')}>
      <div className="bl-userroom" onClick={e => e.stopPropagation()}>
        <button className="bl-userroom__back" onClick={() => setSurface('app')}>
          ← Назад
        </button>

        {isGuest ? (
          <div className="bl-userroom__guest-upgrade">
            <div className="bl-userroom__guest-icon">🚀</div>
            <h3 className="bl-userroom__guest-title">Зарегистрируйся!</h3>
            <p className="bl-userroom__guest-desc">Статистика, прогресс, ИИ и сохранение данных</p>
            <button
              className="bl-userroom__google-btn"
              onClick={() => authService.initiateGoogleOAuth()}
            >
              Войти через Google
            </button>
          </div>
        ) : (
          <div className="bl-userroom__header">
            <div className="bl-userroom__avatar">
              {avatarContent}
            </div>
            <div className="bl-userroom__name">{currentUser?.name || userName}</div>
            {currentUser?.email && (
              <div className="bl-userroom__email">{currentUser.email}</div>
            )}
          </div>
        )}

        <div className="bl-userroom__section">
          <div className="bl-userroom__section-title">Настройки</div>
          <div className="bl-userroom__section-soon">скоро...</div>
        </div>

        {/* MVSEP API Key */}
        <div className="bl-userroom__section">
          <div className="bl-userroom__section-title">🔑 MVSEP API Key</div>
          {mvsepKeyValue ? (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                <input
                  type={showMvsepKey ? 'text' : 'password'}
                  value={mvsepKeyValue}
                  readOnly
                  style={{
                    flex: 1, padding: '6px 8px', borderRadius: 6,
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: 'rgba(255,255,255,0.05)', color: '#ccc',
                    fontSize: 12, fontFamily: 'monospace', outline: 'none',
                  }}
                />
                <button
                  onClick={() => setShowMvsepKey(!showMvsepKey)}
                  style={{
                    padding: '4px 8px', borderRadius: 4,
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: 'transparent', color: '#888',
                    fontSize: 11, cursor: 'pointer',
                  }}
                >
                  {showMvsepKey ? '🙈' : '👁️'}
                </button>
              </div>
              <div style={{ fontSize: 11, color: '#4ade80', marginBottom: 6 }}>
                ✅ Свой ключ — без лимита beLive
              </div>
              <button
                onClick={() => {
                  useUserProfileStore.getState().setMvsepApiKey(null);
                }}
                style={{
                  padding: '4px 10px', borderRadius: 4,
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'transparent', color: '#f97316',
                  fontSize: 11, cursor: 'pointer',
                }}
              >
                🗑️ Удалить ключ
              </button>
            </div>
          ) : (
            <div style={{ marginTop: 8 }}>
              <input
                type="text"
                value={mvsepKeyInput}
                onChange={(e) => setMvsepKeyInput(e.target.value)}
                placeholder="Вставьте API ключ от mvsep.com"
                style={{
                  width: '100%', padding: '6px 8px', borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(255,255,255,0.05)', color: '#ccc',
                  fontSize: 12, fontFamily: 'monospace',
                  marginBottom: 6, boxSizing: 'border-box', outline: 'none',
                }}
              />
              <button
                onClick={() => {
                  const key = mvsepKeyInput.trim();
                  if (key) {
                    useUserProfileStore.getState().setMvsepApiKey(key);
                    setMvsepKeyInput('');
                  }
                }}
                disabled={!mvsepKeyInput.trim()}
                style={{
                  padding: '4px 10px', borderRadius: 4,
                  border: `1px solid ${mvsepKeyInput.trim() ? '#6366f1' : 'rgba(255,255,255,0.15)'}`,
                  background: mvsepKeyInput.trim() ? '#6366f1' : 'transparent',
                  color: mvsepKeyInput.trim() ? '#fff' : '#555',
                  fontSize: 11, cursor: mvsepKeyInput.trim() ? 'pointer' : 'default',
                }}
              >
                💾 Сохранить
              </button>
              <div style={{
                fontSize: 10, color: 'rgba(255,255,255,0.35)',
                marginTop: 8, lineHeight: 1.4,
              }}>
                Получите ключ на{' '}
                <a href="https://mvsep.com/profile" target="_blank" rel="noopener"
                   style={{ color: '#6366f1' }}>
                  mvsep.com/profile
                </a>
                <br />
                Свой ключ — без лимита beLive (лимит MVSEP: ~49/день)
              </div>
            </div>
          )}
        </div>

        <div className="bl-userroom__section" ref={themeDropdownRef} style={{ position: 'relative' }}>
          <div className="bl-userroom__section-title">Тема</div>
          <button
            onClick={() => setThemeDropdownOpen(!themeDropdownOpen)}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 8,
              padding: '6px 12px',
              color: '#ccc',
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 4,
              width: '100%',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 14, height: 14, borderRadius: '50%',
                background: getThemeById(activeThemeId).semantic.accentPrimary,
                border: '1.5px solid rgba(255,255,255,0.3)',
                flexShrink: 0,
              }} />
              {getThemeById(activeThemeId).name}
            </span>
            <span style={{ fontSize: 10, color: '#666' }}>▼</span>
          </button>
          {themeDropdownOpen && (
            <div style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: '100%',
              background: '#252540',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 8,
              padding: 4,
              zIndex: 10,
              backdropFilter: 'blur(12px)',
              marginTop: 4,
            }}>
              {Object.values(themeRegistry).map(t => (
                <button
                  key={t.id}
                  onClick={() => {
                    useThemeStore.setState({ activeThemeId: t.id });
                    applyTheme(t);
                    applyMode(t, activeMode);
                    setThemeDropdownOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    padding: '6px 10px',
                    background: t.id === activeThemeId ? 'rgba(255,255,255,0.1)' : 'none',
                    border: 'none',
                    borderRadius: 4,
                    color: t.id === activeThemeId ? '#fff' : '#ccc',
                    fontSize: 13,
                    cursor: 'pointer',
                    textAlign: 'left' as const,
                    fontWeight: t.id === activeThemeId ? 600 : 400,
                  }}
                >
                  <span style={{
                    width: 14, height: 14, borderRadius: '50%',
                    background: t.semantic.accentPrimary,
                    border: '1.5px solid rgba(255,255,255,0.3)',
                    flexShrink: 0,
                  }} />
                  {t.name}
                  {t.id === activeThemeId && <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9b59b6' }}>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bl-userroom__section">
          <div className="bl-userroom__section-title">Статистика</div>
          <div className="bl-userroom__section-soon">
            {isGuest ? 'Доступно после регистрации' : 'скоро...'}
          </div>
        </div>

        {isGuest ? (
          <button className="bl-userroom__login-btn" onClick={() => authService.initiateGoogleOAuth()}>
            Войти / Зарегистрироваться
          </button>
        ) : (
          <button className="bl-userroom__logout" onClick={handleLogout}>
            🚪 Выйти
          </button>
        )}
      </div>
    </div>
  );
}
