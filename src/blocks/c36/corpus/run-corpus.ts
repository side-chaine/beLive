// @ts-nocheck
// BL-048 · LIVE CORPUS RUNNER (node-only, не часть app-сборки).
//
// Гоняет square-corpus на ЖИВОМ LRC из lrclib (RUN2-метод, не симуляция).
// - Кэш на диске (.cache/*.json) — инкрементален, офлайн-воспроизводим.
// - Между треками — пауза (rate-limit lrclib), плюс retry на пустых ответах.
// - Результат — агрегат CorpusStats в results/<stage>.json + консольный дамп.
//
// Запуск:  npx tsx src/blocks/c36/corpus/run-corpus.ts
// Стейджинг (brief §12.3): ≥59 → ≥149 → ≥300 → ≥600 треков. Растёт добавлением
// треков в tracks.json; кэш делает повторные прогоны дёшевыми.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  fetchTrackLrc,
  collectSquareStats,
  summarizeWindows,
  type CacheStore,
  type CorpusStats,
  type TrackSpec,
} from './square-corpus';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, '.cache');
const RESULTS_DIR = join(__dirname, 'results');
const TRACKS_FILE = join(__dirname, 'tracks.json');

// fs-кэш: ключ -> JSON-строка LrcLine[].
function fsCache(): CacheStore {
  if (!existsSync(CACHE_DIR)) { mkdirSync(CACHE_DIR, { recursive: true }); }
  return {
    get: (k) => {
      const p = join(CACHE_DIR, k + '.json');
      return existsSync(p) ? readFileSync(p, 'utf8') : null;
    },
    set: (k, v) => {
      writeFileSync(join(CACHE_DIR, k + '.json'), v, 'utf8');
    },
  };
}

const DELAY_MS = 900; // пауза между треками (rate-limit)
const RETRIES = 3;
const RETRY_BACKOFF = 1500;

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function fetchWithRetry(spec: TrackSpec, cache: CacheStore): Promise<ReturnType<typeof fetchTrackLrc>> {
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    try {
      return await fetchTrackLrc(spec, cache);
    } catch (e) {
      lastErr = e as Error;
      if (attempt < RETRIES - 1) { await sleep(RETRY_BACKOFF * (attempt + 1)); }
    }
  }
  throw lastErr;
}

function emptyStats(): CorpusStats {
  return {
    windows: 0, byRuleDSplit: {}, byRuleDGroupSize: {}, byRuleDCopies: {}, rondoGte4: 0, rondoLt4: 0, gggKge3: 0,
    ruleDMatched: 0, echoHits: 0, unisonCollapse: 0, tailGiant: 0, anaphoraAnchor: 0, perTrack: {},
  };
}

function merge(into: CorpusStats, part: CorpusStats) {
  into.windows += part.windows;
  into.ruleDMatched += part.ruleDMatched;
  into.echoHits += part.echoHits;
  into.unisonCollapse += part.unisonCollapse;
  into.tailGiant += part.tailGiant;
  into.anaphoraAnchor += part.anaphoraAnchor;
  into.rondoGte4 += part.rondoGte4;
  into.rondoLt4 += part.rondoLt4;
  into.gggKge3 += part.gggKge3;
  for (const k of Object.keys(part.perTrack)) { into.perTrack[k] = part.perTrack[k]; }
  for (const [k, v] of Object.entries(part.byRuleDSplit)) { into.byRuleDSplit[k] = (into.byRuleDSplit[k] ?? 0) + v; }
  for (const [k, v] of Object.entries(part.byRuleDGroupSize)) { into.byRuleDGroupSize[k] = (into.byRuleDGroupSize[k] ?? 0) + v; }
  for (const [k, v] of Object.entries(part.byRuleDCopies)) { into.byRuleDCopies[k] = (into.byRuleDCopies[k] ?? 0) + v; }
}

async function main() {
  const specs: TrackSpec[] = JSON.parse(readFileSync(TRACKS_FILE, 'utf8'));
  const cache = fsCache();
  const combined = emptyStats();
  let ok = 0, fail = 0;

  console.log(`[corpus] tracks in list: ${specs.length}`);
  for (const spec of specs) {
    const key = `${spec.artist} - ${spec.track}`;
    const cacheKey = key.replace(/[^\wа-яёЁ .-]/gi, '_');
    const cachedAlready = cache.get(cacheKey) !== null;
    try {
      const lines = await fetchWithRetry(spec, cache);
      const texts = lines.map((l) => l.text);
      const stats = collectSquareStats(texts, { minSize: 6, maxSize: 20 });
      const part = summarizeWindows(stats, key);
      merge(combined, part);
      ok++;
      console.log(`[corpus] OK  ${key}  windows=${part.windows} ruleD=${part.ruleDMatched} rondo>=4=${part.rondoGte4} rondo<4=${part.rondoLt4} gggK>=3=${part.gggKge3} tailGiant=${part.tailGiant} anaphora=${part.anaphoraAnchor} unison=${part.unisonCollapse}`);
    } catch (e) {
      fail++;
      console.warn(`[corpus] FAIL ${key}: ${(e as Error).message}`);
    }
    if (!cachedAlready) { await sleep(DELAY_MS); }
  }

  if (!existsSync(RESULTS_DIR)) { mkdirSync(RESULTS_DIR, { recursive: true }); }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const out = {
    meta: {
      date: new Date().toISOString(),
      tracksInList: specs.length,
      tracksOk: ok,
      tracksFailed: fail,
      stageTarget: '≥59 (gate-1)',
      method: 'RUN2 live lrclib sliding-window 6..20',
    },
    stats: combined,
  };
  writeFileSync(join(RESULTS_DIR, `run-${stamp}.json`), JSON.stringify(out, null, 2), 'utf8');
  writeFileSync(join(RESULTS_DIR, 'latest.json'), JSON.stringify(out, null, 2), 'utf8');

  // Консольный дамп ключевых гвард-чисел.
  const s = combined;
  console.log('\n=== CORPUS AGGREGATE ===');
  console.log(`tracks ok/fail:        ${ok}/${fail} (of ${specs.length})`);
  console.log(`windows:               ${s.windows}`);
  console.log(`ruleD matched:         ${s.ruleDMatched} (${(100 * s.ruleDMatched / s.windows).toFixed(1)}%)`);
  console.log(`  by split:            ${JSON.stringify(s.byRuleDSplit)}`);
  console.log(`  by groupSize:        ${JSON.stringify(s.byRuleDGroupSize)}`);
  console.log(`rondo g>=4 (clean):    ${s.rondoGte4}`);
  console.log(`rondo g<4 (false[2,2,2,3] risk): ${s.rondoLt4}`);
  console.log(`ggg k>=3 (collapse cand): ${s.gggKge3}  (of ${s.ruleDMatched} matched)`);
  console.log(`  by copies(k):           ${JSON.stringify(s.byRuleDCopies)}`);
  console.log(`tail-giant (b>=3a):    ${s.tailGiant}`);
  console.log(`anaphora-anchor:       ${s.anaphoraAnchor}`);
  console.log(`unison-collapse:       ${s.unisonCollapse}`);
  console.log(`echo hits:             ${s.echoHits}`);
  console.log(`font-guard [6,2] cnt:  ${s.byRuleDSplit['6,2'] ?? 0}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
