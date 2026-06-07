import { useEffect } from 'react';
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
