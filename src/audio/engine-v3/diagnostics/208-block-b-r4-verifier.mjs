// ============================================================
// 208-BLOCK-B-R4-VERIFIER.mjs — Condition B (reuse lifecycle) row verifier
// MAND 208 §1.10: rejects rows without drain marker, with lifecycle
// mismatch, or mixed conditions. Static + raw-record validation.
// Reads per-run JSON packets (one JSON per line, or { runs: [...] })
// OR a synthetic single row packet for unit-testing lifecycle rules.
// ============================================================
import { readFileSync } from 'node:fs';

function parseInput() {
  const fileArg = process.argv[2];
  let raw;
  if (fileArg && fileArg !== '-') raw = readFileSync(fileArg, 'utf8');
  else raw = readFileSync(0, 'utf8');
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const docs = [];
  for (const line of lines) { try { docs.push(JSON.parse(line)); } catch {} }
  const rows = [];
  for (const d of docs) {
    if (Array.isArray(d?.rawObservations?.vendorRows)) rows.push(...d.rawObservations.vendorRows);
    else if (Array.isArray(d?.runs)) rows.push(...d.runs);
    else if (d && typeof d === 'object' && ('raw_observations' in d || 'completion' in d)) rows.push(d);
  }
  return rows;
}

function verifyRow(row) {
  const reasons = [];
  const lc = row?.raw_observations;
  const id = (lc?.conditionId ?? row?.metadata?.conditionId ?? '?') + '/' + (lc?.poolState ?? '?');
  let status = 'PASS';

  // 1) condition/pool attribution mandatory
  if (!lc?.conditionId) { status = 'FAIL'; reasons.push('missing conditionId'); }
  if (row?.raw_observations?.poolState !== 'reused') {
    status = 'FAIL'; reasons.push('expected poolState=reused, got ' + String(row?.raw_observations?.poolState));
  }
  if (lc?.conditionId && lc?.conditionId !== 'B') {
    status = 'FAIL'; reasons.push('mixed condition: expected B, got ' + lc.conditionId);
  }

  // 2) drain marker MUST be present and drained for VALID rows
  const drain = row.raw_observations?.drainMarker;
  if (!drain || drain.present !== true) {
    status = 'FAIL'; reasons.push('missing drain marker');
  } else if (row.verdict?.rowValidity !== 'INVALID') {
    // a VALID row must prove zero-residual drain
    if (drain.drained !== true) { status = 'FAIL'; reasons.push('drain marker drained=false on VALID row'); }
    if (drain.residualPeak >= 1e-6) { status = 'FAIL'; reasons.push('cross-row residual peak ' + drain.residualPeak); }
    if ((drain.residualEnergy ?? 0) >= 1e-9) { status = 'FAIL'; reasons.push('residual energy not drained'); }
    if (drain.stopOk !== true) { status = 'FAIL'; reasons.push('stop boundary not observed'); }
  }
  // If row declared INVALID due to undrained, that's an explicit lifecycle fail (acceptable but counted)
  if (row.verdict?.rowValidity === 'INVALID' && (row.verdict?.invalidReasons || []).includes('drain_marker_undrained')) {
    status = 'FAIL'; reasons.push('lifecycle mismatch: row drained=false (drain_marker_undrained)');
  }

  // 3) lifecycle evidence (reuse path) — must NOT be single flag
  const life = row.raw_observations?.r4Lifecycle;
  if (!life || life.condition !== 'B') { status = 'FAIL'; reasons.push('r4Lifecycle missing or not B'); }
  else if (life.poolState !== 'reused') { status = 'FAIL'; reasons.push('r4Lifecycle poolState not reused'); }

  // 4) bounded evidence to prevent over-run (block/interval/latency)
  const blk = lc?.blockSamples ?? row.raw_observations?.blockSamples;
  if (blk == null || !Number.isFinite(Number(blk))) { status = 'FAIL'; reasons.push('blockSamples missing'); }
  if (row.raw_observations?.actualContextSampleRate == null) { status = 'FAIL'; reasons.push('actualContextSampleRate missing'); }

  // 5) vacuous-drain rejection (NEW): drained=true with no capture output is NOT a valid drain
  const writeIdx = row.raw_observations?.writeIndex ?? row.raw_observations?.captureRequestedLength ?? 0;
  const procCnt = row.raw_observations?.health?.vendorProcessCount?.value
                  ?? row.raw_observations?.r4Lifecycle?.rowDoneMs; // fallback — not used as proof
  const isManualInvalid = row.verdict?.rowValidity === 'INVALID';
  if (!isManualInvalid && row.raw_observations?.drainMarker?.drained === true) {
    if (Number(writeIdx) === 0 || Number(procCnt) === 0) {
      status = 'FAIL'; reasons.push('vacuous_drain:writeIndex=0');
    }
  }

  // 6) process-no-output detection (NEW): SOL §3.6 correlation capture_no_samples with no signal
  const invReasons = row.verdict?.invalidReasons || [];
  if (!isManualInvalid && (Number(writeIdx) === 0 || invReasons.includes('capture_no_samples'))) {
    status = 'FAIL'; reasons.push('process_no_output:writeIndex=0');
  }

  return { key: row.raw_observations?.conditionId + '#' + (row.globalRowIndex ?? row.runIndex ?? '?'), status, reasons, drainPresent: !!row.raw_observations?.drainMarker };
}

function main() {
  const rows = parseInput();
  if (!rows.length) { console.log(JSON.stringify({ status: 'HOLD', confidence: 0, reason: 'no rows parsed' }, null, 2)); return; }
  const results = rows.map(verifyRow);

  // NEW: top-level duplicate-row rejection — same globalRowIndex key used more than once
  const keyCounts = new Map();
  for (const r of rows) {
    const k = r.globalRowIndex ?? r.runIndex ?? '?';
    keyCounts.set(k, (keyCounts.get(k) || 0) + 1);
  }
  const duplicateKeys = [...keyCounts.entries()].filter(([, c]) => c > 1).map(([k]) => k);
  rows.forEach((r, i) => {
    const k = r.globalRowIndex ?? r.runIndex ?? '?';
    if (keyCounts.get(k) > 1) {
      results[i].status = 'FAIL';
      results[i].reasons.push('duplicate_row:' + k);
    }
  });

  const fail = results.filter(r => r.status === 'FAIL').length;
  const pass = results.filter(r => r.status === 'PASS').length;
  const status = fail ? 'FAIL' : 'PASS';
  const confidence = rows.length ? Number((pass / rows.length).toFixed(3)) : 0;
  const missingDrain = results.filter(r => r.drainPresent !== true).length;
  const summary = { status, confidence, rows: rows.length, pass, fail, missingDrainMarker: missingDrain, duplicates: duplicateKeys.length };
  console.log(JSON.stringify({ status, confidence, summary, details: results }, null, 2));
}

main();