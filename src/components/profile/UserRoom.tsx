import { useEffect, useState, useRef } from 'react';
import type { CSSProperties } from 'react';
import { authService } from '../../services/auth.service';
import { useAppStore } from '../../stores/app.store';
import { useUserProfileStore } from '../../stores/user-profile.store';
import { useCurrentTrackId } from '../../stores/track.store';
import { usePracticeStore } from '../../stores/practice-session.store';
import { useThemeStore } from '../../theme/store/theme-store';
import { themeRegistry, getThemeById } from '../../theme/themes/index';
import { applyTheme, applyMode } from '../../theme/engine/css-injector';
import { WeekStrip } from './room/WeekStrip';
import { ContinueCard } from './room/ContinueCard';
import { useJournal } from './room/useJournal';
import './UserRoom.css';

export function UserRoom() {
  const setSurface = useAppStore(s => s.setSurface);
  const currentUser = useUserProfileStore(s => s.currentUser);
  const userName = useUserProfileStore(s => s.userName);
  const userAvatar = useUserProfileStore(s => s.userAvatar);
  const isGuest = useUserProfileStore(s => s.isGuest);
  const currentTrackId = useCurrentTrackId();
  const { week, last, loading } = useJournal(currentUser?.id ?? 'guest');
  const [mvsepKeyInput, setMvsepKeyInput] = useState('');
  const [showMvsepKey, setShowMvsepKey] = useState(false);
  const [mvsepOpen, setMvsepOpen] = useState(false);
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
    // Сессия живёт на сервере (KV + httpOnly cookie) — сносим и её, не только стор
    void authService.logout();
    setSurface('welcome');
  };

  const handleContinue = () => {
    if (!last?.scenarioId) return;
    usePracticeStore.getState().startPractice(
      last.scenarioId,
      undefined,
      undefined,
      last.blockId ?? undefined,
    );
  };

  const accent = getThemeById(activeThemeId).semantic.accentPrimary;

  const avatarContent = currentUser?.avatarUrl
    ? <img src={currentUser.avatarUrl} alt="" className="bl-userroom__avatar-img" />
    : <span className="bl-userroom__avatar-emoji">{userAvatar || '🎤'}</span>;

  const providerLabel = currentUser?.authProvider === 'google' ? 'Google' : 'аккаунт';

  const mvsepPanel = mvsepKeyValue ? (
    <>
      <div className="bl-userroom__mvsep-row">
        <input
          type={showMvsepKey ? 'text' : 'password'}
          value={mvsepKeyValue}
          readOnly
          className="bl-userroom__mvsep-input"
        />
        <button
          className="bl-userroom__mvsep-eye"
          onClick={() => setShowMvsepKey(!showMvsepKey)}
        >
          {showMvsepKey ? '🙈' : '👁️'}
        </button>
      </div>
      <div className="bl-userroom__mvsep-ok">✅ Свой ключ — без лимита beLive</div>
      <button
        className="bl-userroom__mvsep-delete"
        onClick={() => useUserProfileStore.getState().setMvsepApiKey(null)}
      >
        🗑️ Удалить ключ
      </button>
    </>
  ) : (
    <>
      <input
        type="text"
        value={mvsepKeyInput}
        onChange={(e) => setMvsepKeyInput(e.target.value)}
        placeholder="Вставьте API ключ от mvsep.com"
        className="bl-userroom__mvsep-input"
      />
      <button
        className="bl-userroom__mvsep-save"
        onClick={() => {
          const key = mvsepKeyInput.trim();
          if (key) {
            useUserProfileStore.getState().setMvsepApiKey(key);
            setMvsepKeyInput('');
          }
        }}
        disabled={!mvsepKeyInput.trim()}
      >
        💾 Сохранить
      </button>
      <div className="bl-userroom__mvsep-hint">
        Получите ключ на{' '}
        <a href="https://mvsep.com/profile" target="_blank" rel="noopener" className="bl-userroom__mvsep-link">
          mvsep.com/profile
        </a>
        <br />
        Свой ключ — без лимита beLive (лимит MVSEP: ~49/день)
      </div>
    </>
  );

  return (
    <div
      className="bl-userroom-screen"
      style={{ '--bl-room-accent': accent } as CSSProperties}
    >
      <div className="bl-userroom-scroll">
        <div className="bl-userroom-content">
          <div className="bl-userroom__topbar">
            <button className="bl-userroom__back" onClick={() => setSurface('app')}>
              ← В студию
            </button>

            <div className="bl-userroom__theme" ref={themeDropdownRef}>
              <button
                className="bl-userroom__theme-btn"
                onClick={() => setThemeDropdownOpen(!themeDropdownOpen)}
              >
                <span className="bl-userroom__theme-dot" style={{ background: accent }} />
                <span className="bl-userroom__theme-name">{getThemeById(activeThemeId).name}</span>
                <span className="bl-userroom__theme-caret">▼</span>
              </button>
              {themeDropdownOpen && (
                <div className="bl-userroom__theme-menu">
                  {Object.values(themeRegistry).map(t => (
                    <button
                      key={t.id}
                      className={
                        t.id === activeThemeId
                          ? 'bl-userroom__theme-item is-active'
                          : 'bl-userroom__theme-item'
                      }
                      onClick={() => {
                        useThemeStore.setState({ activeThemeId: t.id });
                        applyTheme(t);
                        applyMode(t, activeMode);
                        setThemeDropdownOpen(false);
                      }}
                    >
                      <span
                        className="bl-userroom__theme-dot"
                        style={{ background: t.semantic.accentPrimary }}
                      />
                      {t.name}
                      {t.id === activeThemeId && (
                        <span className="bl-userroom__theme-check">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ПРОФИЛЬ */}
          <section className="bl-userroom__card bl-userroom__card--profile">
            <div className="bl-userroom__profile-row">
              <div className="bl-userroom__avatar">{avatarContent}</div>
              <div className="bl-userroom__ident">
                <div className="bl-userroom__name">
                  {isGuest ? 'Гость' : (currentUser?.name || userName)}
                </div>
                {isGuest ? (
                  <div className="bl-userroom__email">локальный профиль</div>
                ) : (
                  <>
                    {currentUser?.email && (
                      <div className="bl-userroom__email">{currentUser.email}</div>
                    )}
                    <span className="bl-userroom__chip">{providerLabel}</span>
                  </>
                )}
              </div>
            </div>
            {isGuest ? (
              <button
                className="bl-userroom__google-btn"
                onClick={() => authService.initiateGoogleOAuth()}
              >
                Войти через Google
              </button>
            ) : (
              <button className="bl-userroom__logout" onClick={handleLogout}>
                🚪 Выйти
              </button>
            )}
          </section>

          {/* ЭТА НЕДЕЛЯ */}
          {loading ? (
            <div className="bl-userroom__skeleton" />
          ) : (
            <WeekStrip stats={week} onStart={() => setSurface('app')} />
          )}

          {/* ПРОДОЛЖИТЬ */}
          {loading ? (
            <div className="bl-userroom__skeleton bl-userroom__skeleton--continue" />
          ) : last ? (
            <ContinueCard
              target={last}
              currentTrackId={currentTrackId}
              onContinue={handleContinue}
            />
          ) : (
            <section className="bl-userroom__card bl-userroom__continue-empty">
              <div className="bl-userroom__muted-center">
                Здесь появится последний трек — начни репетицию
              </div>
            </section>
          )}

          {/* ТВОЙ ТЕМП */}
          <section className="bl-userroom__card bl-userroom__card--tempo">
            <div className="bl-userroom__card-title">Твой темп</div>
            <div className="bl-userroom__muted">Прогоны покажут темп по блокам</div>
          </section>

          {/* СОВМЕСТНЫЕ СЕССИИ */}
          <section className="bl-userroom__card bl-userroom__card--sessions">
            <div className="bl-userroom__card-title">Совместные сессии</div>
            <div className="bl-userroom__muted">∅ пока пусто · позже: спой с другом или педагогом</div>
          </section>

          {/* ФУТЕР · MVSEP */}
          <div className="bl-userroom__footer">
            <div className="bl-userroom__footer-row">
              <span className="bl-userroom__footer-label">🔑 MVSEP — свой ключ без лимита</span>
              <button
                className="bl-userroom__footer-btn"
                onClick={() => setMvsepOpen(v => !v)}
              >
                {mvsepOpen ? 'Скрыть' : 'Изменить'}
              </button>
            </div>
            {mvsepOpen && <div className="bl-userroom__mvsep">{mvsepPanel}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
