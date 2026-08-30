import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './theme/components/ThemeProvider';
// retired: blocks.bridge → blocks-events (DUAL FIRE)
import { installLiveGuard } from './bridges/live-guard';
// retired: loop.bridge → loop-events
import { initLoopEvents } from './foundation/event-bus/wrappers/loop-events';
// import { initAudioReactiveBridge } from './bridges/audio-reactive.bridge';  // retired → audio-reactive wrapper
import { patchLyricsDisplaySlimMethods } from './services/lyrics.service';
import { bridgeFacade } from './foundation/event-bus';
import { V3StatePublisher, V3DataInterceptor, getTransport, setStatePublisher, MonitorRouter } from './audio/engine-v3';
import type { HybridPipelineService as HybridPipelineServiceType } from './audio/engine-v3/pipeline/HybridPipelineService';
import { MonitorEngine } from './audio/engine-v3/monitor/MonitorEngine';
import { DeviceManager } from './audio/engine-v3/monitor/DeviceManager';
import { getAudioContext } from './audio/core/audioContext';
import { eventBus, EventBusChannel } from './foundation/event-bus';
import { initExerciseEvents } from './foundation/event-bus/wrappers/exercise-events';
import { initTrackEvents } from './foundation/event-bus/wrappers/track-events';
import { initCoverEvents } from './foundation/event-bus/wrappers/cover-events';
import { initPlateEvents } from './foundation/event-bus/wrappers/plate-events';
import { initBlocksEvents } from './foundation/event-bus/wrappers/blocks-events';
import { initMarkersEvents } from './foundation/event-bus/wrappers/markers-events';
import { initLyricsEvents } from './foundation/event-bus/wrappers/lyrics-events';
import { initMonitorEvents } from './foundation/event-bus/wrappers/monitor-events';
import { initAudioReactiveEvents } from './foundation/event-bus/wrappers/audio-reactive';
import { initStemReactiveEvents } from './foundation/event-bus/wrappers/stem-reactive';
import { initTextStyleEvents } from './foundation/event-bus/wrappers/text-style-events';
import { initTakesEvents } from './foundation/event-bus/wrappers/takes-events';
import { initModeEvents } from './foundation/event-bus/wrappers/mode-events';
import { initPositionSync } from './foundation/event-bus/wrappers/position-sync';
import { initAudioEvents } from './foundation/event-bus/wrappers/audio-events';
import { registerInit, runAll } from './foundation/registry/initRegistry';
import { initStemEngineSync } from './foundation/reactions/stem-engine-sync';
import { getColorForBlockType, buildBlocksFromMarkers, computeSections, getBlockTypeForLine } from './utils/markerUtils';
import { SignalingClient } from './Rehearsal/services/signaling-client';
import { PeerConnectionManager } from './Rehearsal/services/peer-connection';
import { RehearsalTriggerBridge } from './Rehearsal/bridge/rehearsal-trigger.bridge';
import { useRehearsalSessionStore } from './Rehearsal/store/rehearsal-session.store';
import { useAudioStore } from './stores/audio.store';
import { useNotifyStore } from './stores/notify.store';
import { MicSourceV3 } from './audio/engine-v3/services/MicSourceV3';

// import '../css/main.css'; // loaded via <link> in index.html
// import '../css/ai-chat.css'; // loaded via <link> in index.html
// import '../css/avatar-studio.css'; // loaded via <link> in index.html

import { aiHub } from './js/ai/registry';
import './character';
import { GatewayProvider } from './js/ai/providers/gateway-provider';
import { OpenRouterDirectProvider } from './js/ai/providers/openrouter-direct.provider';
import { BeliveProvider } from './js/ai/providers/belive.provider';
import { useAiSettingsStore } from './stores/ai-settings.store';
import { ModelDropdownUI } from './js/ui/model-dropdown-ui'; // Новый импорт
import { AIChatUI } from './js/ui/ai-chat-ui'; // Новый импорт

declare global { interface Window { __BELIVE_BOOTED__?: boolean } }

// --- HMR-safe wrapper init (module-eval, без DOM) ---
void bridgeFacade.init()
registerInit({ id: 'exercise-events', init: initExerciseEvents })
registerInit({ id: 'stem-engine-sync', init: initStemEngineSync })
// === DUAL FIRE: 10 GREEN bridges (gate verified, parity pass) ===
registerInit({ id: 'track-events', init: initTrackEvents })
registerInit({ id: 'cover-events', init: initCoverEvents })
registerInit({ id: 'plate-events', init: initPlateEvents })
registerInit({ id: 'blocks-events', init: initBlocksEvents })
registerInit({ id: 'markers-events', init: initMarkersEvents })
registerInit({ id: 'lyrics-events', init: initLyricsEvents })
registerInit({ id: 'monitor-events', init: initMonitorEvents })
registerInit({ id: 'audio-reactive', init: initAudioReactiveEvents })
registerInit({ id: 'stem-reactive', init: initStemReactiveEvents })
registerInit({ id: 'takes-events', init: initTakesEvents })
registerInit({ id: 'text-style-events', init: initTextStyleEvents })
registerInit({ id: 'mode-events', init: initModeEvents })
registerInit({ id: 'position-sync', init: initPositionSync })
registerInit({ id: 'audio-events', init: initAudioEvents })
registerInit({ id: 'loop-events', init: initLoopEvents })
const cleanupAll = runAll()

