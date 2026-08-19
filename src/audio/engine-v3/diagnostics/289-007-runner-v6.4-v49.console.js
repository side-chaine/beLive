;(async () => {
  // ============================================================
  // v6.4-v49 evidence harness (Amendment B V49) — runnable console script (Chrome)
  // Per 098-FINAL-ROADMAP-v3 Stage A (A1-A7) + SOL_2 spec.
  // One track per run. Exports compact JSON. No seekTrace/quantumTrace.
  // ============================================================

  // ---------- METADATA (edit before run) ----------
  const SCRIPT_VERSION = 'v6.4-v49';
  const HARNESS_REVISION = 'v6.4-v49';                    // frozen revision (Sol_2 cond.1)
  const HARNESS_SHA256 = null; // SOL_2 п.1: SHA не пишем в JSON (self-reference запрещён); заполняется только во внешнем manifest (П8)
  const SOURCE_PATH = 'src/audio/engine-v3/diagnostics/run-impulse-diagnostics-v64-v49.console.js';
  const STIMULUS_SOURCE = 'synthetic_generated_click';      // Sol_2 cond.6
  const SELECTED_TRACK_AFFECTS_STIMULUS = false;            // trackId = env label, not PCM source
  const TRACK_PCM_ACTUALLY_USED = false;                    // no real PCM fed to vendor
  const TRACK_ID = '1783177933713'; // pre-registered fixed track
  const BRANCH = '067-e-regime-0';  // operator: confirm
  const COMMIT = null;              // operator: fill git sha or leave null
  const DEVICE_LABEL = 'MBP 2013 2-core'; // operator: confirm
  const SR = 44100;
  const BLOCK_MS = 40;
  const INTERVAL_MS = 20;
  const CLICK_LEN = 44;
  const REPS = 5;
  const ACCEPTANCE_OFFSETS = [128, 256, 4410]; // pre-registered, fixed
  const DIAGNOSTIC_OFFSETS = [0, 64];          // diagnostics only
  const DITHER_OFFSETS = [44, 100, 172, 210];  // NEW: dither (V49)
  const PROBE_OFFSETS = [880, 884, 1762, 1766, 2644, 2648]; // NEW: probes (V49)
  const DITHER_REPS = 4;   // NEW
  const PROBE_REPS = 1;    // NEW
  const SPLIT_COMPUTATION = true;              // current production config, do not change
  const CHANNEL_POLICY = 'mono-sum';           // capture policy
  const CAPTURE_NAME = 'belive-capture-processor-v64';
  const CAPTURE_SIZE = SR * 4;                 // 4 seconds
  const RPC_TIMEOUT_MS = 4000;
  const ROW_DEADLINE_MS = 20000;
  const TRACE_FAILS = false;                   // opt-in per-FAIL trace, off by default

  // ---------- OUTPUT ----------
  const out = {
    metadata: {
      scriptVersion: SCRIPT_VERSION,
      harnessRevision: HARNESS_REVISION,
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
      protocol: 'gate3b.amendment-b.v2 / V49', // 291 STOP-2: canonical protocol identity (291-007-IDENTITY-RULE §2)
      baseProtocol: 'v6.26.1 frozen (MICRO-PACK-086) per 098-FINAL-ROADMAP-v3 + SOL_2 cond.1-9; K independent direct path; timing INFORMATIONAL; state machine INVALID->BLOCKED->CONDITIONAL->PASS (timing UNRESOLVED blocks PASS); Gate4a NOT_RUN; stimulus synthetic only; v6.27 observability revision per SOL_2 (101-verdict): external SHA manifest, allowlist metrics, absolute-frame envelope, start coordinates approximate', // lineage only (291 §2)
      v49Inventory: 49,
      ditherOffsets: DITHER_OFFSETS,
      probeOffsets: PROBE_OFFSETS,
      amendmentBPreregSha: '2178441a44db1b62d2e7138db0bf7db75057e6f5cfddea6871953630310017a2', // 291 STOP-1: exact signed prereg (286-007-PREREG-AMENDMENT-B-V2.md)
      fileApiSelfCheck: { status: 'PENDING' }
    },
    instrumentHealth: { trueK: [], zeroInputSanity: null },
    rawObservations: { vendorRows: [] },
    verdict: { harness: '', gate3BLocal: '', timing: '', gate4a: '', reasons: [] },
    summary: {},
    stage: 'running',
    errors: []
  };
  window.__impulseResultV64V49 = out;

  const log = (...x) => console.log('[v626]', ...x);
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
        this.port.onmessage = e => {
          const [id, method, ...a] = e.data || [];
          if (method === 'ping') this.port.postMessage([id, 'pong']);
          else if (method === 'clear') {
            this.b.fill(0); this.w = 0; this.n = 0; this.max = 0; this.energy = 0;
            this.nzQ = 0; this.firstFrame = -1; this.lastFrame = -1; this.total = 0; this.wraps = 0; this.q = {}; this.env = [];
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
        // v6.27.1-fix (301-SOL_8-DECISION, quantumStartFrame): currentFrame = глобальная переменная
        // AudioWorkletGlobalScope, реальный absolute frame начала кванта (SOL_2 Т.2).
        // Мандат 301: минимальный фикс одной строки, без расширений диагностики.
        if (!this.env) this.env = [];
        if (this.env.length < 64) {
          let s = 0, mx = 0, nz = 0;
          for (let i = 0; i < len; i++) { const v = ch[i]; s += v * v; if (Math.abs(v) > mx) mx = Math.abs(v); if (v !== 0) nz++; }
          this.env.push({
            quantumStartFrame: currentFrame,
            sampleCount: len, sumSq: s, maxAbs: mx, nonZeroSampleCount: nz
          });
        }
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
  function readHealth(ctx, cap, vendor) {
    return {
      contextState: ctx?.state || null,
      captureProcessCount: cap?.statsRec?.processCount ?? null,
      captureWriteCount: cap?.statsRec?.writeIndex ?? null,
      captureTotalSamplesWritten: cap?.statsRec?.totalSamplesWritten ?? null,
      captureWrapCount: cap?.statsRec?.wrapCount ?? null,
      vendorProcessCount: vendor?.insRec?.processCount ?? null
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
  function buildRow({ kind, offset, rep, ctx, cap, vendor, rpcRecs, stats, ins, captured, srcStartFrame, deadlineHit }) {
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

    const captureEmpty = written === 0 || stats?.processCount === 0;
    const contextBad = ctx?.state !== 'running';

    // ---- Verdict (A7 priority) ----
    const invalidReasons = [];
    if (rpcBad) invalidReasons.push('rpc_unhealthy:' + rpcBadKeys.join(','));
    if (captureEmpty) invalidReasons.push('capture_no_samples');
    if (contextBad) invalidReasons.push('context_not_running');
    if (deadlineHit) invalidReasons.push('row_deadline');

    // Normalization: energyRatioToK computed later (after K known). Placeholder here.
    const rowValidity = invalidReasons.length ? 'INVALID' : 'VALID';

    const row = {
      kind, offset, rep,
      raw_observations: {
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
        rpc: rpcRecs,
        health: readHealth(ctx, cap, vendor)
      },
      computed_metrics: kind === 'vendor' ? {
        energyRatioToK: null,      // filled in finalize()
        peakEnergyRatio: energy > 0 ? peak / Math.sqrt(energy) : null,
        truncated: last >= 0 && written > 0 && last >= written - 128
      } : undefined,
      verdict: {
        rowValidity,
        invalidReasons,
        transientClass: null,      // filled in finalize()
        timingStatus: 'INFORMATIONAL',
        gateContribution: 'EXCLUDED'
      }
    };
    // v6.26.1 (MICRO-PACK-086): readWindow redaction — полный Float32Array раздувал JSON до 55MB.
    // В rpc-рекорде остаются только метаданные; сам массив использован выше для peak/energy.
    if (rpcRecs?.readWindow?.result instanceof Float32Array) {
      rpcRecs.readWindow.result = { redacted: true, length: rpcRecs.readWindow.result.length };
    }
    if (kind === 'vendor') {
      out.rawObservations.vendorRows.push(row);
    } else if (kind === 'K') {
      out.instrumentHealth.trueK.push(row);
    }
    return row;
  }

  // ---------- TRUE K (A1) — independent direct path, NO Signalsmith ----------
  async function runTrueK(offset) {
    const ctx = new AudioContext({ sampleRate: SR });
    if (ctx.state === 'suspended') await ctx.resume();
    const url = URL.createObjectURL(new Blob([captureCode], { type: 'text/javascript' }));
    try { await ctx.audioWorklet.addModule(url); } finally { URL.revokeObjectURL(url); }
    const cap = new AudioWorkletNode(ctx, CAPTURE_NAME, { numberOfInputs: 1, numberOfOutputs: 1, processorOptions: { bufferSize: CAPTURE_SIZE } });
    cap.port.start?.();
    const gain = ctx.createGain(); gain.gain.value = 1e-6;
    const src = ctx.createBufferSource();
    const clickBuf = makeClick(offset);
    const ab = ctx.createBuffer(1, clickBuf.length, SR);
    ab.copyToChannel(clickBuf, 0);
    src.buffer = ab;
    src.connect(cap); cap.connect(gain); gain.connect(ctx.destination);
    await sleep(150);

    const rpcRecs = {};
    const ping = await rpc(cap, 'ping'); rpcRecs.ping = ping; ping.shapeValid = shapeValid('ping', ping.result);
    const cleared = await rpc(cap, 'clear'); rpcRecs.clear = cleared; cleared.shapeValid = shapeValid('clear', cleared.result);
    const srcStartFrame = Math.round((ctx.currentTime + 0.02) * SR);
    src.start(0);
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
    await ctx.close();
    return row;
  }

  // ---------- VENDOR ROW ----------
  async function runVendorRow(offset, rep) {
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
      const add = await rpc(node, 'addBuffers', [[makeClick(offset)]]); rpcRecs.addBuffers = add; add.shapeValid = shapeValid('addBuffers', add.result);
      const cleared = await rpc(cap, 'clear'); rpcRecs.clear = cleared; cleared.shapeValid = shapeValid('clear', cleared.result);
      // v6.27 (SOL_2 п.5): start coordinates, approximate=true (main-thread clock, NOT for PASS/FAIL)
      const tStartCmd = performance.now();
      const startCommandSentContextFrame = Math.round(ctx.currentTime * SR);   // approximate
      const started = await rpc(node, 'start', [{ input: 0, rate: 1, active: true }]); rpcRecs.start = started; started.shapeValid = shapeValid('start', started.result);
      const waitMs = Math.ceil((latency || 0.06) * 1000) + 400;
      await sleep(waitMs);
      const statsRec = await rpc(cap, 'stats'); rpcRecs.stats = statsRec; statsRec.shapeValid = shapeValid('stats', statsRec.result);
      const stats = statsRec.result || {};
      const insRec = await rpc(node, 'getInstrumentMetrics', []); rpcRecs.getInstrumentMetrics = insRec; insRec.shapeValid = shapeValid('getInstrumentMetrics', insRec.result);
      // v6.27 (MICRO-PACK-087 REV-3, SOL_2 п.3): EXPLICIT ALLOWLIST скалярных полей.
      // seekTrace/quantumTrace НЕ должны попадать в JSON ДАЖЕ ВРЕМЕННО (прогон v6.26.2 = 5MB).
      const ins = allowlistInstrumentMetrics(insRec.result || {});
      const envRec = await rpc(cap, 'envelope', []); rpcRecs.envelope = envRec;
      envRec.shapeValid = !!envRec.result?.env;
      const written = Number(stats.writeIndex || 0);
      const readRec = await rpc(cap, 'readWindow', [0, written]); rpcRecs.readWindow = readRec; readRec.shapeValid = shapeValid('readWindow', readRec.result);
      cap.statsRec = stats; cap.statsRec.processCount = stats.processCount;
      return buildRow({
        kind: 'vendor', offset, rep,
        ctx, cap, vendor: node,
        rpcRecs, stats, ins,
        captured: readRec.result,
        srcStartFrame: null,
        deadlineHit
      });
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
    const kValid = kRows.filter(r => r.verdict.rowValidity === 'VALID');
    const kOffsetsOk = [0, 4410].every(o => kValid.some(r => r.offset === o));
    const kRefEnergyArr = kValid.filter(r => r.offset === 0).map(r => r.raw_observations.energySumSq).filter(e => Number.isFinite(e) && e > 0);
    const kRefEnergy = kRefEnergyArr.length ? kRefEnergyArr.reduce((a, b) => a + b, 0) / kRefEnergyArr.length : null;
    const controlPass = kOffsetsOk && kRefEnergy != null && kValid.every(r => {
      const e = r.raw_observations.energySumSq;
      const ratio = kRefEnergy > 0 ? e / kRefEnergy : 0;
      return ratio >= 0.8 && ratio <= 1.2 && r.raw_observations.peakAbs >= 0.9;
    });
    out.verdict.instrumentHealth = controlPass ? 'PASS' : 'FAIL';
    out.verdict.reasons.push('trueK_offsets_present=' + (kOffsetsOk ? 'yes' : 'no') + ', kRefEnergy=' + (kRefEnergy != null ? kRefEnergy.toFixed(2) : 'null'));

    // Fill energyRatioToK + transientClass
    for (const r of vendorRows) {
      const e = r.raw_observations.energySumSq;
      const nzQ = r.raw_observations.nonZeroQuantumCount;
      const peakER = r.computed_metrics.peakEnergyRatio;
      const truncated = r.computed_metrics.truncated;
      const ratioToK = kRefEnergy != null && kRefEnergy > 0 ? e / kRefEnergy : null;
      r.computed_metrics.energyRatioToK = ratioToK != null ? Number(ratioToK.toFixed(4)) : null;

      if (r.verdict.rowValidity === 'INVALID') {
        r.verdict.transientClass = 'invalid_harness_row';
        r.verdict.gateContribution = 'EXCLUDED';
      } else if (ratioToK != null && (ratioToK < 0.5 || nzQ < 3)) {
        r.verdict.transientClass = 'energy_collapse';
        r.verdict.gateContribution = 'EXCLUDED';
      } else if (truncated) {
        r.verdict.transientClass = 'truncated_response';
        r.verdict.gateContribution = 'EXCLUDED';
      } else if (ratioToK != null && (ratioToK < 0.7 || ratioToK > 1.3 || peakER < 0.08 || peakER > 0.377 || nzQ < 3)) {
        r.verdict.transientClass = 'form_mismatch';
        r.verdict.gateContribution = 'EXCLUDED';
      } else {
        r.verdict.transientClass = 'healthy';
        r.verdict.gateContribution = 'INCLUDED';
      }
    }

    // Acceptance: only VALID healthy rows on ACCEPTANCE_OFFSETS
    const acceptanceRows = vendorRows.filter(r => ACCEPTANCE_OFFSETS.includes(r.offset));
    const expectedAcceptanceRows = ACCEPTANCE_OFFSETS.length * REPS; // 15
    const presentAcceptanceRows = acceptanceRows.length;
    const validAcceptanceRows = acceptanceRows.filter(r => r.verdict.rowValidity === 'VALID').length;
    const invalidRows = vendorRows.filter(r => r.verdict.rowValidity === 'INVALID').length;
    const energyCollapseRows = acceptanceRows.filter(r => r.verdict.transientClass === 'energy_collapse').length;
    const formPassRows = acceptanceRows.filter(r => r.verdict.transientClass === 'healthy').length;

    const byOffset = {};
    for (const o of [...DIAGNOSTIC_OFFSETS, ...ACCEPTANCE_OFFSETS, ...DITHER_OFFSETS, ...PROBE_OFFSETS]) {
      const rs = vendorRows.filter(r => r.offset === o);
      byOffset[o] = {
        rows: rs.length,
        pass: rs.filter(r => r.verdict.transientClass === 'healthy').length,
        collapse: rs.filter(r => r.verdict.transientClass === 'energy_collapse').length,
        invalid: rs.filter(r => r.verdict.rowValidity === 'INVALID').length,
        formMismatch: rs.filter(r => r.verdict.transientClass === 'form_mismatch').length
      };
    }

    out.summary = {
      expectedAcceptanceRows,
      presentAcceptanceRows,
      validAcceptanceRows,
      invalidRows,
      energyCollapseRows,
      formPassRows,
      byOffset
    };

    // Gate 3B-local (A7): state machine INVALID EVIDENCE -> BLOCKED -> CONDITIONAL -> PASS
    // Sol_2 cond.4: полный PASS структурно невозможен при timingStatus != 'INDEPENDENTLY_VALIDATED'.
    const kPass = controlPass;
    const allValid = validAcceptanceRows === expectedAcceptanceRows;
    const noCollapse = energyCollapseRows === 0;
    const allFormOk = formPassRows === expectedAcceptanceRows;
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
    } else if (out.verdict.timing !== 'INDEPENDENTLY_VALIDATED') {
      // energy/form clean, timing reference unresolved -> CONDITIONAL (never full PASS)
      out.verdict.gate3BLocal = 'CONDITIONAL';
      out.verdict.timing = 'UNRESOLVED';
      out.verdict.reasons.push('energy/form clean; timing contract not independently established -> CONDITIONAL');
    } else {
      // unreachable in v6.26.1 (no independent timing reference implemented) — structural only
      out.verdict.gate3BLocal = 'PASS';
    }
    out.verdict.gate4a = 'NOT_RUN';
    out.stage = 'done';
  }

  // ---------- MAIN ----------
  try {
    log('BOOT', { version: SCRIPT_VERSION, trackId: TRACK_ID });
    log('K START');
    const k0 = await runTrueK(0);
    const k4410 = await runTrueK(4410);
    log('K DONE', { offsets: [0, 4410], rows: out.instrumentHealth.trueK.length });
    log('F START');
    await runZeroInputSanity();
    log('F DONE', out.instrumentHealth.zeroInputSanity);
    for (const offset of [...DIAGNOSTIC_OFFSETS, ...ACCEPTANCE_OFFSETS]) {
      log('OFFSET ' + offset + ' START');
      for (let rep = 1; rep <= REPS; rep++) {
        await runVendorRow(offset, rep);
      }
      log('OFFSET ' + offset + ' DONE');
    }
    for (const offset of DITHER_OFFSETS) {
      log('DITHER ' + offset + ' START');
      for (let rep = 1; rep <= DITHER_REPS; rep++) {
        await runVendorRow(offset, rep);
      }
      log('DITHER ' + offset + ' DONE');
    }
    for (const offset of PROBE_OFFSETS) {
      log('PROBE ' + offset + ' START');
      for (let rep = 1; rep <= PROBE_REPS; rep++) {
        await runVendorRow(offset, rep);
      }
      log('PROBE ' + offset + ' DONE');
    }
    finalize();
    log('SUMMARY', out.summary);
    log('VERDICT', { gate3BLocal: out.verdict.gate3BLocal, harness: out.verdict.harness, timing: out.verdict.timing, gate4a: out.verdict.gate4a });
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'impulse-v64-v49-' + TRACK_ID + '-' + Date.now() + '.json';
    a.click();
    log('JSON DOWNLOADED', 'impulse-v64-v49-' + TRACK_ID + '-' + Date.now() + '.json');
    window.__impulseResultV64V49 = out;
  } catch (e) {
    out.stage = 'error';
    out.errors.push('main: ' + String(e?.stack || e?.message || e));
    window.__impulseResultV64V49 = out;
    log('ERROR', 'E_MAIN');
    console.error('[v626]', e);
  }
})();
