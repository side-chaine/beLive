// audio-facade-v3.js — M1 (342): V3-фасад вместо v1-stub поверх window.audioEngine
// Требования:
//  - window.audioEngine определён ДО marker-manager.js и monitor-mix.js (eval-order)
//  - getCurrentTime() → реальное время V3, НЕ ноль
//  - audioContext → общий (из V3-движка)
//  - остальные методы → no-op (гейтится UI)
(function () {
  const facade = {
    // ВРЕМЯ — критично (маркеры, word-sync)
    // M1 (342): читаем реальное V3-время, публикуемое V3StatePublisher
    // в window.__belive.currentTime (@50ms tick). До загрузки трека — 0 (паритет со stub).
    getCurrentTime() {
      try {
        const t = (window.__belive && window.__belive.currentTime);
        return (typeof t === 'number' && Number.isFinite(t)) ? t : 0;
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
    play() {}, pause() {}, stop() {},
    seekTo() {}, setCurrentTime() {},
    loadTrack() { return Promise.resolve(); },
    setInstrumentalVolume() {}, setVocalsVolume() {}, setMicrophoneVolume() {},
    setStemVolume() {}, setStemsEnabled() {}, setStemMute() {}, setStemSolo() {}, setStemPan() {}, setStemsMode() {},
    getStemMeterLevel() { return 0; }, getStemAnalyser() { return null; },
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
    enableVocalMix() {}, disableVocalMix() {},
    getPlaybackRate() { return 1; }, setPlaybackRate() {},
    attachProgramSource() {}, detachProgramSource() {},
    ensureInstrumentalBuffer() { return Promise.resolve(null); },
    setLoop() { return false; }, clearLoop() { return false; },
  };
  // совместимость с v1-stub API (js/audio-engine.js)
  if (!window.audioEngine) window.audioEngine = facade;
})();
