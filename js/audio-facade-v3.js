// audio-facade-v3.js — M1 (342): V3-фасад вместо v1-stub поверх window.audioEngine
// Требования:
//  - window.audioEngine определён ДО marker-manager.js и monitor-mix.js (eval-order)
//  - getCurrentTime() → реальное время V3, НЕ ноль
//  - audioContext → общий (из V3-движка)
//  - остальные методы → no-op (гейтится UI)
(function () {
  const facade = {
    // ВРЕМЯ — критично (маркеры, word-sync)
    // ARC-2d (002 У-3/Усиле-1): приоритет transport.currentTime (clock, мгновенный,
    // loop-aware) → fallback 50ms-кэш __belive.currentTime (V3StatePublisher) → 0.
    getCurrentTime() {
      try {
        const t = window.__belive && window.__belive.transport;
        const tc = t && typeof t.currentTime === 'number' && Number.isFinite(t.currentTime) ? t.currentTime : null;
        if (tc !== null) return tc;
        const c = window.__belive && window.__belive.currentTime;
        return (typeof c === 'number' && Number.isFinite(c)) ? c : 0;
      } catch { return 0; }
    },
    // M1-2 (342, расширение): hybridEngine контракт для UI (useWaveformData, SyncEditor).
    // В V2-режиме его наполнял AudioEngineV2 (get hybridEngine()); здесь читаем
    // Blob URLs, которые main.tsx публикует в window.__belive.trackUrls после загрузки V3.
    get hybridEngine() {
      try {
        const tu = (window.__belive && window.__belive.trackUrls) || {};
        return {
          instrumentalUrl: tu.instrumentalUrl ?? null,
          vocalsUrl: tu.vocalsUrl ?? null,
        };
      } catch { return { instrumentalUrl: null, vocalsUrl: null }; }
    },
    // ARC-2d: транспорт-методы → TransportV3 (__belive.transport, main.tsx publish).
    // play без transport → resolved Promise — resolve-контракт hijack
    // (rehearsal-trigger:327 .catch; reject ломал бы broadcast-порядок).
    play(offset) {
      try {
        const t = window.__belive && window.__belive.transport;
        return t ? t.play(offset) : Promise.resolve();
      } catch { return Promise.resolve(); }
    },
    pause() {
      try {
        const t = window.__belive && window.__belive.transport;
        return t ? t.pause() : Promise.resolve();
      } catch { return Promise.resolve(); }
    },
    stop() {
      try {
        const t = window.__belive && window.__belive.transport;
        if (t) t.stop();
      } catch {}
    },
    // BRG-2b (201, 31.08): transport.seek — async; раньше void → unhandled rejection
    // при reject. Возвращаем промис как play/pause (консистентный контракт фасада).
    seekTo(t) {
      try {
        const tr = window.__belive && window.__belive.transport;
        return (tr && typeof t === 'number' && Number.isFinite(t))
          ? tr.seek(t).catch(() => {})
          : Promise.resolve();
      } catch { return Promise.resolve(); }
    },
    setCurrentTime(t) {
      try {
        const tr = window.__belive && window.__belive.transport;
        return (tr && typeof t === 'number' && Number.isFinite(t))
          ? tr.seek(t).catch(() => {})
          : Promise.resolve();
      } catch { return Promise.resolve(); }
    },
    loadTrack() { return Promise.resolve(); },
    setInstrumentalVolume(v) {
      try {
        const p = window.__belive && window.__belive.pipeline;
        p?.setStemVolume?.('instrumental', v);
      } catch {}
    },
    setVocalsVolume(v) {
      try {
        const p = window.__belive && window.__belive.pipeline;
        p?.setStemVolume?.('vocals', v);
      } catch {}
    },
    setMicrophoneVolume() {},
    setStemVolume(id, v) {
      try {
        const p = window.__belive && window.__belive.pipeline;
        p?.setStemVolume?.(id, v);
      } catch {}
    },
    setStemsEnabled() {},
    setStemMute(id, m) {
      try {
        const p = window.__belive && window.__belive.pipeline;
        p?.setStemMuted?.(id, m);
      } catch {}
    },
    setStemSolo(id, s) {
      try {
        const p = window.__belive && window.__belive.pipeline;
        p?.soloStem?.(id, s);
      } catch {}
    },
    setStemPan() {}, setStemsMode() {},
    getStemMeterLevel(id) {
      try {
        const p = window.__belive && window.__belive.pipeline;
        return (p && typeof p.getStemMeterLevel === 'function') ? (p.getStemMeterLevel(id) ?? 0) : 0;
      } catch { return 0; }
    },
    getStemAnalyser(id) {
      try {
        const p = window.__belive && window.__belive.pipeline;
        return (p && typeof p.getStemAnalyser === 'function') ? (p.getStemAnalyser(id) ?? null) : null;
      } catch { return null; }
    },
    getStemAudioBuffer(stemId) {
      try {
        const p = window.__belive && window.__belive.pipeline;
        if (!p) return null;
        const stem = p.chainA && p.chainA.stems && p.chainA.stems.get && p.chainA.stems.get(stemId);
        return stem && typeof stem.getBuffer === 'function' ? stem.getBuffer() : null;
      } catch { return null; }
    },
    awaitStemReady(stemId, timeoutMs) {
      const timeout = timeoutMs || 10000;
      return new Promise(function (resolve) {
        var start = Date.now();
        (function poll() {
          try {
            var p = window.__belive && window.__belive.pipeline;
            if (p) {
              var stems = p.chainA && p.chainA.stems;
              var stem = stems && stems.get && stems.get(stemId);
              if (stem && typeof stem.getBuffer === 'function' && stem.getBuffer()) {
                resolve(true);
                return;
              }
            }
          } catch {}
          if (Date.now() - start > timeout) { resolve(false); return; }
          setTimeout(poll, 100);
        })();
      });
    },
    enableMicrophone() { return Promise.resolve({ enabled: false, volume: 0 }); }, disableMicrophone() {},
    // V2-bus концепт: V3 vmix-тапы подключены постоянно (main.tsx) — toggle-API нет.
    // Осознанное отсечение (ARC-2e): UI-ложь TakesPanel reference-listen задокументирована.
    enableVocalMix() {}, disableVocalMix() {},
    setPlaybackRate(r) {
      try {
        const t = window.__belive && window.__belive.transport;
        if (t && typeof r === 'number' && Number.isFinite(r) && r > 0) t.setPlaybackRate(r);
      } catch {}
    },
    getPlaybackRate() {
      try {
        const t = window.__belive && window.__belive.transport;
        return (t && typeof t.playbackRate === 'number') ? t.playbackRate : 1;
      } catch { return 1; }
    },
    // ARC-2d (BRG-3): rate-геттер для vclock.anchor(t, ae?.playbackRate ?? 1)
    get playbackRate() {
      try {
        const t = window.__belive && window.__belive.transport;
        return (t && typeof t.playbackRate === 'number') ? t.playbackRate : 1;
      } catch { return 1; }
    },
    attachProgramSource(node, opts) {
      try {
        const r = window.__belive && window.__belive.monitorRouter;
        r?.attachProgramSource?.(node, opts);
      } catch {}
    },
    // MonitorRouter — static graph «0 disconnect»: detach-метода НЕТ by design.
    // Stopped source молчит — зомби-нода безвредна. Honest debt, ARC-2e.
    detachProgramSource() {},
    // P1 (program-capture): вернуть program-capture bus из MonitorRouter (FR-008).
    // captureStream — MediaStreamAudioDestinationNode; .stream — программный аудиопоток (music+vocals).
    getProgramCaptureStream() {
      try {
        const r = (window.__belive && window.__belive.monitorRouter);
        return (r && r.captureStream && r.captureStream.stream) ? r.captureStream.stream : null;
      } catch { return null; }
    },
    ensureInstrumentalBuffer() { return Promise.resolve(null); },
    // ARC-2d (У-5): true при живом transport (контракт IV2PublicContract: boolean).
    // Edge «стемы + idle»: loop-events V2-ветка глушит rAF-fallback при applied=true.
    setLoop(s, e) {
      try {
        const t = window.__belive && window.__belive.transport;
        if (!t) return false;
        t.setLoop(s, e);
        return true;
      } catch { return false; }
    },
    clearLoop() {
      try {
        const t = window.__belive && window.__belive.transport;
        if (!t) return false;
        t.clearLoop();
        return true;
      } catch { return false; }
    },
    // ARC-2d (BRG-4): общий контекст V3-движка (HPS get ctx())
    get audioContext() {
      try {
        const p = window.__belive && window.__belive.pipeline;
        return (p && p.ctx) || null;
      } catch { return null; }
    },
  };
  // совместимость с v1-stub API (js/audio-engine.js)
  if (!window.audioEngine) window.audioEngine = facade;
})();
