;(async () => {
  // ============================================================
  // v6.26 evidence harness — runnable console script (Chrome)
  // Per 098-FINAL-ROADMAP-v3 Stage A (A1-A7) + SOL_2 spec.
  // One track per run. Exports compact JSON. No seekTrace/quantumTrace.
  // ============================================================

  // ---------- METADATA (edit before run) ----------
  const SCRIPT_VERSION = 'v6.32.3-audit-r2';
  const HARNESS_REVISION = 'v6.32.3-audit-r2';               // immutable observability revision (Сол 137: Fix A readPoints/rpcRecs, Fix B vendorProcessCount)
  const HARNESS_SHA256 = null; // external manifest (П8)
  const SOURCE_PATH = 'src/audio/engine-v3/diagnostics/run-impulse-diagnostics-v6.32.3-audit-r2.console.js';
  const STIMULUS_SOURCE = 'synthetic_generated_click';      // Sol_2 cond.6
  const SELECTED_TRACK_AFFECTS_STIMULUS = false;            // trackId = env label, not PCM source
  const TRACK_PCM_ACTUALLY_USED = false;                    // no real PCM fed to vendor
  const TRACK_ID = '1783197557717';             // v6.29 independent repeat: NEW track (pre-selected, ≠ 1783177933713)
  const BRANCH = '067-e-regime-0';  // operator: confirm
  const COMMIT = '13a1e21c14c0ba363347dffbaf72afba18acefc1';  // Сол 137: HEAD прогона r2 (vendor 55c227ae = тот же, что при v6.32.2; harness immutable)
  const DEVICE_LABEL = 'MBP 2013 2-core'; // operator: confirm
  const SR = 44100;
  const BLOCK_MS = 40;
  const INTERVAL_MS = 20;
  // v6.31 (117-PREREG, Сол R64): positive-control — clickLen параметризуется из URL (?clickLen=128)
  // Оператор: запускать 3 прогона с clickLen 44 / 128 / 256. Default 44 (как v6.30.3).
  const CLICK_LEN = Number(new URLSearchParams(location.search).get('clickLen')) || 44;
  const CLICK_LEN_LABEL = 'c' + CLICK_LEN;
  const REPS = 30;                              // v6.28 (SOL_2 фикс): 30 reps per offset
  const ACCEPTANCE_OFFSETS = [512];                 // v6.30: единственный offset (Сол)
  const DIAGNOSTIC_OFFSETS = [];                    // пусто
  const RUN_ORDER = [];                         // v6.28: balanced interleaved, filled below
  const ORDER_SEED = 1783197557717;             // v6.29: deterministic seed = new track id
  // v6.30 phase experiment (110, Сол)
  const EXPERIMENT_NAME = 'phase-plus-energy-profile';
  const EXPERIMENT_ID = 'phase-plus-energy-profile-v6.32.3-audit-r2';   // Сол 137: immutable schema version (v6.32.3-audit-r2)
  const EXPECTED_WINDOW_START = 512;    // v6.30.3 (Сол 113): expected output window [vsf+512, vsf+3072) — зафиксирован на smoke (≥99.97% энергии)
  const EXPECTED_WINDOW_END = 3072;
  const TRUNCATED_FULLE_RATIO = 0.7;    // v6.30.3 (Сол 113): fullE < 0.7·fullE_baseline → truncated_response (23.84/39.33 = 0.606 ✓)
  const PHASE_OFFSET = 512;                          // единственный основной offset (Сол)
  const DELAY_POINTS_MS = [0, 2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20]; // 9 точек
  const REPS_PER_DELAY = 100;                        // 900 vendor rows total
  const K_OFFSETS = [0, 4410];                       // K sanity
  const K_REPS_PER_DELAY = 3;                        // 54 K rows total
  const VENDOR_WARMUP_ROWS = 3;      // v6.32 (095, Сол R67): первые N vendor-вызовов — прогрев, исключить из измерения
  const PROFILE_REL_START = -4096;                   // v6.30.2: СМЕЩЕНИЕ от vendorStartFrame (абсолютная граница = vsf + PROFILE_REL_START)
  const PROFILE_REL_END = 16384;                     // v6.30.2: СМЕЩЕНИЕ от vendorStartFrame (абсолютная граница = vsf + PROFILE_REL_END)
  const PROFILE_BIN_SIZE = 128;                      // 160 bins
  const CHUNK_ROWS = 100;                            // 9 chunks
  const CHUNKS = Math.ceil(900 / CHUNK_ROWS);        // Оператор: плейсхолдер CHUNKS из пакета = Math.ceil(900/100) = 9
  const SPLIT_COMPUTATION = true;              // current production config, do not change
  const CHANNEL_POLICY = 'mono-sum';           // capture policy
  const CAPTURE_NAME = 'belive-capture-processor-v6323r2';
  const CAPTURE_SIZE = SR * 4;                 // 4 seconds
  const RPC_TIMEOUT_MS = 4000;
  const ROW_DEADLINE_MS = 20000;
  const TRACE_FAILS = false;                   // opt-in per-FAIL trace, off by default
  const CLEAR_TO_START_GAP_MS = 150;            // v6.30.1 (111-B, Сол): harness-readiness gap после clear — покрытие левого окна профиля; НЕ timing contract

  // ---------- OUTPUT ----------
  const out = {
    metadata: {
      scriptVersion: SCRIPT_VERSION,
      harnessRevision: HARNESS_REVISION,
      harnessSha256: HARNESS_SHA256,
      sourcePath: SOURCE_PATH,
      stimulusSource: STIMULUS_SOURCE,
      selectedTrackAffectsStimulus: SELECTED_TRACK_AFFECTS_STIMULUS,
      trackPcmActuallyUsed: TRACK_PCM_ACTUALLY_USED,
      branch: BRANCH,
      commit: COMMIT,
      browser: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      device: DEVICE_LABEL,
      trackId: TRACK_ID,
      sampleRate: SR,
      blockMs: BLOCK_MS,
      intervalMs: INTERVAL_MS,
      clickLen: CLICK_LEN,
      splitComputation: SPLIT_COMPUTATION,
      channelPolicy: CHANNEL_POLICY,
      timestamp: new Date().toISOString(),
      transientPolicy: 'click-128 primary (Gate 3B production-representative); click-44 diagnostic stress-test (Сол R67)',
      protocol: 'phase-plus-energy-profile per 110-PHASE-PREREGISTRATION: offset 512, delays 0/2.5/5/7.5/10/12.5/15/17.5/20ms x100 (900 rows), energy profile [-4096,+16384) bin 128, K sanity 0/4410 x3/delay, 9 chunks interleaved; primary phase-association + energy shift/loss; NOT qualification, NOT Gate3B closure; v6.30.1 (MICRO-PACK-091, Сол решение 111-B): CLEAR_TO_START_GAP_MS=150 fixed harness-readiness gap after clear before start delay; not a timing contract; same for all rows; v6.30.2 (MICRO-PACK-092, Сол решение 112 A+C): energy profile bins привязаны к РЕАЛЬНОМУ vendorStartFrame — Worklet принимает АБСОЛЮТНЫЕ границы [vsf−4096, vsf+16384); v6.30.3 (MICRO-PACK-093, Сол решение 113): targetEnergy УБРАН из primary; expectedOutputWindow = [vsf+512, vsf+3072) зафиксирован; метрики: profileEnergy, fullE, peakAbs, firstNZ/lastNZ, energyBy128Bin, energyBy882Window; классы healthy/shifted_energy/true_energy_loss + truncated_response; новая prereg + smoke + SHA; v6.31 (MICRO-PACK-094, 117-PREREG, Сол R64): POSITIVE-CONTROL — clickLen {44,128,256} параметризован (?clickLen=N); независимый direct K + vendor K (kPathRatio); errata orderAlgo=100x9; vsfAxis=absolute context frame; NOT Gate3B closure; v6.32 (MICRO-PACK-095, Сол R67): HARNESS REPAIR — fix instrumentHealth overwrite (K-метрики теперь в out.instrumentHealth); readiness barrier VENDOR_WARMUP_ROWS=3 перед K-циклом; warm-up исключён из kValid/kRefEnergy/kPathRatio; click-128 = основной Gate 3B transient; click-44 = diagnostic stress-test; v6.32.1 (MICRO-PACK-096, Сол R68): SCHEMA-ONLY — K-health gate переведён на direct-K (vendor-K не health gate: это тестируемый Signalsmith); vendor-K аномалии → vendorKAnomalyCount / vendorFullDropout (отдельный outcome); warmup-tag fix (3+54); классификация vendor_full_dropout vs vendor_partial_truncation; no truncation=0 strict; click-128 = основной Gate 3B transient; click-44 = stress-test; v6.32.2 (MICRO-PACK-097, Сол_2): CODE/SCHEMA REPAIR — итог = PHASE DIAGNOSTIC (не Gate 3B; timing не INDEPENDENTLY_VALIDATED; протокол 512×9×100 ≠ Gate 3B 128/256/4410×5); chunkId/rowIndex от RUN_ORDER (фикс row 100); checkpoint = только текущий chunk; form/peak bounds; vendorKRef вне health baseline, anomaly по raw rows с INVALID; log [v6.32.2]; filename impulse-v6.32.2',
      runOrder: [],
      orderSeed: ORDER_SEED,
      orderAlgo: 'balanced interleaved: 100 rounds x 9 delay points, rotation per round (deterministic, seed=' + ORDER_SEED + ')',
      vsfAxis: 'absolute output context frame, NOT buffer offset; may exceed CAPTURE_SIZE (validated: coverage/ratio=1.0)',
    },
    instrumentHealth: {
      trueK: [], zeroInputSanity: null, state: null,
      directKRefEnergy: null, vendorKRefEnergy: null, kPathRatio: null,
      vendorKAnomalyCount: 0, vendorFullDropout: { count: 0, rows: [] },
      vendorInvalidCount: 0
    },
    rawObservations: { vendorRows: [] },
    computedMetrics: { rows: [] },
    verdict: { harness: '', gate3BLocal: '', timing: '', gate4a: '', reasons: [] },
    summary: {},
    stage: 'running',
    errors: []
  };
  window.__impulseResultV6323R2 = out;

  const log = (...x) => console.log('[v6.32.3-audit-r2]', ...x);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const fail = (where, e) => out.errors.push(where + ': ' + String(e?.stack || e?.message || e));

  // ---------- RPC with health (A2) ----------
  const rpc = (node, method, args = [], timeoutMs = RPC_TIMEOUT_MS) => new Promise(resolve => {
    const rec = {
      requestSent: false, responseReceived: false,
      timedOut: false, timeoutMs, elapsedMs: null,
      shapeValid: false, result: null
    };
    if (!node?.port) return resolve(rec);
    const id = 'r' + Math.random().toString(36).slice(2);
    const t0 = performance.now();
    let done = false;
    const finish = (value, timedOut) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { node.port.removeEventListener('message', handler); } catch {}
      rec.responseReceived = !timedOut;
      rec.timedOut = !!timedOut;
      rec.elapsedMs = Math.round(performance.now() - t0);
      rec.result = value;
      resolve(rec);
    };
    const handler = e => {
      const d = e?.data;
      if (Array.isArray(d) && d[0] === id) finish(d[1], false);
    };
    const timer = setTimeout(() => finish(null, true), timeoutMs);
    try {
      node.port.addEventListener('message', handler);
      node.port.start?.();
      node.port.postMessage([id, method, ...args]);
      rec.requestSent = true;
    } catch (e) { finish(null, true); }
  });

  // ---------- CAPTURE WORKLET ----------
  const captureCode = `
    class CaptureProcessor extends AudioWorkletProcessor {
      constructor(o) {
        super();
        const size = o?.processorOptions?.bufferSize || ${CAPTURE_SIZE};
        this.b = new Float32Array(size); this.size = size; this.w = 0;
        this.n = 0; this.max = 0; this.energy = 0; this.nzQ = 0;
        this.firstFrame = -1; this.lastFrame = -1; this.total = 0; this.wraps = 0; this.q = {};
        this.baseFrame = null;   // v6.30 (110, Сол): первый currentFrame после clear — база энергопрофиля
        this.port.onmessage = e => {
          const [id, method, ...a] = e.data || [];
          if (method === 'ping') this.port.postMessage([id, 'pong']);
          else if (method === 'clear') {
            this.b.fill(0); this.w = 0; this.n = 0; this.max = 0; this.energy = 0;
            this.nzQ = 0; this.firstFrame = -1; this.lastFrame = -1; this.total = 0; this.wraps = 0; this.q = {}; this.env = [];
            this.baseFrame = null;   // v6.30: сброс базы профиля
            this.port.postMessage([id, true]);
          } else if (method === 'stats') {
            this.port.postMessage([id, {writeIndex:this.w, processCount:this.n, bufferSize:this.size,
              maxAbsEver:this.max, energySumSq:this.energy, nonZeroQuantumCount:this.nzQ,
              firstNonZeroFrame:this.firstFrame, lastNonZeroFrame:this.lastFrame,
              totalSamplesWritten:this.total, wrapCount:this.wraps, quantumLenHist:this.q}]);
          } else if (method === 'envelope') {
            this.port.postMessage([id, { env: this.env || [], source: 'currentFrame' }]);
          } else if (method === 'readWindow') {
            const start = Number.isFinite(a[0]) ? Math.max(0, a[0]) : 0;
            const requested = Number.isFinite(a[1]) ? Math.max(0, a[1]) : this.w;
            const len = Math.min(requested, this.size - start);
            const r = new Float32Array(len);
            for (let i=0; i<len; i++) r[i] = this.b[start+i];
            this.port.postMessage([id, r]);
          } else if (method === 'profile') {
            // v6.30.2 (112, Сол вариант A): АБСОЛЮТНЫЕ границы [absStartFrame, absEndFrame)
            // bins строятся от реального vendorStartFrame, НЕ от baseFrame (баг v6.30/090-ERRATA)
            const absStartFrame = Number.isFinite(a[0]) ? a[0] : -4096;   // АБСОЛЮТНЫЙ frame начала окна
            const absEndFrame   = Number.isFinite(a[1]) ? a[1] : 16384;   // АБСОЛЮТНЫЙ frame конца окна
            const binSize  = Number.isFinite(a[2]) ? Math.max(1, Math.floor(a[2])) : 128;
            const base = this.baseFrame;
            const bins = [];
            if (base != null && this.w > 0 && this.wraps === 0) {
              const nBins = Math.max(0, Math.ceil((absEndFrame - absStartFrame) / binSize));
              for (let b = 0; b < nBins; b++) {
                const absStart = absStartFrame + b * binSize;            // АБСОЛЮТНЫЙ start бина
                const rel = absStart - base;                             // индекс в буфере от baseFrame
                let sumSq = 0, mx = 0, nz = 0;
                for (let i = 0; i < binSize; i++) {
                  const idx = ((rel + i) % this.size + this.size) % this.size;
                  const v = this.b[idx];
                  sumSq += v * v; if (Math.abs(v) > mx) mx = Math.abs(v); if (v !== 0) nz++;
                }
                bins.push({ relativeStartFrame: rel, absoluteStartFrame: absStart, sampleCount: binSize, sumSq, maxAbs: mx, nonZeroSampleCount: nz });
              }
            }
            this.port.postMessage([id, { baseFrame: base, wrapCount: this.wraps, bins }]);
          }
        };
      }
      process(inputs, outputs) {
        this.n++;
        const input = inputs[0], output = outputs[0];
        if (output?.length) for (let c=0;c<output.length;c++) {
          if (input?.[c]) output[c].set(input[c]); else output[c].fill(0);
        }
        const ch = input?.[0];
        if (!ch?.length) return true;
        const start = currentFrame, len = ch.length;
        this.q[len] = (this.q[len] || 0) + 1;
        // v6.27.1 (MICRO-PACK-087-ERRATA, Б2): quantumStartFrame = currentFrame (глобальная переменная
        // AudioWorkletGlobalScope, реальный absolute frame начала кванта — как требовал SOL_2).
        // Баг v6.27: this.currentTime === undefined в worklet -> Math.round(NaN) -> null в JSON.
        if (!this.env) this.env = [];
        if (this.env.length < 64) {
          let s = 0, mx = 0, nz = 0;
          for (let i = 0; i < len; i++) { const v = ch[i]; s += v * v; if (Math.abs(v) > mx) mx = Math.abs(v); if (v !== 0) nz++; }
          this.env.push({
            quantumStartFrame: currentFrame,
            sampleCount: len, sumSq: s, maxAbs: mx, nonZeroSampleCount: nz
          });
        }
        if (this.baseFrame == null) this.baseFrame = currentFrame;   // v6.30 (110, Сол): база профиля = первый process после clear
        let nz = false, old = this.w;
        for (let i=0;i<len;i++) {
          const s = ch[i], a = Math.abs(s);
          if (a > this.max) this.max = a;
          if (a > 1e-6) { nz = true; if (this.firstFrame < 0) this.firstFrame = start+i; this.lastFrame = start+i; }
          this.energy += s*s;
          this.b[this.w] = s; this.w = (this.w + 1) % this.size;
        }
        if (nz) this.nzQ++;
        this.total += len;
        this.wraps += Math.floor((old + len) / this.size);
        return true;
      }
    }
    registerProcessor('${CAPTURE_NAME}', CaptureProcessor);
  `;

  const makeClick = (offset, len = CLICK_LEN) => {
    const b = new Float32Array(Math.ceil(SR * 0.5));
    for (let i=offset; i<Math.min(offset+len, b.length); i++) b[i] = 1;
    return b;
  };

  // ---------- VENDOR IMPORT (only for vendor rows, never for K) ----------
  let SignalsmithStretch = null;
  let vendorPathUsed = null;
  async function importVendor() {
    if (SignalsmithStretch) return SignalsmithStretch;
    for (const path of [
      '/beLive/src/audio/engine-v3/vendor/SignalsmithStretch.mjs',
      '/src/audio/engine-v3/vendor/SignalsmithStretch.mjs'
    ]) {
      try {
        const mod = await import(path);
        SignalsmithStretch = mod.default || mod;
        vendorPathUsed = path;
        out.metadata.vendorPath = path;
        break;
      } catch (e) { fail('vendor import ' + path, e); }
    }
    if (!SignalsmithStretch) throw new Error('vendor import failed');
    return SignalsmithStretch;
  }

  // ---------- HEALTH HELPERS ----------
  function readHealth(ctx, cap, vendor, ins) {
    return {
      contextState: ctx?.state || null,
      captureProcessCount: cap?.statsRec?.processCount ?? null,
      captureWriteCount: cap?.statsRec?.writeIndex ?? null,
      captureTotalSamplesWritten: cap?.statsRec?.totalSamplesWritten ?? null,
      captureWrapCount: cap?.statsRec?.wrapCount ?? null,
      // Сол 137 (Fix B): vendorProcessCount — число с units ИЛИ literal 'UNAVAILABLE'; silent null запрещён.
      // processCalls читается из ALREADY-ALLOWLISTED ins (результат getInstrumentMetrics),
      // НЕ из vendor-ноды (у неё нет insRec). UNAVAILABLE только когда поле реально отсутствует.
      vendorProcessCount: (ins && Number.isFinite(ins.processCalls))
        ? { value: ins.processCalls, units: 'process calls' }
        : 'UNAVAILABLE',
      vendorState: ['configure', 'reset', 'start', 'process', 'stop']   // наблюдаемый порядок переходов (diagnostic)
    };
  }

  function shapeValid(method, value) {
    switch (method) {
      // Vendor contract (verified against SignalsmithStretch.mjs):
      // addBuffers -> audioBuffersEnd/sampleRate (float seconds)
      // start (object path) -> schedule() result: {active, input, output, rate, ...}
      case 'addBuffers': return typeof value === 'number' || value === true;
      case 'clear':      return value === true;
      case 'start':      return typeof value === 'object' && value !== null && 'active' in value;
      case 'stats':      return !!value && typeof value === 'object' && Number.isFinite(value.writeIndex);
      case 'readWindow': return value instanceof Float32Array || Array.isArray(value) || (value && typeof value === 'object');
      case 'getInstrumentMetrics': return !!value && typeof value === 'object';
      case 'ping':       return value === 'pong';
      default:           return true;
    }
  }

  // v6.27 (SOL_2 п.3 + 103-REVIEW Т.1): explicit allowlist of SCALAR instrumentation fields.
  // Traces (seekTrace/quantumTrace) NEVER enter JSON; only their lengths + flag.
  // abortSnapshot EXPLICITLY EXCLUDED (SOL_2: не скаляр; см. 103-REVIEW Т.1, вариант Б).
  function allowlistInstrumentMetrics(src) {
    if (!src || typeof src !== 'object') return {};
    const SCALAR_KEYS = [
      'vendorStartFrame', 'firstInputBlockFrame', 'firstOutputBlockFrame',
      'inputLatencySeconds', 'outputLatencySeconds', 'latencySamples', 'latencySeconds',
      'processCalls', 'startCount', 'seekCount', 'skipCount', 'dropoutCount',
      'resetCount', 'configureCount', 'copyCount', 'lastRate', 'lastSeekFrame',
      'audioBufferIndex_max', 'audioBuffersCount', 'audioBuffersStart', 'audioBuffersEnd',
      'sampleRate'
    ];
    const AGG_KEYS = ['blockSamples', 'blockSize', 'bufferLength', 'buffersInRms', 'buffersOutRms', 'inputSamplesEnd'];
    const out = { tracePayloadIncluded: false };
    for (const k of SCALAR_KEYS) if (k in src) out[k] = src[k];
    for (const k of AGG_KEYS) if (k in src && src[k] && typeof src[k] === 'object') out[k] = src[k];
    if (Array.isArray(src.seekTrace)) out.seekTraceLength = src.seekTrace.length;
    if (Array.isArray(src.quantumTrace)) out.quantumTraceLength = src.quantumTrace.length;
    // NOTE: abortSnapshot intentionally NOT included (SOL_2 Т.1 Б).
    return out;
  }

  function rpcHealthy(rec) {
    return rec && rec.requestSent && rec.responseReceived && !rec.timedOut && rec.shapeValid;
  }

  // ---------- ROW BUILDER (A3/A6) ----------
  // v6.30.3 (113, Сол) — ДЕФИНИЦИИ, ЗАФИКСИРОВАНО ДО ПРОГОНА:
  // N2a (v6.30.3): primary окно = expectedOutputWindow [vendorStartFrame+512, vendorStartFrame+3072);
  //      expectedWindowEnergy = Σ sumSq bins, перекрывающих окно. targetEnergy [vsf, vsf+882) УБРАН из primary.
  // N2b (ERRATA §4, двухэтапный): baseline_raw = медиана expectedWindowEnergy по ВСЕМ delay-0 rows;
  //      healthy_rows = delay-0 rows где expectedWindowEnergy ∈ [0.5·baseline_raw, 1.5·baseline_raw];
  //      baseline = медиана expectedWindowEnergy по healthy_rows; healthy range = [0.5·baseline, 1.5·baseline].
  // N2c: profileEnergy = Σ sumSq всех bins в [-4096, +16384); fullCaptureEnergy = energySumSq (весь 4s capture);
  //      outsideExpectedEnergy = profileEnergy − expectedWindowEnergy; energyConservationRatio = profileEnergy / fullCaptureEnergy
  //      (только если coverage VALID); profileCoverage = 'FULL' | 'PARTIAL' | 'UNRESOLVED'.
  // N2d (v6.30.3): fullE baseline (двухэтапный) → truncatedThreshold = 0.7·fullEBaseline;
  //      fullE < threshold → truncated_response (обрезанный клик, НЕ shifted и НЕ loss).
  // Классы v6.30.3: healthy | shifted_energy | true_energy_loss | truncated_response | shifted_far | form_mismatch | unresolved | invalid_harness_row.
  // N1 (ERRATA §5): приоритет unresolved → unchanged → negative_or_zero → quantized → shifted → partially_shifted;
  //      baseline = медиана vendorStartFrame по delay-0 rows; actualShift = vendorStartFrame(row) − baseline; expectedShift = requestedStartDelaySamples;
  //      unresolved | unchanged (|actualShift|<32, вкл. negative) | negative_or_zero (actualShift <= −32) |
  //      quantized (|actualShift − round(actualShift/128)*128| <= 16) | shifted (|actualShift − expectedShift| < 64) |
  //      partially_shifted (actualShift > 0 и не подходит под shifted/quantized).
  // Coverage checks (ERRATA §1, нарушение → invalid_harness_row): 1) baseFrame != null; 2) wrapCount === 0;
  //      3) vendorStartFrame − 4096 >= baseFrame (absWindowStart >= baseFrame);
  //      4) vendorStartFrame + 16384 <= baseFrame + totalSamplesWritten (absWindowEnd <= baseFrame + totalSamplesWritten);
  //      5) written > 0 (sampleCount полный). Все 5 → coverage FULL.
  function buildRow({ kind, offset, rep, delayIndex, requestedStartDelayMs, requestedStartDelaySamples, chunkId, globalRowIndex, ctx, cap, vendor, rpcRecs, stats, ins, captured, srcStartFrame, deadlineHit }) {
    let peak = 0, last = -1, sum = 0;
    for (let i=0; i<(captured?.length || 0); i++) {
      const a = Math.abs(captured[i]);
      if (a > peak) peak = a;
      if (a > 1e-6) last = i;
      sum += captured[i] * captured[i];
    }
    const energy = Number(stats?.energySumSq ?? sum ?? 0);
    const written = Number(stats?.writeIndex ?? 0);

    const vendorStartFrame = ins?.vendorStartFrame ?? null;
    const captureFirstNonZero = stats?.firstNonZeroFrame ?? null;
    const captureLastNonZero = stats?.lastNonZeroFrame ?? null;
    const firstOutputBlockFrame = ins?.firstOutputBlockFrame ?? null;
    const inputLatencySeconds = ins?.inputLatencySeconds ?? null;
    const outputLatencySeconds = ins?.outputLatencySeconds ?? null;

    // Timing coordinates — raw, informational only (A6) + v6.27 startPhase (SOL_2 п.5)
    const startCtx = rpcRecs?.start?.__v627 || {};
    const timingCoords = {
      stimulusFrame: offset,
      sourceStartFrame: srcStartFrame,
      vendorStartFrame,
      vendorStartFrameMod128: vendorStartFrame != null ? vendorStartFrame % 128 : null,
      vendorStartFrameMod882: vendorStartFrame != null ? vendorStartFrame % 882 : null,
      stimulusOffsetSamples: offset,
      captureFirstNonZeroFrame: captureFirstNonZero,
      captureLastNonZeroFrame: captureLastNonZero,
      firstOutputBlockFrame,
      inputLatencySeconds,
      outputLatencySeconds,
      startCommandSentContextFrame: startCtx.startCommandSentContextFrame ?? null,
      startResponseContextFrame: startCtx.startResponseContextFrame ?? null,
      startPhase: (vendorStartFrame != null && startCtx.startCommandSentContextFrame != null)
        ? (vendorStartFrame - startCtx.startCommandSentContextFrame) : null,
      startPhaseMod128: null, // filled below
      startPhaseMod882: null, // filled below
      approximate: startCtx.approximate || true,
      note: 'main-thread ctx.currentTime approximate; not for PASS/FAIL (SOL_2 п.5)'
    };
    if (timingCoords.startPhase != null) {
      timingCoords.startPhaseMod128 = ((timingCoords.startPhase % 128) + 128) % 128;
      timingCoords.startPhaseMod882 = ((timingCoords.startPhase % 882) + 882) % 882;
    }
    // v6.27 (SOL_2 Т.2): envelope in window [vendorStartFrame, vendorStartFrame + 32*128).
    // quantumStartFrame = REAL currentFrame from worklet (NO q0 alignment — rejected by SOL_2).
    const env = rpcRecs?.envelope?.result?.env || [];
    let earlyEnvelope = { alignment: 'UNRESOLVED', reason: '', windowStart: null, windowEnd: null, quanta: [] };
    if (vendorStartFrame != null && env.length) {
      const winEnd = vendorStartFrame + 32 * 128;
      const quanta = env
        .filter(q => Number.isFinite(q.quantumStartFrame) && q.quantumStartFrame >= vendorStartFrame && q.quantumStartFrame < winEnd)
        .map(q => ({ quantumStartFrame: q.quantumStartFrame, sampleCount: q.sampleCount, sumSq: q.sumSq, maxAbs: q.maxAbs, nonZeroSampleCount: q.nonZeroSampleCount }));
      if (quanta.length) earlyEnvelope = { alignment: 'ALIGNED_TO_VENDOR_START', windowStart: vendorStartFrame, windowEnd: winEnd, quanta };
      else earlyEnvelope.reason = 'no quanta in window [vendorStartFrame, +4096)';
    } else {
      earlyEnvelope.reason = vendorStartFrame == null ? 'vendorStartFrame null' : 'env empty';
    }
    const sourceToOutput = captureFirstNonZero != null && srcStartFrame != null ? captureFirstNonZero - srcStartFrame : null;
    const startToOutput = captureFirstNonZero != null && vendorStartFrame != null ? captureFirstNonZero - vendorStartFrame : null;
    const outputDelta = firstOutputBlockFrame != null && vendorStartFrame != null ? firstOutputBlockFrame - vendorStartFrame : null;

    // RPC health verdict
    const rpcBad = Object.values(rpcRecs).some(r => !rpcHealthy(r));
    const rpcBadKeys = Object.entries(rpcRecs).filter(([k, r]) => !rpcHealthy(r)).map(([k]) => k);

    // v6.30.2 (112, Сол A): energy profile bins привязаны к vendorStartFrame; coverage checks (N1/N2) НЕ МЕНЯЛИСЬ
    const hasProfile = kind === 'vendor' && !!rpcRecs?.profile;
    const profResult = rpcRecs?.profile?.result || null;
    const profileBins = Array.isArray(profResult?.bins) ? profResult.bins : [];
    const baseFrame = profResult?.baseFrame ?? null;
    const profileWrapCount = profResult?.wrapCount ?? null;
    // v6.30.3 (113, Сол): targetEnergy УБРАН из primary; expectedOutputWindow [vsf+512, vsf+3072) — primary окно.
    // Сохраняем: profileEnergy, expectedWindowEnergy, energyBy128Bin, energyBy882Window.
    let profileEnergy = 0, expectedWindowEnergy = 0;
    const energyBy128Bin = [];      // 160 значений sumSq (каждый bin)
    const energyBy882Window = [];   // 24 значения sumSq (882-windows от vsf+PROFILE_REL_START)
    const n882 = Math.max(1, Math.ceil((PROFILE_REL_END - PROFILE_REL_START) / 882));   // 24
    for (let w = 0; w < n882; w++) energyBy882Window.push(0);
    for (const b of profileBins) {
      const s = Number(b.sumSq) || 0;
      profileEnergy += s;
      energyBy128Bin.push(s);
      if (vendorStartFrame != null) {
        const bs = Number(b.absoluteStartFrame) || 0;
        const be = bs + (Number(b.sampleCount) || PROFILE_BIN_SIZE);
        // expected window [vsf+512, vsf+3072)
        if (be > vendorStartFrame + EXPECTED_WINDOW_START && bs < vendorStartFrame + EXPECTED_WINDOW_END) expectedWindowEnergy += s;
        // 882-window: индекс от vsf+PROFILE_REL_START
        const rel = bs - (vendorStartFrame + PROFILE_REL_START);
        if (rel >= 0) {
          const w = Math.min(n882 - 1, Math.floor(rel / 882));
          energyBy882Window[w] += s;
        }
      }
    }
    const outsideExpectedEnergy = hasProfile ? (profileEnergy - expectedWindowEnergy) : null;
    const coverage = hasProfile ? {
      // P7 (ERRATA §1): нарушение любого чека → invalid_harness_row; все 5 → coverage FULL
      baseFrameAvailable: baseFrame != null,                                                                    // чек 1: baseFrame != null
      wrapCountZero: (stats?.wrapCount ?? null) === 0,                                                          // чек 2: wrapCount === 0
      absWindowStartCovered: baseFrame != null && vendorStartFrame != null && (vendorStartFrame - 4096) >= baseFrame,   // чек 3: vendorStartFrame − 4096 >= baseFrame (absWindowStart >= baseFrame)
      absWindowEndCovered: baseFrame != null && vendorStartFrame != null && (vendorStartFrame + 16384) <= (baseFrame + (stats?.totalSamplesWritten ?? 0)), // чек 4: vendorStartFrame + 16384 <= baseFrame + totalSamplesWritten (absWindowEnd <= baseFrame + totalSamplesWritten)
      sampleCountFull: written > 0                                                                              // чек 5: written > 0 (sampleCount полный)
    } : null;
    const coverageValid = !hasProfile ? true : Object.values(coverage).every(Boolean);
    const fullCaptureEnergy = hasProfile ? energy : null;                                        // N2c: energySumSq весь 4s capture
    const energyConservationRatio = (coverageValid && fullCaptureEnergy != null && fullCaptureEnergy > 0)
      ? (profileEnergy / fullCaptureEnergy) : null;                                              // N2c: только если coverage VALID

    const captureEmpty = written === 0 || stats?.processCount === 0;
    const contextBad = ctx?.state !== 'running';

    // ---- Verdict (A7 priority) ----
    const invalidReasons = [];
    if (rpcBad) invalidReasons.push('rpc_unhealthy:' + rpcBadKeys.join(','));
    if (captureEmpty) invalidReasons.push('capture_no_samples');
    if (contextBad) invalidReasons.push('context_not_running');
    if (deadlineHit) invalidReasons.push('row_deadline');
    if (hasProfile && !coverageValid) invalidReasons.push('coverage_incomplete');

    // Normalization: energyRatioToK computed later (after K known). Placeholder here.
    const rowValidity = invalidReasons.length ? 'INVALID' : 'VALID';

    const row = {
      kind, offset, rep,
      delayIndex, requestedStartDelayMs, requestedStartDelaySamples, chunkId, globalRowIndex,
      raw_observations: {
        clearToStartGapMs: CLEAR_TO_START_GAP_MS,    // v6.30.1 (111-B, Сол): harness-readiness gap после clear — не timing contract
        timingCoords,
        earlyEnvelope,
        sourceToOutput, startToOutput, outputDelta,
        energySumSq: energy,
        peakAbs: peak,
        nonZeroQuantumCount: stats?.nonZeroQuantumCount ?? 0,
        totalSamplesWritten: stats?.totalSamplesWritten ?? 0,
        writeIndex: written,
        wrapCount: stats?.wrapCount ?? 0,
        quantumLenHist: stats?.quantumLenHist ?? {},
        energyProfile: { baseFrame, wrapCount: profileWrapCount, binCount: profileBins.length, profileEnergy, expectedWindowEnergy, expectedWindow: [EXPECTED_WINDOW_START, EXPECTED_WINDOW_END], outsideExpectedEnergy, energyBy128Bin, energyBy882Window, energyConservationRatio, coverage, coverageValid },
        rpc: rpcRecs,
        health: readHealth(ctx, cap, vendor, ins)
      },
      computed_metrics: {
        energyRatioToK: null,      // filled in finalize()
        peakEnergyRatio: energy > 0 ? peak / Math.sqrt(energy) : null,
        truncated: last >= 0 && written > 0 && last >= written - 128
      },
      verdict: {
        rowValidity,
        invalidReasons,
        transientClass: null,      // filled in finalize()
        timingStatus: 'INFORMATIONAL',
        gateContribution: 'EXCLUDED'
      }
    };
    // v6.26.1 (MICRO-PACK-086): readWindow redaction — полный Float32Array раздувал JSON до 55MB.
    // v6.32.3-audit (Сол 135, C1): LOSSLESS RAW WINDOW — выборочно для trigger rows.
    //   Trigger = B3-канон (W3-AUDIT-REPORT §B3): SSO-candidate iff onset===2334 && support===clickLen,
    //   где onset = captureFirstNonZeroFrame − vendorStartFrame, support = lastNZ−firstNZ+1.
    //   Только для SSO-candidate rows сохраняем lossless samples + trigger/preClassification (схема C1).
    //   Matched-healthy связывается в finalize по pre-registered Matched-row policy (Sol_3 §2); его samples
    //   сохраняются для строк delay-0 (deterministic baseline pool) — см. buildRow ниже.
    //   Digest: НЕ считается в harness — его вычисляет W3-VERIFIER-v3 (node sha256) из samples (fail-closed).
    if (rpcRecs?.readWindow?.result instanceof Float32Array) {
      const rw = rpcRecs.readWindow.result;
      const lastNZ = captureLastNonZero, firstNZ = captureFirstNonZero;
      const vsf = vendorStartFrame;
      const onset = (firstNZ != null && vsf != null) ? (firstNZ - vsf) : null;
      const supportSamples = (lastNZ != null && firstNZ != null) ? (lastNZ - firstNZ + 1) : null;
      // B3-канон: SSO-candidate iff onset===2334 && support===clickLen (диагностика, не канон качества)
      const isSso = onset === 2334 && supportSamples === CLICK_LEN;
      // Pre-registered matched pool: delay-0 строки (детерминированный healthy baseline для matched-row policy)
      const isDelay0MatchedPool = delayIndex === 0;
      if (isSso || isDelay0MatchedPool) {
        // lossless: сохраняем сырые samples (только trigger rows — объём ограничен, ~единицы SSO + delay-0)
        rpcRecs.readWindow.result = {
          redacted: false,
          length: rw.length,
          trigger: isSso ? 'SSO-candidate' : 'matched-pool',
          preClassification: isSso ? 'SSO-candidate' : 'delay0-healthy-pool',
          samples: Array.from(rw),          // lossless (C1)
          channelPolicy: CHANNEL_POLICY,
          origin: 'capture-absolute-context-frame'
        };
      } else {
        rpcRecs.readWindow.result = { redacted: true, length: rw.length, trigger: 'none', preClassification: 'other' };
      }
    }
    if (kind === 'vendor') {
      out.rawObservations.vendorRows.push(row);
      out.computedMetrics.rows.push(row);
    } else if (kind === 'K') {
      out.instrumentHealth.trueK.push(row);
      out.computedMetrics.rows.push(row);
    }
    return row;
  }

  // ---------- TRUE K (A1) — independent direct path, NO Signalsmith ----------
  async function runTrueK(offset, delayMs = 0) {
    const ctx = new AudioContext({ sampleRate: SR });
    if (ctx.state === 'suspended') await ctx.resume();
    const url = URL.createObjectURL(new Blob([captureCode], { type: 'text/javascript' }));
    try { await ctx.audioWorklet.addModule(url); } finally { URL.revokeObjectURL(url); }
    const cap = new AudioWorkletNode(ctx, CAPTURE_NAME, { numberOfInputs: 1, numberOfOutputs: 1, processorOptions: { bufferSize: CAPTURE_SIZE } });
    cap.port.start?.();
    const gain = ctx.createGain(); gain.gain.value = 1e-6;
    const src = ctx.createBufferSource();
    const clickBuf = makeClick(offset, CLICK_LEN);
    const ab = ctx.createBuffer(1, clickBuf.length, SR);
    ab.copyToChannel(clickBuf, 0);
    src.buffer = ab;
    src.connect(cap); cap.connect(gain); gain.connect(ctx.destination);
    await sleep(150);

    const rpcRecs = {};
    const ping = await rpc(cap, 'ping'); rpcRecs.ping = ping; ping.shapeValid = shapeValid('ping', ping.result);
    const cleared = await rpc(cap, 'clear'); rpcRecs.clear = cleared; cleared.shapeValid = shapeValid('clear', cleared.result);
    const srcStartFrame = Math.round((ctx.currentTime + 0.02 + delayMs / 1000) * SR);
    src.start(ctx.currentTime + delayMs / 1000);   // v6.30 (110, Сол): было src.start(0) — теперь controlled start delay
    await sleep(Math.ceil(SR * 0.02)); // wait for click to pass (buffer is 0.5s, click early)
    await sleep(600);
    const statsRec = await rpc(cap, 'stats'); rpcRecs.stats = statsRec; statsRec.shapeValid = shapeValid('stats', statsRec.result);
    const stats = statsRec.result || {};
    const written = Number(stats.writeIndex || 0);
    const readRec = await rpc(cap, 'readWindow', [0, written]); rpcRecs.readWindow = readRec; readRec.shapeValid = shapeValid('readWindow', readRec.result);
    cap.statsRec = stats; cap.statsRec.processCount = stats.processCount;
    const row = buildRow({
      kind: 'K', offset, rep: 'K',
      ctx, cap, vendor: null,
      rpcRecs, stats,
      ins: { vendorStartFrame: null, firstOutputBlockFrame: null },
      captured: readRec.result,
      srcStartFrame,
      deadlineHit: false
    });
    row.controlTopology = 'AudioBufferSourceNode->CaptureWorklet->gain(1e-6)->destination (no Signalsmith)';
    row.kVariant = 'direct';    // v6.31: отличаем от vendor (runVendorK)
    await ctx.close();
    return row;
  }

  // ---------- VENDOR K (v6.31, 117-PREREG): energy через vendor для сравнения с direct K ----------
  let vendorKCallCount = 0;   // v6.32.1 (096): счётчик vendor K-вызовов для корректного warmup-tag
  async function runVendorK(offset, delayMs = 0) {
    const ctx = new AudioContext({ sampleRate: SR });
    if (ctx.state === 'suspended') await ctx.resume();
    const url = URL.createObjectURL(new Blob([captureCode], { type: 'text/javascript' }));
    try { await ctx.audioWorklet.addModule(url); } finally { URL.revokeObjectURL(url); }
    const Vendor = await importVendor();
    const node = await Vendor(ctx, { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1] });
    await node.configure({ blockMs: BLOCK_MS, intervalMs: INTERVAL_MS, splitComputation: SPLIT_COMPUTATION });
    const latency = await node.latency();
    const cap = new AudioWorkletNode(ctx, CAPTURE_NAME, { numberOfInputs: 1, numberOfOutputs: 1, processorOptions: { bufferSize: CAPTURE_SIZE } });
    cap.port.start?.();
    const gain = ctx.createGain(); gain.gain.value = 1e-6;
    node.connect(cap); cap.connect(gain); gain.connect(ctx.destination);
    await sleep(150);
    const rpcRecs = {};
    const add = await rpc(node, 'addBuffers', [[makeClick(offset, CLICK_LEN)]]); rpcRecs.addBuffers = add; add.shapeValid = shapeValid('addBuffers', add.result);
    const cleared = await rpc(cap, 'clear'); rpcRecs.clear = cleared; cleared.shapeValid = shapeValid('clear', cleared.result);
    await sleep(CLEAR_TO_START_GAP_MS);
    await sleep(delayMs);
    const started = await rpc(node, 'start', [{ input: 0, rate: 1, active: true }]); rpcRecs.start = started; started.shapeValid = shapeValid('start', started.result);
    await sleep(Math.ceil((latency || 0.06) * 1000) + 400);
    const statsRec = await rpc(cap, 'stats'); rpcRecs.stats = statsRec; statsRec.shapeValid = shapeValid('stats', statsRec.result);
    const stats = statsRec.result || {};
    const written = Number(stats.writeIndex || 0);
    const readRec = await rpc(cap, 'readWindow', [0, written]); rpcRecs.readWindow = readRec; readRec.shapeValid = shapeValid('readWindow', readRec.result);
    cap.statsRec = stats; cap.statsRec.processCount = stats.processCount;
    const row = buildRow({
      kind: 'K', offset, rep: 'K',
      ctx, cap, vendor: node,
      rpcRecs, stats,
      ins: {}, captured: readRec.result,
      srcStartFrame: null, deadlineHit: false
    });
    row.controlTopology = 'vendor(Signalsmith)->CaptureWorklet->gain(1e-6)->destination (vendor path)';
    row.kVariant = 'vendor';    // v6.31: отличаем от direct (runTrueK)
    // v6.32 (095, Сол R67): различать warmup vs measurement для исключения из K-метрик
    // v6.32.1 (096, Сол R68): warmup-tag по счётчику вызовов, НЕ по уже запушенным строкам (off-by-one fix)
    vendorKCallCount += 1;
    row.kRowRole = (vendorKCallCount <= VENDOR_WARMUP_ROWS) ? 'warmup' : 'measurement';
    await ctx.close();
    return row;
  }

  // ---------- VENDOR ROW ----------
  async function runVendorRow(delayMs, delayIndex, rep) {
    const ctx = new AudioContext({ sampleRate: SR });
    if (ctx.state === 'suspended') await ctx.resume();
    const url = URL.createObjectURL(new Blob([captureCode], { type: 'text/javascript' }));
    try { await ctx.audioWorklet.addModule(url); } finally { URL.revokeObjectURL(url); }
    const Vendor = await importVendor();
    const node = await Vendor(ctx, { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1] });
    await node.configure({ blockMs: BLOCK_MS, intervalMs: INTERVAL_MS, splitComputation: SPLIT_COMPUTATION });
    const latency = await node.latency();
    const cap = new AudioWorkletNode(ctx, CAPTURE_NAME, { numberOfInputs: 1, numberOfOutputs: 1, processorOptions: { bufferSize: CAPTURE_SIZE } });
    cap.port.start?.();
    const gain = ctx.createGain(); gain.gain.value = 1e-6;
    node.connect(cap); cap.connect(gain); gain.connect(ctx.destination);
    await sleep(150);
    await rpc(node, 'setInstrumentation', [true]);

    let deadlineHit = false;
    const deadline = setTimeout(() => { deadlineHit = true; }, ROW_DEADLINE_MS);
    try {
      const rpcRecs = {};
      const offset = PHASE_OFFSET;                          // v6.30: единственный основной offset (Сол)
      const add = await rpc(node, 'addBuffers', [[makeClick(offset, CLICK_LEN)]]); rpcRecs.addBuffers = add; add.shapeValid = shapeValid('addBuffers', add.result);
      const cleared = await rpc(cap, 'clear'); rpcRecs.clear = cleared; cleared.shapeValid = shapeValid('clear', cleared.result);
      // v6.30 (110, Сол, П5): controlled start delay — между clear (cap) и start
      const requestedStartDelayMs = delayMs;
      await sleep(CLEAR_TO_START_GAP_MS);            // v6.30.1 (111-B): fixed readiness gap после clear — покрытие левого окна [-4096,0)
      await sleep(delayMs);                          // controlled start delay (Сол)
      // v6.27 (SOL_2 п.5): start coordinates, approximate=true (main-thread clock, NOT for PASS/FAIL)
      const tStartCmd = performance.now();
      const startCommandSentContextFrame = Math.round(ctx.currentTime * SR);   // approximate
      const started = await rpc(node, 'start', [{ input: 0, rate: 1, active: true }]); rpcRecs.start = started; started.shapeValid = shapeValid('start', started.result);
      const startResponseContextFrame = Math.round(ctx.currentTime * SR);      // approximate
      rpcRecs.start.__v627 = { tStartCmdMs: tStartCmd, startCommandSentContextFrame, startResponseContextFrame, requestedStartDelayMs, approximate: true };
      // v6.32.3-audit (Сол 135, C4): T0-T3 = ОДИН stimulus, НЕСКОЛЬКО read points. clock: tStartMs после start-команды.
      const tStartMs = performance.now();
      const declaredLatencyMs = Math.round((latency || 0.06) * 1000);
      const tRead = async (label) => {
        const snap = await rpc(cap, 'readWindow', [0, CAPTURE_SIZE]);   // deliberate early read — читаем доступный буфер
        const elapsedMs = Math.round(performance.now() - tStartMs);
        let meta = {};
        if (snap?.result instanceof Float32Array) {
          let pk = 0, nz = 0; for (let i=0;i<snap.result.length;i++){ const a=Math.abs(snap.result[i]); if(a>pk)pk=a; if(a>1e-6)nz++; }
          meta = { redacted: true, length: snap.result.length, peak: pk, nonZero: nz };
        } else { meta = snap?.result ?? null; }
        return { readPointId: label, elapsedMs, windowMeta: meta };
      };
      const readPoints = [];
      readPoints.push(await tRead('T0'));   // deliberately EARLY — start только что отправлен, write ещё мал (positive control)
      const waitMs = Math.ceil((latency || 0.06) * 1000) + 400;
      await sleep(waitMs);
      const statsRec = await rpc(cap, 'stats'); rpcRecs.stats = statsRec; statsRec.shapeValid = shapeValid('stats', statsRec.result);
      const stats = statsRec.result || {};
      const insRec = await rpc(node, 'getInstrumentMetrics', []); rpcRecs.getInstrumentMetrics = insRec; insRec.shapeValid = shapeValid('getInstrumentMetrics', insRec.result);
      // v6.27.1 (MICRO-PACK-087-ERRATA, Б1): allowlist ПРИМЕНЯЕТСЯ К САМОМУ РЕКОРДУ.
      // Раньше полный result (с seekTrace 39963B) попадал в JSON через rpcRecs — 6MB вместо <2MB.
      insRec.result = allowlistInstrumentMetrics(insRec.result || {});
      const ins = insRec.result || {};
      // v6.30.2 (112, Сол вариант A): profile привязан к РЕАЛЬНОМУ vendorStartFrame — АБСОЛЮТНЫЕ границы [vsf−4096, vsf+16384)
      // vsf известен из getInstrumentMetrics (выше). Если vsf==null → дефолт → coverage чек 3 уронит row в INVALID (инвариант сохранён).
      const vsfProf = ins?.vendorStartFrame ?? null;
      const profArgs = vsfProf != null
        ? [vsfProf + PROFILE_REL_START, vsfProf + PROFILE_REL_END, PROFILE_BIN_SIZE]
        : [PROFILE_REL_START, PROFILE_REL_END, PROFILE_BIN_SIZE];
      const profRec = await rpc(cap, 'profile', profArgs);
      rpcRecs.profile = profRec; profRec.shapeValid = !!profRec.result?.bins;
      const envRec = await rpc(cap, 'envelope', []); rpcRecs.envelope = envRec;
      envRec.shapeValid = !!envRec.result?.env;
      const written = Number(stats.writeIndex || 0);
      const readRec = await rpc(cap, 'readWindow', [0, written]); rpcRecs.readWindow = readRec; readRec.shapeValid = shapeValid('readWindow', readRec.result);
      // v6.32.3-audit (Сол 135, C4/T-points): T0 уже снят ДО waitMs (early). T1/T2/T3 — фиксированные более поздние read points.
      //   elapsedMs отсчитывается от tStartMs (start), НЕ подменяет друг друга. Observability-only, verdict/gate не трогает.
      readPoints.push(await tRead('T1'));                                      // declared latency + 300 ms
      await sleep(300); readPoints.push(await tRead('T2'));                    // declared latency + 600 ms
      await sleep(600); readPoints.push(await tRead('T3'));                    // declared latency + 1200 ms
      // v6.32.3-audit-r2 (Сол 137, Fix A): readPoints НЕ должен попадать в rpcRecs (иначе
      // buildRow проверяет его как RPC-запись → rpcHealthy()=false → rpc_unhealthy:readPoints → row INVALID).
      // readPoints складываем в rowExtras — вне RPC health map.
      const rowExtras = { readPoints: { declaredLatencyMs, readPoints } };
      cap.statsRec = stats; cap.statsRec.processCount = stats.processCount;
      // v6.30 (П5): проброс delay-параметров в buildRow (rep = globalRowIndex из RUN_ORDER)
      const requestedStartDelaySamples = Math.round(delayMs * SR / 1000);
      // v6.32.2 (097, Сол_2): chunkId/rowIndex от 1-based globalRowIndex (rep) → корректный 0-based
      const chunkId = Math.floor((rep - 1) / CHUNK_ROWS);
      const rowIndex = (rep - 1) % CHUNK_ROWS;
      const row = buildRow({
        kind: 'vendor', offset, rep,
        delayIndex, requestedStartDelayMs, requestedStartDelaySamples, chunkId, globalRowIndex: rep,
        ctx, cap, vendor: node,
        rpcRecs, stats, ins,
        captured: readRec.result,
        srcStartFrame: null,
        deadlineHit
      });
      // v6.32.3-audit-r2 (Сол 137, Fix A): rowExtras привязываем к row вне rpcRecs/rpc-health.
      row.raw_observations.readPoints = rowExtras.readPoints;
      return row;
    } finally {
      clearTimeout(deadline);
      await ctx.close();
    }
  }

  // ---------- ZERO-INPUT SANITY (NOT Gate4a) ----------
  async function runZeroInputSanity() {
    const ctx = new AudioContext({ sampleRate: SR });
    if (ctx.state === 'suspended') await ctx.resume();
    const url = URL.createObjectURL(new Blob([captureCode], { type: 'text/javascript' }));
    try { await ctx.audioWorklet.addModule(url); } finally { URL.revokeObjectURL(url); }
    const Vendor = await importVendor();
    const node = await Vendor(ctx, { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1] });
    await node.configure({ blockMs: BLOCK_MS, intervalMs: INTERVAL_MS, splitComputation: SPLIT_COMPUTATION });
    const latency = await node.latency();
    const cap = new AudioWorkletNode(ctx, CAPTURE_NAME, { numberOfInputs: 1, numberOfOutputs: 1, processorOptions: { bufferSize: CAPTURE_SIZE } });
    cap.port.start?.();
    const gain = ctx.createGain(); gain.gain.value = 1e-6;
    node.connect(cap); cap.connect(gain); gain.connect(ctx.destination);
    await sleep(150);
    try {
      await rpc(node, 'addBuffers', [[new Float32Array(Math.ceil(SR * 0.5))]]);
      await rpc(cap, 'clear');
      await rpc(node, 'start', [{ input: 0, rate: 1, active: true }]);
      await sleep(Math.ceil((latency || 0.06) * 1000) + 400);
      const statsRec = await rpc(cap, 'stats');
      const stats = statsRec.result || {};
      const n = Number(stats.writeIndex || 0);
      const x = n ? (await rpc(cap, 'readWindow', [0, n])).result : null;
      let sum = 0, peak = 0;
      for (const v of (x || [])) { sum += v * v; peak = Math.max(peak, Math.abs(v)); }
      const rms = x?.length ? Math.sqrt(sum / x.length) : null;
      out.instrumentHealth.zeroInputSanity = {
        name: 'zeroInputSanity',
        captureStatus: n === 0 ? 'no_samples' : (x?.length ? 'samples' : 'no_samples'),
        rms: n === 0 ? null : rms,
        rmsDb: rms != null && rms > 0 ? 20 * Math.log10(rms) : (n === 0 ? null : -Infinity),
        peak,
        nonZeroQuantumCount: stats.nonZeroQuantumCount ?? 0,
        writeIndex: n,
        gate4a: 'NOT_RUN', // NOT a reference null-test
        note: 'zero-input sanity check only; not Gate4a reference'
      };
    } finally { await ctx.close(); }
  }

  // ---------- FINALIZE (recompute from raw rows, A7) ----------
  function finalize() {
    const kRows = out.instrumentHealth.trueK;
    const vendorRows = out.rawObservations.vendorRows;

    // K verdict: both offsets 0 and 4410 present & VALID
    // v6.32.1 (096, R68): K-HEALTH GATE = direct-K ТОЛЬКО (vendor-K — объект исследования, не gate)
    const kDirect = kRows.filter(r => r.kVariant === 'direct' && r.verdict.rowValidity === 'VALID' && r.kRowRole !== 'warmup');
    const kOffsetsOk = [0, 4410].every(o => kDirect.some(r => r.offset === o));
    const kRefEnergyArr = kDirect.filter(r => r.offset === 0).map(r => r.raw_observations.energySumSq).filter(e => Number.isFinite(e) && e > 0);
    const kRefEnergy = kRefEnergyArr.length ? kRefEnergyArr.reduce((a, b) => a + b, 0) / kRefEnergyArr.length : null;
    const controlPass = kOffsetsOk && kRefEnergy != null && kDirect.every(r => {
      const e = r.raw_observations.energySumSq;
      const ratio = kRefEnergy > 0 ? e / kRefEnergy : 0;
      return ratio >= 0.8 && ratio <= 1.2 && r.raw_observations.peakAbs >= 0.9;
    });
    // v6.32 (095, Сол R67): не перезаписывать объект instrumentHealth строкой (баг v6.31)
    out.verdict.instrumentHealthState = controlPass ? 'PASS' : 'FAIL';
    out.instrumentHealth.state = controlPass ? 'PASS' : 'FAIL';
    out.verdict.reasons.push('trueK_offsets_present=' + (kOffsetsOk ? 'yes' : 'no') + ', kRefEnergy=' + (kRefEnergy != null ? kRefEnergy.toFixed(2) : 'null'));

    // v6.31 (117-PREREG, Сол R64): independent direct K vs vendor K
    const kDirectArr = kDirect.map(r => r.raw_observations.energySumSq).filter(e => Number.isFinite(e) && e > 0);
    const kVendor = kRows.filter(r => r.kVariant === 'vendor' && r.verdict.rowValidity === 'VALID' && r.kRowRole !== 'warmup');
    const kVendorArr = kVendor.map(r => r.raw_observations.energySumSq).filter(e => Number.isFinite(e) && e > 0);
    const directKRef = kDirectArr.length ? kDirectArr.reduce((a, b) => a + b, 0) / kDirectArr.length : null;
    const vendorKRef = kVendorArr.length ? kVendorArr.reduce((a, b) => a + b, 0) / kVendorArr.length : null;
    out.instrumentHealth.directKRefEnergy = directKRef;
    out.instrumentHealth.vendorKRefEnergy = vendorKRef;
    out.instrumentHealth.kPathRatio = (directKRef != null && vendorKRef != null && vendorKRef > 0) ? Number((directKRef / vendorKRef).toFixed(4)) : null;
    if (out.instrumentHealth.kPathRatio != null) {
      out.verdict.reasons.push('kPathRatio(direct/vendor)=' + out.instrumentHealth.kPathRatio);
    }

    // v6.32.2 (097, Сол_2): vendor-K anomaly по RAW rows, с явной обработкой INVALID
    const kVendorRaw = kRows.filter(r => r.kVariant === 'vendor' && r.kRowRole !== 'warmup');
    const kVendorInvalid = kVendorRaw.filter(r => r.verdict.rowValidity === 'INVALID');
    const kVendorValidE = kVendorRaw.filter(r => r.verdict.rowValidity === 'VALID')
      .map(r => r.raw_observations.energySumSq).filter(e => Number.isFinite(e) && e > 0);
    // v6.32.2 (098, Сол): robust baseline — median по VALID measurement vendor-K rows.
    // Ранее обычный mean включал аномальные vendor-K rows в сам baseline, занижая его.
    // Порядок: сначала baseline (median), затем классификация anomaly ПОСЛЕ него (ниже).
    const kVendorValidSorted = kVendorValidE.slice().sort((a, b) => a - b);
    const vendorKRefSafe = kVendorValidSorted.length
      ? (kVendorValidSorted.length % 2 === 1
        ? kVendorValidSorted[(kVendorValidSorted.length - 1) / 2]
        : (kVendorValidSorted[kVendorValidSorted.length / 2 - 1] + kVendorValidSorted[kVendorValidSorted.length / 2]) / 2)
      : null;
    const vendorAnomalyRows = (vendorKRefSafe != null && vendorKRefSafe > 0)
      ? kVendorRaw.filter(r => r.verdict.rowValidity === 'VALID' && r.raw_observations.energySumSq / vendorKRefSafe < 0.3)
      : [];
    out.instrumentHealth.vendorKAnomalyCount = vendorAnomalyRows.length;
    out.instrumentHealth.vendorInvalidCount = kVendorInvalid.length;
    out.instrumentHealth.vendorFullDropout = {
      count: (vendorKRefSafe != null && vendorKRefSafe > 0)
        ? vendorAnomalyRows.filter(r => r.raw_observations.energySumSq / vendorKRefSafe < 0.1).length : 0,
      rows: (vendorKRefSafe != null && vendorKRefSafe > 0)
        ? vendorAnomalyRows.filter(r => r.raw_observations.energySumSq / vendorKRefSafe < 0.1)
            .map(r => ({ index: kRows.indexOf(r), offset: r.offset, energySumSq: r.raw_observations.energySumSq, peakAbs: r.raw_observations.peakAbs, kRowRole: r.kRowRole }))
        : []
    };
    if (out.instrumentHealth.vendorKAnomalyCount > 0 || out.instrumentHealth.vendorInvalidCount > 0) {
      out.verdict.reasons.push('vendorKRefSafe=' + (vendorKRefSafe != null ? vendorKRefSafe.toFixed(2) : 'null') + ', vendorKAnomaly=' + out.instrumentHealth.vendorKAnomalyCount + ', vendorKInvalid=' + out.instrumentHealth.vendorInvalidCount);
    }

    // Fill energyRatioToK
    for (const r of vendorRows) {
      const e = r.raw_observations.energySumSq;
      const ratioToK = kRefEnergy != null && kRefEnergy > 0 ? e / kRefEnergy : null;
      r.computed_metrics.energyRatioToK = ratioToK != null ? Number(ratioToK.toFixed(4)) : null;
    }

    // v6.30.3 (113, Сол): классификация по expectedWindowEnergy — двухэтапный healthy baseline.
    // Шаг 1: baseline_raw = медиана expectedWindowEnergy по ВСЕМ delay-0 rows (rowValidity VALID).
    // Шаг 2: healthy_rows = delay-0 rows где expectedWindowEnergy ∈ [0.5·baseline_raw, 1.5·baseline_raw].
    // Шаг 3: baseline = медиана expectedWindowEnergy по healthy_rows; healthy range = [0.5·baseline, 1.5·baseline].
    const medianOf = arr => arr.length ? (arr.length % 2 === 1 ? arr[(arr.length - 1) / 2] : (arr[arr.length / 2 - 1] + arr[arr.length / 2]) / 2) : null;
    const delay0ValidRows = vendorRows.filter(r => r.requestedStartDelayMs === 0 && r.verdict.rowValidity === 'VALID');
    const eweAll = delay0ValidRows
      .map(r => r.raw_observations.energyProfile?.expectedWindowEnergy)
      .filter(v => Number.isFinite(v))
      .sort((a, b) => a - b);
    const baseline_raw = medianOf(eweAll);                                                                  // шаг 1
    const eweHealthy = (baseline_raw != null && baseline_raw > 0)
      ? eweAll.filter(v => v >= 0.5 * baseline_raw && v <= 1.5 * baseline_raw)                              // шаг 2: healthy_rows
      : [];
    const healthyBaseline = medianOf(eweHealthy);                                                           // шаг 3
    const healthyRange = healthyBaseline != null ? { low: 0.5 * healthyBaseline, high: 1.5 * healthyBaseline } : null; // N2b

    // v6.30.3 (113, Сол): fullE baseline для truncated_response (двухэтапный, аналогично)
    const fEAll = delay0ValidRows
      .map(r => r.raw_observations.energySumSq)
      .filter(v => Number.isFinite(v) && v > 0)
      .sort((a, b) => a - b);
    const fullEBaselineRaw = medianOf(fEAll);
    const fEHealthy = (fullEBaselineRaw != null && fullEBaselineRaw > 0)
      ? fEAll.filter(v => v >= 0.5 * fullEBaselineRaw && v <= 1.5 * fullEBaselineRaw)
      : [];
    const fullEBaseline = medianOf(fEHealthy) != null ? medianOf(fEHealthy) : fullEBaselineRaw;
    const truncatedThreshold = fullEBaseline != null ? TRUNCATED_FULLE_RATIO * fullEBaseline : null;   // 0.7·baseline

    // v6.32.2 (097, Сол_2): реальные peak/form bounds (не только energy)
    const peakAllBase = delay0ValidRows
      .map(r => r.raw_observations.peakAbs)
      .filter(v => Number.isFinite(v) && v > 0)
      .sort((a, b) => a - b);
    const peakBaseRaw = medianOf(peakAllBase);
    const peakBaseHealthy = (peakBaseRaw != null && peakBaseRaw > 0)
      ? peakAllBase.filter(v => v >= 0.9 * peakBaseRaw && v <= 1.1 * peakBaseRaw)
      : [];
    const peakBaseline = medianOf(peakBaseHealthy) ?? peakBaseRaw;
    const peakRange = peakBaseline != null && peakBaseline > 0
      ? { low: 0.9 * peakBaseline, high: 1.1 * peakBaseline }
      : null;

    for (const r of vendorRows) {
      const prof = r.raw_observations.energyProfile || {};
      const expectedWindowEnergy = prof.expectedWindowEnergy;
      const outsideExpectedEnergy = prof.outsideExpectedEnergy;
      const ratio = prof.energyConservationRatio;          // только если coverage VALID
      const fullCaptureEnergy = r.raw_observations.energySumSq;
      const peakAbs = r.raw_observations.peakAbs;

      if (r.verdict.rowValidity === 'INVALID') {
        // 113: coverage/RPC/deadline/wrap/SHA failure (rowValidity INVALID)
        r.verdict.transientClass = 'invalid_harness_row';
        r.verdict.gateContribution = 'EXCLUDED';
      } else if (truncatedThreshold != null && fullCaptureEnergy < truncatedThreshold) {
        // 113 (Сол): truncated_response — fullE заметно ниже baseline (обрезанный клик, 23.84/39.33=0.61)
        r.verdict.transientClass = 'truncated_response';
        r.verdict.gateContribution = 'EXCLUDED';
      } else if (healthyRange == null || !Number.isFinite(expectedWindowEnergy)) {
        r.verdict.transientClass = 'unresolved';
        r.verdict.gateContribution = 'EXCLUDED';
      } else if (expectedWindowEnergy >= healthyRange.low && expectedWindowEnergy <= healthyRange.high) {
        // 113 (Сол): healthy — нормальная энергия в expected window [vsf+512, vsf+3072)
        r.verdict.transientClass = 'healthy';
        r.verdict.gateContribution = 'INCLUDED';
      } else if (expectedWindowEnergy < healthyRange.low && ratio != null && ratio >= 0.8 && outsideExpectedEnergy > 0) {
        // 113 (Сол): shifted_energy — expected провален, но полная profile energy сохранена (ratio≥0.8)
        // и пик ушёл в другой 882-window (energyBy882Window максимум вне expected-окон)
        r.verdict.transientClass = 'shifted_energy';
        r.verdict.gateContribution = 'EXCLUDED';
      } else if (expectedWindowEnergy < healthyRange.low && ratio != null && ratio < 0.8) {
        // 113 (Сол): true_energy_loss — провалены и expected, и вся покрытая profile energy (ratio<0.8)
        const profileEnergy = prof.profileEnergy || 0;
        if (profileEnergy < 0.5 * fullCaptureEnergy && fullCaptureEnergy >= healthyRange.low) {
          r.verdict.transientClass = 'shifted_far';
        } else {
          r.verdict.transientClass = 'true_energy_loss';
        }
        r.verdict.gateContribution = 'EXCLUDED';
      } else {
        r.verdict.transientClass = 'form_mismatch';
        r.verdict.gateContribution = 'EXCLUDED';
      }
    }
    out.verdict.reasons.push('healthyBaseline_expectedWindowEnergy=' + (healthyBaseline != null ? healthyBaseline.toFixed(2) : 'null') + ', healthyRange=' + (healthyRange != null ? healthyRange.low.toFixed(2) + '..' + healthyRange.high.toFixed(2) : 'null') + ', truncatedThreshold=' + (truncatedThreshold != null ? truncatedThreshold.toFixed(2) : 'null'));

    // v6.30 (110, Сол, N1): phaseControlStatus — вычислимое правило, пост-классификация
    const vsfArr = vendorRows
      .filter(r => r.requestedStartDelayMs === 0 && r.verdict.rowValidity === 'VALID' && r.raw_observations?.timingCoords?.vendorStartFrame != null)
      .map(r => r.raw_observations.timingCoords.vendorStartFrame)
      .sort((a, b) => a - b);
    const vsfBaseline = vsfArr.length ? (vsfArr.length % 2 === 1 ? vsfArr[(vsfArr.length - 1) / 2] : (vsfArr[vsfArr.length / 2 - 1] + vsfArr[vsfArr.length / 2]) / 2) : null;
    for (const r of vendorRows) {
      const vsf = r.raw_observations?.timingCoords?.vendorStartFrame ?? null;
      const expectedShift = r.requestedStartDelaySamples ?? 0;
      let status;
      if (vsf == null || r.verdict.rowValidity !== 'VALID') {
        status = 'unresolved';                                        // N1 (ERRATA §5): vendorStartFrame == null || row invalid
      } else {
        const actualShift = vsf - vsfBaseline;
        if (Math.abs(actualShift) < 32) status = 'unchanged';         // N1 (ERRATA §5): |actualShift| < 32 (вкл. negative)
        else if (actualShift <= -32) status = 'negative_or_zero';     // N1 (ERRATA §5): сдвиг назад — аномалия, не ошибка
        else if (Math.abs(actualShift - Math.round(actualShift / 128) * 128) <= 16) status = 'quantized'; // N1
        else if (Math.abs(actualShift - expectedShift) < 64) status = 'shifted'; // N1
        else status = 'partially_shifted';                            // N1 (ERRATA §5): actualShift > 0 И не подходит под shifted/quantized
      }
      r.verdict.phaseControlStatus = status;
    }

    // Acceptance: only VALID healthy rows on ACCEPTANCE_OFFSETS
    const acceptanceRows = vendorRows.filter(r => ACCEPTANCE_OFFSETS.includes(r.offset));
    const expectedAcceptanceRows = DELAY_POINTS_MS.length * REPS_PER_DELAY; // 900 (ERRATA §2: вместо ACCEPTANCE_OFFSETS.length * REPS)
    const presentAcceptanceRows = acceptanceRows.length;
    const validAcceptanceRows = acceptanceRows.filter(r => r.verdict.rowValidity === 'VALID').length;
    const invalidRows = vendorRows.filter(r => r.verdict.rowValidity === 'INVALID').length;
    const shiftedEnergyRows = acceptanceRows.filter(r => r.verdict.transientClass === 'shifted_energy').length;
    const trueLossRows      = acceptanceRows.filter(r => r.verdict.transientClass === 'true_energy_loss').length;
    const shiftedFarRows    = acceptanceRows.filter(r => r.verdict.transientClass === 'shifted_far').length;
    const truncatedRows     = acceptanceRows.filter(r => r.verdict.transientClass === 'truncated_response').length;

    const byOffset = {};
    for (const o of [...DIAGNOSTIC_OFFSETS, ...ACCEPTANCE_OFFSETS]) {
      const rs = vendorRows.filter(r => r.offset === o);
      byOffset[o] = {
        rows: rs.length,
        pass: rs.filter(r => r.verdict.transientClass === 'healthy').length,
        shiftedEnergy: rs.filter(r => r.verdict.transientClass === 'shifted_energy').length,
        trueLoss: rs.filter(r => r.verdict.transientClass === 'true_energy_loss').length,
        shiftedFar: rs.filter(r => r.verdict.transientClass === 'shifted_far').length,
        truncated: rs.filter(r => r.verdict.transientClass === 'truncated_response').length,
        invalid: rs.filter(r => r.verdict.rowValidity === 'INVALID').length,
        formMismatch: rs.filter(r => r.verdict.transientClass === 'form_mismatch').length
      };
    }

    out.summary = {
      expectedAcceptanceRows,
      presentAcceptanceRows,
      validAcceptanceRows,
      invalidRows,
      shiftedEnergyRows,
      trueLossRows,
      shiftedFarRows,
      truncatedRows,
      byOffset
    };

    out.summary.vendorKAnomalyCount = out.instrumentHealth.vendorKAnomalyCount;
    out.summary.vendorFullDropout = out.instrumentHealth.vendorFullDropout.count;
    out.summary.vendorPartialTruncation = truncatedRows;   // label-алиас для vendor_partial_truncation

    // Gate 3B-local (A7): state machine INVALID EVIDENCE -> BLOCKED -> CONDITIONAL -> PASS
    // Sol_2 cond.4: полный PASS структурно невозможен при timingStatus != 'INDEPENDENTLY_VALIDATED'.
    const kPass = controlPass;
    const allValid = validAcceptanceRows === expectedAcceptanceRows;
    const noCollapse = (shiftedEnergyRows + trueLossRows + shiftedFarRows) === 0;   // Gate3B (ERRATA §3)
    const allFormOk = acceptanceRows.filter(r => r.verdict.transientClass === 'healthy').length === expectedAcceptanceRows
      && (peakRange == null || acceptanceRows.filter(r => r.verdict.transientClass === 'healthy').every(r => r.raw_observations.peakAbs >= peakRange.low && r.raw_observations.peakAbs <= peakRange.high));   // замена formPassRows
    const baseOk = kPass && allValid && noCollapse && allFormOk;
    out.verdict.harness = invalidRows > 0 ? 'HARNESS_ISSUES' : 'OK';

    if (!kPass || invalidRows > 0) {
      // K/RPC/capture invalid -> INVALID EVIDENCE (top priority)
      out.verdict.gate3BLocal = 'INVALID EVIDENCE';
      out.verdict.timing = 'UNRESOLVED';
      out.verdict.reasons.push('kPass=' + kPass + ', invalidRows=' + invalidRows + ', harness=' + out.verdict.harness);
    } else if (!baseOk) {
      // missing rows / collapse / truncation / form failure -> BLOCKED
      out.verdict.gate3BLocal = 'BLOCKED';
      out.verdict.timing = 'UNRESOLVED';
      out.verdict.reasons.push('kPass=' + kPass + ', allValid=' + allValid + ', noCollapse=' + noCollapse + ', allFormOk=' + allFormOk);
    } else {
      // v6.32.2 (097, Сол_2): итог — PHASE DIAGNOSTIC, НЕ Gate 3B (протокол ≠ Gate 3B, timing не INDEPENDENTLY_VALIDATED)
      out.verdict.gate3BLocal = 'PHASE-DIAGNOSTIC';
      out.verdict.timing = 'UNRESOLVED';
      out.verdict.reasons.push('phase diagnostic: energy/form clean but protocol NOT Gate 3B + timing unresolved -> PHASE-DIAGNOSTIC (не квалификация)');
    }
    out.verdict.gate4a = 'NOT_RUN';
    out.verdict.qualification = 'NOT_GATE3B';
    out.verdict.diagnostic = {
      protocol: 'phase-plus-energy-profile (NOT standard Gate 3B 128/256/4410x5)',
      timingIndependentlyValidated: false,
      note: 'PHASE DIAGNOSTIC run; cannot be Gate 3B PASS by protocol design'
    };
    out.stage = 'done';
  }

  // ---------- MAIN ----------
  try {
    log('BOOT', { version: SCRIPT_VERSION, trackId: TRACK_ID });
    // v6.32 (095, Сол R67): readiness barrier — прогрев vendor перед измерениями (warm-up не входит в K/metrics)
    log('WARMUP START');
    for (let w = 1; w <= VENDOR_WARMUP_ROWS; w++) {
      try { await runVendorK(0, 0); } catch (e) { fail('warmup ' + w, e); }
    }
    log('WARMUP DONE', VENDOR_WARMUP_ROWS);
    log('K START');
    // v6.30 (110, Сол, П9): K sanity — 9 delays × 2 offsets × 3 reps = 54 rows
    // v6.31 (117-PREREG): direct K (без vendor) + vendor K (через vendor) — сравнение путей
    for (const dm of DELAY_POINTS_MS) {
      for (const ko of K_OFFSETS) {
        for (let kr = 1; kr <= K_REPS_PER_DELAY; kr++) {
          await runTrueK(ko, dm);      // direct (существующий)
          await runVendorK(ko, dm);    // vendor (новый, 5a)
        }
      }
    }
    log('K DONE', { delays: DELAY_POINTS_MS.length, offsets: K_OFFSETS, repsPerDelay: K_REPS_PER_DELAY, rows: out.instrumentHealth.trueK.length });
    log('F START');
    await runZeroInputSanity();
    log('F DONE', out.instrumentHealth.zeroInputSanity);
    // v6.30 (110, Сол, П4): balanced interleaved — 100 rounds × 9 delays, rotation per round
    const dOffsets = [...DELAY_POINTS_MS];
    for (let round = 0; round < REPS_PER_DELAY; round++) {
      for (let j = 0; j < dOffsets.length; j++) {
        const dIdx = (j + round) % dOffsets.length;
        RUN_ORDER.push({ globalRowIndex: RUN_ORDER.length + 1, delayIndex: dIdx,
                         requestedStartDelayMs: DELAY_POINTS_MS[dIdx],
                         requestedStartDelaySamples: Math.round(DELAY_POINTS_MS[dIdx] * SR / 1000),
                         chunkId: Math.floor(RUN_ORDER.length / CHUNK_ROWS), rowIndex: RUN_ORDER.length % CHUNK_ROWS });
      }
    }
    out.metadata.runOrder = RUN_ORDER;
    out.metadata.experimentName = EXPERIMENT_NAME;
    out.metadata.experimentId = EXPERIMENT_ID;   // v6.30.2 (Сол 112)
    out.metadata.chunkSize = CHUNK_ROWS;
    out.metadata.delayPointsMs = DELAY_POINTS_MS;
    out.metadata.phaseOffset = PHASE_OFFSET;
    out.metadata.binSize = PROFILE_BIN_SIZE;
    // v6.30 (110, Сол, П10): 9 chunks по 100 rows + checkpoint Blob download per chunk
    for (let c = 0; c < CHUNKS; c++) {
      const chunkRows = RUN_ORDER.slice(c * CHUNK_ROWS, (c + 1) * CHUNK_ROWS);
      for (const { requestedStartDelayMs, delayIndex, globalRowIndex, chunkId, rowIndex } of chunkRows) {
        await runVendorRow(requestedStartDelayMs, delayIndex, globalRowIndex);
        if ((globalRowIndex % 10) === 0) await sleep(0);   // не блокировать event loop (N8)
      }
      // checkpoint: отдельный JSON per chunk
      // v6.32.2 (097, Сол_2): checkpoint = ТОЛЬКО rows текущего чанка (по корректному chunkId после фикса ШАГ 2)
      const chunkOut = {
        ...out,
        chunkId: c,
        chunkDone: true,
        rawObservations: {
          vendorRows: out.rawObservations.vendorRows.filter(r => r.chunkId === c)
        },
      };
      const blob = new Blob([JSON.stringify(chunkOut)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'impulse-v6.32.3-audit-r2-' + CLICK_LEN_LABEL + '-chunk' + c + '-' + TRACK_ID + '-' + Date.now() + '.json';
      a.click();
      log('CHUNK ' + c + ' DONE', { rows: chunkOut.rawObservations.vendorRows.length });
    }
    finalize();
    log('SUMMARY', out.summary);
    log('VERDICT', { gate3BLocal: out.verdict.gate3BLocal, harness: out.verdict.harness, timing: out.verdict.timing, gate4a: out.verdict.gate4a });
    const blob = new Blob([JSON.stringify(out)], { type: 'application/json' }); // N4: компактный JSON (БЕЗ null, 2)
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'impulse-v6.32.3-audit-r2-' + CLICK_LEN_LABEL + '-' + TRACK_ID + '-' + Date.now() + '.json';
    a.click();
    log('JSON DOWNLOADED', 'impulse-v6.32.3-audit-r2-' + CLICK_LEN_LABEL + '-' + TRACK_ID + '-' + Date.now() + '.json');
    window.__impulseResultV6323R2 = out;
  } catch (e) {
    out.stage = 'error';
    out.errors.push('main: ' + String(e?.stack || e?.message || e));
    window.__impulseResultV6323R2 = out;
    log('ERROR', 'E_MAIN');
    console.error('[v6.32.3-audit-r2]', e);
  }
})();
