import React, { useCallback, useRef } from 'react';
import { useAudioStore } from '../stores/audio.store';
import { useModeStore } from '../stores/mode.store';
import { interruptPracticeSession } from '../exercises/exercise.interruption';

const MODE_COLORS: Record<string, string> = {
  concert: '#3498db',
  karaoke: '#9b59b6',
  rehearsal: '#FF8C00',
  live: '#e74c3c',
};

export function TransportBar() {
  const isPlaying = useAudioStore((s) => s.isPlaying);
  const currentTime = useAudioStore((s) => s.currentTime);
  const duration = useAudioStore((s) => s.duration);
  const mode = useModeStore((s) => s.mode);
  const trackRef = useRef<HTMLDivElement>(null);

  const color = MODE_COLORS[mode] || '#fff';
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const fmt = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Interrupt practice first if active, then seek
      interruptPracticeSession(() => {
        const ae = (window as any).audioEngine;
        if (!ae || !trackRef.current || duration === 0) return;
        const rect = trackRef.current.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const newTime = ratio * duration;
        ae.setCurrentTime(newTime);
        useAudioStore.setState({ currentTime: newTime });
      });
    },
    [duration]
  );

  if (duration === 0) return null;

  return (
    <div
      ref={trackRef}
      onClick={handleSeek}
      style={{
        height: 20,
        background: 'rgba(0,0,0,0.95)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 14px',
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      {/* Progress track */}
      <div
        style={{
          flex: 1,
          height: 3,
          background: 'rgba(255,255,255,0.08)',
          borderRadius: 2,
          position: 'relative',
          cursor: 'pointer',
        }}
      >
        {/* Fill with glow */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            height: '100%',
            width: `${progress}%`,
            background: `linear-gradient(90deg, ${color}44, ${color})`,
            borderRadius: 2,
            boxShadow: `0 0 8px ${color}66, 0 0 20px ${color}33`,
            transition: 'width 0.3s linear',
          }}
        />
        {/* Playhead dot with intense glow */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: `${progress}%`,
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: color,
            transform: 'translate(-50%, -50%)',
            boxShadow: `0 0 6px ${color}, 0 0 14px ${color}88, 0 0 28px ${color}44`,
          }}
        />
      </div>

      {/* Time */}
      <span
        style={{
          fontSize: 9,
          color: 'rgba(255,255,255,0.4)',
          fontFamily: 'monospace',
          minWidth: 72,
          textAlign: 'right',
          letterSpacing: 0.5,
        }}
      >
        {fmt(currentTime)} / {fmt(duration)}
      </span>
    </div>
  );
}
