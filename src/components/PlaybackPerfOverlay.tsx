/**
 * Playback Performance Overlay
 *
 * Dev-only overlay for observing runtime/performance state.
 * Shows scheduler metrics, performance tier, Word FX settings, and active playback state.
 */

import { useEffect, useState } from 'react';
import { usePerformanceTier } from '../performance/performance.hooks';
import { useTextStyleStore } from '../stores/textStyle.store';
import { useTriggerStore } from '../triggers/trigger.store';
import { getPlaybackVisualScheduler } from '../playback';

interface MetricsSnapshot {
  frameCount: number;
  lastFrameMs: number;
  avgFrameMs: number;
  queuedCssVarCount: number;
}

export function PlaybackPerfOverlay(): React.ReactElement | null {
  // All hooks must be called unconditionally (Rules of Hooks)
  // Debug gate: only show when Ctrl+Shift+T debug mode is active
  const showDebug = useTriggerStore((s) => s.showDebug);

  // Performance tier
  const { tier, autoDetect, manualTier, detectedTier } = usePerformanceTier();

  // Text style settings
  const { wordFxMode, wordFocusLevel, wordTrailDepth } = useTextStyleStore();

  // Trigger state
  const activeWordId = useTriggerStore((s) => s.activeWordId);
  const triggerLineIndex = useTriggerStore((s) => s.triggerLineIndex);

  // Scheduler metrics (sampled)
  const [metrics, setMetrics] = useState<MetricsSnapshot>({
    frameCount: 0,
    lastFrameMs: 0,
    avgFrameMs: 0,
    queuedCssVarCount: 0,
  });

  useEffect(() => {
    // Skip sampling when overlay is hidden (dev-only optimization)
    if (!import.meta.env.DEV || !showDebug) {
      return;
    }

    const scheduler = getPlaybackVisualScheduler();

    // Sample metrics at 4Hz (250ms) — light enough for dev overlay
    const intervalId = setInterval(() => {
      const m = scheduler.getMetrics();
      setMetrics({
        frameCount: m.frameCount,
        lastFrameMs: Math.round(m.lastFrameMs * 100) / 100,
        avgFrameMs: Math.round(m.avgFrameMs * 100) / 100,
        queuedCssVarCount: m.queuedCssVarCount,
      });
    }, 250);

    return () => clearInterval(intervalId);
  }, [showDebug]);

  // Dev-only: return null in production or when debug mode is off
  const shouldRender = import.meta.env.DEV && showDebug;
  if (!shouldRender) {
    return null;
  }

  // Trim long word IDs for display
  const displayWordId = activeWordId
    ? activeWordId.length > 12
      ? `${activeWordId.slice(0, 12)}…`
      : activeWordId
    : '—';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 8,
        right: 8,
        zIndex: 999999,
        background: 'rgba(0,0,0,0.85)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 6,
        padding: '8px 12px',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: 11,
        lineHeight: 1.5,
        color: '#ccc',
        minWidth: 180,
        backdropFilter: 'blur(4px)',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      <div style={{ color: '#fff', fontWeight: 600, marginBottom: 4 }}>
        beLive Perf
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0 8px' }}>
        <span style={{ color: '#888' }}>Tier:</span>
        <span style={{ color: '#6ee7b7', textTransform: 'uppercase' }}>{tier}</span>

        <span style={{ color: '#888' }}>Mode:</span>
        <span>{autoDetect ? 'auto' : 'manual'}</span>

        {autoDetect && (
          <>
            <span style={{ color: '#888' }}>Detected:</span>
            <span style={{ textTransform: 'uppercase' }}>{detectedTier}</span>
          </>
        )}

        {!autoDetect && (
          <>
            <span style={{ color: '#888' }}>Manual:</span>
            <span style={{ textTransform: 'uppercase' }}>{manualTier}</span>
          </>
        )}

        <span style={{ color: '#888' }}>FX:</span>
        <span style={{ color: '#fcd34d' }}>{wordFxMode}</span>

        <span style={{ color: '#888' }}>Focus:</span>
        <span>{wordFocusLevel}</span>

        <span style={{ color: '#888' }}>Trail:</span>
        <span>{wordTrailDepth}</span>

        <span style={{ color: '#888' }}>Line:</span>
        <span style={{ color: '#60a5fa' }}>{triggerLineIndex}</span>

        <span style={{ color: '#888' }}>Word:</span>
        <span style={{ color: '#c4b5fd' }} title={activeWordId ?? undefined}>
          {displayWordId}
        </span>

        <div style={{ gridColumn: '1 / -1', height: 1, background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />

        <span style={{ color: '#888' }}>Frame:</span>
        <span>{metrics.lastFrameMs.toFixed(2)}ms</span>

        <span style={{ color: '#888' }}>Avg:</span>
        <span>{metrics.avgFrameMs.toFixed(2)}ms</span>

        <span style={{ color: '#888' }}>CSS:</span>
        <span>{metrics.queuedCssVarCount}</span>

        <span style={{ color: '#888' }}>Count:</span>
        <span>{metrics.frameCount}</span>
      </div>
    </div>
  );
}
