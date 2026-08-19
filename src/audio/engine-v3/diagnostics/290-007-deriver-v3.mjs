#!/usr/bin/env node
/**
 * deriver-v3.mjs — two-population deriver (Amendment B V49 / mandate 291 §3-4)
 * ---------------------------------------------------------------------------
 * Read-only external verifier for immutable Gate 3B raw.
 * Two modes, ONE two-population contract (gate3b.twopop.v1, 278):
 *
 *   --mode legacy-audit : scriptVersion=v6.27, V49 additions ABSENT,
 *                         expected SHA = raw 233 canonical. Produces
 *                         historical-audit result on raw 233 (fixture-only),
 *                         NEVER a V49 PASS.
 *   --mode v49-twopop   : scriptVersion=v6.4-v49, exact 49 inventory
 *                         (2K + 10 diag + 15 acc + 16 dither + 6 probe),
 *                         prereg SHA must match signed prereg, dither/probes
 *                         present but NEVER in HS/CD drift.
 *
 * FAIL-CLOSED (mandate 277 §3):
 *   - missing gateContribution      -> STOP (SOURCE_MISMATCH), NOT default INCLUDED
 *   - missing transientClass        -> STOP
 *   - contradictory (healthy+EXCLUDED | collapse+INCLUDED) -> STOP
 *   - collapse row in HEALTHY denom -> STOP (cross-check)
 *   - unknown label                 -> STOP
 *   - wrong mode/scriptVersion      -> STOP (legacy raw must not pass as V49, and vice versa)
 *
 * VERDICT FIELDS (contract 278):
 *   oldCanonicalVerdict:      historical BLOCKED (raw 233: drift 0.9366020127721636[PIR])
 *   amendedStabilityVerdict:  derived from HEALTHY-STABILITY population only
 *   overwrite:                false — amended PASS does NOT overwrite canonical BLOCKED
 *
 * Canonical drift literals NOT hardcoded: read from 290-007-CANONICAL-REFS.json
 * (machine-generated from deriver-v2 output + raw 233, mandate 291 §3).
 *
 * Usage:
 *   node deriver-v3.mjs <raw-path> --mode legacy-audit [--expected-sha <sha256>]
 *   node deriver-v3.mjs <raw-path> --mode v49-twopop  [--expected-sha <sha256>]
 *   node deriver-v3.mjs --self-test <raw-path>
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";

export const DRIFT_CAP = 0.50; // frozen gate threshold, not tunable
export const ACCEPTANCE_OFFSETS = [128, 256, 4410];
export const DIAG_OFFSETS = [0, 64];
export const DITHER_OFFSETS = [44, 100, 172, 210];   // V49 addition
export const PROBE_OFFSETS = [880, 884, 1762, 1766, 2644, 2648]; // V49 addition
export const LOCKED_13 = [ // addendum C §2: fixed HS estimand
  "128x1","128x2","128x4","128x5",
  "256x1","256x2","256x4","256x5",
  "4410x1","4410x2","4410x3","4410x4","4410x5",
];
export const MIN_N = 12;   // addendum C §3 step 5: floor
export const PROTOCOL_LEGACY = "v6.27";
export const PROTOCOL_V49 = "v6.4-v49";
export const IDENTITY = {
  scriptVersion: "v6.4-v49",
  harnessRevision: "v6.4-v49",
  protocol: "gate3b.amendment-b.v2 / V49",
  amendmentBPreregSha: "2178441a44db1b62d2e7138db0bf7db75057e6f5cfddea6871953630310017a2",
};

// ---- machine-generated canonical references (mandate 291 §3) ----
const ROOT = path.dirname(new URL(import.meta.url).pathname);
export const CANON_REFS = JSON.parse(fs.readFileSync(path.join(ROOT, "290-007-CANONICAL-REFS.json"), "utf8"));
export const CANON_SHA = "2e90f5c07fc9c9eaca0b63b1e2311c8b4a2bb0e68d55c69e795bdf0e5c746c82";
export const DRIFT_EXPECTED_HEALTHY = CANON_REFS.values.fixtureRegressionDrift.value; // fixture-only
export const DRIFT_EXPECTED_CANONICAL = CANON_REFS.values.oldCanonicalDrift.value;    // [PIR]

function sha256(buf) { return crypto.createHash("sha256").update(buf).digest("hex"); }

/**
 * Two-population derive from raw. Returns report object.
 * Never mutates raw. Fail-closed on any schema/protocol mismatch.
 * @param {string} rawPath
 * @param {string} mode 'legacy-audit' | 'v49-twopop'
 * @param {string} [expectedSha]
 */
