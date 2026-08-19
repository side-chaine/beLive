#!/usr/bin/env node
/**
 * 289-007-GATEKEEPER-B2.mjs — schema handshake против CORRECTED runner (V49)
 * ---------------------------------------------------------------------------
 * Мандат 288 §4 B2. Проверяет raw НОВОГО прогона (не legacy 233):
 *   1. v2-allowlist (переиспользует validateAllowlist из 279)
 *   2. V49 inventory match: ровно 49 строк, offsets/roles/reps == frozen V49
 *   3. K-строки {0,4410} валидны (controlPass по 232-U5)
 *   4. Исполняющая машина = CORRECTED runner (metadata scriptVersion == v6.4-v49)
 *      + prereg SHA в metadata == подписанный prereg (288)
 *
 * Fail-closed: любое несоответствие -> STOP, exit 1. НЕ вызывает deriver.
 * Usage: node 289-007-GATEKEEPER-B2.mjs <raw-path> [--strict-version]
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { validateAllowlist } from "./279-007-SELFTEST-RUNNER.mjs";

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const EXIT_OK = 0, EXIT_STOP = 1;

// ---- Frozen V49 inventory (из 286-007-V49-INVENTORY.json, verified T-32.5) ----
const V49_INV = JSON.parse(fs.readFileSync(path.join(ROOT, "286-007-V49-INVENTORY.json"), "utf8"));
const V49_IDS = new Set(V49_INV.v49);
const EXPECTED_REP_BY_OFFSET = new Map();
for (const id of V49_INV.v49) {
  const [offStr, repStr] = id.split("x");
  if (repStr === "K") continue;
  const off = Number(offStr);
  const rep = Number(repStr);
  if (!EXPECTED_REP_BY_OFFSET.has(off)) EXPECTED_REP_BY_OFFSET.set(off, new Set());
  EXPECTED_REP_BY_OFFSET.get(off).add(rep);
}
const EXPECTED_K = new Set(["K0", "K4410"]);
const PREREG_SHA = V49_INV.preregSha || null; // может быть null до сборки runner'а

export function runGatekeeperB2(rawPath, { strictVersion = true, expectedScriptVersion = "v6.4-v49" } = {}) {
  const buf = fs.readFileSync(rawPath);
  const rawSha = crypto.createHash("sha256").update(buf).digest("hex");
  let j;
  try { j = JSON.parse(buf.toString("utf8")); }
  catch { return { ok: false, reason: "invalid JSON", rawSha, exit: EXIT_STOP }; }

  // ---- 1. v2-allowlist ----
  const gk = validateAllowlist(j);
  if (!gk.ok || (gk.rejections?.length ?? 0) > 0) {
    return {
      ok: false, reason: "allowlist rejection", rawSha,
      rejections: gk.rejections?.slice(0, 8), errors: gk.errors?.slice(0, 4), exit: EXIT_STOP
    };
  }

  // ---- 2. исполняющая машина = corrected runner ----
  const meta = j.metadata || {};
  const scriptVersion = meta.scriptVersion;
  if (strictVersion && scriptVersion !== expectedScriptVersion) {
    return { ok: false, reason: `wrong runner: ${scriptVersion} != ${expectedScriptVersion}`, rawSha, exit: EXIT_STOP };
  }
  // 291 §3.1: harnessRevision === scriptVersion (canonical identity)
  if (strictVersion && meta.harnessRevision !== scriptVersion) {
    return { ok: false, reason: `harnessRevision mismatch: ${meta.harnessRevision} != ${scriptVersion}`, rawSha, exit: EXIT_STOP };
  }
  // 291 §2: protocol === canonical 'gate3b.amendment-b.v2 / V49'
  if (strictVersion && meta.protocol !== "gate3b.amendment-b.v2 / V49") {
    return { ok: false, reason: `protocol mismatch: ${meta.protocol}`, rawSha, exit: EXIT_STOP };
  }
  if (PREREG_SHA && meta.amendmentBPreregSha !== PREREG_SHA) {
    return { ok: false, reason: `prereg sha mismatch: ${meta.amendmentBPreregSha}`, rawSha, exit: EXIT_STOP };
  }

  // ---- 3. V49 inventory match (строки + offsets + reps) ----
  // NOTE: K-строки эмитятся runner'ом в instrumentHealth.trueK (kind='K'),
  // НЕ в rawObservations.vendorRows (v6.27:375-381). Inventory match читает их оттуда.
  const rows = j.rawObservations?.vendorRows ?? [];
  const observed = new Map(); // id -> {gate, trans}
  for (const r of rows) {
    const id = r.kind === "K" ? `K${r.offset}` : `${r.offset}x${r.rep}`;
    observed.set(id, { gate: r.verdict?.gateContribution, trans: r.verdict?.transientClass });
  }
  for (const k of (j.instrumentHealth?.trueK ?? [])) {
    const id = k.kind === "K" ? `K${k.offset}` : `${k.offset}x${k.rep}`;
    if (!observed.has(id)) {
      observed.set(id, { gate: k.verdict?.gateContribution, trans: k.verdict?.transientClass });
    }
  }
  const missing = [...V49_IDS].filter((id) => !observed.has(id));
  const extra = [...observed.keys()].filter((id) => !V49_IDS.has(id));
  if (missing.length || extra.length) {
    return {
      ok: false, reason: `V49 inventory mismatch`, rawSha,
      missing: missing.slice(0, 8), extra: extra.slice(0, 8), exit: EXIT_STOP
    };
  }
  // K-строки валидны
  const kRows = (j.instrumentHealth?.trueK ?? []).filter((k) => [0, 4410].includes(k.offset));
  const kOffsets = new Set(kRows.map((k) => k.offset));
  const kValid = kRows.every((k) => k.verdict?.rowValidity === "VALID");
  // addendum C §5.7: EXACTLY two K rows, in addition to distinct offsets {0,4410}
  if (kRows.length !== 2 || kOffsets.size !== 2 || !kOffsets.has(0) || !kOffsets.has(4410) || !kValid) {
    return { ok: false, reason: "K-control invalid (need exactly 2 K rows, offsets {0,4410})", rawSha, kRows: kRows.length, kOffsets: [...kOffsets], kValid, exit: EXIT_STOP };
  }

  return {
    ok: true, reason: "B2 schema handshake PASS", rawSha,
    rows: rows.length, v49Expected: V49_IDS.size,
    kValid, kOffsets: [...kOffsets].sort((a, b) => a - b),
    scriptVersion, exit: EXIT_OK
  };
}

// ---- CLI ----
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const target = process.argv[2];
  if (!target) { console.error("usage: node 289-007-GATEKEEPER-B2.mjs <raw-path>"); process.exit(2); }
  const res = runGatekeeperB2(target, { strictVersion: process.argv.includes("--strict-version") });
  console.log(JSON.stringify(res, null, 2));
  process.exit(res.exit);
}
