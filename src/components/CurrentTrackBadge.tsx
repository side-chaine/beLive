import { useMemo, useState, useEffect, useRef } from 'react';
import { useTrackStore } from '../stores/track.store';
import { useModeStore } from '../stores/mode.store';

const MODE_COLORS: Record<string, string> = {
  concert: '#3498db',
  karaoke: '#9b59b6',
  rehearsal: '#FF8C00',
  live: '#e74c3c',
};

if (typeof document !== 'undefined' && !document.getElementById('badge-fx-styles')) {
  const s = document.createElement('style');
  s.id = 'badge-fx-styles';
  s.textContent = `
    @keyframes badgePulse {
      0%,100% { opacity:1; }
      50% { opacity:0.7; }
    }
    @keyframes badgeWave {
      0% { background-position: 200% center; }
      100% { background-position: -200% center; }
    }
    @keyframes badgeFlicker {
      0%,100% { opacity:1; }
      20% { opacity:0.5; }
      40% { opacity:1; }
      60% { opacity:0.6; }
      80% { opacity:1; }
    }
    @keyframes badgeSpark {
      0%,100% { box-shadow: none; }
      33% { box-shadow: 0 0 14px var(--bfx-c), 0 0 4px var(--bfx-c); }
      66% { box-shadow: 0 0 8px var(--bfx-c); }
    }
    @keyframes badgeBreathe {
      0%,100% { box-shadow: 0 0 4px var(--bfx-c); }
      50% { box-shadow: 0 0 20px var(--bfx-c), 0 0 8px var(--bfx-c); }
    }
  `;
  document.head.appendChild(s);
}

const EFFECTS = ['glow','pulse','colorWave','sparkleBorder','breathe','flicker'] as const;
type Effect = typeof EFFECTS[number];

export function CurrentTrackBadge() {
  const current = useTrackStore((s) => s.currentTrack);
  const mode = useModeStore((s) => s.mode);
  const color = MODE_COLORS[mode] || '#fff';
  const [fx, setFx] = useState<Effect | null>(null);
  const prevText = useRef('');

  const text = useMemo(() => {
    if (!current) return '';
    const { artist, title } = current;
    if (!artist) return title || '';
    if (!title) return artist;
    if (title.startsWith(artist)) {
      const rest = title.slice(artist.length).replace(/^[\s\-\u2014_]+/, '');
      return rest ? `${artist} \u2014 ${rest}` : artist;
    }
    return `${artist} \u2014 ${title}`;
  }, [current]);

  useEffect(() => {
    if (!text || text === prevText.current) return;
    prevText.current = text;
    const pick = EFFECTS[Math.floor(Math.random() * EFFECTS.length)];
    setFx(pick);
    const t = setTimeout(() => setFx(null), 1600);
    return () => clearTimeout(t);
  }, [text]);

  if (!text) return null;

  // Base: ALL longhand properties — NO background shorthand conflict
  const base: React.CSSProperties = {
    maxWidth: 400,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: 13,
    color: '#ddd',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: `${color}33`,
    backgroundColor: 'rgba(0,0,0,0.25)',
    backgroundImage: 'none',
    backgroundSize: 'auto',
    padding: '4px 10px',
    borderRadius: 8,
    boxShadow: 'none',
    letterSpacing: 'normal',
    transition: 'color 0.4s, border-color 0.4s, background-color 0.4s, box-shadow 0.4s',
    ['--bfx-c' as any]: color,
  };

  type FxStyle = {
    color?: string;
    borderColor?: string;
    backgroundColor?: string;
    backgroundImage?: string;
    backgroundSize?: string;
    boxShadow?: string;
    letterSpacing?: string;
    animation?: string;
  };

  const fxStyles: Record<Effect, FxStyle> = {
    glow: {
      color: '#fff',
      borderColor: `${color}99`,
      backgroundColor: `${color}22`,
      boxShadow: `0 0 16px ${color}66, 0 0 6px ${color}44`,
      letterSpacing: '0.6px',
    },
    pulse: {
      color: '#fff',
      borderColor: `${color}88`,
      backgroundColor: `${color}20`,
      animation: 'badgePulse 0.5s ease 3',
    },
    colorWave: {
      color: '#fff',
      borderColor: `${color}66`,
      backgroundImage: `linear-gradient(90deg, transparent 0%, ${color}55 50%, transparent 100%)`,
      backgroundSize: '200% auto',
      animation: 'badgeWave 0.8s linear 2',
    },
    sparkleBorder: {
      color: '#fff',
      borderColor: `${color}cc`,
      backgroundColor: `${color}15`,
      animation: 'badgeSpark 0.5s ease 3',
    },
    breathe: {
      color: '#fff',
      borderColor: `${color}77`,
      backgroundColor: `${color}18`,
      animation: 'badgeBreathe 0.7s ease 2',
    },
    flicker: {
      color: '#fff',
      borderColor: `${color}88`,
      backgroundColor: `${color}18`,
      animation: 'badgeFlicker 0.4s linear 3',
      boxShadow: `0 0 10px ${color}44`,
    },
  };

  const style = fx ? { ...base, ...fxStyles[fx] } : base;
  return <div title={text} style={style}>{text}</div>;
}
