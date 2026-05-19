/**
 * MixerPanel — W5: N-Stem Mixer UI
 *
 * Horizontal scrollable row of ChannelStrips in the Dock Panel.
 * Each strip: label + VU meter + fader + M/S buttons.
 * Binds to stem.store for state, AudioEngineV2 for metering.
 *
 * Performance: metering poll respects STEM_CAPACITY_BY_TIER.meterFps.
 * CSS-only meters for v1 (no canvas, no peak hold).
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useStemStore } from '../stem/stem.store';
import { BUILTIN_STEMS, STEM_CAPACITY_BY_TIER, sortStemsForDisplay } from '../stem/stemTypes';
import { usePerformanceStore } from '../performance/performance.store';
import { InstrumentStrip } from './InstrumentStrip';
// TC-VIS-09: Critical CSS import — tier gating + recording clamp for InstrumentCard
import '../triggers/instrument-card.css';
import styles from './MixerPanel.module.css';

// ─── ChannelStrip ───────────────────────────────────────────

interface ChannelStripProps {
  stemId: string;
  level: number;
  meterStyle: string;
}

function ChannelStrip({ stemId, level, meterStyle }: ChannelStripProps) {
  const volume = useStemStore(s => s.stemVolumes[stemId] ?? 1);
  const mute = useStemStore(s => s.stemMutes[stemId] ?? false);
  const solo = useStemStore(s => s.stemSolos[stemId] ?? false);
  const stemDef = BUILTIN_STEMS[stemId];
  const label = stemDef?.shortLabel ?? stemDef?.label ?? stemId;
  const color = stemDef?.color ?? '#888';

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    useStemStore.getState().setStemVolume(stemId, v);
    (window as any).audioEngine?.setStemVolume?.(stemId, v);
  }, [stemId]);

  const handleMuteToggle = useCallback(() => {
    const prevMute = useStemStore.getState().stemMutes[stemId] ?? false;
    useStemStore.getState().setStemMute(stemId, !prevMute);
    (window as any).audioEngine?.setStemMute?.(stemId, !prevMute);
  }, [stemId]);

  const handleSoloToggle = useCallback(() => {
    const prevSolo = useStemStore.getState().stemSolos[stemId] ?? false;
    useStemStore.getState().setStemSolo(stemId, !prevSolo);
    (window as any).audioEngine?.setStemSolo?.(stemId, !prevSolo);
  }, [stemId]);

  // Convert RMS (0~1) to dB-ish scale for meter (0% = -60dB, 100% = 0dB)
  const meterPercent = level > 0 ? Math.min(100, (20 * Math.log10(level) + 60) / 60 * 100) : 0;

  return (
    <div className={`${styles.channelStrip} ${mute ? styles.muted : ''}`}>
      <div className={styles.stripAccent} style={{ backgroundColor: color }} />
      <div className={styles.stemLabel} title={stemDef?.label ?? stemId}>
        {label}
      </div>
      <div className={styles.meterContainer} data-style={meterStyle}>
        <div
          className={styles.meterFill}
          style={{ height: `${meterPercent}%` }}
        />
      </div>
      <input
        type="range"
        className={styles.fader}
        min="0"
        max="1"
        step="0.01"
        value={volume}
        onChange={handleVolumeChange}
        aria-label={`${stemDef?.label ?? stemId} volume`}
      />
      <div className={styles.muteSoloRow}>
        <button
          className={`${styles.msButton} ${mute ? styles.active : ''}`}
          onClick={handleMuteToggle}
          title="Mute"
        >
          M
        </button>
        <button
          className={`${styles.msButton} ${solo ? styles.activeSolo : ''}`}
          onClick={handleSoloToggle}
          title="Solo"
        >
          S
        </button>
      </div>
    </div>
  );
}

// ─── MixerPanel ─────────────────────────────────────────────

export function MixerPanel() {
  // Use loadedStems (stable reference from store) instead of getOrderedStemIds() (new array each call)
  // to avoid infinite re-render loop with useSyncExternalStore
  const loadedStems = useStemStore(s => s.loadedStems);
  const stemsEnabled = useStemStore(s => s.stemsEnabled); // W10-002
  const stemsMode = useStemStore(s => s.stemsMode); // TC-10.6: tumbler preference
  const [visualMode, setVisualMode] = useState(false); // TC-VIS-09: Visual sub-mode
  const orderedStems = useMemo(() => sortStemsForDisplay(loadedStems), [loadedStems]);
  const [meterLevels, setMeterLevels] = useState<Record<string, number>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Get performance tier for meter settings
  const meterFps = usePerformanceStore(s => {
    const tier = s.getEffectiveTier();
    return STEM_CAPACITY_BY_TIER[tier]?.meterFps ?? 10;
  });
  const meterStyle = usePerformanceStore(s => {
    const tier = s.getEffectiveTier();
    return STEM_CAPACITY_BY_TIER[tier]?.meterStyle ?? 'solid';
  });

  // W10-002: Stems mode toggle handler
  const handleStemsModeToggle = useCallback(async () => {
    const st = useStemStore.getState();
    const ae = (window as any).audioEngine;
    const newEnabled = !st.stemsEnabled;

    // 1. Toggle stemsEnabled
    st.setStemsEnabled(newEnabled);
    ae?.setStemsEnabled?.(newEnabled);

    // 2. Persist stemsEnabled to IDB
    const tc = (window as any).trackCatalog;
    const trackId = tc?.tracks?.[tc?.currentTrackIndex]?.id;
    if (trackId) {
      const idb = (window as any).idbService;
      idb?.updateTrackField?.(trackId, { stemsMode: newEnabled });
    }

    if (newEnabled) {
      // ═══ ВКЛЮЧИТЬ СТЕМЫ (кнопка нажата) ═══

      // Проверяем: стемы загружены?
      const loadedStemIds = ae?.stems ? [...ae.stems.keys()] : [];
      const musicStemsLoaded = loadedStemIds.some(
        (id: string) => id !== 'instrumental' && id !== 'vocals'
      );

      if (!musicStemsLoaded) {
        // Загрузить стемы on-demand
        useStemStore.getState().setStemsLoading(true);
        try {
          const { loadStemsOnDemand } = await import('../services/track.orchestrator');
          await loadStemsOnDemand();
          return; // loadStemsOnDemand handles mute/unmute
        } catch (e) {
          console.warn('[MixerPanel] On-demand load failed:', e);
          // Fallback: вернуть instrumental + сбросить stemsEnabled
          ae?.setStemVolume?.('instrumental', 1);
          st.setStemsEnabled(false);
          ae?.setStemsEnabled?.(false);
          return;
        } finally {
          useStemStore.getState().setStemsLoading(false);
        }
      }

      // Стемы загружены — переключить воспроизведение
      // Instrumental ВНИЗ (engine + store)
      ae?.setStemVolume?.('instrumental', 0);
      st.setStemVolume('instrumental', 0);

      // Стемы ВВЕРХ (engine + store)
      const musicStems = st.loadedStems.filter(
        (id: string) => id !== 'instrumental' && id !== 'vocals'
      );
      for (const id of musicStems) {
        ae?.setStemVolume?.(id, 1);
        st.setStemVolume(id, 1);
      }
      ae?.setStemVolume?.('vocals', 1);
      st.setStemVolume('vocals', 1);

    } else {
      // ═══ ВЫКЛЮЧИТЬ СТЕМЫ (кнопка отжата) ═══

      // Instrumental ВВЕРХ (engine + store)
      ae?.setStemVolume?.('instrumental', 1);
      st.setStemVolume('instrumental', 1);

      // Стемы ВНИЗ (engine + store)
      const musicStems = st.loadedStems.filter(
        (id: string) => id !== 'instrumental' && id !== 'vocals'
      );
      for (const id of musicStems) {
        ae?.setStemVolume?.(id, 0);
        st.setStemVolume(id, 0);
      }
    }
  }, []);

  // Metering poll loop
  useEffect(() => {
    if (meterFps === 0 || orderedStems.length === 0) {
      setMeterLevels({});
      return;
    }

    const interval = 1000 / meterFps;
    timerRef.current = setInterval(() => {
      const ae = (window as any).audioEngine;
      if (!ae?.getStemMeterLevel) return;

      const levels: Record<string, number> = {};
      for (const stemId of orderedStems) {
        levels[stemId] = ae.getStemMeterLevel(stemId) ?? 0;
      }
      setMeterLevels(levels);
    }, interval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [orderedStems, meterFps]);

  if (orderedStems.length === 0) {
    return (
      <div className={styles.mixerPanel}>
        <div className={styles.emptyState}>No stems loaded</div>
      </div>
    );
  }

  return (
    <div className={styles.mixerPanel}>
      {/* W10-002: Stems mode toggle toolbar */}
      {orderedStems.length > 1 && (
        <div className={styles.mixerToolbar}>
          <button
            className={`${styles.stemsToggle} ${stemsEnabled ? styles.stemsActive : ''}`}
            onClick={handleStemsModeToggle}
            title={stemsEnabled ? 'Switch to Instrumental' : 'Enable Stems'}
          >
            Stems
          </button>
          {/* TC-VIS-09: Visual mode toggle — only active when stemsEnabled */}
          <button
            className={`${styles.visualToggle} ${visualMode ? styles.visualActive : ''}`}
            onClick={() => setVisualMode(!visualMode)}
            disabled={!stemsEnabled}
            title={stemsEnabled ? 'Toggle Visual Mode' : 'Enable Stems first'}
            style={{
              opacity: stemsEnabled ? 1 : 0.4,
              cursor: stemsEnabled ? 'pointer' : 'not-allowed',
            }}
          >
            Visual
          </button>
        </div>
      )}
      {/* TC-VIS-09: Conditional rendering — Visual mode vs DAW faders */}
      {visualMode && stemsEnabled ? (
        <InstrumentStrip />
      ) : (
        <div className={styles.channelStripContainer}>
          {orderedStems.map((stemId, index) => {
            // TC-10.7: Show faders only when stemsMode=true
            const isAlwaysVisible = stemId === 'instrumental' || stemId === 'vocals';
            const isVisible = isAlwaysVisible || stemsMode;
            if (!isVisible) return null;

            return (
              <div
                key={stemId}
                style={{
                  transition: 'opacity 0.3s ease, transform 0.3s ease',
                  transitionDelay: `${index * 0.05}s`,
                  opacity: loadedStems.includes(stemId) ? 1 : 0,
                  transform: loadedStems.includes(stemId) ? 'translateY(0)' : 'translateY(8px)',
                }}
              >
                <ChannelStrip
                  stemId={stemId}
                  level={meterLevels[stemId] ?? 0}
                  meterStyle={meterStyle}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
