#!/usr/bin/env node
// scripts/probe-bundle.mjs — CEO_1 §3: «сборка + сверка + печать ложных».
// v2 (007): сверка по SOURCemap-sources (истинные пути модулей), НЕ по basename-тексту —
// basename-эвристика v1 дала 6 ложных срабатываний на омонимах (storage/types/index).
// Требует sourcemaps: build-скрипт уже флаг --sourcemap у Опуса; иначе предупреждаем.
import { execSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const mode = process.argv.includes('--skip-build') ? 'skip-build' : 'build';

if (mode === 'build') {
  console.log('probe:bundle: building (vite build --sourcemap)...');
  try { execSync('npx vite build --sourcemap', { cwd: root, stdio: 'pipe' }); }
  catch (e) { console.error('probe:bundle: BUILD FAILED'); process.exit(1); }
}

// 1. unreachable-список из verify-reach
const reach = execSync('node scripts/verify-reach.mjs', { cwd: root, encoding: 'utf8' });
const flagged = [...reach.matchAll(/^\s{2}(\S+\.tsx?)$/gm)].map(m => m[1]);
if (flagged.length === 0) { console.error('probe:bundle: verify-reach недоступен'); process.exit(1); }

// 2. Собрать sources[] из ВСЕХ .map в dist/
const dist = join(root, 'dist');
if (!existsSync(dist)) { console.error('probe:bundle: dist/ отсутствует'); process.exit(1); }
const bundled = new Set();
let maps = 0;
(function walk(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.map')) {
      maps++;
      try {
        const j = JSON.parse(readFileSync(p, 'utf8'));
        for (const s of (j.sources || [])) {
          // sources: "../../src/foo.ts" или "../src/foo.ts" — нормализуем к src/...
          const m = String(s).match(/(?:^|\/)((?:src|js)\/[^\s]+)$/);
          if (m) bundled.add(m[1]);
        }
      } catch {}
    }
  }
})(dist);
if (maps === 0) { console.error('probe:bundle: .map-файлов нет — нужен build с --sourcemap (честный прогон, не текст)'); process.exit(1); }

// 3. Ложные флаги = flagged И в bundled (точное совпадение пути)
const falseFlags = flagged.filter(f => bundled.has(f));
const tests = flagged.filter(f => /\.(test|spec)\.tsx?$/.test(f) || /__tests__|__smoke__/.test(f));
const src = flagged.filter(f => !tests.includes(f));
console.log(`probe:bundle(v2-sourcemap): flagged=${flagged.length} (src=${src.length}, tests=${tests.length}), map-файлов=${maps}, бандл-модулей=${bundled.size}`);
console.log(`probe:bundle: ЛОЖНЫХ (flagged реально в бандле): ${falseFlags.length}`);
for (const f of falseFlags) console.log(`  🔴 FALSE-FLAG: ${f}`);
if (falseFlags.length === 0) console.log('  ✅ гейт честен в обе стороны: ни один flagged-файл не в прод-бандле');
process.exit(falseFlags.length > 0 ? 2 : 0);
