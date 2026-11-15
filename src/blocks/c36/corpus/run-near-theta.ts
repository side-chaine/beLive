// @ts-nocheck
// BL-050-full · θ-КАЛИБРОВКА (node-only CLI, не часть app-сборки).
//
// Гоняет near-train на ЖИВОМ LRC-кэше 645 треков при θ = 0.75 / 0.80 / 0.85.
// Кэш уже прогрет BL-048 → прогон офлайн-воспроизводим и дешёв.
//
// Запуск: npx tsx src/blocks/c36/corpus/run-near-theta.ts

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type CacheStore,
  type TrackSpec,
} from './square-corpus';
import { runNearCalibration, type NearThetaStat } from './near-calibration';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, '.cache');
const RESULTS_DIR = join(__dirname, 'results');
const TRACKS_FILE = join(__dirname, 'tracks.json');

function fsCache(): CacheStore {
  if (!existsSync(CACHE_DIR)) { mkdirSync(CACHE_DIR, { recursive: true }); }
  return {
    get: (k) => {
      const p = join(CACHE_DIR, k + '.json');
      return existsSync(p) ? readFileSync(p, 'utf8') : null;
    },
    set: (k, v) => { writeFileSync(join(CACHE_DIR, k + '.json'), v, 'utf8'); },
  };
}

function printTheta(st: NearThetaStat) {
  console.log(`\n=== θ = ${st.theta.toFixed(2)} ===`);
  console.log(`  hits:          ${st.hits}`);
  console.log(`  exactAlso:     ${st.exactAlso}  (near избыточен — exact уже дал тот же split)`);
  console.log(`  nearOnly:      ${st.nearOnly}  (расширение: exact не сработал)`);
  console.log(`    strongAnchor: ${st.strongAnchor}  (exactRatio > 0.5)`);
  console.log(`    weakAnchor:   ${st.weakAnchor}  (exactRatio == 0.5 — минимум допуска)`);
  console.log(`  guard-rejected: tail-giant ${st.tailGiantRejected}, roman-cap ${st.romanCapRejected}`);
  console.log(`  SURVIVING:     ${st.surviving}  (strong ${st.survivingStrong} / weak ${st.survivingWeak})`);
  console.log(`  by groupSize:  ${JSON.stringify(st.byGroupSize)}`);
  console.log(`  by split:      ${JSON.stringify(st.bySplit)}`);
  const topTracks = Object.entries(st.perTrack).sort((a, b) => b[1] - a[1]).slice(0, 8);
  console.log(`  top tracks:    ${topTracks.map(([k, v]) => `${k}(${v})`).join(' | ') || '—'}`);
}

async function main() {
  const specs: TrackSpec[] = JSON.parse(readFileSync(TRACKS_FILE, 'utf8'));
  const cache = fsCache();
  console.log(`[near] tracks in list: ${specs.length}`);

  const report = await runNearCalibration(specs, cache, {
    thetas: [0.75, 0.8, 0.85],
    minSize: 6,
    maxSize: 20,
    step: 1,
    maxSamples: 12,
  });

  // Контр-гипотеза: строгий majority-якорь (exact > g/2) при θ=0.80.
  const strict = await runNearCalibration(specs, cache, {
    thetas: [0.8],
    strictAnchor: true,
    minSize: 6,
    maxSize: 20,
    step: 1,
    maxSamples: 12,
  });

  if (!existsSync(RESULTS_DIR)) { mkdirSync(RESULTS_DIR, { recursive: true }); }
  // Один артефакт: прогон воспроизводим из кэша, таймстемп-копии не нужны.
  const out = { loose: report, strict };
  writeFileSync(join(RESULTS_DIR, 'latest-near-theta.json'), JSON.stringify(out, null, 2), 'utf8');

  console.log(`\ntracks ok/fail: ${report.meta.tracksOk}/${report.meta.tracksFailed}`);
  console.log('\n########## LOOSE ANCHOR (exact >= ceil(g/2)) ##########');
  for (const st of report.byTheta) { printTheta(st); }
  console.log('\n########## STRICT ANCHOR (exact > g/2) ##########');
  for (const st of strict.byTheta) { printTheta(st); }

  // Сэмплы nearOnly при θ=0.80 — глазами проверить «это квадрат?».
  const base = report.byTheta.find((s) => Math.abs(s.theta - 0.8) < 1e-9);
  if (base) {
    console.log('\n=== SAMPLES θ=0.80 · nearOnly (первые 12) ===');
    for (const s of base.samples.slice(0, 12)) {
      console.log(`\n[${s.track}] win=${s.start}+${s.size} g=${s.groupSize} k=${s.copies} exact=${s.exactRatio.toFixed(2)} split=[${s.split}]`);
      s.lines.forEach((l, i) => console.log(`   ${String(i).padStart(2)} ${l}`));
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
