import { ENGINE_MODE } from '../engine-mode';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useDeckStore } from '../stores/deck.store';
import { useModeStore } from '../stores/mode.store';
import { getModulesForMode, getLazyComponent } from '../deck/registry';
import '../deck/modules';
import { TransportBar } from './TransportBar';
import { DeckPlayPause } from './DeckPlayPause';
import styles from './ControlDeck.module.css';
import { useAudioStore } from '../stores/audio.store';
import { usePracticeStore } from '../stores/practice-session.store';
import { useStemStore } from '../stem/stem.store';
import { BUILTIN_STEMS } from '../stem/stemTypes';
import { useSyncStore } from '../sync/store/sync.store';
import { useMonitorStore } from '../stores/monitor.store';
import { useRecordingStore } from '../stores/recording.store';
import { interruptPracticeSession } from '../exercises/exercise.interruption';
import { useExerciseStore } from '../exercises/exercise.store';
import { CoverArt } from './CoverArt';
import { BpmButtons } from './BpmButtons';
import { useTrackStore } from '../stores/track.store';
import { useTrackInfoStore } from '../stores/trackInfo.store';
import { useShowStore } from '../stores/show.store';

// Exact wing-core colors (sampled from welcome-splash.mp4) — keep in sync with LoadingSplash.
const WING_RED = '#FE5C55';
const WING_BLUE = '#39A4FE';
const INST_GLOW = 'rgba(254, 92, 85, 0.55)';
const VOC_GLOW = 'rgba(57, 164, 254, 0.55)';
const INST_GLOW_HOT = 'rgba(254, 92, 85, 0.9)';
const VOC_GLOW_HOT = 'rgba(57, 164, 254, 0.9)';

