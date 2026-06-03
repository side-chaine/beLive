import { Suspense, useEffect, useRef } from 'react';
import { useDeckStore } from '../stores/deck.store';
import { useModeStore } from '../stores/mode.store';
import { usePianoStore } from '../stores/piano.store';
import { getModulesForMode, getLazyComponent } from '../deck/registry';
import '../deck/modules';
import { TransportBar } from './TransportBar';
import styles from './ControlDeck.module.css';
import { useAudioStore } from '../stores/audio.store';
import { usePracticeStore } from '../stores/practice-session.store';
import { useStemStore } from '../stem/stem.store';
import { useSyncStore } from '../sync/store/sync.store';
import { requestOpenSync, requestCloseSync } from '../sync/bridge/sync.bridge';
import { useMonitorStore } from '../stores/monitor.store';
import { useRecordingStore } from '../stores/recording.store';
import { interruptPracticeSession } from '../exercises/exercise.interruption';
import { useExerciseStore } from '../exercises/exercise.store';
import { CoverArt } from './CoverArt';
import { useTrackStore } from '../stores/track.store';
import { useTrackInfoStore } from '../stores/trackInfo.store';
import { useShowStore } from '../stores/show.store';

export function ControlDeck() {
  const expanded = useDeckStore(s => s.expanded);
  const activeTabId = useDeckStore(s => s.activeTabId);
  const stemsMode = useStemStore(s => s.stemsMode);
  const toggle = useDeckStore(s => s.toggle);
  const setTab = useDeckStore(s => s.setTab);
  const mode = useModeStore(s => s.mode);
  const recFeatureActive = useShowStore(s => s.featureActive);
  const deactivateFeature = useShowStore(s => s.deactivateFeature);
  const rootRef = useRef<HTMLDivElement>(null);
  // TC-PITCH-03: Piano = tab, not overlay
  const pianoOpen = activeTabId === 'pitch';

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
  const hasVocals = useAudioStore(s => s.hasVocals);
  const playbackRate = useAudioStore(s => s.playbackRate);
  const isPracticeActive = usePracticeStore(s => s.isActive);
  const practiceCurrentRate = usePracticeStore(s => s.currentRate);
  const vocalMixEnabled = useAudioStore(s => s.vocalMixEnabled);
  const micEnabled = useAudioStore(s => s.micEnabled);
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

        {/* TC-SLIDERS-CENTER-01: Sliders group — centered with flexbox */}
        <div style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 6,
          minWidth: 0,
        }}>
          <div
            style={{
              position: 'relative',
              width: 180,
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
              const ae = (window as any).audioEngine;
              if (ae) ae.setInstrumentalVolume(v);
              useStemStore.getState().setStemVolume('instrumental', v);
              if (activeExercise) setInstrumentalOverride(v);
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              const slider = e.currentTarget;
              const onMove = (ev: MouseEvent) => {
                const rect = slider.getBoundingClientRect();
                const x = ev.clientX - rect.left;
                const v = Math.max(0, Math.min(1, x / rect.width));
                const ae = (window as any).audioEngine;
                if (ae) ae.setInstrumentalVolume(v);
                useStemStore.getState().setStemVolume('instrumental', v);
                if (activeExercise) setInstrumentalOverride(v);
              };
              const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
              };
              document.addEventListener('mousemove', onMove);
              document.addEventListener('mouseup', onUp);
            }}
            title='Instrumental volume'
          >
            <div style={{
              position: 'absolute',
              left: 0, top: 0, bottom: 0,
              width: `${Math.round(instrumentalVolume * 100)}%`,
              background: 'rgba(255, 60, 60, 0.3)',
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
              Inst {Math.round(instrumentalVolume * 100)}
            </span>
          </div>

          {hasVocals && (
            <div
              style={{
                position: 'relative',
                width: 180,
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
                background: 'rgba(74, 158, 255, 0.3)',
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
                Voc {Math.round(vocalsVolume * 100)}
              </span>
            </div>
          )}

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            flexShrink: 0,
            marginLeft: 4,
          }}>
            <button
              disabled={isPracticeActive}
              title={isPracticeActive ? 'Управление темпом через карточку тренировки' : '-5% playback rate'}
              onClick={() => {
                // Interrupt practice first if active, then continue requested action
                interruptPracticeSession(() => {
                  const r = Math.max(0.25, (playbackRate || 1) - 0.05);
                  (window as any).audioEngine?.setPlaybackRate?.(Math.round(r * 100) / 100);
                });
              }}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.4)',
                fontSize: 12,
                padding: '4px 10px',
                borderRadius: 4,
                cursor: 'pointer',
                lineHeight: 1,
              }}
            >-5</button>
            <button
              disabled={isPracticeActive}
              title={isPracticeActive ? 'Управление темпом через карточку тренировки' : 'Reset playback rate'}
              onClick={() => {
                // Interrupt practice first if active, then continue requested action
                interruptPracticeSession(() => {
                  (window as any).audioEngine?.setPlaybackRate?.(1);
                });
              }}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: (playbackRate || 1) !== 1 ? '#ff8c00' : 'rgba(255,255,255,0.5)',
                fontSize: 12,
                padding: '4px 10px',
                borderRadius: 4,
                cursor: 'pointer',
                minWidth: 42,
                textAlign: 'center' as const,
                lineHeight: 1,
              }}
            >{Math.round(((isPracticeActive ? practiceCurrentRate : playbackRate) || 1) * 100)}%</button>
            <button
              disabled={isPracticeActive}
              title={isPracticeActive ? 'Управление темпом через карточку тренировки' : '+5% playback rate'}
              onClick={() => {
                // Interrupt practice first if active, then continue requested action
                interruptPracticeSession(() => {
                  const r = Math.min(4, (playbackRate || 1) + 0.05);
                  (window as any).audioEngine?.setPlaybackRate?.(Math.round(r * 100) / 100);
                });
              }}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.4)',
                fontSize: 12,
                padding: '4px 10px',
                borderRadius: 4,
                cursor: 'pointer',
                lineHeight: 1,
              }}
            >+5</button>
          </div>

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
                if (!ae) return;
                if (vocalMixEnabled) ae.disableVocalMix();
                else ae.enableVocalMix();
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
              title='VMix'
            >
              VMix {vocalMixEnabled ? 'ON' : 'OFF'}
            </button>

            {/* Mic toggle */}
            <button
              onClick={() => {
                const ae = (window as any).audioEngine;
                if (!ae) return;
                if (micEnabled) ae.disableMicrophone();
                else ae.enableMicrophone();
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
              if (syncOpen) requestCloseSync();
              else requestOpenSync();
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
