import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useUserProfileStore } from '../../stores/user-profile.store';
import './LandingPage.css';

const AVATAR_COLORS = [
  '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c',
  '#3498db', '#9b59b6', '#e84393', '#00cec9', '#6c5ce7',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitial(name: string): string {
  return (name.trim().charAt(0) || 'Г').toUpperCase();
}

export function LandingPage() {
  const [phase, setPhase] = useState(0);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const createProfile = useUserProfileStore(s => s.createProfile);

  const avatarColor = useMemo(() => getAvatarColor(name), [name]);
  const initial = useMemo(() => getInitial(name), [name]);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 150);
    const t2 = setTimeout(() => setPhase(2), 400);
    const t3 = setTimeout(() => setPhase(3), 650);
    const t4 = setTimeout(() => setPhase(4), 850);
    const t5 = setTimeout(() => {
      setPhase(5);
      inputRef.current?.focus();
    }, 1050);
    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      clearTimeout(t4); clearTimeout(t5);
    };
  }, []);

  const handleStart = () => {
    if (submitting) return;
    const finalName = name.trim() || 'Гость';
    setSubmitting(true);
    createProfile(finalName, `${initial}:${avatarColor}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleStart();
  };

  return (
    <div className="lp-root">
      <div className="lp-content">

        {/* SVG Микрофон */}
        <div className={`lp-logo ${phase >= 1 ? 'visible' : ''}`}>
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="22" />
          </svg>
        </div>

        {/* Название */}
        <h1 className={`lp-title ${phase >= 2 ? 'visible' : ''}`}>
          beLive
        </h1>

        {/* Подзаголовок */}
        <p className={`lp-subtitle ${phase >= 3 ? 'visible' : ''}`}>
          Твоя вокальная студия
        </p>

        {/* Аватар-превью */}
        <div
          className={`lp-avatar ${phase >= 4 ? 'visible' : ''}`}
          style={{
            backgroundColor: name.trim() ? avatarColor : 'rgba(255,255,255,0.06)',
            color: name.trim() ? '#fff' : '#333',
          }}
        >
          {name.trim() ? initial : '?'}
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          className={`lp-input ${phase >= 4 ? 'visible' : ''}`}
          placeholder="Имя"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={30}
          autoComplete="off"
        />

        {/* Кнопка */}
        <button
          className={`lp-start ${phase >= 5 ? 'visible' : ''}`}
          onClick={handleStart}
          disabled={submitting}
          type="button"
        >
          Начать
        </button>

        {/* Соцкнопки */}
        <div className={`lp-social ${phase >= 5 ? 'visible' : ''}`}>
          <span className="lp-social-label">или войти через</span>
          <div className="lp-social-buttons">
            {['Google', 'VK', 'Telegram', 'GitHub'].map(p => (
              <button key={p} className="lp-social-btn" disabled type="button">
                {p}
              </button>
            ))}
          </div>
          <span className="lp-social-soon">скоро</span>
        </div>
      </div>
    </div>
  );
}
