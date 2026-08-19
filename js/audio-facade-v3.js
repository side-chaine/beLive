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
    getStemMeterLevel() { return 0; }, getStemAnalyser() { return null; }, getStemAudioBuffer() { return null; },
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
