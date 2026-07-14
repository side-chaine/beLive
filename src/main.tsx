import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './theme/components/ThemeProvider';
import { initBlocksBridge } from './bridges/blocks.bridge';
import { installLiveGuard } from './bridges/live-guard';
import { initLoopBridge } from './bridges/loop.bridge';
import { registerLiveModeStub } from './services/live-mode.stub';
import { registerWaveformEditorStub } from './services/waveform-editor.stub';
import * as markerService from './services/marker.service';
import { initAudioReactiveBridge } from './bridges/audio-reactive.bridge';
import { patchLyricsDisplaySlimMethods } from './services/lyrics.service';
import { initBlockEditorBridge } from './blocks/bridge/blockEditor.bridge';
import { useUIStore } from './stores/ui.store';
import { getColorForBlockType, buildBlocksFromMarkers, computeSections, getBlockTypeForLine } from './utils/markerUtils';
import { SignalingClient } from './Rehearsal/services/signaling-client';
import { PeerConnectionManager } from './Rehearsal/services/peer-connection';
import { RehearsalTriggerBridge } from './Rehearsal/bridge/rehearsal-trigger.bridge';
import { useRehearsalSessionStore } from './Rehearsal/store/rehearsal-session.store';

// import '../css/main.css'; // loaded via <link> in index.html
// import '../css/ai-chat.css'; // loaded via <link> in index.html
// import '../css/avatar-studio.css'; // loaded via <link> in index.html

import { aiHub } from './js/ai/registry';
import { GatewayProvider } from './js/ai/providers/gateway-provider';
import { OpenRouterDirectProvider } from './js/ai/providers/openrouter-direct.provider';
import { BeliveProvider } from './js/ai/providers/belive.provider';
import { useAiSettingsStore } from './stores/ai-settings.store';
import { ModelDropdownUI } from './js/ui/model-dropdown-ui'; // Новый импорт
import { AIChatUI } from './js/ui/ai-chat-ui'; // Новый импорт

declare global { interface Window { __BELIVE_BOOTED__?: boolean } }

document.addEventListener('DOMContentLoaded', async () => {
  if (window.__BELIVE_BOOTED__) return; // Глобальный гард от повторной инициализации
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

  registerLiveModeStub();
  registerWaveformEditorStub();
  initBlocksBridge();
  installLiveGuard();
  initLoopBridge();
  initAudioReactiveBridge();
  initBlockEditorBridge();

  // F49: marker service for legacy LD access
  (window as any).markerService = markerService;

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
      const validMarkers: any[] = [], usedLineIndexes = new Set<number>(), totalLyricLines = ld ? ld.lyrics.length : 0;
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
              console.log('[M2] Active line', activeLineIndex, '→ block', block.id, '(has M1 markers)');
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
                  console.log('[M2] Active line block has no M1 → using previous block', prevBlock.id);
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
      console.log('[M2] Updated M2 for block', afterBlockId, 'time:', currentTime.toFixed(2) + 's');
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
      console.log('[M2] Placed M2 closing marker after block', afterBlockId, 'time:', currentTime.toFixed(2) + 's');
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

  // Override legacy catalog opener → React catalog
  (window as any).openCatalog = () => {
    useUIStore.getState().setCatalogOpen(true);
  };

  const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:8787'; // Use environment variable or default
  const gatewayProvider = new GatewayProvider(GATEWAY_URL);
  aiHub.register(gatewayProvider);

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
      console.log('[AI] Hydrated: set model:', settings.modelId);
    } else if (!aiHub.getActiveModel() && settings.openRouterApiKey) {
      const defaultModel = 'deepseek/deepseek-chat-v3-0324';
      aiHub.setActiveModel(defaultModel);
      useAiSettingsStore.getState().setModelId(defaultModel);
      console.log('[AI] Hydrated: set default model:', defaultModel);
    }
  });

  // Fallback: if already hydrated before this code runs
  const currentSettings = useAiSettingsStore.getState();
  if (!aiHub.getActiveModel() && currentSettings.openRouterApiKey && currentSettings.modelId) {
    aiHub.setActiveModel(currentSettings.modelId);
    console.log('[AI] Fallback: set model:', currentSettings.modelId);
  } else if (!aiHub.getActiveModel() && currentSettings.openRouterApiKey) {
    const defaultModel = 'deepseek/deepseek-chat-v3-0324';
    aiHub.setActiveModel(defaultModel);
    useAiSettingsStore.getState().setModelId(defaultModel);
    console.log('[AI] Fallback: set default model:', defaultModel);
  }

  new AIChatUI(); // Инициализация AIChatUI
  new ModelDropdownUI(); // Инициализация ModelDropdownUI

  // Обработчик для кнопки AI Operator. Теперь он будет открывать чат.
  const aiOperatorButton = document.getElementById('toggle-loopblock-mode');
  if (aiOperatorButton) {
    // console.log('✅ Found AI Operator button'); // Закомментировано
    // aiOperatorButton.addEventListener('click', () => { // Удален дублирующий обработчик
    //   console.log('⚡ AI Operator button clicked!');
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

  // ★ Billy Mode Switcher — instant, no reload ★
  import('./stores/ai-settings.store').then(mod => {
    (window as any).billyMode = (mode?: 'user' | 'tech') => {
      const store = mod.useAiSettingsStore.getState();
      if (!mode) {
        console.log(`🤖 Billy mode: ${store.billyMode}`);
        return store.billyMode;
      }
      store.setBillyMode(mode);
      const icon = mode === 'tech' ? '🛠️' : '🎤';
      console.log(`${icon} Billy switched to ${mode} mode (instant, no reload needed)`);
      return mode;
    };
  });
});

  // ★ Rehearsal Video Bridge — временный тестовый хук (Фаза 2: +bridge, Phase 3 удалить)
  (window as any).__testRehearsal = (roomId: string, role: 'teacher' | 'student', ticket: string) => {
    const sc = new SignalingClient(roomId, role, ticket);
    const pc = new PeerConnectionManager(sc, role);
    sc.onOpen = () => {
      console.log('[test] WS open, role=', role);
      useRehearsalSessionStore.getState().setConnectionState('connected');
    };
    sc.onClose = (code) => {
      useRehearsalSessionStore.getState().setConnectionState(code === 4001 ? 'failed' : 'reconnecting');
    };
    sc.onPeerJoined = (peerRole) => {
      console.log('[test] peer joined:', peerRole);
      if (role === 'teacher') pc.createDataChannels();
    };
    pc.onConnectionStateChange = (s) => console.log('[test] connectionState:', s);
    pc.onClockSynced = (offset, rtt) => console.log('[test] clock synced. offset=', offset, 'rtt=', rtt);
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