// ═══ AETHER v3.0 Boot ═══
// TransportV3 singleton через getTransport()

let _aetherPublisher: V3StatePublisher | undefined

function bootAether(): void {
  try {
    // 009-W2b-restore: единственный writer флага V3 (удалён в W2b, d0e31af)
    ;(window as any).__v3Active = false
    ;(window as any).__setV3Active = (active: boolean) => { (window as any).__v3Active = active === true }
    const transport = getTransport()
    ;(window as any).__belive = (window as any).__belive || {}
    ;(window as any).__belive.transport = transport
    if (!transport) return // V2 not available

    // 1. Publisher — публикация времени в UI
    _aetherPublisher = new V3StatePublisher(transport)
    setStatePublisher(_aetherPublisher) // для UI компонентов (publishSeek)
    _aetherPublisher.start()

    // 1b. MonitorRouter + MonitorEngine — Static Output Bus (TC-2C).
    //     Eager: стемы с рождения в Router. Permanent Facade — один раз навсегда.
    const ctx = getAudioContext()
    let router: MonitorRouter | null = null
    let monitorEngine: MonitorEngine | null = null
    let deviceManager: InstanceType<typeof DeviceManager> | null = null
    try {
      router = new MonitorRouter(ctx)
      transport.orchestrator.setOutputRouting(router.programInput, router.vocalHallInput)
      monitorEngine = new MonitorEngine()
      deviceManager = new DeviceManager(router.monitorStream, router.mainStream)
      monitorEngine.setBackend(router, ctx, deviceManager)
      // 🔬 RECON-3: временный глобальный доступ для диагностики
      ;(window as any).__router = router
      console.log('[AETHER] ✅ MonitorRouter + MonitorEngine active — Static Output Bus')
    } catch (e) { console.warn('[AETHER] MonitorRouter failed — stems → ctx.destination', e) }

    // 2. Interceptor — получение треков из IDB параллельно V2 (СТРОГО ПОСЛЕ Router)
    const interceptor = new V3DataInterceptor(ctx, transport.orchestrator, transport)

    // 🟢 Phase F: HybridPipelineService — retry/re-entry + explicit fail-state
    const initV3Pipeline = async (attempt = 0): Promise<HybridPipelineServiceType | null> => {
      const MAX = 3
      const BACKOFF = [1000, 2000, 4000]
      try {
        const { HybridPipelineService } = await import('./audio/engine-v3/pipeline/HybridPipelineService')
        const pipeline = new HybridPipelineService(ctx)
        await pipeline.init()
        return pipeline
      } catch (e) {
        if (attempt < MAX) {
          console.warn(`[AETHER] ❌ HybridPipelineService init failed (${attempt + 1}/${MAX}) — retry in ${BACKOFF[attempt]}ms:`, e)
          await new Promise(r => setTimeout(r, BACKOFF[attempt]))
          return initV3Pipeline(attempt + 1)
        }
        return null
      }
    }

    const handleV3BootFailure = () => {
      useAudioStore.getState().setV3BootStatus({ status: 'failed', attempts: 3, at: Date.now() })
      useNotifyStore.getState().pushToast({
        level: 'error',
        title: 'V3 engine unavailable',
        message: 'Audio running in degraded mode — reload to restore V3.',
      })
      ;(window as any).__setV3Active?.(false)
      console.error('[AETHER] ❌ V3 boot failed after retries — V2 restored, user notified')
    }

    ;(async () => {
      const pipeline = await initV3Pipeline()
      if (!pipeline) { handleV3BootFailure(); return }
      try {
        // Подключаем pipeline к MonitorRouter
        // Topology: pipeline.outputNode → router.programInput → _defaultBranch → destination
        if (router) {
          pipeline.outputNode.connect(router.programInput)
          pipeline.setVocalHallTarget(router.vocalHallInput)
          pipeline.setVMixCenterTarget(router.vmixCenterIn)
          pipeline.setVMixVocalTarget(router.vmixVocalIn)
        }

        // Подключаем pipeline к TransportV3 (через IPipelineController)
        transport.attachPipeline(pipeline)

        // Attach pipeline к Interceptor для загрузки стемов в WASM
        interceptor.attachPipeline(pipeline)

        // Выставляем в window для дебага
        ;(window as any).__belive = (window as any).__belive || {}
        ;(window as any).__belive.pipeline = pipeline
        ;(window as any).__belive.micSource = (window as any).__belive.micSource ?? new MicSourceV3()
        ;(window as any).__belive.monitorRouter = router
        ;(window as any).__belive.stemOrchestrator = transport.orchestrator
        ;(window as any).__belive.stemOrchestrator?.setVMixCenterTap?.((window as any).__belive.monitorRouter?.vmixCenterIn)
        if (deviceManager) { ;(window as any).__belive.deviceManager = deviceManager }

        console.log('[AETHER] ✅ HybridPipelineService Phase F — ACTIVE')
        console.log('[AETHER] ⚡ __belive.pipeline — diagnostics API')
      } catch (e) {
        console.warn('[AETHER] ❌ HybridPipelineService wiring deferred — varispeed fallback:', e)
      }
    })()

    // 🧪 Expose для консоли: __getTransport().setPlaybackRate(0.85)
    ;(window as any).__getTransport = getTransport

    // 🎮 Консольные команды для управления V3 (Phase F)
    ;(window as any).__tp = transport  // быстрая ссылка
    ;(window as any).__v3play = async (offset?: number) => {
      try { getTransport()?.stop() } catch {}
      transport.play(offset);
      console.log('[🎮] play', offset ?? 0, '🔇 V3')
    }
    ;(window as any).__v3pause = () => { transport.pause(); console.log('[🎮] pause') }
    ;(window as any).__v3stop = () => { transport.stop(); console.log('[🎮] stop') }
    ;(window as any).__v3rate = (r: number) => { transport.setPlaybackRate(r); console.log('[🎮] rate →', r) }
    ;(window as any).__v3seek = (t: number) => { transport.seek(t); console.log('[🎮] seek →', t.toFixed(1) + 's') }
    ;(window as any).__v3status = () => {
      const stems = transport.orchestrator.all()
      const p = (window as any).__belive?.pipeline
      console.log(`[🎮] state:${transport.state} rate:${transport.playbackRate.toFixed(2)} stems:${stems.length} pipeline:${p ? '✅' : '❌'}`)
    }

    // Подписка на before-track-change (V3 pipeline — единственный путь)
    document.addEventListener('before-track-change', async (event) => {
      console.log('[TRACE] 🎯 before-track-change HANDLER FIRED', (event as CustomEvent).detail)
      const payload = (event as CustomEvent).detail
      const trackId = payload?.toTrackId
      if (!trackId) return

      // M2 (P1-a): глушим звук СРАЗУ — не ждём IDB-фетч, старый трек не должен звучать
      try { getTransport()?.stop?.() } catch {}
      try { (window as any).__belive?.pipeline?.stop?.() } catch {}
      
      try {
        const idbModule = await import('./services/idb.service')
        const getTrack = idbModule.getTrack
        const numericId = Number(trackId)
        const record = await getTrack(numericId)
        
        if (record) {
          // 🔧 FIX: Не блокируем V2 — грузим V3 в фоне.
          // V3DataInterceptor.loadTrack() медленный (addBuffers → AudioWorklet postMessage может зависнуть).
          // V2 продолжает играть, пока V3 грузится в фоне.
          // Когда V3 загрузится → авто-старт (в loadTrack есть transport.play()) + глушим V2.
          console.log('[TRACE] ⏳ V3 loading in background — V2 continues...')
          // M2 (345): latency instrumentation — load-to-first-audio
          const __tLoadStart = performance.now();
          interceptor.loadTrack(record as any).then(() => {
            // M2 (345): P50/P95 sampling
            try {
              const __lat = performance.now() - __tLoadStart;
              const __samples = ((window as any).__latencySamples = (window as any).__latencySamples || []);
              __samples.push(__lat);
              console.log(`[M2-latency] load-to-first-audio: ${__lat.toFixed(0)}ms (samples=${__samples.length})`)
            } catch {}
            console.log('[TRACE] ✅ V3 loadTrack completed', { 
              stems: transport.orchestrator.all().length, 
              state: transport.state 
            })
            
            // №18-BUS H2.3: блок «gains restored to 1.0» УДАЛЁН — четвёртый отравитель raw-слота.
            // pipeline сам восстанавливает effective gains из RAW (_stemRawVolumes переживают reset).
            if (monitorEngine) monitorEngine.setBackendMode('v3')
            console.log('[AETHER] ✅ V3 loaded for track', trackId)

            // M1-2 (342, расширение): публикуем trackUrls для V3-фасада.
            // UI-потребители (useWaveformData/SyncEditor) ждут ae.hybridEngine.instrumentalUrl —
            // фасад читает window.__belive.trackUrls (см. js/audio-facade-v3.js).
            try {
              const belive = (window as any).__belive || ((window as any).__belive = {})
              const r = record as any
              if (r?.instrumentalData) {
                const blob = new Blob([r.instrumentalData], { type: r.instrumentalType ?? 'audio/mpeg' })
                belive.trackUrls = belive.trackUrls || {}
                belive.trackUrls.instrumentalUrl = URL.createObjectURL(blob)
              }
              if (r?.vocalsData) {
                const blob = new Blob([r.vocalsData], { type: r.vocalsType ?? 'audio/mpeg' })
                belive.trackUrls = belive.trackUrls || {}
                belive.trackUrls.vocalsUrl = URL.createObjectURL(blob)
              }
            } catch (e) {
              console.warn('[AETHER] trackUrls publish failed:', e)
            }
          }).catch((e: unknown) => {
            console.warn('[AETHER] V3 loadTrack failed — V2 continues playing:', e)
          })
        } else {
          console.log('[TRACE] ❌ getTrack returned null for trackId:', numericId)
        }
      } catch (e) {
        console.warn('[AETHER] Interceptor failed:', e)
      }
    })

  } catch (e) {
    console.warn('[AETHER] Boot failed — V2 continues', e)
  }
}
bootAether()

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    cleanupAll()
    bridgeFacade.destroy()
    _aetherPublisher?.dispose()
  })
}

