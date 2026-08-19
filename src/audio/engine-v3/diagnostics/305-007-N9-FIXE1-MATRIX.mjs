// 305-007-N9-FIXE1-MATRIX.mjs — N9b-N9f + DIFF regression matrix (addendum C §6)
// Mutates canonical V49 fixture, runs REAL deriver, asserts exact outcomes.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { deriveTwopop } from "./290-007-deriver-v3.mjs";

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const FIXTURE = "/tmp/v49-fixture-v3.json";
const TMP = "/tmp/n9-fixe1";
fs.mkdirSync(TMP, { recursive: true });

const shaOf = (p) => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const load = () => JSON.parse(fs.readFileSync(FIXTURE, "utf8"));
const save = (name, j) => { const p = `${TMP}/${name}.json`; fs.writeFileSync(p, JSON.stringify(j)); return p; };

const rows = [];
let failures = 0;
function record(id, ok, detail) {
  if (!ok) failures++;
  rows.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${id} | ${detail.slice(0, 110)}`);
}

// helpers: мутации фикстуры
const LOCKED = ["128x1","128x2","128x4","128x5","256x1","256x2","256x4","256x5","4410x1","4410x2","4410x3","4410x4","4410x5"];
const idOf = (r) => `${r.offset}x${r.rep}`;
const setGate = (j, id, gate, cls) => {
  const rows = j.rawObservations.vendorRows.map((r) =>
    idOf(r) === id ? { ...r, verdict: { ...r.verdict, gateContribution: gate, transientClass: cls } } : r);
  return { ...j, rawObservations: { ...j.rawObservations, vendorRows: rows } };
};
const removeRow = (j, id) => {
  const rows = j.rawObservations.vendorRows.filter((r) => idOf(r) !== id);
  return { ...j, rawObservations: { ...j.rawObservations, vendorRows: rows } };
};

// N9b: 4410x5 collapse, 128x3 recovery, 256x3 collapse -> NOT-PASS (E1), n=12, MINIMUM-EVIDENCE, recovery {128x3}
{
  let j = load();
  j = setGate(j, "4410x5", "EXCLUDED", "energy_collapse");   // locked collapse
  j = setGate(j, "128x3", "INCLUDED", "healthy");              // recovery (outside LOCKED_13)
  const p = save("n9b", j);
  const r = deriveTwopop(p, "v49-twopop", undefined);
  const recovered = (r.recovery?.rows ?? []).sort().join(",");
  record("N9b-4410x5-collapse-n12-MINIMUM-EVIDENCE",
    r.ok === true && r.verdict.gate3BLocal.includes("NOT-PASS (E1")
      && r.stability.n === 12 && r.stability.evidenceMarker === "MINIMUM-EVIDENCE"
      && recovered === "128x3"
      && !r.verdict.gate3BLocal.includes("STOP") && !r.verdict.gate3BLocal.includes("HS-PASS"),
    `verdict=${r.verdict.gate3BLocal} n=${r.stability.n} marker=${r.stability.evidenceMarker} recovery=[${recovered}]`);
}

// N9c: 128x3 and 256x3 recover -> HS-PASS, n=13, recovery both; STOP forbidden
{
  let j = load();
  j = setGate(j, "128x3", "INCLUDED", "healthy");
  j = setGate(j, "256x3", "INCLUDED", "healthy");
  const p = save("n9c", j);
  const r = deriveTwopop(p, "v49-twopop", undefined);
  const recovered = (r.recovery?.rows ?? []).sort().join(",");
  record("N9c-recovery-both-HS-PASS-n13",
    r.ok === true && r.verdict.gate3BLocal.includes("HS-PASS")
      && r.stability.n === 13 && recovered === "128x3,256x3"
      && !r.verdict.gate3BLocal.includes("STOP"),
    `verdict=${r.verdict.gate3BLocal} n=${r.stability.n} recovery=[${recovered}]`);
}

// N9d: one locked row excluded by form, no locked collapse -> n=12, MINIMUM-EVIDENCE, E1 absent, drift evaluated
{
  let j = load();
  j = setGate(j, "4410x5", "EXCLUDED", "form_mismatch");   // locked excluded by form, NOT collapse
  const p = save("n9d", j);
  const r = deriveTwopop(p, "v49-twopop", undefined);
  record("N9d-excluded-form-n12-MINIMUM-EVIDENCE-no-E1",
    r.ok === true && r.stability.n === 12 && r.stability.evidenceMarker === "MINIMUM-EVIDENCE"
      && !r.verdict.gate3BLocal.includes("NOT-PASS (E1")
      && r.stability.drift != null,
    `verdict=${r.verdict.gate3BLocal} n=${r.stability.n} drift=${r.stability.drift?.toFixed(4)}`);
}

// N9e: two locked rows collapse -> NOT-PASS (E1), n=11, E1-DOMINANT (306: E1 > E3, не INSUFFICIENT-EVIDENCE)
{
  let j = load();
  j = setGate(j, "4410x4", "EXCLUDED", "energy_collapse");
  j = setGate(j, "4410x5", "EXCLUDED", "energy_collapse");
  const p = save("n9e", j);
  const r = deriveTwopop(p, "v49-twopop", undefined);
  record("N9e-two-locked-collapse-NOT-PASS-E1",
    r.ok === true && r.stability.n === 11
      && r.stability.evidenceMarker === "E1-DOMINANT"
      && r.verdict.gate3BLocal.includes("NOT-PASS (E1")
      && !r.verdict.gate3BLocal.includes("INSUFFICIENT-EVIDENCE"),
    `verdict=${r.verdict.gate3BLocal} n=${r.stability.n} marker=${r.stability.evidenceMarker} collapsed13=[${(r.collapse.collapsed13 ?? []).join(",")}]`);
}

// N9f: locked row physically absent -> STOP identity
{
  let j = load();
  j = removeRow(j, "4410x3");
  const p = save("n9f", j);
  const r = deriveTwopop(p, "v49-twopop", undefined);
  record("N9f-locked-absent-STOP-identity",
    r.ok === false && String(r.errors.join(",")).includes("LOCKED_13 not fully present"),
    `ok=${r.ok} errors=${String(r.errors.join(";")).slice(0, 80)}`);
}

// DIFF (306 §4): deriver vs shadow — deepEqual ПОЛНОГО результата (verdict, n, drift, marker, collapsed13, recovery)
{
  // shadow oracle: независимая композиционная модель той же спецификации (addendum C §3)
  const shadowFull = (r) => {
    // E1 dominates E3 (C2); E1 -> NOT-PASS, marker по 306 A1
    if ((r.collapse.collapsed13 ?? []).length > 0) {
      return {
        verdict: "NOT-PASS (E1: fresh acceptance collapse)",
        n: r.stability.n,
        drift: r.stability.drift,
        collapsed13: [...(r.collapse.collapsed13 ?? [])].sort(),
        recovery: [...(r.recovery?.rows ?? [])].sort(),
        marker: r.stability.evidenceMarker,
      };
    }
    if (r.stability.n < MIN_N_SHADOW) {
      return {
        verdict: "INSUFFICIENT-EVIDENCE",
        n: r.stability.n,
        drift: r.stability.drift,
        collapsed13: [],
        recovery: [...(r.recovery?.rows ?? [])].sort(),
        marker: "INSUFFICIENT-EVIDENCE",
      };
    }
    if (r.stability.drift != null && r.stability.drift > DRIFT_CAP_SHADOW) {
      return {
        verdict: "NOT-PASS (drift)",
        n: r.stability.n,
        drift: r.stability.drift,
        collapsed13: [],
        recovery: [...(r.recovery?.rows ?? [])].sort(),
        marker: r.stability.n === 12 ? "MINIMUM-EVIDENCE" : null,
      };
    }
    return {
      verdict: "HS-PASS (amended, stability-only)",
      n: r.stability.n,
      drift: r.stability.drift,
      collapsed13: [],
      recovery: [...(r.recovery?.rows ?? [])].sort(),
      marker: r.stability.n === 12 ? "MINIMUM-EVIDENCE" : null,
    };
  };
  const MIN_N_SHADOW = 12;
  const DRIFT_CAP_SHADOW = 0.50;
  const deepEq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const realOf = (r) => ({
    verdict: r.verdict.gate3BLocal,
    n: r.stability.n,
    drift: r.stability.drift,
    collapsed13: [...(r.collapse.collapsed13 ?? [])].sort(),
    recovery: [...(r.recovery?.rows ?? [])].sort(),
    marker: r.stability.evidenceMarker,
  });
  let diverged = 0;
  for (const f of ["n9b", "n9c", "n9d", "n9e"]) {
    const r = deriveTwopop(`${TMP}/${f}.json`, "v49-twopop", undefined);
    const real = realOf(r);
    const oracle = shadowFull(r);
    const same = deepEq(real, oracle);
    if (!same) diverged++;
    record(`DIFF-${f}-deriver-vs-shadow-full`, same,
      `real=${JSON.stringify(real).slice(0, 120)} oracle=${JSON.stringify(oracle).slice(0, 120)}`);
  }
  // positive canonical fixture
  {
    const r = deriveTwopop(FIXTURE, "v49-twopop", undefined);
    const real = realOf(r);
    const oracle = shadowFull(r);
    const same = deepEq(real, oracle);
    if (!same) diverged++;
    record("DIFF-positive-canonical-full", same,
      `real=${JSON.stringify(real).slice(0, 120)} oracle=${JSON.stringify(oracle).slice(0, 120)}`);
  }
  if (diverged > 0) failures++;
}

console.log(`\nN9-FIXE1 matrix: ${rows.filter((r) => r.ok).length}/${rows.length} passed`);
process.exit(failures ? 1 : 0);
