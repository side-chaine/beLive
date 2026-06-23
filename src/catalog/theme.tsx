import React from 'react';

export const T = {
  bg: 'rgba(8,8,14,0.98)',
  surface: 'rgba(255,255,255,0.035)',
  surfaceH: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.07)',
  border2: 'rgba(255,255,255,0.12)',
  text: '#e2e2e2',
  dim: '#888',
  mute: '#555',
  green: '#4CAF50',
  greenD: 'rgba(76,175,80,0.10)',
  purple: '#9b59b6',
  purpleD: 'rgba(155,89,182,0.08)',
  orange: '#FF8C00',
  orangeD: 'rgba(255,140,0,0.07)',
  red: '#e74c3c',
  r: 6,
  rL: 10,
};

export const colBase: React.CSSProperties = {
  background: T.surface,
  border: `1px solid ${T.border}`,
  borderRadius: T.rL,
  padding: 14,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

interface IBProps {
  c: string;
  children: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  o?: number;
}

export function IB({ c, children, onClick, o }: IBProps) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: c,
        fontSize: 13,
        padding: '2px 4px',
        lineHeight: 1,
        opacity: o ?? 1,
        transition: 'opacity 0.15s',
      }}
    >
      {children}
    </button>
  );
}

export function NB({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'rgba(255,255,255,0.05)',
        color: '#aaa',
        border: `1px solid rgba(255,255,255,0.08)`,
        borderRadius: 4,
        padding: '5px 16px',
        cursor: 'pointer',
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {children}
    </button>
  );
}