document.addEventListener('DOMContentLoaded', async () => {
  if (window.__BELIVE_BOOTED__) return; // Legacy guard для MM-патчей
  window.__BELIVE_BOOTED__ = true;

  // --- App host stub (replaces legacy app.js) ---
  if (!(window as any).app) {
    (window as any).app = {
      currentMode: null,
      previousMode: null,
      initComplete: true,
      lyricsEnabled: true,
      lyricsDisplay: (window as any).lyricsDisplay || null,
      audioEngine: (window as any).audioEngine || null,
      concertBackgroundManager: null,
      karaokeBackgroundManager: null,
      rehearsalBackgroundManager: null,
      showNotification: (...args: any[]) => {
        const fn = (window as any).showAppNotification;
        if (fn) fn(...args);
      },
      _showWelcomeIfNoTracks: () => {},
    };
  }

  installLiveGuard();
  // initLoopBridge();  // retired → loop-events in initRegistry
  // initAudioReactiveBridge();  // retired → audio-reactive wrapper in registerInit
  // Phase 5.1: cleanup bridgeFacade on page unload
  window.addEventListener('beforeunload', () => { bridgeFacade.destroy() })

  // AETHER v2.3 — TransportV3 будет создан при первой загрузке трека
  // (см. StemOrchestrator.addStem + TransportV3 в V3StatePublisher)

  // F60: patch slim methods onto existing window.lyricsDisplay (no object swap)
  patchLyricsDisplaySlimMethods();

  // --- MM helper patches (Phase 3: helper extraction) ---
  const mm = (window as any).markerManager;
  if (mm) {
    mm._getColorForBlockType = (blockType: string) => getColorForBlockType(blockType);
    mm._buildBlocksFromMarkers = (markers: any[]) => buildBlocksFromMarkers(markers);
    mm._computeSections = (markers: any[], trackDuration?: number) => computeSections(markers, trackDuration);
    mm._getBlockTypeForLine = (lineIndex: number) => {
      const ld = (window as any).lyricsDisplay;
      return getBlockTypeForLine(lineIndex, ld?.textBlocks || []);
    };
    mm.resetMarkers = () => {
      mm.markers = [];
      mm._notifySubscribers?.('markersReset', []);
      return;
    };
    mm.updateMarkerColors = () => {
      if (!mm.markers || mm.markers.length === 0) return;
      let updated = false;
      const ld = mm.lyricsDisplay || (window as any).lyricsDisplay;
      const hasBlocks = !!(ld && Array.isArray(ld.textBlocks) && ld.textBlocks.length > 0);
      mm.markers.forEach((marker: any) => {
        // M2 markers keep their color (#1a1a1a) — never overwrite
        if (marker.markerType === 'M2') return;
        const newBlockType = mm._getBlockTypeForLine(marker.lineIndex);
        if (!hasBlocks || newBlockType === 'unknown') return;
        const newColor = mm._getColorForBlockType(newBlockType);
        if (marker.blockType !== newBlockType || marker.color !== newColor) { marker.blockType = newBlockType; marker.color = newColor; updated = true; }
      });
      if (updated) mm._notifySubscribers?.('markersReset', mm.markers);
    };
    mm.setMarkers = (markers: any[]) => {
      if (!Array.isArray(markers)) { console.error('Invalid markers array'); return; }
      const ld = mm.lyricsDisplay || (window as any).lyricsDisplay;
      const totalLyricLines = ld ? ld.lyrics.length : 0;
      const validMarkers: any[] = [], usedLineIndexes = new Set<number>();
      markers.forEach((marker: any) => {
        if (marker && typeof marker.lineIndex === 'number' && marker.lineIndex >= 0 && marker.lineIndex < totalLyricLines && !usedLineIndexes.has(marker.lineIndex)) {
          usedLineIndexes.add(marker.lineIndex); const updatedMarker = { ...marker };
          if (!updatedMarker.blockType) updatedMarker.blockType = mm._getBlockTypeForLine(marker.lineIndex);
          // M2 markers keep their color (#1a1a1a) — never overwrite with block color
          if (marker.markerType === 'M2') {
            if (!updatedMarker.blockType) updatedMarker.blockType = 'closing';
            if (!updatedMarker.color) updatedMarker.color = '#1a1a1a';
          } else if (!updatedMarker.color) { const typeForColor = updatedMarker.blockType && updatedMarker.blockType !== 'unknown' ? updatedMarker.blockType : mm._getBlockTypeForLine(marker.lineIndex); updatedMarker.color = mm._getColorForBlockType(typeForColor); }
          validMarkers.push(updatedMarker);
        }
      });
      mm.markers = validMarkers;
      mm.markers.sort((a: any, b: any) => a.time - b.time);
      try {
        const hasExistingBlocks = !!(ld && Array.isArray(ld.textBlocks) && ld.textBlocks.length > 0);
        const hasTypedMarkers = mm.markers.some((m: any) => m.blockType && m.blockType !== 'unknown');
        if (!hasExistingBlocks && ld && hasTypedMarkers) { const synthesized = mm._buildBlocksFromMarkers(mm.markers); if (synthesized.length > 0) { ld.textBlocks = synthesized; ld.currentActiveBlock = null; if (typeof ld?.updateDefinedBlocksDisplay === 'function') ld.updateDefinedBlocksDisplay(); } }
      } catch (e) {
        console.warn('MarkerManager: Error synthesizing blocks from markers:', e);
      }
      mm._notifySubscribers?.('markersReset', mm.markers);
    };
    mm.addMarker = (lineIndex: number, time?: number | null) => {
      const ld = mm.lyricsDisplay || (window as any).lyricsDisplay;
      const ae = mm.audioEngine || (window as any).audioEngine;
      if (lineIndex < 0 || lineIndex >= ld.lyrics.length) {
        console.error('Invalid line index:', lineIndex);
        return null;
      }
      let t = time;
      if (t === undefined || t === null) t = ae.getCurrentTime();
      const blockType = mm._getBlockTypeForLine(lineIndex);
      const markerColor = blockType && blockType !== 'unknown' ? mm._getColorForBlockType(blockType) : undefined;
      const marker = {
        id: Date.now() + Math.random().toString(36).substr(2, 5),
        lineIndex,
        time: t,
        text: ld.lyrics[lineIndex],
        blockType,
        color: markerColor,
      };
      const existingIndex = mm.markers.findIndex((m: any) => m.lineIndex === lineIndex && m.markerType !== 'M2');
      if (existingIndex >= 0) {
        mm.markers[existingIndex] = marker;
        mm._notifySubscribers?.('markerUpdated', marker);
      } else {
        mm.markers.push(marker);
        mm.markers.sort((a: any, b: any) => a.time - b.time);
        mm._notifySubscribers?.('markerAdded', marker);
      }
      return marker;
    };
    mm.updateMarker = (markerId: string, updates: any) => {
      const index = mm.markers.findIndex((marker: any) => marker.id === markerId);
      if (index === -1) {
        console.error('Marker not found:', markerId);
        return null;
      }
      mm.markers[index] = { ...mm.markers[index], ...updates };
      if (updates.time !== undefined) {
        mm.markers.sort((a: any, b: any) => a.time - b.time);
      }
      mm._notifySubscribers?.('markerUpdated', mm.markers[index]);
      mm.updateMarkerColors();
      return mm.markers[index];
    };
    mm.deleteMarker = (markerId: string) => {
      const index = mm.markers.findIndex((marker: any) => marker.id === markerId);
      if (index === -1) {
        console.error('Marker not found:', markerId);
        return false;
      }
      const deletedMarker = mm.markers[index];
      mm.markers.splice(index, 1);
      mm._notifySubscribers?.('markerDeleted', deletedMarker);
      return true;
    };
    mm.getMarkers = (): any[] => {
      return [...mm.markers];
    };
    mm.getMarkerForLine = (lineIndex: number): any | null => {
      return mm.markers.find((marker: any) => marker.lineIndex === lineIndex) || null;
    };
    mm.subscribe = (event: string, callback: (data: any) => void): (() => void) => {
      if (!mm.subscribers[event]) {
        console.error('Invalid event type:', event);
        return () => {};
      }
      mm.subscribers[event].push(callback);
      return () => {
        mm.subscribers[event] = mm.subscribers[event].filter((cb: any) => cb !== callback);
      };
    };
    mm._notifySubscribers = (event: string, data: any): void => {
      if (!mm.subscribers[event]) { return; }
      mm.subscribers[event].forEach((callback: any) => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in event subscriber:', error);
        }
      });
    };
    mm.saveMarkersToTrack = (): boolean => {
      if (!(window as any).trackCatalog || (window as any).trackCatalog.currentTrackIndex < 0) {
        console.error('No current track to save markers to');
        return false;
      }
      const currentTrack = (window as any).trackCatalog.tracks[(window as any).trackCatalog.currentTrackIndex];
      const event = new CustomEvent('save-track-markers', {
        detail: {
          trackId: currentTrack.id,
          markers: mm.markers
        }
      });
      document.dispatchEvent(event);
      return true;
    };
    mm.importMarkers = (json: string): boolean => {
      try {
        let jsonContent = json;
        if (json.charCodeAt(0) === 0xFEFF) {
          jsonContent = json.substring(1);
        }
        const data = JSON.parse(jsonContent);
        if (Array.isArray(data)) {
          mm.setMarkers(data);
        } else if (data && data.markers && Array.isArray(data.markers)) {
          mm.setMarkers(data.markers);
          if (data.lyrics && (window as any).lyricsDisplay) {
            const _title = data.title || 'Imported Track';
            const ae = mm.audioEngine || (window as any).audioEngine;
            if (ae && ae.duration > 0) {
              (window as any).lyricsDisplay.loadLyrics(data.lyrics, ae.duration);
            }
          }
        } else {
          throw new Error('Invalid markers format');
        }
        return true;
      } catch (error) {
        console.error('Error importing markers:', error);
        return false;
      }
    };
    mm._activateNextLine = (lineIndex: number): void => {
      const ld = mm.lyricsDisplay || (window as any).lyricsDisplay;
      if (lineIndex < 0 || lineIndex >= ld.lyrics.length) { return; }
      ld.setActiveLine(lineIndex);
    };
    mm._addMarkerForActiveLine = (): void => {
      const ae = mm.audioEngine || (window as any).audioEngine;
      if (!ae) {
        console.error('Audio engine not available');
        return;
      }

      const currentTime = ae.getCurrentTime();
      const activeLine = document.querySelector<HTMLElement>('.lyric-line.active');

      if (!activeLine) {
        console.warn('No active lyric line found when pressing "1"');
        return;
      }

      const indexStr = activeLine.dataset.index;
      if (!indexStr) {
        console.error('No index data attribute in active line');
        return;
      }
      const lineIndex = parseInt(indexStr, 10);
      if (isNaN(lineIndex)) {
        console.error('Invalid line index in active line');
        return;
      }

      const existingMarker = mm.getMarkerForLine(lineIndex);
      if (existingMarker) {
        let nextLine = lineIndex + 1;
        while (nextLine < mm.lyricsDisplay.lyrics.length) {
          if (!mm.getMarkerForLine(nextLine)) {
            mm.addMarker(nextLine, currentTime);
            mm._activateNextLine(nextLine);
            return;
          }
          nextLine++;
        }
      } else {
        mm.addMarker(lineIndex, currentTime);
        mm._activateNextLine(lineIndex + 1);
      }
    };
  }

  // M2: Optional closing marker — cuts off playback/run-through at a specific point
  // Does NOT replace M1. M2 is a separate marker that sets block endTime.
  // Without M2, the next M1 naturally closes the block (Priority 2 in getBlockTimeRange).
  // With M2, the block ends at M2 time — cutting off any run-through/interlude.
  mm._addM2Marker = (): void => {
    const ae = mm.audioEngine || (window as any).audioEngine;
    if (!ae) {
      console.error('[M2] Audio engine not available');
      return;
    }

    const currentTime = ae.getCurrentTime();

    // Use the active line from DOM — this is the block user is currently working on
    const activeLine = document.querySelector<HTMLElement>('.lyric-line.active');
    const ld = mm.lyricsDisplay || (window as any).lyricsDisplay;
    const blocks = ld?.textBlocks || [];

    let afterBlockId = '';
    if (activeLine) {
      const indexStr = activeLine.dataset.index;
      if (indexStr) {
        const activeLineIndex = parseInt(indexStr, 10);
        if (!isNaN(activeLineIndex)) {
          // Find which block this active line belongs to
          const block = blocks.find((b: any) => b.lineIndices?.includes(activeLineIndex));
          if (block) {
            // Check if this block has at least one M1 marker
            const hasM1 = mm.markers.some(
              (m: any) => m.markerType !== 'M2' && block.lineIndices?.includes(m.lineIndex)
            );
            if (hasM1) {
              afterBlockId = block.id;
              if (import.meta.env.DEV) console.log('[M2] Active line', activeLineIndex, '→ block', block.id, '(has M1 markers)');
            } else {
              // Active line's block has no M1 yet — find previous block that has markers
              const blockIdx = blocks.indexOf(block);
              for (let i = blockIdx - 1; i >= 0; i--) {
                const prevBlock = blocks[i];
                const hasPrevM1 = mm.markers.some(
                  (m: any) => m.markerType !== 'M2' && prevBlock.lineIndices?.includes(m.lineIndex)
                );
                if (hasPrevM1) {
                  afterBlockId = prevBlock.id;
                  if (import.meta.env.DEV) console.log('[M2] Active line block has no M1 → using previous block', prevBlock.id);
                  break;
                }
              }
            }
          }
        }
      }
    }

    if (!afterBlockId) {
      // Fallback: find block with the most recent M1 before currentTime
      const lastM1 = [...mm.markers]
        .filter((m: any) => m.markerType !== 'M2' && m.time <= currentTime)
        .sort((a: any, b: any) => b.time - a.time)[0];
      if (lastM1) {
        const block = blocks.find((b: any) => b.lineIndices?.includes(lastM1.lineIndex));
        if (block) afterBlockId = block.id;
      }
    }

    if (!afterBlockId) {
      afterBlockId = 'block-0';
    }

    // Check if M2 already exists for this block — update it
    const existingM2 = mm.markers.find(
      (m: any) => m.markerType === 'M2' && m.afterBlockId === afterBlockId
    );
    if (existingM2) {
      mm.updateMarker(existingM2.id, {
        time: currentTime,
        isSuggested: false,
      });
      if (import.meta.env.DEV) console.log('[M2] Updated M2 for block', afterBlockId, 'time:', currentTime.toFixed(2) + 's');
    } else {
      // Create new M2 marker — NOT attached to any line, purely a time boundary
      const m2Marker = {
        id: `m2-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        lineIndex: -1,
        time: currentTime,
        text: '⟩',
        markerType: 'M2' as const,
        afterBlockId,
        blockType: 'closing',
        color: '#1a1a1a',
        isSuggested: false,
      };
      mm.markers.push(m2Marker);
      mm.markers.sort((a: any, b: any) => a.time - b.time);
      mm._notifySubscribers?.('markerAdded', m2Marker);
      if (import.meta.env.DEV) console.log('[M2] Placed M2 closing marker after block', afterBlockId, 'time:', currentTime.toFixed(2) + 's');
    }
  };

  // F44: notification utility
  import('./utils/notification').then(n => {
    (window as any).showAppNotification = n.showAppNotification;
    (window as any).showNotification = n.showAppNotification;
  });

  // F38: parsing service → window global (used by lyrics-display.js wrappers)
  import('./services/parsing.service').then(ps => {
    (window as any).parsingService = ps;
  });

  // F39: IDB service for legacy access
  import('./services/idb.service').then(idb => {
    (window as any).idbService = idb;
  });

  // F42: RTF service — uses TS rtfToText (ported SimpleRtf)
  (window as any).rtfService = {
    parseRtf: async (rtfText: string) => {
      if (typeof rtfText !== 'string') return '';
      if (!rtfText.trim().startsWith('{\\rtf')) return rtfText;
      const { rtfToText } = await import('./services/parsing.service');
      return rtfToText(rtfText);
    },
  };

  // (openCatalog removed)

  const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL;
  if (GATEWAY_URL) {
    const gatewayProvider = new GatewayProvider(GATEWAY_URL);
    aiHub.register(gatewayProvider);
  }

  // ── OpenRouter Direct Provider (works without localhost gateway) ──
  const orProvider = new OpenRouterDirectProvider();
  aiHub.register(orProvider);

  // ── beLive AI Provider (built-in, requires OAuth) ──
  const aiWorkerUrl = import.meta.env.VITE_AI_WORKER_URL;
  if (aiWorkerUrl) {
    const beliveProvider = new BeliveProvider();
    aiHub.register(beliveProvider);
  }

  // Auto-select model after persist hydrates from localStorage
  // (persist loads async — settings may not be available at boot)
  useAiSettingsStore.persist.onFinishHydration(() => {
    const settings = useAiSettingsStore.getState();
    if (!aiHub.getActiveModel() && settings.openRouterApiKey && settings.modelId) {
      aiHub.setActiveModel(settings.modelId);
      if (import.meta.env.DEV) console.log('[AI] Hydrated: set model:', settings.modelId);
    } else if (!aiHub.getActiveModel() && settings.openRouterApiKey) {
      const defaultModel = 'deepseek/deepseek-chat-v3-0324';
      aiHub.setActiveModel(defaultModel);
      useAiSettingsStore.getState().setModelId(defaultModel);
      if (import.meta.env.DEV) console.log('[AI] Hydrated: set default model:', defaultModel);
    }
  });

  // Fallback: if already hydrated before this code runs
  const currentSettings = useAiSettingsStore.getState();
  if (!aiHub.getActiveModel() && currentSettings.openRouterApiKey && currentSettings.modelId) {
    aiHub.setActiveModel(currentSettings.modelId);
    if (import.meta.env.DEV) console.log('[AI] Fallback: set model:', currentSettings.modelId);
  } else if (!aiHub.getActiveModel() && currentSettings.openRouterApiKey) {
    const defaultModel = 'deepseek/deepseek-chat-v3-0324';
    aiHub.setActiveModel(defaultModel);
    useAiSettingsStore.getState().setModelId(defaultModel);
    if (import.meta.env.DEV) console.log('[AI] Fallback: set default model:', defaultModel);
  }

  new AIChatUI(); // Инициализация AIChatUI
  new ModelDropdownUI(); // Инициализация ModelDropdownUI

  // Обработчик для кнопки AI Operator. Теперь он будет открывать чат.
  const aiOperatorButton = document.getElementById('toggle-loopblock-mode');
  if (aiOperatorButton) {
    // aiOperatorButton.addEventListener('click', () => { // Удален дублирующий обработчик
    //   aiChatUI.toggleChat(); // Переключаем видимость чата
    // });
  }

  // Подписка на изменение модели для обновления UI кнопки "Operator"
  aiHub.on('modelChanged', (event: Event) => {
      const customEvent = event as CustomEvent;
      const activeModel = customEvent.detail;
      const operatorButton = document.getElementById('toggle-loopblock-mode');
      if (operatorButton) {
          operatorButton.innerHTML = '';
          const span = document.createElement('span');
          span.className = 'operator-text';
          if (activeModel) {
              span.textContent = activeModel.shortName;
              operatorButton.classList.add('ai-active');
          } else {
              span.textContent = 'Operator';
              operatorButton.classList.remove('ai-active');
          }
          operatorButton.appendChild(span);
      }
  });

  // ▼ Слой «эмоций» персонажа (звук на завершение ответа) саморегистрируется через
  // ./character → registerInit('character-layer') в initRegistry (engine-agnostic, R9).

  // Убедимся, что начальное состояние кнопки правильное при загрузке
  const initialActiveModel = aiHub.getActiveModel();
  const operatorButton = document.getElementById('toggle-loopblock-mode');
  if (operatorButton) {
      operatorButton.innerHTML = '';
      const span = document.createElement('span');
      span.className = 'operator-text';
      if (initialActiveModel) {
          span.textContent = initialActiveModel.shortName;
          operatorButton.classList.add('ai-active');
      } else {
          span.textContent = 'Operator';
          operatorButton.classList.remove('ai-active');
      }
      operatorButton.appendChild(span);
  }

});

  // ★ Rehearsal Video Bridge — временный тестовый хук (Фаза 2: +bridge, Phase 3 удалить)
  (window as any).__testRehearsal = (roomId: string, role: 'teacher' | 'student', ticket: string) => {
    const sc = new SignalingClient(roomId, role, ticket);
    const pc = new PeerConnectionManager(sc, role);
    sc.onOpen = () => {
      if (import.meta.env.DEV) console.log('[test] WS open, role=', role);
      useRehearsalSessionStore.getState().setConnectionState('connected');
    };
    sc.onClose = (code) => {
      useRehearsalSessionStore.getState().setConnectionState(code === 4001 ? 'failed' : 'reconnecting');
    };
    sc.onPeerJoined = (peerRole) => {
      if (import.meta.env.DEV) console.log('[test] peer joined:', peerRole);
      if (role === 'teacher') pc.createDataChannels();
    };
    pc.onConnectionStateChange = (s) => { if (import.meta.env.DEV) console.log('[test] connectionState:', s); };
    pc.onClockSynced = (offset, rtt) => {
      if (import.meta.env.DEV) console.log('[test] clock synced. offset=', offset, 'rtt=', rtt);
      useRehearsalSessionStore.getState().setClockSync(offset, rtt);
    };
    const bridge = new RehearsalTriggerBridge(pc, role);
    sc.connect();
    (window as any).__pc = pc;
    (window as any).__sc = sc;
    (window as any).__bridge = bridge;
    return { sc, pc, bridge };
  };

  // Surface guard — скрыть legacy header если нет профиля
  if (!localStorage.getItem('belive:user-profile')) {
    document.documentElement.classList.add('bl-surface-welcome');
  }

  // ★ Phone connect — автоматическое подключение Student без консоли
  // Используется с docs/phone-connect.html (открыть на телефоне, ввести Room ID)
  // URL: https://app.mybelive.com/?phone=1&room=live-xxxxxxxxxx
  (async () => {
    const params = new URLSearchParams(location.search);
    if (params.get('phone') !== '1') return;
    const roomId = params.get('room');
    if (!roomId) return;
    const secret = 'test-rehearsal-secret-2026';
    try {
      const { signClientTicket } = await import('./Rehearsal/services/deep-link.service');
      const ticket = await signClientTicket(roomId, 'student', secret);
      (window as any).__testRehearsal(roomId, 'student', ticket);
    } catch (e) {
      console.warn('[phone] auto-connect failed:', e);
    }
  })();

// Mount React Shell
const reactRoot = document.getElementById('react-root');
if (reactRoot) {
  createRoot(reactRoot).render(
    React.createElement(
      React.Fragment,
      null,
      React.createElement(ThemeProvider),
      React.createElement(App)
    )
  );
} else {
  console.warn('[beLive] #react-root not found, React Shell not mounted');
}
