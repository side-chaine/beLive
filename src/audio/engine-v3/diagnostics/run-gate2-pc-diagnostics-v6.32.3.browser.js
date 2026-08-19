// ============================================================
// run-gate2-pc-diagnostics-v6.32.3.browser.js
// Gate 2 PC runner — PC-0..PC-5 dropout detector test harness.
// DO NOT import into production. Standalone console script.
//
// Browser variant: HTTP import of vendor; mechanism identical.
//
// Mechanism: vendor SignalsmithStretch.mjs increments _instr.dropoutCount
// when gap = (currentTime - _lastProcessTime) > expectedInterval*1.5, where
// expectedInterval = blockSamples / sampleRate (L346-355). We drive the REAL
// vendor process() path via a virtual per-instance audio clock: the global
// AudioWorkletScope ambient scalar (currentTime) is set immediately before each
// process() call, so an injection bumps ONLY the target stem's clock -> a
// controlled underrun emulation (NOT DSP, NOT a dropoutCount write). Each
// injection (gap = K*expectedInterval) yields exactly +1 dropoutCount (vendor
// does ++ once per gapped process call).
//
// Node-headless capability: vendor wasmReady=false guard returns zeros AFTER
// the dropout-detection block runs, so the real detection path is exercised on
// the captured WasmProcessor class without a browser AudioContext graph.
//
// MAND 202: no vendor/frozen/r2/r3 edits, no dropoutCount substitution, no DSP
// zeros injection (time-gap only), fresh local pool per run.
// ============================================================
;(async () => {
  'use strict';

  // ---------- METADATA (r3-style header) ----------
  const SCRIPT_VERSION = 'v6.32.3-pc';
  const HARNESS_REVISION = 'v6.32.3-pc';
  const SOURCE_PATH = 'src/audio/engine-v3/diagnostics/run-gate2-pc-diagnostics-v6.32.3.browser.js';
  const SHA256 = null; // external manifest (007)
  const SEED = 2020807; // deterministic seed (SPEC contract)
  const IS_NODE = typeof process === 'object' &&
    typeof process.versions === 'object' &&
    typeof process.versions.node === 'string';
  const log = (...x) => { if (IS_NODE) console.error('[v6.32.3-pc]', ...x); else console.log('[v6.32.3-pc]', ...x); };

  // ---------- OUTPUT ----------
  const out = {
    metadata: {
      scriptVersion: SCRIPT_VERSION,
      harnessRevision: HARNESS_REVISION,
      harnessSha256: SHA256,
      sourcePath: SOURCE_PATH,
      seed: SEED,
      mode: 'browser',
      timestamp: new Date().toISOString(),
      node: null,
      userAgent: (() => { try { return navigator.userAgent; } catch { return null; } })(),
      protocol: 'Gate 2 PC-0..PC-5 temporal-gap emulation on REAL vendor process() dropout detector; sampleRate + expectedIntervalMs per run',
      specLoaded: false,
    },
    runs: [],
    errors: [],
    stage: 'running',
  };

  // ---------- DEFAULT SPEC (override via env PC_SPEC = path to SPEC.json) ----------
  const DEFAULT_SPEC = {
    sampleRate: 44100,
    blockSamples: 128,
    pc0: { reps: 5, durationS: 4.5 },
    pc1_4: { ks: [1, 2, 4, 8], repsPerK: 10 },
    pc5: { k: 4, injections: 3, separateByFactorX: 8, reps: 1 },
    seed: SEED,
    stems: ['vocals', 'bass', 'drums', 'guitar', 'other', 'keys'],
  };
  let SPEC = JSON.parse(JSON.stringify(DEFAULT_SPEC));
  SPEC.seed = SEED;
  try {
    if (IS_NODE && process?.env?.PC_SPEC) {
      const fsM = await import('node:fs');
      const pM = await import('node:path');
      const specPath = pM.resolve(process.env.PC_SPEC);
      if (fsM.existsSync(specPath)) {
        SPEC = { ...DEFAULT_SPEC, ...JSON.parse(fsM.readFileSync(specPath, 'utf8')), seed: SEED };
        out.metadata.specLoaded = true;
        out.metadata.specSource = specPath;
      }
    }
  } catch (e) {
    out.errors.push('spec: ' + String(e?.message || e));
    out.metadata.specLoaded = false;
  }

  const SR = SPEC.sampleRate;
  const BLOCK = SPEC.blockSamples;
  const expectedInterval = BLOCK / SR;          // seconds
  const expectedIntervalMs = expectedInterval * 1000;
  const STEMS = SPEC.stems;

  // ---------- AUDIO-WORKLET MOCK GLOBALS (must be set BEFORE vendor import) ----------
  let CapturedProcessor = null;
  function ensureWorkletGlobals() {
    if (typeof globalThis.AudioWorkletProcessor === 'undefined') {
      class MockAudioWorkletProcessor {
        constructor() { this.port = { postMessage() {}, onmessage: null }; }
      }
      globalThis.AudioWorkletProcessor = MockAudioWorkletProcessor;
    }
    if (typeof globalThis.registerProcessor === 'undefined') {
      globalThis.registerProcessor = (_name, cls) => { CapturedProcessor = cls; };
    }
    if (typeof globalThis.sampleRate === 'undefined') globalThis.sampleRate = SR;
    if (typeof globalThis.currentFrame === 'undefined') globalThis.currentFrame = 0;
    if (typeof globalThis.currentTime === 'undefined') globalThis.currentTime = 0;
  }

  // ---------- VENDOR IMPORT ----------
  // Browser: vendor is fetched over HTTP via dynamic import() from candidate
  // paths. The vendor exposes registerProcessor(...) so the module registers the
  // worklet class (captured into CapturedProcessor) even in-browser.
  let Processor = null;
  async function importVendor() {
    if (Processor) return Processor;
    ensureWorkletGlobals();              // mocks BEFORE dynamic import
    if (!IS_NODE) {
      const candidates = [
        '/src/audio/engine-v3/vendor/SignalsmithStretch.mjs',
        '/beLive/src/audio/engine-v3/vendor/SignalsmithStretch.mjs',
        new URL('/src/audio/engine-v3/vendor/SignalsmithStretch.mjs', location.origin).href,
      ];
      const tried = [];
      for (const cand of candidates) {
        tried.push(cand);
        try {
          const mod = await import(/* webpackIgnore */ cand);
          if (CapturedProcessor) { Processor = CapturedProcessor; break; }
        } catch (e) {
          out.errors.push('vendor import ' + cand + ': ' + String(e?.message || e));
        }
      }
      if (!Processor) {
        out.errors.push('vendor HTTP import failed; tried ' + tried.concat(['<use node branch>']).join(' | '));
        throw new Error('vendor WasmProcessor not registered (need AudioWorkletProcessor+registerProcessor global)');
      }
      return Processor;
    }
    // node branch (unchanged from source runner)
    const url = await import('node:url');
    const fs = await import('node:fs');
    const pM = await import('node:path');
    const candidates = [
      pM.resolve(process.cwd(), 'src/audio/engine-v3/vendor/SignalsmithStretch.mjs'),
      pM.resolve(process.cwd(), 'beLive/src/audio/engine-v3/vendor/SignalsmithStretch.mjs'),
    ];
    for (const cand of candidates) {
      try {
        if (fs.existsSync(cand)) {
          await import(url.pathToFileURL(cand).href);
          if (CapturedProcessor) { Processor = CapturedProcessor; break; }
        }
      } catch (e) { out.errors.push('vendor import ' + cand + ': ' + String(e?.message || e)); }
    }
    if (!Processor) throw new Error('vendor WasmProcessor not registered (need AudioWorkletProcessor+registerProcessor global)');
    return Processor;
  }

  // ---------- METRICS / INSTRUMENTATION ----------
  function procMetrics(proc) {
    const i = proc?._instr || {};
    return {
      dropoutCount: i.dropoutCount ?? 0,
      processCalls: i.processCalls ?? 0,
      _lastProcessTime: i._lastProcessTime ?? 0,
      _expectedInterval: i._expectedInterval ?? 0,
      sampleRate: globalThis.sampleRate ?? null,
    };
  }
  function dropCount(proc) { return procMetrics(proc).dropoutCount; }
  function enableInstrumentation(proc) {
    if ('_instrument' in proc) proc._instrument = true;                  // bare instance
    else if (typeof proc.setInstrumentation === 'function') proc.setInstrumentation(true);
    else { try { proc._instrument = true; } catch {} }
  }

  // ---------- INSTANCE FACTORY (local fresh pool per run) ----------
  function makeInstance(stem) {
    const proc = new Processor({});
    enableInstrumentation(proc);
    return { id: stem, proc, clock: 0, events: [] };
  }

  // One process()-block call at inst.clock advanced by `advance` seconds.
  function stepInstance(inst, advance) {
    const t = inst.clock + advance;
    inst.clock = t;
    globalThis.currentTime = t;                // vendor uses global currentTime for gap
    globalThis.currentFrame = Math.round(t * SR);
    const inputList = [[new Float32Array(BLOCK)]];
    const outputList = [[new Float32Array(BLOCK)]];
    try { inst.proc.process(inputList, outputList, {}); }
    catch (e) { out.errors.push('process: ' + String(e?.message || e)); }
    return t;
  }
  function runClean(inst, n) {
    for (let i = 0; i < n; i++) stepInstance(inst, expectedInterval);
  }
  function poll(inst, prevDrop, seq) {
    const d = dropCount(inst.proc);
    const delta = d - prevDrop;
    if (delta !== 0) {
      inst.events.push({
        t: inst.clock,
        dropoutCount: d,
        deltaSinceLastPoll: delta,
        stem: inst.id,
        seq,
      });
    }
    return d;
  }

  // ---------- PC-0 (baseline, zero injection) ----------
  function runPC0(runIndex) {
    const run = {
      pc: 'PC-0', K: 0, runIndex, seed: SEED,
      sampleRate: SR, expectedIntervalMs, blockSamples: BLOCK,
      durationS: SPEC.pc0.durationS, timestamp: Date.now(), events: [],
    };
    const pool = {};
    for (const s of STEMS) pool[s] = makeInstance(s);
    const totalCalls = Math.max(3, Math.round(SPEC.pc0.durationS / expectedInterval));
    for (const s of STEMS) {
      runClean(pool[s], 1);                    // prime _lastProcessTime (detection skipped)
      runClean(pool[s], totalCalls - 1);     // remaining clean calls (no injection)
    }
    const byStem = {};
    let totalDrop = 0;
    for (const s of STEMS) { const d = dropCount(pool[s].proc); byStem[s] = d; totalDrop += d; }
    run.totalDropouts = totalDrop;
    run.byStem = byStem;
    run.falsePositives = totalDrop;
    run.underrunFree = totalDrop === 0;
    run.verdict = run.underrunFree ? 'PASS' : 'FAIL';
    return run;
  }

  // ---------- PC-1..4 (single injection K x expectedInterval) ----------
  function runKSingle(K, runIndex) {
    const run = {
      pc: 'PC-' + K, K, runIndex, seed: SEED,
      sampleRate: SR, expectedIntervalMs, blockSamples: BLOCK, timestamp: Date.now(),
    };
    const stem = STEMS[0];
    const inst = makeInstance(stem);
    runClean(inst, 2);                        // prime + 1 clean
    const beforeDrop = dropCount(inst.proc);
    run.tInject = stepInstance(inst, K * expectedInterval);   // SINGLE injection
    poll(inst, beforeDrop, 'inject');
    runClean(inst, 2);                        // recovery (gap back to 1x)
    const final = dropCount(inst.proc);
    run.totalDropouts = final;
    run.byStem = { [stem]: final };
    run.events = inst.events;                 // raw detector events (delta==1 per injection)
    run.detected = inst.events.length === 1;
    if (inst.events.length === 1 && inst.events[0].deltaSinceLastPoll === 1) run.verdict = 'PASS';
    else if (inst.events.length === 0) run.verdict = 'K_NOT_TRIGGERED';
    else run.verdict = 'FAIL';
    return run;
  }

  // ---------- PC-5 (3 separated injections K=4) ----------
  function runPC5(runIndex) {
    const K = SPEC.pc5.k;
    const run = {
      pc: 'PC-5', K, runIndex, seed: SEED,
      sampleRate: SR, expectedIntervalMs, blockSamples: BLOCK, timestamp: Date.now(),
    };
    const stem = STEMS[0];
    const inst = makeInstance(stem);
    runClean(inst, 2);
    let prev = dropCount(inst.proc);
    let seqN = 0;
    inst.events = [];
    for (let j = 0; j < SPEC.pc5.injections; j++) {
      stepInstance(inst, K * expectedInterval);               // one injection
      poll(inst, prev, 'pc5-' + j);
      runClean(inst, SPEC.pc5.separateByFactorX);             // separated clean cycles
      prev = dropCount(inst.proc);
    }
    run.totalDropouts = dropCount(inst.proc);
    run.byStem = { [stem]: run.totalDropouts };
    run.events = inst.events.slice();
    run.distinctIncrements = inst.events.length;
    if (inst.events.length >= 2) {
      const ts = inst.events.map(e => e.t);
      run.minIncrementGapMs = Math.min(...ts.slice(1).map((v, i) => (v - ts[i]) * 1000));
    } else run.minIncrementGapMs = null;
    run.timestamps = inst.events.map(e => e.t);
    // Acceptance: injections distinct increments, separated by >= 2 x expectedInterval
    const okCount = inst.events.length === SPEC.pc5.injections;
    const okSep = run.minIncrementGapMs != null && run.minIncrementGapMs >= 2 * expectedIntervalMs;
    run.ver = (okCount && okSep) ? 'PASS' : 'FAIL';
    return run;
  }

  // ---------- MAIN (browser + node-headless) ----------
  // CLI: --pc-run N (0..5) | --smoke (PC-0 x1 + PC-1 K=1 x1 + PC-5 x1) | default full matrix.
  const ARGS = (typeof process !== 'undefined' && process?.argv?.slice(2)) || [];
  const pcRunFlag = (ARGS.find(a => a.startsWith('--pc-run=')) || '').split('=')[1];
  const SMOKE = ARGS.includes('--smoke');
  try {
    Processor = await importVendor();
    log('VENDOR LOADED', { blockSamples: BLOCK, sampleRate: SR, expectedIntervalMs: expectedIntervalMs.toFixed(4) });

    const emit = (run) => { out.runs.push(run); console.log(JSON.stringify(run)); };

    if (SMOKE) {
      // minimal synthetic smoke: PC-0 x1, PC-1 K=1 x1, PC-5 x1
      emit(runPC0(1));
      emit(runKSingle(1, 1));
      emit(runPC5(1));
    } else if (pcRunFlag !== undefined && pcRunFlag !== '') {
      const n = Number(pcRunFlag);
      if (n === 0) { for (let r = 1; r <= SPEC.pc0.reps; r++) emit(runPC0(r)); }
      else if (n >= 1 && n <= 4) {
        const K = n;
        for (let rep = 1; rep <= SPEC.pc1_4.repsPerK; rep++) emit(runKSingle(K, rep));
      } else if (n === 5) { for (let r = 1; r <= SPEC.pc5.reps; r++) emit(runPC5(r)); }
      else throw new Error('--pc-run must be 0..5, got ' + n);
    } else {
      for (let r = 1; r <= SPEC.pc0.reps; r++) emit(runPC0(r));
      for (const K of SPEC.pc1_4.ks) {
        for (let rep = 1; rep <= SPEC.pc1_4.repsPerK; rep++) emit(runKSingle(K, rep));
        log('PC-' + K + ' done', { reps: SPEC.pc1_4.repsPerK });
      }
      for (let r = 1; r <= SPEC.pc5.reps; r++) emit(runPC5(r));
    }
    out.stage = 'done';
  } catch (e) {
    out.stage = 'error';
    out.errors.push('main: ' + String(e?.stack || e?.message || e));
    console.log(JSON.stringify(out));
  }
})();