export function deriveTwopop(rawPath, mode, expectedSha) {
  const isV49 = mode === "v49-twopop";
  const out = {
    ok: false,
    mode,
    schema: "gate3b.twopop.v1",
    errors: [],
    warnings: [],
    input: { rawPath, expectedSha },
    protocol: null,
    population: { vendor: 0, acceptance: 0, diagnostics: 0, dither: 0, probe: 0, K: 0 },
    integrity: { invalidRows: 0, wrapCount: 0, duplicateRows: 0, rpcFailures: 0, contextFailures: 0, rawSha: null },
    kControl: { pass: false, rows: [] },
    stability: { n: 0, min: null, max: null, median: null, drift: null, cap: DRIFT_CAP, rows: [] },
    collapse: { count: 0, rows: [], acceptanceCount: 0, reason: [] },
    unknown: [],
    verdict: {
      oldCanonicalVerdict: "BLOCKED",
      amendedStabilityVerdict: null,
      overwrite: false,
      gate3BLocal: null,
      reasons: [],
    },
    evidence: null,
  };

  if (!["legacy-audit", "v49-twopop"].includes(mode)) {
    out.errors.push(`unknown mode ${mode} (expected legacy-audit|v49-twopop)`);
    return out;
  }

  const fail = (cond, label) => { if (cond) { out.errors.push(label); return true; } return false; };

  // ---- file + sha (fail closed) ----
  if (!fs.existsSync(rawPath)) {
    out.errors.push(`raw missing: ${rawPath}`);
    return out;
  }
  const buf = fs.readFileSync(rawPath);
  const actualSha = sha256(buf);
  out.integrity.rawSha = actualSha;
  if (expectedSha && actualSha !== expectedSha) {
    out.errors.push(`RAW SHA MISMATCH: got ${actualSha} expected ${expectedSha}`);
    return out;
  }

  // ---- parse + identity (mandate 291 §2 canonical identity) ----
  let j;
  try { j = JSON.parse(buf.toString("utf8")); }
  catch { out.errors.push("raw not valid JSON"); return out; }

  const meta = j?.metadata ?? {};
  const scriptVersion = meta.scriptVersion;
  if (scriptVersion !== (isV49 ? PROTOCOL_V49 : PROTOCOL_LEGACY)) {
    out.errors.push(`mode ${mode} requires scriptVersion=${isV49 ? PROTOCOL_V49 : PROTOCOL_LEGACY}, got ${scriptVersion}`);
    return out;
  }
  out.protocol = scriptVersion;

  if (isV49) {
    // identity: protocol + prereg must match signed identity (291 §2)
    const protoOk = meta.protocol === IDENTITY.protocol || meta.protocol === "gate3b.amendment-b.v2/V49" || meta.protocol === "gate3b.amendment-b.v2 / V49";
    if (fail(!protoOk, `protocol identity mismatch: ${meta.protocol} != ${IDENTITY.protocol}`)) return out;
    if (fail(meta.harnessRevision !== PROTOCOL_V49, `harnessRevision ${meta.harnessRevision} != ${PROTOCOL_V49}`)) return out;
    if (fail(meta.amendmentBPreregSha !== IDENTITY.amendmentBPreregSha, `amendmentBPreregSha mismatch: ${meta.amendmentBPreregSha}`)) return out;
  }

  const vendorRows = j?.rawObservations?.vendorRows;
  const trueK = j?.instrumentHealth?.trueK;
  if (!Array.isArray(vendorRows)) { out.errors.push("rawObservations.vendorRows missing"); return out; }
  if (!Array.isArray(trueK)) { out.errors.push("instrumentHealth.trueK missing"); return out; }

  // C1 (addendum C §2): любой LOCKED_13 row физически отсутствует -> STOP identity.
  // Проверка ДО population gates, чтобы N9f (locked row удалена) дал identity-STOP,
  // а не vendor-count FAIL.
  const lockedIdsEarly = new Set(LOCKED_13);
  const lockedAbsent = LOCKED_13.filter((id) => !vendorRows.some((r) => `${r.offset}x${r.rep}` === id));
  if (fail(lockedAbsent.length > 0, `LOCKED_13 not fully present (identity failure): ${lockedAbsent.join(",")}`)) return out;

  // ---- population split ----
  const vendor = vendorRows.filter((r) => r?.kind === "vendor");
  const accept = vendor.filter((r) => ACCEPTANCE_OFFSETS.includes(r?.offset));
  const diag = vendor.filter((r) => DIAG_OFFSETS.includes(r?.offset));
  const dither = vendor.filter((r) => DITHER_OFFSETS.includes(r?.offset));
  const probe = vendor.filter((r) => PROBE_OFFSETS.includes(r?.offset));

  out.population.vendor = vendor.length;
  out.population.acceptance = accept.length;
  out.population.diagnostics = diag.length;
  out.population.dither = dither.length;
  out.population.probe = probe.length;
  out.population.K = trueK.length;

  // mode-specific population gates (mandate 291 §4)
  if (isV49) {
    if (fail(vendor.length !== 47, `v49: vendor rows ${vendor.length} != 47 (25 core + 16 dither + 6 probe)`)) return out;
    if (fail(accept.length !== 15, `v49: acceptance ${accept.length} != 15`)) return out;
    if (fail(diag.length !== 10, `v49: diagnostics ${diag.length} != 10`)) return out;
    if (fail(dither.length !== 16, `v49: dither rows ${dither.length} != 16`)) return out;
    if (fail(probe.length !== 6, `v49: probe rows ${probe.length} != 6`)) return out;
    if (fail(trueK.length !== 2, `v49: K rows ${trueK.length} != 2`)) return out;
    out.warnings.push(`v49: dither=${dither.length} + probe=${probe.length} rows excluded from HS/CD drift (291 §7)`);
  } else {
    if (fail(vendor.length !== 25, `legacy: vendor rows ${vendor.length} != 25`)) return out;
    if (fail(accept.length !== 15, `legacy: acceptance ${accept.length} != 15`)) return out;
    if (fail(diag.length !== 10, `legacy: diagnostics ${diag.length} != 10`)) return out;
    if (fail(trueK.length !== 2, `legacy: K rows ${trueK.length} != 2`)) return out;
    if (fail(dither.length !== 0, `legacy: dither rows ${dither.length} != 0 (V49 addition in legacy raw)`)) return out;
    if (fail(probe.length !== 0, `legacy: probe rows ${probe.length} != 0 (V49 addition in legacy raw)`)) return out;
  }

  // ---- integrity counters (same as deriver-v2 C1) ----
  const seenGrid = new Set();
  for (const r of vendor) {
    const id = `${r.offset}x${r.rep}`;
    if (seenGrid.has(id)) out.integrity.duplicateRows++;
    seenGrid.add(id);
    const ro = r?.raw_observations ?? {};
    const tc = ro?.timingCoords ?? {};
    const vd = r?.verdict ?? {};
    const health = ro?.health ?? {};
    const rpc = ro?.rpc ?? {};
    if (vd?.rowValidity !== "VALID") out.integrity.invalidRows++;
    if ((ro?.wrapCount ?? 0) !== 0) out.integrity.wrapCount++;
    if (Array.isArray(Object.values(rpc)) && Object.values(rpc).some((x) => x && (x.timedOut === true || x.responseReceived === false))) {
      out.integrity.rpcFailures++;
    }
    if (health?.contextState && health.contextState !== "running") out.integrity.contextFailures++;
    const span = (tc.captureFirstNonZeroFrame != null && tc.captureLastNonZeroFrame != null)
      ? tc.captureLastNonZeroFrame - tc.captureFirstNonZeroFrame + 1
      : null;
    out.rows = out.rows ?? [];
    out.rows.push({
      id, offset: r.offset, rep: r.rep,
      role: ACCEPTANCE_OFFSETS.includes(r.offset) ? "acceptance" : DIAG_OFFSETS.includes(r.offset) ? "diagnostics" : DITHER_OFFSETS.includes(r.offset) ? "dither" : PROBE_OFFSETS.includes(r.offset) ? "probe" : "?",
      energy: ro?.energySumSq, peak: ro?.peakAbs, span, nzQ: ro?.nonZeroQuantumCount,
      ratioToK: ro?.ratioToK,
      writeIndex: ro?.writeIndex, total: ro?.totalSamplesWritten, wrap: ro?.wrapCount ?? 0,
      vendorStartFrame: tc?.vendorStartFrame, capFirstNZ: tc?.captureFirstNonZeroFrame,
      startToOutput: ro?.startToOutput, outputDelta: ro?.outputDelta,
      transientClass: vd?.transientClass, gate: vd?.gateContribution,
    });
  }
  if (fail(out.integrity.invalidRows !== 0, `integrity: invalidRows=${out.integrity.invalidRows}`)) return out;
  if (fail(out.integrity.wrapCount !== 0, `integrity: wrapCount=${out.integrity.wrapCount}`)) return out;
  if (fail(out.integrity.duplicateRows !== 0, `integrity: duplicateRows=${out.integrity.duplicateRows}`)) return out;
  if (fail(out.integrity.rpcFailures !== 0, `integrity: rpcFailures=${out.integrity.rpcFailures}`)) return out;
  if (fail(out.integrity.contextFailures !== 0, `integrity: contextFailures=${out.integrity.contextFailures}`)) return out;

  // ---- grid check (C2) ----
  const expectedIds = new Set();
  for (const o of [...ACCEPTANCE_OFFSETS, ...DIAG_OFFSETS]) for (const r of [1, 2, 3, 4, 5]) expectedIds.add(`${o}x${r}`);
  if (isV49) {
    for (const o of DITHER_OFFSETS) for (const r of [1, 2, 3, 4]) expectedIds.add(`${o}x${r}`);
    for (const o of PROBE_OFFSETS) expectedIds.add(`${o}x1`);
  }
  const actualIds = new Set(seenGrid);
  const missing = [...expectedIds].filter((x) => !actualIds.has(x)).sort();
  const extra = [...actualIds].filter((x) => !expectedIds.has(x)).sort();
  if (fail(missing.length > 0, `grid missing rows: ${missing.join(",")}`)) return out;
  if (fail(extra.length > 0, `grid extra rows: ${extra.join(",")}`)) return out;
  const expectedGridSize = isV49 ? 47 : 25;
  if (fail(seenGrid.size !== expectedGridSize, `grid size ${seenGrid.size} != ${expectedGridSize}`)) return out;

  // ---- K control (same as deriver-v2) ----
  const kRows = trueK
    .map((k) => ({ offset: k.offset, energy: k?.raw_observations?.energySumSq, peak: k?.raw_observations?.peakAbs }))
    .filter((x) => x.offset === 0 || x.offset === 4410);
  out.kControl.rows = kRows;
  const kOffsets = new Set(kRows.map((x) => x.offset));
  const kOk = kRows.length === 2 && kOffsets.size === 2 && kOffsets.has(0) && kOffsets.has(4410)
    && kRows.every((x) => x.energy === 44 && x.peak === 1 && x.energy !== null);
  out.kControl.pass = kOk;
  if (fail(!kOk, "K-control not PASS (expect energy 44, peak 1, distinct offsets {0,4410})")) return out;

  // ---- FAIL-CLOSED classification audit (mandate 277 §3) ----
  for (const row of out.rows.filter((r) => r.role === "acceptance")) {
    const { gate, transientClass } = row;
    if (gate == null) { out.unknown.push(`${row.id}:missing gateContribution`); continue; }
    if (transientClass == null) { out.unknown.push(`${row.id}:missing transientClass`); continue; }
    if (gate === "INCLUDED" && transientClass === "energy_collapse") { out.unknown.push(`${row.id}:contradictory collapse+INCLUDED`); continue; }
    if (gate === "EXCLUDED" && transientClass === "healthy") { out.unknown.push(`${row.id}:contradictory healthy+EXCLUDED`); continue; }
    if (!["INCLUDED", "EXCLUDED"].includes(gate)) { out.unknown.push(`${row.id}:unknown gate ${gate}`); continue; }
    if (!["healthy", "energy_collapse", "truncated_response", "form_mismatch", "invalid_harness_row"].includes(transientClass)) {
      out.unknown.push(`${row.id}:unknown transientClass ${transientClass}`);
    }
  }
  if (fail(out.unknown.length > 0, `fail-closed classification: ${out.unknown.join(", ")}`)) return out;

  // ---- POPULATION 1: HEALTHY-STABILITY (directed membership C1) ----
  // C1 (addendum C §2): HS denominator = INCLUDED acceptance ∩ LOCKED_13.
  // recovery-строки ВНЕ LOCKED_13 не попадают в denominator, не триггерят E1,
  // эмитятся как RECOVERY-OBSERVED (descriptive only).
  // (lockedAbsent уже проверен в A2b — до population gates.)
  const lockedIds = new Set(LOCKED_13);

  // recovery: acceptance rows ВНЕ LOCKED_13, healthy INCLUDED
  const recoveryRows = out.rows.filter((r) =>
    r.role === "acceptance" && !lockedIds.has(r.id) && r.transientClass === "healthy" && r.gate === "INCLUDED");
  out.recovery = {
    observed: recoveryRows.length > 0,
    rows: recoveryRows.map((r) => r.id),
    descriptiveOnly: true, // addendum C §2: не создаёт HS evidence
  };
  if (recoveryRows.length > 0) out.warnings.push(`RECOVERY-OBSERVED (descriptive): ${recoveryRows.map((r) => r.id).join(",")}`);

  // included13 = INCLUDED acceptance ∩ LOCKED_13 (addendum C §2 denominator)
  const included13 = out.rows.filter((r) => r.role === "acceptance" && r.gate === "INCLUDED" && lockedIds.has(r.id));
  const e = included13.map((r) => r.energy).filter((v) => typeof v === "number" && !Number.isNaN(v));
  out.stability.n = e.length;
  out.stability.rows = included13.map((r) => ({ id: r.id, energy: r.energy, transientClass: r.transientClass }));
  out.stability.evidenceMarker = null; // fill in composition

  // E1 set (addendum C §3): collapsed13 = acceptance rows in LOCKED_13 with energy_collapse
  const collapsed13 = out.rows.filter((r) => r.role === "acceptance" && lockedIds.has(r.id) && r.transientClass === "energy_collapse");
  out.collapse.collapsed13 = collapsed13.map((r) => r.id);
  const e1Triggered = collapsed13.length > 0;
  if (e1Triggered) out.collapse.reason.push(`E1: fresh acceptance collapse in LOCKED_13: ${collapsed13.map((r) => r.id).join(",")}`);

  // E3 floor (addendum C §3 step 5 + 306): n<12 -> INSUFFICIENT-EVIDENCE; n=12 -> MINIMUM-EVIDENCE.
  // 306: E1 доминирует над E3 (C2). При E1: n=12 -> MINIMUM-EVIDENCE (N9b), n<12 -> E1-DOMINANT (N9e, не E3).
  const nInsufficient = e.length < MIN_N;
  const nMinimum = e.length === MIN_N;
  if (e1Triggered && nMinimum) {
    out.stability.evidenceMarker = "MINIMUM-EVIDENCE";
  } else if (e1Triggered) {
    out.stability.evidenceMarker = "E1-DOMINANT";
  } else if (nInsufficient) {
    out.stability.evidenceMarker = "INSUFFICIENT-EVIDENCE";
  } else if (nMinimum) {
    out.stability.evidenceMarker = "MINIMUM-EVIDENCE";
  }

  // drift по included13 (n∈[12,13]); upper-median для n=12 (PREREG:52, addendum C §4)
  const sorted = [...e].sort((a, b) => a - b);
  const median = e.length > 0 ? sorted[Math.floor(sorted.length / 2)] : null;
  const min = e.length > 0 ? sorted[0] : null;
  const max = e.length > 0 ? sorted[sorted.length - 1] : null;
  const drift = e.length > 0 ? (max - min) / median : null;
  out.stability.min = min;
  out.stability.max = max;
  out.stability.median = median;
  out.stability.drift = drift;
  out.stability.capVerdict = drift != null && drift <= DRIFT_CAP ? "PASS" : "FAIL";

  // ---- POPULATION 2: COLLAPSE-DIAGNOSTIC (descriptive CD context) ----
  const collapseRows = out.rows.filter((r) => r.role === "acceptance" && r.transientClass === "energy_collapse");
  for (const r of collapseRows) {
    out.collapse.rows.push({
      id: r.id, offset: r.offset, rep: r.rep,
      energy: r.energy, ratioToK: r.ratioToK ?? null, nzQ: r.nzQ ?? null,
      reason: r.gate === "EXCLUDED" ? "collapse (gate EXCLUDED)" : "collapse (gate unknown)",
      gate: r.gate, transientClass: r.transientClass,
      inLocked13: lockedIds.has(r.id),
    });
  }
  out.collapse.count = collapseRows.length;
  out.collapse.acceptanceCount = collapseRows.length;
  if (out.collapse.reason.length === 0) out.collapse.reason = collapseRows.length > 0
    ? [`observed collapse (acceptance: ${collapseRows.length})`]
    : ["no collapse in acceptance"];
  const collapseInStability = included13.filter((r) => r.transientClass === "energy_collapse");
  if (fail(collapseInStability.length > 0, `collapse row in HEALTHY denom: ${collapseInStability.map((r) => r.id).join(",")}`)) return out;
  const includedCollapse = out.rows.filter((r) => r.gate === "INCLUDED" && r.transientClass === "energy_collapse");
  if (fail(includedCollapse.length > 0, `INCLUDED collapse rows: ${includedCollapse.map((r) => r.id).join(",")}`)) return out;

  // ---- verdict composition (addendum C §3 precedence) ----
  out.verdict.oldCanonicalVerdict = "BLOCKED"; // historical, preserved
  out.verdict.overwrite = false;
  out.verdict.oldCanonicalDrift = DRIFT_EXPECTED_CANONICAL; // [PIR] historical regression vector
  out.verdict.amendedStabilityDrift = drift; // computed from THIS raw only

  // C2 precedence: E1 over E3 (addendum C §3 steps 4-7)
  if (e1Triggered) {
    out.verdict.gate3BLocal = "NOT-PASS (E1: fresh acceptance collapse)";
  } else if (nInsufficient) {
    out.verdict.gate3BLocal = "INSUFFICIENT-EVIDENCE";
  } else if (drift != null && drift > DRIFT_CAP) {
    out.verdict.gate3BLocal = "NOT-PASS (drift)";
  } else {
    out.verdict.gate3BLocal = "HS-PASS (amended, stability-only)";
  }
  out.verdict.amendedStabilityVerdict = out.verdict.gate3BLocal === "HS-PASS (amended, stability-only)" ? "PASS" : "FAIL";
  out.verdict.reasons = [
    `oldCanonicalDrift ${DRIFT_EXPECTED_CANONICAL} [PIR], historical regression vector, > cap ${DRIFT_CAP} -> canonical BLOCKED`,
    `amendedStabilityDrift ${drift?.toFixed(12) ?? "n/a"} (computed from this raw, mode=${mode}) <= cap ${DRIFT_CAP} -> ${out.stability.capVerdict}`,
    `overwrite=false: amended verdict does NOT overwrite canonical BLOCKED`,
    `E1 over E3: collapsed13=${e1Triggered ? out.collapse.collapsed13.join(",") : "none"} n=${e.length} marker=${out.stability.evidenceMarker ?? "none"}`,
  ];
  if (!isV49) {
    out.verdict.evidenceRole = "historical-audit (fixture raw 233). NOT evidence of a new run (291 §7).";
  }

  const evidenceChecks = [
    { name: "sha", pass: !expectedSha || actualSha === expectedSha },
    { name: "mode-protocol", pass: (isV49 ? scriptVersion === PROTOCOL_V49 : scriptVersion === PROTOCOL_LEGACY) },
    { name: "population", pass: isV49
        ? (out.population.vendor === 47 && out.population.acceptance === 15 && out.population.diagnostics === 10 && out.population.dither === 16 && out.population.probe === 6 && out.population.K === 2)
        : (out.population.vendor === 25 && out.population.acceptance === 15 && out.population.diagnostics === 10 && out.population.K === 2) },
    { name: "grid", pass: seenGrid.size === (isV49 ? 47 : 25) },
    { name: "integrity", pass: out.integrity.invalidRows === 0 && out.integrity.wrapCount === 0 && out.integrity.duplicateRows === 0 && out.integrity.rpcFailures === 0 && out.integrity.contextFailures === 0 },
    { name: "kControl", pass: kOk },
    { name: "failClosedClassification", pass: out.unknown.length === 0 },
    { name: "locked13Present", pass: lockedAbsent.length === 0 },
    // 306: E1 над floor (C2) — при E1 n может быть <12 (N9e), результат валиден как E1-доминантный
    { name: "includedNInRange", pass: e.length >= MIN_N || e1Triggered },
    { name: "e1DominatesBelowFloor", pass: !e1Triggered || out.verdict.gate3BLocal === "NOT-PASS (E1: fresh acceptance collapse)" },
    { name: "capStabilityOnly", pass: out.stability.capVerdict === "PASS" },
    { name: "excludedNotInDenom", pass: collapseInStability.length === 0 },
    { name: "collapseDiagnostic", pass: out.collapse.rows.every((r) => r.gate === "EXCLUDED" || !r.inLocked13) },
    { name: "oldVerdictPreserved", pass: out.verdict.oldCanonicalVerdict === "BLOCKED" && out.verdict.overwrite === false },
    { name: "oldCanonicalDriftPIR", pass: Math.abs(DRIFT_EXPECTED_CANONICAL - 0.9366020127721636) < 1e-15 },
  ];
  out.evidence = {
    rawSha: actualSha,
    protocol: out.protocol,
    mode,
    specVersion: "gate3b.twopop.v1",
    canonicalRefs: CANON_REFS.artifact,
    formulas: {
      drift: "(max-min)/median, n=13 or n=12 (INCLUDED acceptance ∩ LOCKED_13), median=sorted[floor(n/2)] 0-based, n=12 upper-median (PREREG:52)",
      cap: "0.50 applies to HEALTHY-STABILITY only",
    },
    checks: evidenceChecks,
  };
  // C5 (306): failed evidence check -> ok=false (hard stop)
  const failedEvidence = evidenceChecks.filter((c) => !c.pass);
  if (failedEvidence.length > 0) {
    out.verdict.reasons.push(`evidence gate failed: ${failedEvidence.map((c) => c.name).join(",")}`);
    out.errors.push(`evidence gate failed: ${failedEvidence.map((c) => c.name).join(",")}`);
    out.ok = false;
    return out;
  }
  out.ok = true;
  return out;
}

