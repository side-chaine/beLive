/**
 * Быстрые тумблеры меню аватара.
 *
 * Вынесено из QuickActions, когда настройки (ИИ, качество графики) переехали
 * в комнату. Здесь остаётся только то, что относится к студии «здесь и сейчас»:
 * Show Cover, Background, Stems.
 *
 * Стили намеренно инлайновые: меню — тёмный оверлей с фиксированной палитрой,
 * и это единственный экран, который не подчиняется токенам комнаты.
 */

import type { CSSProperties } from 'react';
import { useTrackStore } from '../../stores/track.store';
import { usePlateStore } from '../../stores/plate.store';
import { useBlockSceneStore } from '../../stores/blockScene.store';
import { useStemStore } from '../../stem/stem.store';

export interface QuickTogglesProps {
  accentColor: string;
  onClose: () => void;
}

const ROW: CSSProperties = {
  padding: '8px 12px',
  paddingLeft: 20,
  cursor: 'pointer',
  borderRadius: 4,
  transition: 'background 0.15s ease',
  fontSize: 13,
  color: '#eee',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
};

function rowStyle(active: boolean, accentColor: string): CSSProperties {
  return {
    ...ROW,
    background: active ? `${accentColor}15` : undefined,
    borderLeft: active ? `2px solid ${accentColor}` : '2px solid transparent',
  };
}

function hoverIn(el: HTMLElement, accentColor: string): void {
  el.style.background = `${accentColor}22`;
}

function hoverOut(el: HTMLElement, active: boolean, accentColor: string): void {
  el.style.background = active ? `${accentColor}15` : 'transparent';
}

function labelStyle(active: boolean): CSSProperties {
  return { fontWeight: active ? 500 : 400, color: active ? '#fff' : '#ccc' };
}

/** Show Cover — показывать обложку трека как фон. */
function ShowCoverRow({ accentColor }: { accentColor: string }) {
  const useAutoBg = usePlateStore(s => s.useAutoBg);
  const setUseAutoBg = usePlateStore(s => s.setUseAutoBg);

  return (
    <div
      style={rowStyle(useAutoBg, accentColor)}
      onClick={() => setUseAutoBg(!useAutoBg)}
      onMouseEnter={e => hoverIn(e.currentTarget, accentColor)}
      onMouseLeave={e => hoverOut(e.currentTarget, useAutoBg, accentColor)}
    >
      <span style={labelStyle(useAutoBg)}>Show Cover</span>
      {useAutoBg && <span style={{ fontSize: 12, color: accentColor }}>✓</span>}
    </div>
  );
}

/** Background — единая точка входа в сцены блоков / свой фон. */
function BackgroundRow({ accentColor }: { accentColor: string }) {
  const customBgUrl = useTrackStore(s => s.currentTrack?.customBgUrl) || null;
  const hasBlockScenes = useTrackStore(s => s.hasBlockScenes);
  const setBlockSceneOpen = useBlockSceneStore(s => s.setOpen);
  const active = Boolean(customBgUrl || hasBlockScenes);

  return (
    <div
      style={rowStyle(active, accentColor)}
      onClick={() => setBlockSceneOpen(true)}
      onMouseEnter={e => hoverIn(e.currentTarget, accentColor)}
      onMouseLeave={e => hoverOut(e.currentTarget, active, accentColor)}
    >
      <span style={labelStyle(active)}>Background</span>
      {active && <span style={{ fontSize: 12, color: accentColor }}>✓</span>}
    </div>
  );
}

