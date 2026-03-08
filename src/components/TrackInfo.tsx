import React from 'react';
import { useAudioStore } from '../stores/audio.store';
import { useLyricsStore } from '../stores/lyrics.store';
import { useMarkersStore } from '../stores/markers.store';
import { useModeStore } from '../stores/mode.store';

export function TrackInfo() {
  const isPlaying = useAudioStore((s) => s.isPlaying);
  const currentTime = useAudioStore((s) => s.currentTime);
  const duration = useAudioStore((s) => s.duration);
  const hasVocals = useAudioStore((s) => s.hasVocals);
  const playbackRate = useAudioStore((s) => s.playbackRate);
  const vocalMix = useAudioStore((s) => s.vocalMixEnabled);
  const mic = useAudioStore((s) => s.micEnabled);
  const lines = useLyricsStore((s) => s.lines);
  const activeLine = useLyricsStore((s) => s.activeLineIndex);
  const markers = useMarkersStore((s) => s.markers);
  const mode = useModeStore((s) => s.mode);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const currentText = activeLine >= 0 && activeLine < lines.length
    ? lines[activeLine]
    : '';

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{
      position: 'fixed',
      top: 'calc(var(--react-header-height, 48px) + 8px)',
      right: 8,
      background: 'rgba(0,0,0,0.9)',
      color: '#fff',
      padding: '10px 14px',
      borderRadius: 8,
      fontSize: 12,
      fontFamily: 'monospace',
      zIndex: 999995,
      minWidth: 220,
      maxWidth: 320,
      border: '1px solid #333',
      pointerEvents: 'none',
    }}>
      <div style={{ color: '#4CAF50', fontWeight: 'bold', marginBottom: 6 }}>
        🎵 {mode.toUpperCase()}
      </div>

      {/* Progress bar */}
      <div style={{
        height: 3,
        background: '#333',
        borderRadius: 2,
        marginBottom: 8,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${progress}%`,
          background: isPlaying ? '#4CAF50' : '#666',
          transition: 'width 0.3s',
        }} />
      </div>

      {/* Time */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span>{isPlaying ? '▶' : '⏸'} {formatTime(currentTime)}</span>
        <span style={{ color: '#888' }}>{formatTime(duration)}</span>
      </div>

      {/* Current line */}
      {currentText && (
        <div style={{
          color: '#ffcc00',
          fontSize: 11,
          padding: '4px 0',
          borderTop: '1px solid #333',
          marginTop: 4,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {currentText}
        </div>
      )}

      {/* Stats */}
      <div style={{ color: '#666', fontSize: 10, marginTop: 4 }}>
        Lines: {lines.length} | Markers: {markers.length}
        {hasVocals && ' | Voc ✓'}
        {vocalMix && ' | VMix'}
        {mic && ' | 🎤'}
        {playbackRate !== 1 && ` | ${playbackRate}x`}
      </div>
    </div>
  );
}