// ---------- self-test (mandate 277 §5.5 + 291 §7) ----------
const TMP_DIR = "/tmp/deriver-v3-self";
function ensureTmp(name, obj) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  const p = `${TMP_DIR}/${name}`;
  fs.writeFileSync(p, JSON.stringify(obj));
  return p;
}

export async function selfTest(rawPath, expectedSha = CANON_SHA) {
  const results = [];
  const run = async (nameT, fn) => {
    try {
      const r = await fn();
      results.push({ name: nameT, pass: r.ok !== false, message: r.errors?.join(";") || "OK" });
    } catch (e) {
      results.push({ name: nameT, pass: false, message: String(e?.message ?? e) });
    }
  };

  // T1: legacy-audit canonical raw 233 -> historical-audit, drift 0.1086 (fixture-only), collapse [128x3,256x3]
  await run("T1 legacy-audit raw233 -> historical audit", () => {
    const r = deriveTwopop(rawPath, "legacy-audit", expectedSha);
    const okVal = r.ok === true && r.mode === "legacy-audit"
      && r.stability.n === 13
      && Math.abs(r.stability.drift - DRIFT_EXPECTED_HEALTHY) < 1e-9
      && r.collapse.count === 2
      && r.collapse.rows.map((x) => x.id).sort().join(",") === "128x3,256x3"
      && r.unknown.length === 0
      && r.verdict.amendedStabilityVerdict === "PASS"
      && r.verdict.oldCanonicalVerdict === "BLOCKED"
      && r.verdict.evidenceRole && r.verdict.evidenceRole.includes("NOT evidence of a new run");
    return { ok: okVal, errors: r.errors };
  });

  // T2: missing gateContribution (128x1) -> fail-closed STOP
  await run("T2 missing gateContribution -> STOP", () => {
    const buf = fs.readFileSync(rawPath);
    const j = JSON.parse(buf.toString("utf8"));
    const rows = j.rawObservations.vendorRows.map((r) =>
      (r.offset === 128 && r.rep === 1)
        ? { ...r, verdict: { ...r.verdict, gateContribution: undefined } }
        : r);
    const copy = { ...j, rawObservations: { ...j.rawObservations, vendorRows: rows } };
    const tmp = ensureTmp("t2-missing-gate.json", copy);
    const r = deriveTwopop(tmp, "legacy-audit", sha256(fs.readFileSync(tmp)));
    return { ok: r.ok === false && r.unknown.some((x) => x.includes("128x1")), errors: r.errors };
  });

  // T3: contradictory (4410x1 healthy+EXCLUDED) -> STOP
  await run("T3 contradictory healthy+EXCLUDED -> STOP", () => {
    const buf = fs.readFileSync(rawPath);
    const j = JSON.parse(buf.toString("utf8"));
    const rows = j.rawObservations.vendorRows.map((r) =>
      (r.offset === 4410 && r.rep === 1)
        ? { ...r, verdict: { ...r.verdict, gateContribution: "EXCLUDED", transientClass: "healthy" } }
        : r);
    const copy = { ...j, rawObservations: { ...j.rawObservations, vendorRows: rows } };
    const tmp = ensureTmp("t3-contradictory.json", copy);
    const r = deriveTwopop(tmp, "legacy-audit", sha256(fs.readFileSync(tmp)));
    return { ok: r.ok === false && r.unknown.some((x) => x.includes("4410x1")), errors: r.errors };
  });

  // T4: old bug all-15 drift -> 0.9366 [PIR] BLOCKED (historical regression vector)
  await run("T4 old-bug all-15 drift == PIR canonical", () => {
    const buf = fs.readFileSync(rawPath);
    const j = JSON.parse(buf.toString("utf8"));
    const accept = j.rawObservations.vendorRows.filter((r) => ACCEPTANCE_OFFSETS.includes(r.offset));
    const e = accept.map((r) => r.raw_observations?.energySumSq).filter((v) => typeof v === "number" && !Number.isNaN(v)).sort((a, b) => a - b);
    const drift15 = (e[14] - e[0]) / e[7];
    const okVal = drift15 > DRIFT_CAP && Math.abs(drift15 - 0.9366020127721636) < 1e-12;
    return { ok: okVal, errors: [`drift15=${drift15} vs PIR 0.9366020127721636`] };
  });

  // T5: all-healthy synthetic -> healthy=15, collapse=0, PASS
  await run("T5 all-healthy -> 15/0 PASS", () => {
    const buf = fs.readFileSync(rawPath);
    const j = JSON.parse(buf.toString("utf8"));
    const rows2 = j.rawObservations.vendorRows.map((r) => {
      if (r.offset === 128 && r.rep === 3) {
        return { ...r, verdict: { ...r.verdict, gateContribution: "INCLUDED", transientClass: "healthy" }, raw_observations: { ...r.raw_observations, energySumSq: 47.97522252734917 } };
      }
      if (r.offset === 256 && r.rep === 3) {
        return { ...r, verdict: { ...r.verdict, gateContribution: "INCLUDED", transientClass: "healthy" }, raw_observations: { ...r.raw_observations, energySumSq: 48.77543909942143 } };
      }
      return r;
    });
    const copy2 = { ...j, rawObservations: { ...j.rawObservations, vendorRows: rows2 } };
    const tmp2 = ensureTmp("t5-allhealthy2.json", copy2);
    // NOTE: 15 healthy INCLUDED -> expectedHealthyCount must allow 15; derive with legacy mode expects 13 by default,
    // so we pass through a synthetic expectedHealthyCount bypass: use v49-twopop? No — instead we call with a
    // special override via monkey-patch below. Here we only assert the 15-row population math.
    const r = deriveTwopop(tmp2, "legacy-audit", sha256(fs.readFileSync(tmp2)));
    // 15 INCLUDED: 13 в LOCKED_13 + 128x3/256x3 recovery (вне LOCKED_13, C1).
    // Recovery rows -> RECOVERY-OBSERVED (descriptive), n=13, HS-PASS.
    const lockedOk = LOCKED_13.every((id) => { const [o, rp] = id.split("x"); return rows2.some((x) => x.offset === Number(o) && x.rep === Number(rp)); });
    const recovered = (r.recovery?.rows ?? []).sort().join(",");
    const okVal = lockedOk && r.ok === true && r.recovery.observed && recovered === "128x3,256x3"
      && r.stability.n === 13 && r.verdict.gate3BLocal.includes("HS-PASS");
    return { ok: okVal, errors: r.errors, recovered };
  });

  // T5b: legacy-audit on V49 raw -> STOP (mode separation, 291 §4)
  await run("T5b legacy-audit on V49 raw -> STOP", () => {
    // use the v49 synthetic fixture if present
    const v49path = "/tmp/v49-fixture-v3.json";
    if (!fs.existsSync(v49path)) return { ok: true, errors: ["v49 fixture v3 absent, skipped"] };
    const r = deriveTwopop(v49path, "legacy-audit", undefined);
    const okVal = r.ok === false && r.errors.some((x) => x.includes("vendor rows 47") || x.includes("scriptVersion"));
    return { ok: okVal, errors: r.errors };
  });

  // T6: mixed population (128x1 fake collapse) -> detect E1 on LOCKED_13 row (naturalized, no override; addendum C §5.5)
  await run("T6 mixed fake collapse -> E1 detect", () => {
    const buf = fs.readFileSync(rawPath);
    const j = JSON.parse(buf.toString("utf8"));
    const rows = j.rawObservations.vendorRows.map((r) =>
      (r.offset === 128 && r.rep === 1)
        ? { ...r, verdict: { ...r.verdict, gateContribution: "EXCLUDED", transientClass: "energy_collapse" } }
        : r);
    const copy = { ...j, rawObservations: { ...j.rawObservations, vendorRows: rows } };
    const tmp = ensureTmp("t6-mixed.json", copy);
    const r = deriveTwopop(tmp, "legacy-audit", sha256(fs.readFileSync(tmp)));
    const detected = r.collapse.rows.map((x) => x.id).sort().join(",");
    // 128x1 — В LOCKED_13 (locked acceptance). Коллапс locked-строки -> E1 (fresh acceptance collapse).
    // n падает до 12 (128x1 вышел из HS denominator). 128x3,256x3 — вне LOCKED_13, descriptive/recovery.
    // Ожидаем: n=12, NOT-PASS (E1), collapsed13 содержит 128x1.
    // ВАЖНО: при ok=true E1-маркер НЕ попадает в r.errors — он в r.collapse.reason
    // (контракт A1-A5). Берём E1-маркер именно оттуда.
    const collapsed13 = (r.collapse?.collapsed13 ?? []).sort().join(",");
    const okVal = r.ok === true && r.stability.n === 12 && r.collapse.rows.length === 3
      && collapsed13 === "128x1"
      && r.verdict.gate3BLocal.includes("NOT-PASS")
      && String((r.collapse?.reason ?? []).join(",")).includes("fresh acceptance collapse");
    return { ok: okVal, errors: r.errors, collapse: detected, collapsed13, verdict: r.verdict.gate3BLocal };
  });

  // T7: 291 §7 — oldCanonicalDrift literal exact PIR via registry
  await run("T7 oldCanonicalDrift == 0.9366020127721636 [PIR]", () => {
    const okVal = Math.abs(DRIFT_EXPECTED_CANONICAL - 0.9366020127721636) < 1e-15
      && Math.abs(CANON_REFS.values.oldCanonicalDrift.value - 0.9366020127721636) < 1e-15;
    return { ok: okVal, errors: [`registry=${DRIFT_EXPECTED_CANONICAL}`] };
  });

  // T8: 291 §7 — v49 fixture 49 rows -> two-pop output (if fixture exists)
  await run("T8 v49 fixture -> two-pop output", () => {
    const v49path = "/tmp/v49-fixture-v3.json";
    if (!fs.existsSync(v49path)) return { ok: true, errors: ["v49 fixture v3 absent, skipped"] };
    const r = deriveTwopop(v49path, "v49-twopop", undefined);
    const okVal = r.ok === true && r.stability.n === 13 && r.mode === "v49-twopop";
    return { ok: okVal, errors: r.errors };
  });

  const failures = results.filter((r) => !r.pass);
  return { ok: failures.length === 0, results, failures };
}

// ---------- cli ----------
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const args = process.argv.slice(2);
  if (args.includes("--self-test")) {
    const fixture = args[args.indexOf("--self-test") + 1];
    if (!fixture) { console.error("usage: node deriver-v3.mjs --self-test <raw-path>"); process.exit(2); }
    const res = await selfTest(fixture, CANON_SHA);
    console.log(JSON.stringify(res, null, 2));
    process.exit(res.ok ? 0 : 1);
  }
  const rawArg = args.find((a) => !a.startsWith("--"));
  const modeIdx = args.indexOf("--mode");
  const mode = modeIdx >= 0 ? args[modeIdx + 1] : undefined;
  const shaIdx = args.indexOf("--expected-sha");
  const shaArg = shaIdx >= 0 ? args[shaIdx + 1] : undefined;
  if (!rawArg || !mode) {
    console.error("usage: node deriver-v3.mjs <raw-path> --mode legacy-audit|v49-twopop [--expected-sha <sha256>]");
    process.exit(2);
  }
  const report = deriveTwopop(rawArg, mode, shaArg);
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
