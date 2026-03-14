import React, { useEffect, useState, useRef } from 'react';
import { triggerBus } from './trigger.bus';
import { useTriggerStore } from './trigger.store';
import type { TriggerEvent } from './trigger.types';

const MAX_LOG = 12;

/**
 * Read current word progress from CSS variable (hot-path optimized)
 * Falls back to 0 if CSS var not set
 */
function getWordProgressFromCSS(): number {
  if (typeof document === 'undefined') return 0;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue('--bl-word-progress')
    .trim();
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export const TriggerDebugOverlay: React.FC = () => {
  const [log, setLog] = useState<string[]>([]);
  const logRef = useRef<string[]>([]);
  // Local state for progress — read from CSS var instead of store (hot-path optimization)
  const [progress, setProgress] = useState<number>(0);

  const visible = useTriggerStore((s) => s.showDebug);

  const {
    activeWordId,
    activeWordText,
    activeWordConfidence,
    triggerLineIndex,
    isActive,
  } = useTriggerStore();

  // Subscribe to bus for event log and progress updates
  useEffect(() => {
    if (!visible) return;

    // Initial progress read
    setProgress(getWordProgressFromCSS());

    const unsub = triggerBus.onAny((event: TriggerEvent) => {
      if (event.id === 'word-active' || event.id === 'line-active') return;

      // Update progress from CSS var on each progress event
      if (event.id === 'word-progress') {
        setProgress(event.value);
        return;
      }

      const entry = `${event.time.toFixed(2)}s ${event.id}${
        event.metadata.wordText ? ' "' + event.metadata.wordText + '"' : ''
      }${event.metadata.lineIndex != null ? ' L' + event.metadata.lineIndex : ''}`;

      logRef.current = [entry, ...logRef.current].slice(0, MAX_LOG);
      setLog([...logRef.current]);
    });

    return unsub;
  }, [visible]);

  if (!visible) return null;

  const bar = progress;

  return (
    <div style={{
      position: 'fixed',
      bottom: 12,
      right: 12,
      zIndex: 99999,
      background: 'rgba(0,0,0,0.88)',
      color: '#0f0',
      fontFamily: 'monospace',
      fontSize: 11,
      padding: '8px 12px',
      borderRadius: 8,
      minWidth: 280,
      maxWidth: 380,
      pointerEvents: 'none',
      border: '1px solid rgba(0,255,0,0.3)',
    }}>
      <div style={{ color: '#0f0', fontWeight: 700, marginBottom: 4 }}>
        🎯 TRIGGER DEBUG {isActive ? '▶' : '⏸'}
      </div>

      <div style={{ marginBottom: 4 }}>
        <span style={{ color: '#888' }}>line:</span>{' '}
        <span style={{ color: triggerLineIndex >= 0 ? '#0f0' : '#666' }}>
          {triggerLineIndex >= 0 ? triggerLineIndex : '—'}
        </span>
        {'  '}
        <span style={{ color: '#888' }}>word:</span>{' '}
        <span style={{ color: activeWordId ? '#0ff' : '#666' }}>
          {activeWordText || '—'}
        </span>
        {'  '}
        <span style={{ color: '#888' }}>conf:</span>{' '}
        <span>{activeWordConfidence.toFixed(2)}</span>
      </div>

      {/* Progress bar */}
      <div style={{
        height: 4,
        background: '#333',
        borderRadius: 2,
        marginBottom: 6,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${bar * 100}%`,
          background: 'linear-gradient(90deg, #0f0, #0ff)',
          borderRadius: 2,
          transition: 'width 0.05s linear',
        }} />
      </div>

      {/* CSS vars readout */}
      <div style={{ color: '#666', fontSize: 10, marginBottom: 4 }}>
        --bl-word-active={activeWordId ? '1' : '0'}{' '}
        --bl-word-progress={bar.toFixed(3)}{' '}
        --bl-line-active={triggerLineIndex >= 0 ? '1' : '0'}
      </div>

      {/* Event log */}
      {log.length > 0 && (
        <div style={{ borderTop: '1px solid #333', paddingTop: 4, fontSize: 10 }}>
          {log.map((entry, i) => (
            <div key={i} style={{ color: i === 0 ? '#0f0' : '#555' }}>
              {entry}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
