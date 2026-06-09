import { useEffect, useState } from 'react';
import { useAppStore } from '../../stores/app.store';
import { useUserProfileStore } from '../../stores/user-profile.store';
import { authService } from '../../services/auth.service';
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

        <div className="bl-userroom__section">
          <div className="bl-userroom__section-title">Тема</div>
          <div className="bl-userroom__section-soon">скоро...</div>
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
