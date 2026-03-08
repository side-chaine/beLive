import React, { useEffect, useState } from 'react';
import { useAudioStore } from '../stores/audio.store';
import { useLyricsStore } from '../stores/lyrics.store';
import { useModeStore } from '../stores/mode.store';

const MODE_COLORS: Record<string, string> = {
  concert: '#3498db',
  karaoke: '#9b59b6',
  rehearsal: '#FF8C00',
  live: '#e74c3c',
};

export function NowPlaying() {
  const mode = useModeStore((s) => s.mode);
  const isPlaying = useAudioStore((s) => s.isPlaying);
  const currentTime = useAudioStore((s) => s.currentTime);
  const duration = useAudioStore((s) => s.duration);
  const lines = useLyricsStore((s) => s.lines);
  const activeLine = useLyricsStore((s) => s.activeLineIndex);
  const [visible, setVisible] = useState(true);

  const currentText = activeLine >= 0 && activeLine < lines.length
    ? lines[activeLine] : '';
  const nextText = activeLine + 1 < lines.length
    ? lines[activeLine + 1] : '';
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const color = MODE_COLORS[mode] || '#fff';

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (!isPlaying && currentTime === 0) return null;

  return (
    <div
      onClick={() => setVisible(!visible)}
      style={{
        position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.85)', color: '#fff',
        padding: visible ? '12px 20px' : '4px 12px',
        borderRadius: 12, fontSize: 13, fontFamily: 'system-ui, sans-serif',
        zIndex: 999998, textAlign: 'center',
        border: `1px solid ${color}40`,
        backdropFilter: 'blur(10px)',
        transition: 'all 0.3s ease',
        cursor: 'pointer',
        maxWidth: '80vw',
      }}
    >
      {!visible ? (
        <span style={{ color, fontSize: 10 }}>▼ NOW PLAYING</span>
      ) : (
        <>
          {/* Progress bar */}
          <div style={{
            height: 2, background: '#333', borderRadius: 1,
            marginBottom: 8, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', width: `${progress}%`,
              background: `linear-gradient(90deg, ${color}, ${color}aa)`,
              transition: 'width 0.5s linear',
            }} />
          </div>

          {/* Current line */}
          <div style={{
            color, fontSize: 16, fontWeight: 600,
            marginBottom: 4, minHeight: 22,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {currentText || '♪ ♪ ♪'}
          </div>

          {/* Next line */}
          {nextText && (
            <div style={{
              color: '#888', fontSize: 12,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {nextText}
            </div>
          )}

          {/* Time */}
          <div style={{ color: '#555', fontSize: 10, marginTop: 6 }}>
            {fmt(currentTime)} / {fmt(duration)}
          </div>
        </>
      )}
    </div>
  );
}