/** Stems — тумблер стемов (логика перенесена без изменений). */
function StemsRow({ accentColor, onClose }: QuickTogglesProps) {
  const stemsMode = useStemStore(s => s.stemsMode);

  const tc = (window as unknown as { trackCatalog?: { tracks?: Array<{ id?: string; stemsData?: Record<string, unknown> }>; currentTrackIndex?: number } }).trackCatalog;
  const trackIndex = tc?.currentTrackIndex ?? -1;
  const currentTrack = trackIndex >= 0 ? tc?.tracks?.[trackIndex] : undefined;
  const hasStemsData = Boolean(
    currentTrack?.stemsData && Object.keys(currentTrack.stemsData).length > 0,
  );

  const handleToggle = async () => {
    const st = useStemStore.getState();
    const newMode = !st.stemsMode;
    const ae = (window as unknown as { audioEngine?: Record<string, unknown> }).audioEngine;
    const trackId = currentTrack?.id;
    // Загруженные стемы нужны в обеих ветках: ON — проверяем, OFF — глушим.
    const stems = ae?.stems as Map<string, unknown> | undefined;

    if (newMode) {
      // ON — загрузить стемы, показать фейдеры (звук не включаем: это делает MixerPanel)
      st.setStemsMode(true);

      if (trackId) {
        const idb = (window as unknown as { idbService?: { updateTrackField?: (id: string, v: unknown) => void } }).idbService;
        idb?.updateTrackField?.(trackId, { stemsMode: true });
      }

      const loadedStemIds = stems ? [...stems.keys()] : [];
      const musicStemsLoaded = loadedStemIds.some(
        id => id !== 'instrumental' && id !== 'vocals',
      );

      if (!musicStemsLoaded) {
        useStemStore.getState().setStemsLoading(true);
        try {
          const { loadStemsOnDemand } = await import('../../services/track.loader');
          await loadStemsOnDemand();
        } catch (e) {
          console.warn('[QuickActions] On-demand load failed:', e);
        } finally {
          useStemStore.getState().setStemsLoading(false);
        }
      }
    } else {
      // OFF — скрыть фейдеры и выключить воспроизведение стемов
      st.setStemsMode(false);

      if (st.stemsEnabled) {
        st.setStemsEnabled(false);
        const setStemVolume = ae?.setStemVolume as ((id: string, v: number) => void) | undefined;
        setStemVolume?.('instrumental', 1);
        st.setStemVolume('instrumental', 1);

        if (stems) {
          stems.forEach((_v, id) => {
            if (id !== 'instrumental' && id !== 'vocals') {setStemVolume?.(id, 0);}
          });
        }

        const musicStems = st.loadedStems.filter(
          id => id !== 'instrumental' && id !== 'vocals',
        );
        for (const id of musicStems) {st.setStemVolume(id, 0);}
      }

      if (trackId) {
        const idb = (window as unknown as { idbService?: { updateTrackField?: (id: string, v: unknown) => void } }).idbService;
        idb?.updateTrackField?.(trackId, { stemsMode: false });
      }
    }

    onClose();
  };

  return (
    <div style={{ borderTop: '1px solid #333', marginTop: 8, paddingTop: 8 }}>
      <div
        style={{
          ...ROW,
          cursor: hasStemsData ? 'pointer' : 'not-allowed',
          opacity: hasStemsData ? 1 : 0.4,
        }}
        onClick={hasStemsData ? () => void handleToggle() : undefined}
      >
        <span style={{ fontWeight: 600, fontSize: 12, color: '#ddd' }}>Stems</span>

        {!hasStemsData ? (
          <span style={{ fontSize: 10, color: '#666' }}>N/A</span>
        ) : (
          <div
            role="switch"
            aria-checked={stemsMode}
            aria-label="Стемы"
            style={{
              width: 36,
              height: 20,
              borderRadius: 10,
              background: stemsMode ? accentColor : '#444',
              position: 'relative',
              transition: 'background 0.2s ease',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: 8,
                background: '#fff',
                position: 'absolute',
                top: 2,
                left: stemsMode ? 18 : 2,
                transition: 'left 0.2s ease',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/** Show Cover · Background · Stems — три строки под настройками. */
export function QuickToggles({ accentColor, onClose }: QuickTogglesProps) {
  return (
    <div>
      <ShowCoverRow accentColor={accentColor} />
      <BackgroundRow accentColor={accentColor} />
      <StemsRow accentColor={accentColor} onClose={onClose} />
    </div>
  );
}
