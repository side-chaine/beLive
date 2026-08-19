import type { CSSProperties } from 'react';

export interface AudioCrashModalProps {
  visible: boolean;
  onReload?: () => void;
}

/**
 * Framework-agnostic on purpose — I don't know your actual styling system (CSS
 * modules / Tailwind / styled-components), so this uses plain inline styles as a
 * functional placeholder. Restyle to match your design system; what matters is the
 * aria attributes and the reload action, not the visuals.
 */
export function AudioCrashModal({ visible, onReload }: AudioCrashModalProps) {
  if (!visible) return null;

  const handleReload = onReload ?? (() => window.location.reload());

  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="audio-crash-title" style={overlayStyle}>
      <div style={cardStyle}>
        <p id="audio-crash-title" style={{ margin: 0, marginBottom: 12, fontWeight: 600 }}>
          Звук недоступен
        </p>
        <p style={{ margin: 0, marginBottom: 16, opacity: 0.8, fontSize: 14 }}>
          Аудио-движок не смог восстановиться после сворачивания вкладки.
        </p>
        {/* eslint-disable-next-line jsx-a11y/no-autofocus -- deliberate: this is a full-screen blocking dialog */}
        <button autoFocus onClick={handleReload} style={buttonStyle}>
          Перезагрузить
        </button>
      </div>
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
};

const cardStyle: CSSProperties = {
  background: '#1a1a1a',
  color: '#fff',
  padding: '24px 28px',
  borderRadius: 12,
  maxWidth: 320,
  textAlign: 'center',
};

const buttonStyle: CSSProperties = {
  padding: '10px 20px',
  borderRadius: 8,
  border: 'none',
  background: '#fff',
  color: '#111',
  cursor: 'pointer',
  fontWeight: 600,
};
