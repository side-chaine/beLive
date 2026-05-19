import React, { useRef, useEffect, useCallback } from 'react';
import { BUILTIN_STEMS } from '../stem/stemTypes';
import type { StemRole } from '../stem/stemTypes';
import { useStemStore } from '../stem/stem.store';
import { useStemWaveform } from '../hooks/useStemWaveform';
import styles from './InstrumentCard.module.css';

// ═══ Theme API Stub ═══
// Любой будущий скин должен соответствовать этому интерфейсу
export interface InstrumentSkinProps {
  stemId: string;
  role: StemRole;
  color: string;
  energy: number;
  hit: boolean;
  isMuted: boolean;
  isSolo: boolean;
  volume: number;
}

interface InstrumentCardProps {
  stemId: string;
  onMuteToggle?: (stemId: string) => void;
  onSoloToggle?: (stemId: string) => void;
  onVolumeChange?: (stemId: string, volume: number) => void;
}

// ═══ Shape Placeholder (пока нет SVG от Никиты) ═══
function ShapePlaceholder({ role, color }: { role: StemRole; color: string }) {
  const shapeMap: Record<StemRole, string> = {
    master: '◼',
    music: '◆',
    vocal: '●',
    backing: '○',
    effect: '▲',
  };
  return (
    <div className={styles.shapePlaceholder} style={{ color }}>
      <span style={{ fontSize: 28 }}>{shapeMap[role] || '●'}</span>
    </div>
  );
}

export function InstrumentCard({ stemId, onMuteToggle, onSoloToggle, onVolumeChange }: InstrumentCardProps) {
  const stem = BUILTIN_STEMS[stemId];
  const isMuted = useStemStore(s => s.stemMutes[stemId] ?? false);
  const isSolo = useStemStore(s => s.stemSolos[stemId] ?? false);
  const volume = useStemStore(s => s.stemVolumes[stemId] ?? 1);
  
  // ═══ Waveform canvas ═══
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);
  useStemWaveform({ stemId, canvasRef: waveformCanvasRef, enabled: !isMuted });
  
  // ═══ Volume Drag (MonitorMixPanel pattern — document listeners) ═══
  const isDraggingRef = useRef(false);
  const dragStartYRef = useRef(0);
  const dragStartVolRef = useRef(0);
  
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Only drag on the card body, not on buttons
    if ((e.target as HTMLElement).closest('button')) return;
    isDraggingRef.current = true;
    dragStartYRef.current = e.clientY;
    dragStartVolRef.current = volume;
  }, [volume]);
  
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      // Drag UP = increase volume, DOWN = decrease
      const deltaY = dragStartYRef.current - e.clientY;
      const cardHeight = 96;
      const deltaVol = deltaY / cardHeight;
      const newVol = Math.max(0, Math.min(1, dragStartVolRef.current + deltaVol));
      onVolumeChange?.(stemId, newVol);
    };
    const handlePointerUp = () => {
      isDraggingRef.current = false;
    };
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
  }, [stemId, onVolumeChange]);
  
  if (!stem) return null;
  
  const state = isMuted ? 'muted' : isSolo ? 'solo' : 'active';
  
  return (
    <div
      className={styles.card}
      data-state={state}
      data-stem-id={stemId}
      data-role={stem.role}
      onPointerDown={handlePointerDown}
      style={{
        '--stem-color': stem.color,
        // Bridge CSS vars → local CSS vars (card doesn't know which stem it is)
        '--stem-energy': `var(--bl-stem-${stemId}-energy, 0)`,
        '--stem-hit': `var(--bl-stem-${stemId}-hit, 0)`,
        '--stem-volume': volume,
      } as React.CSSProperties}
    >
      {/* Volume indicator (background fill) */}
      <div className={styles.volumeIndicator} />
      
      {/* Skin slot — сюда Никита вставит SVG */}
      <div className={styles.skinSlot}>
        <ShapePlaceholder role={stem.role} color={stem.color || '#fff'} />
      </div>
      
      {/* Waveform slot — canvas rendered by useStemWaveform hook */}
      <div className={styles.waveformSlot}>
        <canvas
          ref={waveformCanvasRef}
          className={styles.waveformCanvas}
        />
      </div>
      
      {/* Label */}
      <div className={styles.label}>{stem.shortLabel || stem.label}</div>
      
      {/* Mute/Solo buttons */}
      <div className={styles.buttonRow}>
        <button
          className={`${styles.btn} ${isMuted ? styles.btnActive : ''}`}
          onClick={(e) => { e.stopPropagation(); onMuteToggle?.(stemId); }}
          title="Mute"
        >M</button>
        <button
          className={`${styles.btn} ${isSolo ? styles.btnActive : ''}`}
          onClick={(e) => { e.stopPropagation(); onSoloToggle?.(stemId); }}
          title="Solo"
        >S</button>
      </div>
    </div>
  );
}
