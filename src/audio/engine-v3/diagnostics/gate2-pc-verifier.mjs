// ============================================================
// gate2-pc-verifier.mjs — node verifier for Gate 2 PC runner JSON.
// Reads per-run JSON packets (one JSON object per line, or a single JSON
// document containing { runs: [...] }). Applies acceptance per contract:
//   PC-0  : 0 dropout (totalDropouts===0), byStem all 0, underrunFree
//   PC-1..4 : each single injection -> delta==1 (exactly +1, NOT +K);
//             K never mixed (no extra increments during recovery)
//   PC-5  : exactly 3 distinct increments, min gap >= 2 x expectedInterval
// Emits {PASS | FAIL | HOLD} + confidence. Does NOT need a browser.
// ============================================================
import { readFileSync } from 'node:fs';

const EXPECTED_MIN_GAP_FACTOR = 2; // PC-5: min gap between increments >= 2 x expectedInterval

function parseInput() {
  const fileArg = process.argv[2];
  let raw;
  if (fileArg && fileArg !== '-') {
    raw = readFileSync(fileArg, 'utf8');
  } else {
    raw = readFileSync(0, 'utf8'); // stdin
  }
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const docs = [];
  for (const line of lines) {
    try { docs.push(JSON.parse(line)); } catch { /* skip non-JSON lines */ }
  }
  // flatten: one doc may contain { runs: [] } or be a single run object
  const runs = [];
  for (const d of docs) {
    if (Array.isArray(d?.runs)) runs.push(...d.runs);
    else if (d && typeof d === 'object') runs.push(d);
  }
  return runs;
}

function verifyRun(run) {
  const reasons = [];
  const pc = run?.pc ?? 'UNKNOWN';
  const expectedIntervalMs = run?.expectedIntervalMs;

  // ---- mandatory evidence guards ----
  if (run?.sampleRate == null) reasons.push('INVALID EVIDENCE: sampleRate missing');
  if (expectedIntervalMs == null) reasons.push('INVALID EVIDENCE: expectedIntervalMs missing');
  if (run == null || typeof run !== 'object') reasons.push('INVALID EVIDENCE: run not an object');
  if (run && (!Array.isArray(run.events) || run.events.length === 0) && pc === 'PC-5') {
    reasons.push('INVALID EVIDENCE: no raw events (only count)');
  }

  let verdict = 'PASS';

  if (pc === 'PC-0') {
    const total = run.totalDropouts ?? -1;
    const byStem = run.byStem || {};
    const allZero = Object.keys(byStem).length === 0 || Object.values(byStem).every(v => v === 0);
    if (total !== 0) { verdict = 'FAIL'; reasons.push('PC-0: totalDropouts=' + total + ' (expected 0)'); }
    if (!allZero) { verdict = 'FAIL'; reasons.push('PC-0: byStem not all zero'); }
    if (run.underrunFree !== true) { verdict = 'FAIL'; reasons.push('PC-0: underrunFree!==true'); }
    if (run.falsePositives !== 0) { verdict = 'FAIL'; reasons.push('PC-0: falsePositives=' + run.falsePositives); }
    if (verdict === 'PASS') reasons.push('PC-0: 0 dropouts, no false positives');
  } else if (/^PC-[1248]$/.test(pc)) {
    const K = run.K;
    const ev = run.events || [];
    const deltas = ev.map(e => e.deltaSinceLastPoll);
    // acceptance: exactly one injection -> exactly one increment with delta==1
    if (run.verdict === 'K_NOT_TRIGGERED') {
      verdict = 'HOLD';
      reasons.push(`PC-${K}: injection did not trigger detector (gap=K x expectedInterval; K=${K})`);
    } else if (ev.length !== 1) {
      verdict = 'FAIL';
      reasons.push(`PC-${K}: expected exactly 1 detector event, got ${ev.length}`);
    } else if (deltas[0] !== 1) {
      verdict = 'FAIL';
      reasons.push(`PC-${K}: deltaSinceLastPoll=${deltas[0]} (expected exactly 1, NOT +K)`);
    } else {
      reasons.push(`PC-${K}: single injection -> delta==1 (not +${K}), K not mixed`);
    }
    if (!Number.isFinite(K)) { verdict = 'FAIL'; reasons.push(`PC-${K}: K missing`); }
  } else if (pc === 'PC-5') {
    const ev = run.events || [];
    const distinct = run.distinctIncrements ?? ev.length;
    if (distinct !== 3) { verdict = 'FAIL'; reasons.push('PC-5: distinctIncrements=' + distinct + ' (expected 3)'); }
    const ts = ev.map(e => e.t);
    if (ts.length >= 2) {
      const gapsMs = ts.slice(1).map((v, i) => (v - ts[i]) * 1000);
      const minGap = Math.min(...gapsMs);
      const minReq = EXPECTED_MIN_GAP_FACTOR * expectedIntervalMs;
      if (minGap < minReq) {
        verdict = 'FAIL';
        reasons.push(`PC-5: min gap between increments=${minGap.toFixed(4)}ms < ${minReq.toFixed(4)}ms (2x expectedInterval)`);
      } else {
        reasons.push(`PC-5: min gap=${minGap.toFixed(4)}ms >= ${minReq.toFixed(4)}ms`);
      }
    } else if (distinct === 3) {
      reasons.push('PC-5: gaps not computable (events present)');
    }
    if (ev.length === 0) reasons.push('INVALID EVIDENCE: no raw events');
  } else {
    verdict = 'FAIL';
    reasons.push('UNKNOWN pc=' + pc);
  }

  return { pc, K: run?.K ?? null, runIndex: run?.runIndex ?? null, verdict, reasons };
}

function main() {
  const runs = parseInput();
  if (runs.length === 0) {
    console.log(JSON.stringify({ status: 'HOLD', confidence: 0, reason: 'no runs parsed' }, null, 2));
    return;
  }
  const results = runs.map(verifyRun);
  const statuses = results.map(r => r.verdict);
  const failCount = statuses.filter(s => s === 'FAIL').length;
  const holdCount = statuses.filter(s => s === 'HOLD').length;
  const passCount = statuses.filter(s => s === 'PASS').length;
  const status = failCount > 0 ? 'FAIL' : (holdCount > 0 ? 'HOLD' : 'PASS');
  // confidence = share of PASS over non-HOLD runs (HOLD reduces confidence)
  const decisive = results.filter(r => r.verdict !== 'HOLD').length;
  const confidence = decisive ? Number((passCount / decisive).toFixed(3)) : 0;

  const summary = { status, confidence, runs: results.length, passCount, failCount, holdCount };
  console.log(JSON.stringify({ status, confidence, summary, details: results }, null, 2));
}

main();