export function ControlDeck() {
  const expanded = useDeckStore(s => s.expanded);
  const activeTabId = useDeckStore(s => s.activeTabId);
  const toggle = useDeckStore(s => s.toggle);
  const setTab = useDeckStore(s => s.setTab);
  const mode = useModeStore(s => s.mode);
  const recFeatureActive = useShowStore(s => s.featureActive);
  const deactivateFeature = useShowStore(s => s.deactivateFeature);
  const rootRef = useRef<HTMLDivElement>(null);
  // 707 brief: hover/drag glow boost on the wing faders (does NOT touch click/drag math).
  const [hotFader, setHotFader] = useState<'' | 'inst' | 'voc'>('');

  const syncOpen = useSyncStore(s => s.open);
  const trackInfoOpen = useTrackInfoStore(s => s.isOpen);
  const monitorEnabled = useMonitorStore(s => s.enabled);
  const isRecording = useRecordingStore(s => s.isRecording);
  // TC-PITCH-03: Removed pianoWasOpen imports (no longer needed)

  const activeExercise = useExerciseStore(s => s.activeExercise);
  const setInstrumentalOverride = useExerciseStore(s => s.setInstrumentalOverride);
  const setVocalOverride = useExerciseStore(s => s.setVocalOverride);

  // W12: Cover Art for current track
  const currentTrack = useTrackStore(s => s.currentTrack);
  const hasTrack = !!currentTrack;

  // Exercise execution lock variables removed - replaced with interruption model

  const visibleTabs = getModulesForMode(mode);
  const ActiveModule = getLazyComponent(activeTabId);

  const instrumentalVolume = useStemStore(s => s.stemVolumes['instrumental'] ?? 1);
  const vocalsVolume = useStemStore(s => s.stemVolumes['vocals'] ?? 1);
  // №18-BUS H3.4 (GO): красный фейдер dual-mode.
  // V3-stems: Inst-фейдер = уровень минуса (music-bus); no-stems: инструментал-мастер (как в V2).
  const loadedStems = useStemStore(s => s.loadedStems);
  const musicBusVolume = useStemStore(s => s.busVolumes['music-bus'] ?? 1);
  const __v3Active = !!(window as any).__v3Active;
  const hasMusicStems = loadedStems.some(id => BUILTIN_STEMS[id]?.role === 'music');
  const instFaderValue = __v3Active && hasMusicStems ? musicBusVolume : instrumentalVolume;
  const playbackRate = useAudioStore(s => s.playbackRate);
  const isPracticeActive = usePracticeStore(s => s.isActive);
  const practiceCurrentRate = usePracticeStore(s => s.currentRate);
  const vocalMixEnabled = useAudioStore(s => s.vocalMixEnabled);
  const micEnabled = useAudioStore(s => s.micEnabled);
  // E17-E19 (SURFACE): setMicEnabled removed — store updated via microphone-state-changed event
  const micVolume = useAudioStore(s => s.micVolume);

  // TC-PITCH-03: Removed pianoOpenRef + pianoOpen checks (pitch = tab now)
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      document.documentElement.style.setProperty(
        '--bl-deck-height', `${entry.contentRect.height}px`
      );
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      // НЕ удаляем --bl-deck-height — BillyDock зависит от этого значения
      // даже когда ControlDeck не смонтирован (syncOpen=true)
      // SyncEditorPanel также публикует эту var — покрытие есть
    };
  }, []);
  
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    document.documentElement.style.setProperty(
      '--bl-deck-height', `${el.getBoundingClientRect().height}px`
    );
  }, []);

  // Stale tab guard — normalize to empty state if module not registered
  useEffect(() => {
    const id = useDeckStore.getState().activeTabId;
    if (id && id !== '' && !getLazyComponent(id)) {
      useDeckStore.getState().clearTab();
    }
  }, []);

  return (
    <div ref={rootRef} className={styles.root} data-reactive="true">
      <div className={styles.tabs} style={{ position: 'relative' }}>
        {/* W12: Cover Art 32x32 — absolute in .tabs, NOT in .tabsInner (overflow-y:hidden) */}
        {hasTrack && (
          <div style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 32,
            height: 32,
            zIndex: 1,
          }}>
            <CoverArt
              url={currentTrack?.coverArtUrl}
              title={currentTrack?.title || ''}
              size={32}
              borderRadius={7}
            />
          </div>
        )}
        <div className={styles.tabsInner} style={{ paddingLeft: hasTrack ? 44 : 0 }}>
          {visibleTabs.map(t => {
            // Feature-active: monitor when enabled, rec when recording
            const featureActive = 
              (t.id === 'monitor' && monitorEnabled) ||
              (t.id === 'rec' && isRecording)
                ? 'true'
                : 'false';
            
            return (
              <button
                key={t.id}
                className={styles.tab}
                data-active={activeTabId === t.id ? 'true' : 'false'}
                data-feature-active={featureActive}
                data-recording={t.id === 'rec' && isRecording ? 'true' : 'false'}
                onClick={() => {
                  // Interrupt practice first if active, then continue requested action
                  interruptPracticeSession(() => {
                    // Если клик на Show таб и feature активна — вернуться к сценарию
                    if (t.id === 'rec' && recFeatureActive) {
                      deactivateFeature();
                      return;
                    }
                    setTab(t.id);
                  });
                }}
                style={{
                  opacity: 1,
                  cursor: 'pointer',
                }}
                title={t.label}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* TC-SLIDERS-CENTER-01: Sliders group. The three transport controls
            are anchored to the SAME 50% axis as the top bL roundel, so their
            position can no longer drift when tab / BPM / VMix widths change
            (a loaded track adds a "Split" tab and used to push play ~19px right). */}
        <div style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 6,
          minWidth: 0,
        }}>
          {/* Nearest positioned ancestor is `.tabs` (this group is static),
              so 50% here means 50% of the viewport, not of the leftover flex
              space. All other controls keep their old flow positions. */}
          <div style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            zIndex: 2,
          }}>
          <div
            style={{
              position: 'relative',
              width: 180,
              height: 22,
              borderRadius: 4,
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(254, 92, 85, 0.4)',
              filter: hotFader === 'inst' ? `drop-shadow(0 0 13px ${INST_GLOW_HOT})` : `drop-shadow(0 0 7px ${INST_GLOW})`,
              overflow: 'hidden',
              cursor: 'pointer',
              flexShrink: 0,
            }}
            onMouseEnter={() => setHotFader('inst')}
            onMouseLeave={() => setHotFader('')}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const v = Math.max(0, Math.min(1, x / rect.width));
              // №18-BUS H3.4: dual-mode маршрутизация красного фейдера
              const __v3 = (window as any).__v3Active;
              if (__v3 && hasMusicStems) {
                // V3-stems: фейдер управляет music-bus (уровень минуса)
                useStemStore.getState().setBusVolume('music-bus', v);
              } else {
                if (!__v3) { // 📌DC3: гард от DEV-warn спама обёрткой H4.1 (009 LOW#2)
                  const ae = (window as any).audioEngine;
                  if (ae) ae.setInstrumentalVolume(v);
                }
                useStemStore.getState().setStemVolume('instrumental', v); // зеркало всегда (дисплей/синк)
              }
              if (activeExercise) setInstrumentalOverride(v);
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              const slider = e.currentTarget;
              const onMove = (ev: MouseEvent) => {
                const rect = slider.getBoundingClientRect();
                const x = ev.clientX - rect.left;
                const v = Math.max(0, Math.min(1, x / rect.width));
                // №18-BUS H3.4: dual-mode маршрутизация красного фейдера
                const __v3 = (window as any).__v3Active;
                if (__v3 && hasMusicStems) {
                  // V3-stems: фейдер управляет music-bus (уровень минуса)
                  useStemStore.getState().setBusVolume('music-bus', v);
                } else {
                  if (!__v3) { // 📌DC3: гард от DEV-warn спама обёрткой H4.1 (009 LOW#2)
                    const ae = (window as any).audioEngine;
                    if (ae) ae.setInstrumentalVolume(v);
                  }
                  useStemStore.getState().setStemVolume('instrumental', v); // зеркало всегда (дисплей/синк)
                }
                if (activeExercise) setInstrumentalOverride(v);
              };
              const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
              };
              document.addEventListener('mousemove', onMove);
              document.addEventListener('mouseup', onUp);
            }}
            title='V3-stems: Inst-фейдер = уровень минуса (music-bus); no-stems: инструментал-мастер (как в V2)'
          >
            <div style={{
              position: 'absolute',
              left: 0, top: 0, bottom: 0,
              width: `${Math.round(instFaderValue * 100)}%`,
              background: `linear-gradient(180deg, rgba(254, 92, 85, 0.9) 0%, rgba(254, 92, 85, 0.22) 50%, rgba(254, 92, 85, 0.9) 100%)`,
              boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.35), inset 0 -3px 6px rgba(0,0,0,0.45)',
              transition: 'width 0.05s',
              pointerEvents: 'none',
            }}>
              <div style={{
                position: 'absolute', inset: 0,
                background: 'repeating-linear-gradient(90deg, transparent 0, transparent 6px, rgba(255,255,255,0.14) 6px, rgba(255,255,255,0.14) 7px)',
                mixBlendMode: 'overlay', pointerEvents: 'none',
              }} />
              <div style={{
                position: 'absolute', right: -1, top: -1, bottom: -1, width: 2,
                background: '#ffffff',
                boxShadow: `0 0 6px 1px ${WING_RED}, 0 0 12px 3px ${INST_GLOW}`,
                pointerEvents: 'none',
              }} />
            </div>
            <span style={{
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              fontSize: 9,
              color: 'rgba(255, 255, 255, 0.55)',
              userSelect: 'none',
              pointerEvents: 'none',
              textShadow: '0 1px 2px rgba(0,0,0,0.65)',
            }}>
              Inst {Math.round(instFaderValue * 100)}
            </span>
          </div>

          {/* 707: visual play/pause — the deck twin of the top "bL" roundel.
              Sits EXACTLY between the two wing faders; the splash renders the
              same RoundelFace so the hand-off stays pixel-identical. */}
          <DeckPlayPause />

          <div
              style={{
                position: 'relative',
                width: 180,
                height: 22,
                borderRadius: 4,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(57, 164, 254, 0.4)',
                filter: hotFader === 'voc' ? `drop-shadow(0 0 13px ${VOC_GLOW_HOT})` : `drop-shadow(0 0 7px ${VOC_GLOW})`,
                overflow: 'hidden',
                cursor: 'pointer',
                flexShrink: 0,
              }}
              onMouseEnter={() => setHotFader('voc')}
              onMouseLeave={() => setHotFader('')}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const v = Math.max(0, Math.min(1, x / rect.width));
                const ae = (window as any).audioEngine;
                if (ae) ae.setVocalsVolume(v);
                useStemStore.getState().setStemVolume('vocals', v);
                if (activeExercise) setVocalOverride(v);
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                const slider = e.currentTarget;
                const onMove = (ev: MouseEvent) => {
                  const rect = slider.getBoundingClientRect();
                  const x = ev.clientX - rect.left;
                  const v = Math.max(0, Math.min(1, x / rect.width));
                  const ae = (window as any).audioEngine;
                  if (ae) ae.setVocalsVolume(v);
                  useStemStore.getState().setStemVolume('vocals', v);
                  if (activeExercise) setVocalOverride(v);
                };
                const onUp = () => {
                  document.removeEventListener('mousemove', onMove);
                  document.removeEventListener('mouseup', onUp);
                };
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
              }}
              title='Vocals volume'
            >
              <div style={{
                position: 'absolute',
                left: 0, top: 0, bottom: 0,
                width: `${Math.round(vocalsVolume * 100)}%`,
              background: `linear-gradient(180deg, rgba(57, 164, 254, 0.9) 0%, rgba(57, 164, 254, 0.22) 50%, rgba(57, 164, 254, 0.9) 100%)`,
              boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.35), inset 0 -3px 6px rgba(0,0,0,0.45)',
                transition: 'width 0.05s',
                pointerEvents: 'none',
              }}>
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'repeating-linear-gradient(90deg, transparent 0, transparent 6px, rgba(255,255,255,0.14) 6px, rgba(255,255,255,0.14) 7px)',
                  mixBlendMode: 'overlay', pointerEvents: 'none',
                }} />
                <div style={{
                  position: 'absolute', right: -1, top: -1, bottom: -1, width: 2,
                  background: '#ffffff',
                  boxShadow: `0 0 6px 1px ${WING_BLUE}, 0 0 12px 3px ${VOC_GLOW}`,
                  pointerEvents: 'none',
                }} />
              </div>
              <span style={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                fontSize: 9,
                color: 'rgba(255, 255, 255, 0.55)',
                userSelect: 'none',
                pointerEvents: 'none',
                textShadow: '0 1px 2px rgba(0,0,0,0.65)',
              }}>
              Voc {Math.round(vocalsVolume * 100)}
            </span>
            </div>
          </div>
          {/* Reserves exactly the trio width (180 + 6 + 52 + 6 + 180 = 424)
              inside the flex row, so BpmButtons / VMix stay pixel-identical. */}
          <div aria-hidden="true" style={{ width: 424, height: 22, flexShrink: 0, pointerEvents: 'none' }} />

          <BpmButtons
            playbackRate={(isPracticeActive ? practiceCurrentRate : playbackRate) || 1}
            disabled={isPracticeActive}
            onChange={(rate) => {
              interruptPracticeSession(() => {
                const safe = Math.max(0.25, Math.min(4, rate));
                // Двойной путь: V2 (legacy) + store (для V3 arbiter)
                (window as any).audioEngine?.setPlaybackRate?.(safe);
                useAudioStore.setState({ playbackRate: safe });
              });
            }}
          />

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            flexShrink: 0,
            marginLeft: 6,
          }}>
            {/* VMix toggle */}
            <button
              onClick={() => {
                const ae = (window as any).audioEngine;
                // TASK-015 (v3): стерео-разводка через MonitorRouter.setVMix
                const router = (window as any).__belive?.monitorRouter;
                if (router?.setVMix) {
                  const next = !vocalMixEnabled;
                  router.setVMix(next);
                  // E17 (SURFACE): store updated via vocalmix-state-changed event → audio-events
                  return;
                }
                if (!ae) return;
                const engineMode = ENGINE_MODE;
                if (engineMode === 'v3') {
                  // UI: явное «недоступно в V3-режиме» (тост/бейдж), НЕ бросать, НЕ вызывать
                  return;
                }
                if (vocalMixEnabled) router?.setVMix(false);
                else router?.setVMix(true);
              }}
              style={{
                background: vocalMixEnabled ? 'rgba(255, 140, 0, 0.25)' : 'transparent',
                border: `1px solid ${vocalMixEnabled ? 'rgba(255, 140, 0, 0.5)' : 'rgba(255,255,255,0.12)'}`,
                color: vocalMixEnabled ? '#ff8c00' : 'rgba(255,255,255,0.4)',
                fontSize: 10,
                padding: '4px 8px',
                borderRadius: 4,
                cursor: 'pointer',
                fontWeight: 600,
              }}
              title='VMix — vocals L / music center / mic R (нужен включённый 🎤)'
            >
              VMix {vocalMixEnabled ? 'ON' : 'OFF'}
            </button>

            {/* Mic toggle */}
            <button
              onClick={async () => {
                const belive = (window as any).__belive;
                const src = belive?.micSource;
                if (!src) return;
                if (micEnabled) {
                  try { (belive.__micMonitorNode as MediaStreamAudioSourceNode)?.disconnect(); } catch {}
                  belive.__micMonitorNode = null;
                  try { belive.monitorRouter?.setMicMonitor(false); } catch {}
                  src.release();
                  // E18 (SURFACE): store updated via microphone-state-changed event → audio-events
                  return;
                }
                try {
                  const stream = await src.acquire();
                  const ctx = belive?.pipeline?.ctx;
                  const router = belive?.monitorRouter;
                  if (ctx && router) {
                    // R1-гвард: быстрый ON/OFF/ON — переиспользуем слот
                    try { (belive.__micMonitorNode as MediaStreamAudioSourceNode)?.disconnect(); } catch {}
                    const node = ctx.createMediaStreamSource(stream);
                    node.connect(router.micInput);
                    belive.__micMonitorNode = node;
                    try { await belive.deviceManager?.ensureMonitorPlaying?.(); } catch {}
                    router.setMicMonitor(true, useAudioStore.getState().micVolume ?? 1);
                    setTimeout(() => {
                      try {
                        const g = router.monitorLevel;
                        const st = (ctx as AudioContext).state;
                        console.log(`[MON-PROBE] monitorGain=${g} ctx=${st}`);
                      } catch {}
                    }, 150);
                    // E19 (SURFACE): store updated via microphone-state-changed event → audio-events
                  } else {
                    src.release();
                    console.warn('[ControlDeck] mic monitor недоступен (нет router/ctx)');
                  }
                } catch (e) { console.warn('[ControlDeck] mic enable failed', e); }
              }}
              style={{
                background: micEnabled ? 'rgba(255, 140, 0, 0.25)' : 'transparent',
                border: `1px solid ${micEnabled ? 'rgba(255, 140, 0, 0.5)' : 'rgba(255,255,255,0.12)'}`,
                color: micEnabled ? '#ff8c00' : 'rgba(255,255,255,0.4)',
                fontSize: 10,
                padding: '4px 8px',
                borderRadius: 4,
                cursor: 'pointer',
                fontWeight: 600,
              }}
              title='Microphone'
            >
              🎤 {micEnabled ? 'ON' : 'OFF'}
            </button>

            {/* Mic volume slider — shows only when mic enabled */}
            {micEnabled && (
              <div
                style={{
                  position: 'relative',
                  width: 80,
                  height: 22,
                  borderRadius: 4,
                  background: 'rgba(255, 255, 255, 0.06)',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const v = Math.max(0, Math.min(1, x / rect.width));
                  (window as any).audioEngine?.setMicrophoneVolume?.(v);
                  useAudioStore.setState({ micVolume: v });
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  const slider = e.currentTarget;
                  const onMove = (ev: MouseEvent) => {
                    const rect = slider.getBoundingClientRect();
                    const x = ev.clientX - rect.left;
                    const v = Math.max(0, Math.min(1, x / rect.width));
                    (window as any).audioEngine?.setMicrophoneVolume?.(v);
                    useAudioStore.setState({ micVolume: v });
                  };
                  const onUp = () => {
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                  };
                  document.addEventListener('mousemove', onMove);
                  document.addEventListener('mouseup', onUp);
                }}
                title='Mic volume'
              >
                <div style={{
                  position: 'absolute',
                  left: 0, top: 0, bottom: 0,
                  width: `${Math.round((micVolume || 0) * 100)}%`,
                  background: 'rgba(255, 140, 0, 0.3)',
                  transition: 'width 0.05s',
                  pointerEvents: 'none',
                }} />
                <span style={{
                  position: 'relative',
                  zIndex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  fontSize: 9,
                  color: 'rgba(255, 255, 255, 0.45)',
                  userSelect: 'none',
                  pointerEvents: 'none',
                }}>
                  Mic {Math.round((micVolume || 0) * 100)}
                </span>
              </div>
            )}
          </div>
        </div>


        {/* Sync — technical section */}
        <button
          className={styles.tab}
          data-active={syncOpen ? 'true' : 'false'}
          onClick={() => {
            // Interrupt practice first if active, then continue requested action
            interruptPracticeSession(() => {
              useDeckStore.getState().setTab('');
              if (syncOpen) useSyncStore.getState().closeSync();
              else useSyncStore.getState().openSync();
            });
          }}
          title='Sync'
        >
          Sync
        </button>

        {/* TrackMap Info Board */}
        <button
          className={styles.tab}
          data-active={trackInfoOpen ? 'true' : 'false'}
          onClick={() => {
            interruptPracticeSession(() => {
              useDeckStore.getState().setTab('');
              if (trackInfoOpen) {
                useTrackInfoStore.getState().close();
              } else if (currentTrack?.id) {
                useTrackInfoStore.getState().open(Number(currentTrack.id));
              }
            });
          }}
          title='DNA'
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M 8 4 C 8 8 16 8 16 12 C 16 16 8 16 8 20"/>
            <path d="M 16 4 C 16 8 8 8 8 12 C 8 16 16 16 16 20"/>
          </svg>
        </button>

        <button
          type="button"
          className={styles.tabsToggle}
          onClick={() => {
            // Interrupt practice first if active, then continue requested action
            interruptPracticeSession(() => {
              // TC-PITCH-03: Removed pianoOpen/pianoWasOpen logic (pitch = tab now)
              toggle();
            });
          }}
          aria-label={expanded ? 'Collapse dock' : 'Expand dock'}
          title={expanded ? 'Collapse dock' : 'Expand dock'}
          style={{
            opacity: 1,
            cursor: 'pointer',
          }}
        >
          {expanded ? '▾' : '▴'}
        </button>
      </div>

      {expanded && (
        <div className={styles.panel} data-active-tab={activeTabId || 'none'}>
          {ActiveModule && (
            <Suspense fallback={null}>
              <ActiveModule />
            </Suspense>
          )}
        </div>
      )}

      <TransportBar />
    </div>
  );
}
