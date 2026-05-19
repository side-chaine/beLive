import { useState, useEffect } from 'react';
import type { CoverArtTheme } from '../types/cover-theme.types';
import { DEFAULT_COVER_THEME } from '../types/cover-theme.types';

interface CoverArtProps {
  url?: string | null;
  title?: string;
  size?: number;
  borderRadius?: number;
  theme?: CoverArtTheme | null;
}

export function CoverArt({ url, title, size = 32, borderRadius = 6, theme }: CoverArtProps) {
  const [failed, setFailed] = useState(false);

  // Reset failed state when URL changes (Центр2 усиление)
  useEffect(() => {
    setFailed(false);
  }, [url]);

  const initial = (title || '?')[0].toUpperCase();
  const t = theme || DEFAULT_COVER_THEME;
  const gradient = `linear-gradient(135deg, ${t.primary}, ${t.secondary})`;

  const imgStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius,
    objectFit: 'cover',
    flexShrink: 0,
    display: 'block',
  };

  const placeholderStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius,
    background: gradient,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: Math.round(size * 0.45),
    fontWeight: 700,
    color: t.text || '#fff',
    flexShrink: 0,
    userSelect: 'none',
  };

  if (url && !failed) {
    return <img src={url} alt="" style={imgStyle} onError={() => setFailed(true)} />;
  }

  return <div style={placeholderStyle}>{initial}</div>;
}
