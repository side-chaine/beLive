// audio-facade-v3.js — M1 (342): V3-фасад вместо v1-stub поверх window.audioEngine
// Требования:
//  - window.audioEngine определён ДО marker-manager.js и monitor-mix.js (eval-order)
//  - getCurrentTime() → реальное время V3, НЕ ноль
//  - audioContext → общий (из V3-движка)
//  - остальные методы → no-op (гейтится UI)
(function () {
  // В1 п.3e: on-demand загрузка стемов — generation-гард + in-flight дедуп (HPS:713-715 addBuffers=push)
  var _additionalGen = 0;
  var _additionalInFlight = {};
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
    // В1 п.3a: isPlaying-адаптер — источник transport.state (takes.time.ts:36 потребитель)
    get isPlaying() {
      try {
        const t = window.__belive && window.__belive.transport;
        return !!(t && t.state === 'playing');
      } catch { return false; }
    },
    // В1 п.3a: duration-адаптер — источник transport.duration (main.tsx importMarkers ae.duration>0)
    get duration() {
      try {
        const t = window.__belive && window.__belive.transport;
        return (t && typeof t.duration === 'number' && Number.isFinite(t.duration)) ? t.duration : 0;
      } catch { return 0; }
    },
    // M1-2 (342, расширение): hybridEngine контракт для UI (useWaveformData, SyncEditor).
    // В V2-режиме его наполнял AudioEngineV2 (get hybridEngine()) (класс снесён D-1, 03.09); здесь читаем
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
    setMicrophoneVolume(v) {
      try {
        window.__belive && window.__belive.monitorRouter &&
        window.__belive.monitorRouter.setMicVolume && window.__belive.monitorRouter.setMicVolume(Number(v) || 0);
      } catch {}
    },
    // В1 п.3c: унифицированный V-Mix-адаптер → MonitorRouter.setVMix
    // (enableVocalMix/disableVocalMix retired — кейс-21, TypeError при выключении исключён)
    setVMix(on) {
      try {
        const r = window.__belive && window.__belive.monitorRouter;
        if (r && typeof r.setVMix === 'function') r.setVMix(on === true);
      } catch {}
    },
    // В1 п.3e: on-demand догрузка стемов (QuickActions:214 / MixerPanel:179 → track.loader:543).
    // generation-гард: устаревшая генерация своих decode-ответов не пушит (stale отбрасываются);
    // дедуп: уже-живые (liveStems п.1) и in-flight стемы не тянут WASM-буфер дважды (push(), не replace).
    loadAdditionalStems(stemMap) {
      return new Promise(function (resolve) {
        var gen = ++_additionalGen;
        var p = window.__belive && window.__belive.pipeline;
        var ctx = p && p.ctx;
        if (!ctx || !p || !stemMap || typeof stemMap !== 'object') { resolve([]); return; }
        var liveBefore = (p.liveStems && Array.isArray(p.liveStems)) ? p.liveStems : [];
        var ids = Object.keys(stemMap);
        var loaded = [];
        (async function () {
          for (var i = 0; i < ids.length; i++) {
            var id = ids[i];
            var entry = stemMap[id];
            var data = entry && (entry.data || entry.buffer);
            if (!data) continue;
            if (liveBefore.indexOf(id) !== -1) continue;   // дедуп: уже жив — двойной буфер не нужен
            if (_additionalInFlight[id]) continue;         // дедуп: уже в полёте
            _additionalInFlight[id] = true;
            try {
              var buf = await ctx.decodeAudioData(data.slice(0));
              if (gen !== _additionalGen) break;           // generation-гард: stale-ответ старой генерации
              await p.loadStem(id, buf);
              loaded.push(id);
            } catch (e) {
              console.warn('[facade-v3] loadAdditionalStems failed for ' + id, e);
            } finally {
              _additionalInFlight[id] = false;
            }
          }
          resolve(loaded);
        })();
      });
    },
    setStemVolume(id, v) {
      try {
        const p = window.__belive && window.__belive.pipeline;
        p?.setStemVolume?.(id, v);
      } catch {}
    },
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
    // В1 п.3b: live-стемы из pipeline (п.1 liveStems-геттер: chainA.stems минус _deadStems)
    get liveStems() {
      try {
        const p = window.__belive && window.__belive.pipeline;
        if (!p) return [];
        const ls = p.liveStems;
        return Array.isArray(ls) ? ls : [];
      } catch { return []; }
    },
    // В1 п.3b: stems отдаёт live-стемы (п.1) — has() не врёт (dead исключены, догрузка возможна)
    get stems() {
      const live = this.liveStems;
      return { has: function (id) { return live.indexOf(id) !== -1; } };
    },
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
    // В1 п.3d: detach внешнего источника от program-capture шины
    // (утечка превью-тейка useTakesPlayback:74 — симметрично attachProgramSource)
    detachProgramSource(node) {
      try {
        const r = window.__belive && window.__belive.monitorRouter;
        if (r && typeof r.detachProgramSource === 'function') r.detachProgramSource(node);
      } catch {}
    },
    // P1 (program-capture): вернуть program-capture bus из MonitorRouter (FR-008).
    // captureStream — MediaStreamAudioDestinationNode; .stream — программный аудиопоток (music+vocals).
    getProgramCaptureStream() {
      try {
        const r = (window.__belive && window.__belive.monitorRouter);
        return (r && r.captureStream && r.captureStream.stream) ? r.captureStream.stream : null;
      } catch { return null; }
    },
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
  // v1-stub-эпоха закрыта (де-фриз Волна A, 01.09)
  if (!window.audioEngine) window.audioEngine = facade;
})();
